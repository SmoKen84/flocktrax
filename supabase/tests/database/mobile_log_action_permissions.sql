-- Regression coverage for worker mobile-log authorization.
-- Run after all migrations against a disposable database.

begin;

do $catalog$
begin
  if has_function_privilege(
    'anon', 'public.save_log_daily_mobile(uuid,date,jsonb)', 'EXECUTE'
  ) then
    raise exception 'Mobile log regression: anonymous daily wrapper execution is allowed';
  end if;

  if not has_function_privilege(
    'authenticated', 'public.save_log_daily_mobile(uuid,date,jsonb)', 'EXECUTE'
  ) then
    raise exception 'Mobile log regression: authenticated daily wrapper execution is denied';
  end if;

  if has_function_privilege(
    'authenticated', 'public.save_log_daily_mobile_internal(uuid,date,jsonb)', 'EXECUTE'
  ) or has_function_privilege(
    'authenticated', 'public.save_log_weight_mobile_internal(uuid,date,text,jsonb)', 'EXECUTE'
  ) then
    raise exception 'Mobile log regression: an internal save implementation is client-executable';
  end if;
end
$catalog$;

insert into auth.users (id, email, created_at, updated_at)
values ('21111111-1111-1111-1111-111111111111', 'mobile-worker@example.invalid', now(), now());

insert into public.roles (id, code, description)
values ('2ccccccc-cccc-cccc-cccc-cccccccccccc', 'FarmHand', 'Mobile log test role');

insert into public.sysactions (id, action)
values
  ('2ddddddd-dddd-dddd-dddd-dddddddddd01', 'daily_logs'),
  ('2ddddddd-dddd-dddd-dddd-dddddddddd02', 'log_mortality'),
  ('2ddddddd-dddd-dddd-dddd-dddddddddd03', 'weight_samples');

insert into public.roles_actions_permissions (
  id, role_id, action_id, createyn, readyn, updateyn, deleteyn
)
values
  (
    '2eeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
    '2ccccccc-cccc-cccc-cccc-cccccccccccc',
    '2ddddddd-dddd-dddd-dddd-dddddddddd01',
    true, true, true, false
  ),
  (
    '2eeeeeee-eeee-eeee-eeee-eeeeeeeeee02',
    '2ccccccc-cccc-cccc-cccc-cccccccccccc',
    '2ddddddd-dddd-dddd-dddd-dddddddddd02',
    true, true, true, false
  ),
  (
    '2eeeeeee-eeee-eeee-eeee-eeeeeeeeee03',
    '2ccccccc-cccc-cccc-cccc-cccccccccccc',
    '2ddddddd-dddd-dddd-dddd-dddddddddd03',
    true, true, true, false
  );

select set_config('request.jwt.claim.sub', '21111111-1111-1111-1111-111111111111', true);

insert into public.farms (id, farm_code, farm_name, updated_by, created_by)
values
  (
    '2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'MOBILE-A', 'Assigned Mobile Farm',
    '21111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111'
  ),
  (
    '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'MOBILE-B', 'Other Mobile Farm',
    '21111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111'
  );

insert into public.farm_memberships (user_id, farm_id, role_id, is_active)
values
  (
    '21111111-1111-1111-1111-111111111111',
    '2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '2ccccccc-cccc-cccc-cccc-cccccccccccc',
    true
  ),
  (
    '21111111-1111-1111-1111-111111111111',
    '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    '2ccccccc-cccc-cccc-cccc-cccccccccccc',
    false
  );

insert into public.barns (id, farm_id, barn_code, created_by)
values
  (
    '2aaaaaaa-0000-0000-0000-000000000001',
    '2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'MOBILE-A1',
    '21111111-1111-1111-1111-111111111111'
  ),
  (
    '2bbbbbbb-0000-0000-0000-000000000001',
    '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'MOBILE-B1',
    '21111111-1111-1111-1111-111111111111'
  );

insert into public.flocks (
  id, farm_id, flock_number, date_placed, max_date, created_by
)
values
  (
    '2aaaaaaa-0000-0000-0000-000000000002',
    '2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    2001,
    current_date - 10,
    current_date + 60,
    '21111111-1111-1111-1111-111111111111'
  ),
  (
    '2bbbbbbb-0000-0000-0000-000000000002',
    '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    2002,
    current_date - 10,
    current_date + 60,
    '21111111-1111-1111-1111-111111111111'
  );

insert into public.placements (
  id, farm_id, barn_id, flock_id, placement_key, active_start, created_by
)
values
  (
    '2aaaaaaa-0000-0000-0000-000000000003',
    '2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '2aaaaaaa-0000-0000-0000-000000000001',
    '2aaaaaaa-0000-0000-0000-000000000002',
    'MOBILE-A1-2001',
    current_date - 10,
    '21111111-1111-1111-1111-111111111111'
  ),
  (
    '2bbbbbbb-0000-0000-0000-000000000003',
    '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    '2bbbbbbb-0000-0000-0000-000000000001',
    '2bbbbbbb-0000-0000-0000-000000000002',
    'MOBILE-B1-2002',
    current_date - 10,
    '21111111-1111-1111-1111-111111111111'
  );

set local role authenticated;

do $test$
begin
  if not public.can_perform_farm_action(
    '2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'daily_logs', 'create'
  ) then
    raise exception 'Mobile log regression: active FarmHand daily create was denied';
  end if;

  if not public.can_perform_farm_action(
    '2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'log_mortality', 'update'
  ) then
    raise exception 'Mobile log regression: active FarmHand mortality update was denied';
  end if;

  if public.can_perform_farm_action(
    '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'daily_logs', 'create'
  ) then
    raise exception 'Mobile log regression: inactive cross-farm membership was allowed';
  end if;

  if public.can_perform_farm_action(
    '2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'grade_birds', 'create'
  ) then
    raise exception 'Mobile log regression: ungranted action was allowed';
  end if;

  if public.can_perform_farm_action(
    '2aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'daily_logs', 'delete'
  ) then
    raise exception 'Mobile log regression: unsupported operation was allowed';
  end if;

  perform public.save_log_daily_mobile(
    '2aaaaaaa-0000-0000-0000-000000000003',
    current_date,
    jsonb_build_object('am_temp', 78, 'comment', 'FarmHand regression test')
  );

  perform public.save_log_mortality_mobile(
    '2aaaaaaa-0000-0000-0000-000000000003',
    current_date,
    jsonb_build_object('dead_female', 0, 'dead_male', 0)
  );

  perform public.save_log_weight_mobile(
    '2aaaaaaa-0000-0000-0000-000000000003',
    current_date,
    'female',
    jsonb_build_object('cnt_weighed', 10, 'avg_weight', 1.25)
  );

  -- Repeat the same natural keys to exercise the update authorization path.
  perform public.save_log_daily_mobile(
    '2aaaaaaa-0000-0000-0000-000000000003',
    current_date,
    jsonb_build_object('am_temp', 79)
  );

  perform public.save_log_mortality_mobile(
    '2aaaaaaa-0000-0000-0000-000000000003',
    current_date,
    jsonb_build_object('dead_female', 1)
  );

  perform public.save_log_weight_mobile(
    '2aaaaaaa-0000-0000-0000-000000000003',
    current_date,
    'female',
    jsonb_build_object('cnt_weighed', 11, 'avg_weight', 1.30)
  );

  begin
    perform public.save_log_daily_mobile(
      '2bbbbbbb-0000-0000-0000-000000000003',
      current_date,
      jsonb_build_object('am_temp', 78)
    );
    raise exception 'Mobile log regression: cross-farm daily save was allowed';
  exception
    when insufficient_privilege then null;
  end;
end
$test$;

reset role;
rollback;
