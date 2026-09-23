-- Focused PostgreSQL harness for cancellation. Run ONLY in a disposable DB:
-- psql -v ON_ERROR_STOP=1 -f cancel_scheduled_placement_regression.sql
-- The minimal tables intentionally match the columns used by the production
-- routine; placements has active_start and has NO date_placed column.
do $$ begin
  if current_database() not like 'flocktrax_cancel_regression_%' then
    raise exception 'Use a disposable flocktrax_cancel_regression_* database';
  end if;
end $$;
begin;
create schema auth;
create function auth.uid() returns uuid language sql as 'select null::uuid';
create table public.flocks (
  id uuid primary key, date_placed date, is_active boolean default true,
  is_in_barn boolean default false, is_complete boolean default false,
  is_settled boolean default false, updated_at timestamptz, updated_by text
);
create table public.placements (
  id uuid primary key, flock_id uuid references public.flocks,
  farm_id uuid, barn_id uuid, placement_key text, active_start date,
  lifecycle_stage text default 'scheduled', date_removed date,
  is_active boolean default true, canceled_at timestamptz, canceled_by uuid,
  updated_at timestamptz, updated_by text
);
create table public.log_daily (placement_id uuid);
create table public.log_mortality (placement_id uuid);
create table public.log_weight (placement_id uuid);
create table public.feed_drops (
  id integer primary key, placement_id uuid, placement_code text,
  queued_from_placement_id uuid, queued_from_placement_code text,
  drop_weight numeric, feed_bin_id uuid
);
create table public.feed_order_commitments (
  id integer primary key, placement_id uuid, farm_id uuid, barn_id uuid,
  feed_bin_id uuid, ordered_lbs numeric, received_lbs numeric,
  status text, updated_at timestamptz, updated_by text
);

-- Override function_file to reproduce the original error before applying fix.
\if :{?function_file}
\i :function_file
\else
\ir ../../migrations/20260922130000_fix_cancel_feed_drop_columns.sql
\endif

create procedure pg_temp.seed() language plpgsql as $$
begin
  truncate public.log_daily, public.log_mortality, public.log_weight,
    public.feed_drops, public.feed_order_commitments, public.placements, public.flocks;
  insert into public.flocks (id,date_placed) values
    ('00000000-0000-0000-0000-000000000001','2026-09-23'),
    ('00000000-0000-0000-0000-000000000002','2026-11-25');
  insert into public.placements (id,flock_id,farm_id,barn_id,placement_key,active_start)
  select id,id,'00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000020',
    case when id='00000000-0000-0000-0000-000000000001' then '340-W8' else '358-W8' end,
    date_placed from public.flocks;
end $$;

do $test$
declare
  s constant uuid := '00000000-0000-0000-0000-000000000001';
  t constant uuid := '00000000-0000-0000-0000-000000000002';
  actor constant uuid := '00000000-0000-0000-0000-000000000099';
  bin constant uuid := '00000000-0000-0000-0000-000000000030';
  result jsonb;
  target_before jsonb;
  scenario text;
  expected text;
begin
  call pg_temp.seed();
  select to_jsonb(p) into target_before from public.placements p where id=t;
  insert into public.feed_drops values
    (1,s,'340-W8',null,null,1000,bin),
    (2,null,null,s,'340-W8',2000,bin);
  insert into public.feed_order_commitments values
    (1,s,null,null,bin,3000,500,'open',null,null),
    (2,s,null,null,bin,4000,0,'cancelled',null,null);
  result := public.cancel_scheduled_placement(s,t,actor);
  assert (result->>'feed_drop_count')::int=1;
  assert (result->>'queued_feed_drop_count')::int=1;
  assert (result->>'feed_order_lbs')::numeric=2500;
  assert (select placement_id=t and placement_code='358-W8' and feed_bin_id=bin from public.feed_drops where id=1);
  assert (select queued_from_placement_id=t and queued_from_placement_code='358-W8' and placement_id is null and feed_bin_id=bin from public.feed_drops where id=2);
  assert (select placement_id=t and feed_bin_id=bin from public.feed_order_commitments where id=1);
  assert (select placement_id=s from public.feed_order_commitments where id=2);
  assert (select lifecycle_stage='canceled' and not is_active and canceled_by=actor from public.placements where id=s);
  assert (select not is_active and not is_in_barn and not is_complete from public.flocks where id=s);
  assert (select to_jsonb(p)=target_before from public.placements p where id=t);
  raise notice 'PASS: delivered/queued feed and open orders move; bins and target preserved';

  call pg_temp.seed();
  result := public.cancel_scheduled_placement(s,null,actor);
  assert result->>'target_placement_id' is null;
  assert (select lifecycle_stage='canceled' from public.placements where id=s);
  raise notice 'PASS: no-feed cancellation needs no destination';

  call pg_temp.seed();
  update public.flocks set date_placed=null;
  result := public.cancel_scheduled_placement(s,t,actor);
  assert (select lifecycle_stage='canceled' from public.placements where id=s);
  raise notice 'PASS: active_start fallback works when flock dates are missing';

  foreach scenario in array array['earlier','same_day','cross_barn','active_target','missing_target','recorded_activity','flock_date_precedence'] loop
    call pg_temp.seed();
    insert into public.feed_drops values (1,s,'340-W8',null,null,1000,bin);
    case scenario
      when 'earlier' then
        update public.flocks set date_placed='2026-09-21' where id=t;
        expected := 'Feed must be moved to a later scheduled flock.';
      when 'same_day' then
        update public.flocks set date_placed='2026-09-23' where id=t;
        expected := 'Feed must be moved to a later scheduled flock.';
      when 'cross_barn' then
        update public.placements set barn_id='00000000-0000-0000-0000-000000000021' where id=t;
        expected := 'Delivered or queued feed must be reassigned to a flock scheduled for the same barn.';
      when 'active_target' then
        update public.flocks set is_in_barn=true where id=t;
        expected := 'Feed can only be moved to a scheduled or awaiting-arrival flock.';
      when 'missing_target' then
        expected := 'Feed is associated with this flock. Select the flock that should receive it before canceling.';
      when 'recorded_activity' then
        insert into public.log_daily values(s);
        expected := 'This flock cannot be canceled because daily, mortality, or weight records already exist.';
      when 'flock_date_precedence' then
        update public.placements set active_start='2027-01-01' where id=s;
        result := public.cancel_scheduled_placement(s,t,actor);
        assert (select lifecycle_stage='canceled' from public.placements where id=s);
        raise notice 'PASS: flock date precedence matches scheduler';
        continue;
    end case;
    begin
      perform public.cancel_scheduled_placement(s,case when scenario='missing_target' then null else t end,actor);
      raise exception 'Expected rejection for %',scenario;
    exception when raise_exception then
      if sqlerrm<>expected then raise; end if;
    end;
    assert (select lifecycle_stage='scheduled' from public.placements where id=s);
    assert (select placement_id=s and feed_bin_id=bin from public.feed_drops where id=1);
    raise notice 'PASS: % rejected without data changes',scenario;
  end loop;
end
$test$;
rollback;
