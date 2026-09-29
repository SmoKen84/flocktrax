-- Run against a database containing the migration. All fixtures roll back.
begin;
-- Isolated fixture tables let the real function execute without unrelated
-- application triggers or required columns. Use a disposable test database.
insert into public.flocks (id, date_placed) values
  ('00000000-0000-0000-0000-000000000001', '2026-09-22');
insert into public.placements (id, flock_id) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001');
insert into public.log_mortality (id, placement_id, log_date, dead_female, is_active)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000002', date '2023-01-01' + n, 1, true
from generate_series(0, 1004) n;
insert into public.log_mortality (id, placement_id, log_date, dead_female, dead_male, cull_female, cull_male, is_active)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000002', d::date, df, dm, cf, cm, active
from (values
  ('2026-09-22', 2, 0, 0, 0, true),
  ('2026-09-23', 3, 4, 2, 1, true),
  ('2026-09-24', null, null, null, null, true),
  ('2026-09-25', 100, 100, 100, 100, false),
  ('2026-09-27', 7, 8, 0, 0, true),
  ('2026-09-28', 11, 0, 0, 0, true)
) v(d, df, dm, cf, cm, active);

do $$
declare r record;
begin
  select * into strict r from public.get_mortality_window(
    array['00000000-0000-0000-0000-000000000002']::uuid[], '2026-09-23', '2026-09-27');
  assert r.opening_female = 1007, 'Opening summary must include history beyond 1,000 rows';
  assert r.total_female = 1019 and r.total_male = 13, 'Report totals must exclude later dates and inactive logs';
  assert r.period_female = 12 and r.period_male = 13, 'Inclusive period boundaries and culls';
  assert jsonb_array_length(r.days) = 3, 'Only in-range active details';
  assert r.days->1->'dead_female' = 'null'::jsonb, 'Unentered counts remain null';

  select * into strict r from public.get_mortality_window(
    array['00000000-0000-0000-0000-000000000002']::uuid[], '2026-09-23', '2026-09-27', true);
  assert r.total_female = 1030, 'Dashboard retains lifetime totals';
  assert r.first_week_female = 25 and r.first_week_male = 13, 'First week uses placement through placement + 6';
  assert r.period_female = 12, 'Period total excludes future and pre-range dates';
  assert jsonb_array_length(r.days) = 5, 'Overlapping windows must not duplicate detail';

  select * into strict r from public.get_mortality_window(
    array['00000000-0000-0000-0000-000000000003']::uuid[], '2026-09-23', '2026-09-27');
  assert r.total_female = 0 and r.opening_male = 0 and r.days = '[]'::jsonb, 'Empty placement';
  assert (select count(*) from public.get_mortality_window('{}'::uuid[], '2026-09-23', '2026-09-27')) = 0, 'Empty scope';
  begin
    perform * from public.get_mortality_window('{}'::uuid[], '2026-09-27', '2026-09-23');
    raise exception 'Reversed range accepted';
  exception when invalid_parameter_value then null;
  end;
  assert not has_function_privilege('anon', 'public.get_mortality_window(uuid[],date,date,boolean)', 'execute'), 'No anonymous access';
  assert not has_function_privilege('authenticated', 'public.get_mortality_window(uuid[],date,date,boolean)', 'execute'), 'Server-only access';
  assert has_function_privilege('service_role', 'public.get_mortality_window(uuid[],date,date,boolean)', 'execute'), 'Admin server access';
end;
$$;
rollback;
