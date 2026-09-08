-- Dedicated demo showcase data and reset primitive.
--
-- Safety properties:
--   * the exact manually-created demo owner must exist in auth.users;
--   * a demo-only marker must match the expected Supabase project ref;
--   * the reset function is callable only by service_role/postgres;
--   * all business records created here are synthetic;
--   * outbound sync queues are emptied after seed generation.

create schema if not exists demo_control;
revoke all on schema demo_control from public, anon, authenticated;

create table if not exists demo_control.environment (
  singleton boolean primary key default true check (singleton),
  project_ref text not null,
  owner_user_id uuid not null,
  owner_email text not null,
  seeded_at timestamptz,
  seed_version integer not null default 1
);

revoke all on table demo_control.environment from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from auth.users
    where id = 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a'::uuid
      and lower(email) = 'ken@mothercluckershenhouse.com'
  ) then
    raise exception 'Expected demo owner is missing; refusing demo bootstrap';
  end if;

  insert into demo_control.environment (
    singleton,
    project_ref,
    owner_user_id,
    owner_email,
    seed_version
  )
  values (
    true,
    'srkgobayrzidytmvoago',
    'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a',
    'ken@mothercluckershenhouse.com',
    1
  )
  on conflict (singleton) do update
    set project_ref = excluded.project_ref,
        owner_user_id = excluded.owner_user_id,
        owner_email = excluded.owner_email,
        seed_version = excluded.seed_version;
end
$$;

create or replace function demo_control.reset_showcase_data()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
declare
  v_owner_id constant uuid := 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a';
  v_owner_email constant text := 'ken@mothercluckershenhouse.com';
  v_expected_project_ref constant text := 'srkgobayrzidytmvoago';
  v_super_admin_role_id uuid;
  v_group_id constant uuid := 'de100000-0000-4000-8000-000000000001';
  v_farm_a constant uuid := 'de200000-0000-4000-8000-000000000001';
  v_farm_b constant uuid := 'de200000-0000-4000-8000-000000000002';
  v_farm_c constant uuid := 'de200000-0000-4000-8000-000000000003';
  v_barn_a1 constant uuid := 'de300000-0000-4000-8000-000000000001';
  v_barn_a2 constant uuid := 'de300000-0000-4000-8000-000000000002';
  v_barn_b1 constant uuid := 'de300000-0000-4000-8000-000000000003';
  v_barn_b2 constant uuid := 'de300000-0000-4000-8000-000000000004';
  v_barn_c1 constant uuid := 'de300000-0000-4000-8000-000000000005';
  v_barn_c2 constant uuid := 'de300000-0000-4000-8000-000000000006';
  v_flock_a1 constant uuid := 'de400000-0000-4000-8000-000000000001';
  v_flock_a2 constant uuid := 'de400000-0000-4000-8000-000000000002';
  v_flock_b1 constant uuid := 'de400000-0000-4000-8000-000000000003';
  v_flock_b2 constant uuid := 'de400000-0000-4000-8000-000000000004';
  v_flock_c1 constant uuid := 'de400000-0000-4000-8000-000000000005';
  v_place_a1 constant uuid := 'de500000-0000-4000-8000-000000000001';
  v_place_a2 constant uuid := 'de500000-0000-4000-8000-000000000002';
  v_place_b1 constant uuid := 'de500000-0000-4000-8000-000000000003';
  v_place_b2 constant uuid := 'de500000-0000-4000-8000-000000000004';
  v_place_c1 constant uuid := 'de500000-0000-4000-8000-000000000005';
begin
  if not exists (
    select 1
    from demo_control.environment
    where singleton = true
      and project_ref = v_expected_project_ref
      and owner_user_id = v_owner_id
      and lower(owner_email) = v_owner_email
  ) then
    raise exception 'Demo environment marker mismatch; reset refused';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = v_owner_id
      and lower(email) = v_owner_email
  ) then
    raise exception 'Demo owner identity mismatch; reset refused';
  end if;

  -- Audit triggers read auth.uid(); provide the known demo owner for this
  -- transaction so required created_by/updated_by columns remain valid.
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  -- This database is dedicated to the demo. Starting from farm_groups clears
  -- all dependent farm operations through FK cascades while retaining Auth,
  -- profiles, roles, and the demo safety marker.
  truncate table public.farm_groups, public.feed_tickets restart identity cascade;
  truncate table gsync.outbox restart identity cascade;
  truncate table platform.sync_outbox restart identity cascade;

  insert into public.roles (id, code, description)
  values
    ('de000000-0000-4000-8000-000000000001', 'super_admin', 'Full demo platform authority.'),
    ('de000000-0000-4000-8000-000000000002', 'integrator_manager', 'Integrator-wide operational management.'),
    ('de000000-0000-4000-8000-000000000003', 'grower_admin', 'Grower group administration.'),
    ('de000000-0000-4000-8000-000000000004', 'farm_manager', 'Farm-level operational management.'),
    ('de000000-0000-4000-8000-000000000005', 'flock_supervisor', 'Flock observation and entry specialist.'),
    ('de000000-0000-4000-8000-000000000006', 'readonly', 'View-only demonstration access.')
  on conflict (code) do update
    set description = excluded.description;

  select id into v_super_admin_role_id
  from public.roles
  where lower(replace(code, '-', '_')) in ('super_admin', 'superadmin')
  order by case when lower(replace(code, '-', '_')) = 'super_admin' then 0 else 1 end
  limit 1;

  insert into public.user_roles (user_id, role, role_id)
  values (v_owner_id, 'super_admin', v_super_admin_role_id)
  on conflict (user_id, role_id) do update
    set role = excluded.role,
        updated_at = now();

  insert into public.sysactions (id, action)
  select md5('flocktrax-demo-action:' || action)::uuid, action
  from unnest(array[
    'dashboard',
    'daily_logs',
    'log_mortality',
    'weight_samples',
    'grade_birds',
    'feed_tickets',
    'feed_bins',
    'placements',
    'livehaul',
    'issues',
    'reports',
    'farm_structure',
    'users',
    'settings'
  ]) as action
  on conflict (action) do nothing;

  insert into public.roles_actions_permissions (
    id, role_id, action_id, menu_access, createyn, readyn, updateyn, deleteyn
  )
  select
    md5('flocktrax-demo-super-permission:' || sa.id::text)::uuid,
    v_super_admin_role_id,
    sa.id,
    true,
    true,
    true,
    true,
    true
  from public.sysactions sa
  on conflict (role_id, action_id) do update
    set menu_access = true,
        createyn = true,
        readyn = true,
        updateyn = true,
        deleteyn = true;

  insert into public.roles_actions_permissions (
    id, role_id, action_id, menu_access, createyn, readyn, updateyn, deleteyn
  )
  select
    md5('flocktrax-demo-readonly-permission:' || sa.id::text)::uuid,
    r.id,
    sa.id,
    true,
    false,
    true,
    false,
    false
  from public.roles r
  cross join public.sysactions sa
  where lower(replace(r.code, '-', '_')) = 'readonly'
  on conflict (role_id, action_id) do update
    set menu_access = true,
        createyn = false,
        readyn = true,
        updateyn = false,
        deleteyn = false;

  insert into public.farm_groups (
    id, group_name, group_contact_name, contact_title, city, st, zip,
    comments, created_by, updated_by, is_active, name
  )
  values (
    v_group_id,
    'Evergreen Poultry Partners',
    'Jordan Ellis',
    'Live Operations Director',
    'Oak Valley',
    'AR',
    '72000',
    'Synthetic showcase organization. No production data.',
    v_owner_id,
    v_owner_id,
    true,
    'Evergreen Poultry Partners'
  );

  insert into public.farms (
    id, farm_code, farm_name, farm_group, city, state, zip, is_active,
    updated_by, created_by, farm_group_id, name, latitude, longitude
  )
  values
    (v_farm_a, 'CEDAR', 'Cedar Creek Farm', 'Evergreen Poultry Partners', 'Oak Valley', 'AR', '72000', true, v_owner_id, v_owner_id, v_group_id, 'Cedar Creek Farm', 35.1042, -92.3138),
    (v_farm_b, 'REDBUD', 'Redbud Ridge Farm', 'Evergreen Poultry Partners', 'Pine Crossing', 'AR', '72001', true, v_owner_id, v_owner_id, v_group_id, 'Redbud Ridge Farm', 35.1880, -92.1962),
    (v_farm_c, 'PINE', 'Pine Hollow Farm', 'Evergreen Poultry Partners', 'Maple Run', 'AR', '72002', true, v_owner_id, v_owner_id, v_group_id, 'Pine Hollow Farm', 35.0227, -92.4261);

  insert into public.barns (
    id, farm_id, barn_code, sort_code, length_ft, width_ft, sqft,
    stdroc_head, has_flock, is_empty, is_active, created_by
  )
  values
    (v_barn_a1, v_farm_a, 'A-1', '01', 500, 42, 21000, '12000', false, true, true, v_owner_id),
    (v_barn_a2, v_farm_a, 'A-2', '02', 500, 42, 21000, '12000', false, true, true, v_owner_id),
    (v_barn_b1, v_farm_b, 'B-1', '01', 600, 44, 26400, '15000', false, true, true, v_owner_id),
    (v_barn_b2, v_farm_b, 'B-2', '02', 600, 44, 26400, '15000', false, true, true, v_owner_id),
    (v_barn_c1, v_farm_c, 'C-1', '01', 480, 40, 19200, '11000', false, true, true, v_owner_id),
    (v_barn_c2, v_farm_c, 'C-2', '02', 480, 40, 19200, '11000', false, true, true, v_owner_id);

  insert into public.flocks (
    id, farm_id, flock_number, date_placed, max_date,
    start_cnt_females, start_cnt_males, is_active, is_complete,
    is_in_barn, is_settled, created_by, female_date_placed, male_date_placed,
    flock_removed
  )
  values
    (v_flock_a1, v_farm_a, 3101, current_date - 12, current_date + 51, 10320, 1120, true, false, true, false, v_owner_id, current_date - 12, current_date - 11, null),
    (v_flock_a2, v_farm_a, 3102, current_date - 31, current_date + 32, 10180, 1090, true, false, true, false, v_owner_id, current_date - 31, current_date - 30, null),
    (v_flock_b1, v_farm_b, 4201, current_date - 45, current_date + 18, 12750, 1340, true, false, true, false, v_owner_id, current_date - 45, current_date - 44, null),
    (v_flock_b2, v_farm_b, 4202, current_date + 10, current_date + 73, 13000, 1380, false, false, false, false, v_owner_id, current_date + 10, current_date + 11, null),
    (v_flock_c1, v_farm_c, 2507, current_date - 105, current_date - 42, 9400, 1010, false, true, false, true, v_owner_id, current_date - 105, current_date - 104, current_date - 42);

  insert into public.placements (
    id, farm_id, barn_id, flock_id, date_removed, is_active,
    placement_key, created_by, active_start, active_end, lifecycle_stage,
    archived_at, archived_by, lh1_date
  )
  values
    (v_place_a1, v_farm_a, v_barn_a1, v_flock_a1, null, true, 'CEDAR-A-1-3101', v_owner_id, current_date - 12, current_date + 51, 'in_barn_growing', null, null, null),
    (v_place_a2, v_farm_a, v_barn_a2, v_flock_a2, null, true, 'CEDAR-A-2-3102', v_owner_id, current_date - 31, current_date + 32, 'in_barn_growing', null, null, null),
    (v_place_b1, v_farm_b, v_barn_b1, v_flock_b1, null, true, 'REDBUD-B-1-4201', v_owner_id, current_date - 45, current_date + 18, 'in_barn_growing', null, null, current_date + 12),
    (v_place_b2, v_farm_b, v_barn_b2, v_flock_b2, null, true, 'REDBUD-B-2-4202', v_owner_id, current_date + 10, current_date + 73, 'scheduled', null, null, null),
    (v_place_c1, v_farm_c, v_barn_c1, v_flock_c1, current_date - 42, false, 'PINE-C-1-2507', v_owner_id, current_date - 105, current_date - 42, 'archived', current_date - 40, v_owner_id, current_date - 45);

  -- Ensure the presentational barn status is explicit after placement triggers.
  update public.barns
  set active_flock_id = case id
        when v_barn_a1 then v_flock_a1
        when v_barn_a2 then v_flock_a2
        when v_barn_b1 then v_flock_b1
        else null
      end,
      has_flock = id in (v_barn_a1, v_barn_a2, v_barn_b1),
      is_empty = id not in (v_barn_a1, v_barn_a2, v_barn_b1)
  where farm_id in (v_farm_a, v_farm_b, v_farm_c);

  insert into public.farm_group_memberships (
    id, user_id, farm_group_id, role_id, active
  )
  values (
    'de600000-0000-4000-8000-000000000001',
    v_owner_id,
    v_group_id,
    v_super_admin_role_id,
    true
  );

  insert into public.farm_memberships (user_id, farm_id, role_id, is_active)
  values
    (v_owner_id, v_farm_a, v_super_admin_role_id, true),
    (v_owner_id, v_farm_b, v_super_admin_role_id, true),
    (v_owner_id, v_farm_c, v_super_admin_role_id, true);

  insert into public.log_daily (
    id, placement_id, log_date, age_days, am_temp, set_temp,
    rel_humidity, min_vent, is_oda_open, comment, created_by,
    outside_temp_current, outside_temp_low, outside_temp_high,
    maintenance_flag, feedlines_flag, nipple_lines_flag,
    bird_health_alert, water_meter_reading
  )
  select
    md5('daily:' || p.placement_id::text || ':' || (p.started_on + d.age_day)::text)::uuid,
    p.placement_id,
    p.started_on + d.age_day,
    d.age_day,
    round((88 - least(d.age_day, 20) * 0.55)::numeric, 1),
    round((89 - least(d.age_day, 22) * 0.55)::numeric, 1),
    54 + (d.age_day % 8),
    case when d.age_day < 14 then '2.0 min / 5 min' else '3.0 min / 5 min' end,
    d.age_day > 20,
    case when d.age_day = current_date - p.started_on then 'Morning walk-through complete.' else null end,
    v_owner_id,
    70 + (d.age_day % 9),
    62 + (d.age_day % 7),
    79 + (d.age_day % 8),
    false,
    false,
    false,
    false,
    1240 + (d.age_day * 188)
  from (values
    (v_place_a1, current_date - 12),
    (v_place_a2, current_date - 31),
    (v_place_b1, current_date - 45)
  ) as p(placement_id, started_on)
  cross join lateral generate_series(0, current_date - p.started_on, 1) as d(age_day);

  insert into public.log_mortality (
    id, placement_id, log_date, dead_female, dead_male,
    cull_female, cull_male, dead_reason, grade_litter,
    grade_footpad, grade_feathers, grade_lame, grade_pecking,
    created_by
  )
  select
    md5('mortality:' || p.placement_id::text || ':' || (p.started_on + d.age_day)::text)::uuid,
    p.placement_id,
    p.started_on + d.age_day,
    case when d.age_day % 5 = 0 then 2 else 1 end,
    case when d.age_day % 7 = 0 then 1 else 0 end,
    case when d.age_day % 11 = 0 then 1 else 0 end,
    0,
    case when d.age_day = 1 then 'Placement adjustment' else null end,
    case when d.age_day % 7 = 0 then 4 else null end,
    case when d.age_day % 7 = 0 then 4 else null end,
    case when d.age_day % 7 = 0 then 5 else null end,
    case when d.age_day % 7 = 0 then 5 else null end,
    case when d.age_day % 7 = 0 then 5 else null end,
    v_owner_id
  from (values
    (v_place_a1, current_date - 12),
    (v_place_a2, current_date - 31),
    (v_place_b1, current_date - 45)
  ) as p(placement_id, started_on)
  cross join lateral generate_series(0, current_date - p.started_on, 1) as d(age_day);

  insert into public.log_weight (
    id, placement_id, log_date, age_days, sex, cnt_weighed,
    avg_weight, stddev_weight, procure, other_note, updated_by, created_by
  )
  select
    md5('weight:' || p.placement_id::text || ':' || d.age_day::text || ':' || s.sex)::uuid,
    p.placement_id,
    p.started_on + d.age_day,
    d.age_day,
    s.sex,
    75 + (d.age_day % 20),
    round((0.18 + d.age_day * case when s.sex = 'male' then 0.095 else 0.086 end)::numeric, 2),
    round((0.03 + d.age_day * 0.004)::numeric, 2),
    round((88 + (d.age_day % 5))::numeric, 1),
    'Synthetic weekly sample',
    v_owner_id,
    v_owner_id
  from (values
    (v_place_a1, current_date - 12, 12),
    (v_place_a2, current_date - 31, 31),
    (v_place_b1, current_date - 45, 45)
  ) as p(placement_id, started_on, current_age)
  cross join lateral generate_series(7, p.current_age, 7) as d(age_day)
  cross join (values ('female'), ('male')) as s(sex);

  insert into public.feedbins (
    id, farm_id, barn_id, bin_num, capacity,
    binsentry_last_inventory_lbs, binsentry_sync_note,
    accessible_feed_type, accessible_feed_lbs, queued_feed_type,
    queued_feed_lbs, feed_state_effective_at, feed_state_source
  )
  values
    ('de700000-0000-4000-8000-000000000001', v_farm_a, v_barn_a1, 1, 24000, 8600, 'Synthetic demo reading', 'starter', 8600, null, 0, now() - interval '2 hours', 'demo_seed'),
    ('de700000-0000-4000-8000-000000000002', v_farm_a, v_barn_a1, 2, 24000, 17200, 'Synthetic demo reading', 'grower', 17200, null, 0, now() - interval '2 hours', 'demo_seed'),
    ('de700000-0000-4000-8000-000000000003', v_farm_a, v_barn_a2, 1, 24000, 6100, 'Synthetic demo reading', 'grower', 6100, 'starter', 4200, now() - interval '90 minutes', 'demo_seed'),
    ('de700000-0000-4000-8000-000000000004', v_farm_b, v_barn_b1, 1, 30000, 11900, 'Synthetic demo reading', 'grower', 11900, null, 0, now() - interval '45 minutes', 'demo_seed'),
    ('de700000-0000-4000-8000-000000000005', v_farm_b, v_barn_b2, 1, 30000, 0, 'Future placement bin', null, 0, null, 0, now(), 'demo_seed');

  insert into public.feed_tickets (
    id, created_by, ticket_num, feedmill, delivery_date, comment,
    feed_weight, feed_name, source_type, ticket_type, updated_by
  )
  values
    ('de800000-0000-4000-8000-000000000001', v_owner_id, 'DEMO-1001', 'Evergreen Feed Mill', current_date - 9, 'Synthetic delivery', 23500, 'Starter', 'mill', 'Reg', v_owner_id),
    ('de800000-0000-4000-8000-000000000002', v_owner_id, 'DEMO-1002', 'Evergreen Feed Mill', current_date - 4, 'Synthetic split delivery', 48000, 'Grower', 'mill', 'Reg', v_owner_id),
    ('de800000-0000-4000-8000-000000000003', v_owner_id, 'DEMO-1003', 'Evergreen Feed Mill', current_date + 1, 'Queued showcase delivery', 24000, 'Grower', 'mill', 'Reg', v_owner_id);

  insert into public.feed_drops (
    id, feed_ticket_id, created_by, ticket_num, bin_code,
    placement_code, type, drop_weight, comment, farm_id, barn_id,
    feed_bin_id, placement_id, drop_order
  )
  values
    ('de900000-0000-4000-8000-000000000001', 'de800000-0000-4000-8000-000000000001', v_owner_id, 'DEMO-1001', 'A-1 / 1', 'CEDAR-A-1-3101', 'starter', 23500, 'Synthetic drop', v_farm_a, v_barn_a1, 'de700000-0000-4000-8000-000000000001', v_place_a1, 1),
    ('de900000-0000-4000-8000-000000000002', 'de800000-0000-4000-8000-000000000002', v_owner_id, 'DEMO-1002', 'A-2 / 1', 'CEDAR-A-2-3102', 'grower', 24000, 'Synthetic split drop', v_farm_a, v_barn_a2, 'de700000-0000-4000-8000-000000000003', v_place_a2, 1),
    ('de900000-0000-4000-8000-000000000003', 'de800000-0000-4000-8000-000000000002', v_owner_id, 'DEMO-1002', 'B-1 / 1', 'REDBUD-B-1-4201', 'grower', 24000, 'Synthetic split drop', v_farm_b, v_barn_b1, 'de700000-0000-4000-8000-000000000004', v_place_b1, 2),
    ('de900000-0000-4000-8000-000000000004', 'de800000-0000-4000-8000-000000000003', v_owner_id, 'DEMO-1003', 'B-1 / 1', 'REDBUD-B-1-4201', 'grower', 24000, 'Future synthetic delivery', v_farm_b, v_barn_b1, 'de700000-0000-4000-8000-000000000004', v_place_b1, 1);

  insert into public.livehaul_schedule (
    livehaul_id, placement_id, flock_id, farm_id, barn_id, lh_date,
    sequence_num, actual_date, actual_at, head_target, head_actual,
    status, comment, created_by, updated_by, target_sex
  )
  values
    ('dea00000-0000-4000-8000-000000000001', v_place_b1, v_flock_b1, v_farm_b, v_barn_b1, current_date + 12, 1, null, null, 13200, null, 'scheduled', 'Synthetic upcoming livehaul', v_owner_id, v_owner_id::text, null),
    ('dea00000-0000-4000-8000-000000000002', v_place_c1, v_flock_c1, v_farm_c, v_barn_c1, current_date - 45, 1, current_date - 45, (current_date - 45) + time '21:30', 9700, 9650, 'completed', 'Synthetic completed livehaul', v_owner_id, v_owner_id::text, null);

  insert into public.livehaul_loads (
    load_id, livehaul_id, truck_num, trailer_num, scale_location,
    scale_empty, scale_loaded, live_weight, head_count, doa_count,
    comment, created_by, updated_by
  )
  values
    ('deb00000-0000-4000-8000-000000000001', 'dea00000-0000-4000-8000-000000000002', 'T-14', 'L-08', 'Demo Processing Scale', 32100, 80125, 48025, 4850, 2, 'Synthetic first load', v_owner_id, v_owner_id::text),
    ('deb00000-0000-4000-8000-000000000002', 'dea00000-0000-4000-8000-000000000002', 'T-22', 'L-11', 'Demo Processing Scale', 33400, 80890, 47490, 4800, 1, 'Synthetic final load', v_owner_id, v_owner_id::text);

  insert into public.issues (
    id, entity_type, entity_id, issue_type, title, description,
    status, related_placement_id, reported_log_date, opened_at,
    opened_by, resolved_at, resolved_by, resolution_note, updated_by
  )
  values
    ('dec00000-0000-4000-8000-000000000001', 'barn', v_barn_a2, 'maintenance', 'Feed line motor vibration', 'Synthetic open maintenance item for product demonstration.', 'open', v_place_a2, current_date, now() - interval '1 day', v_owner_id, null, null, null, v_owner_id),
    ('dec00000-0000-4000-8000-000000000002', 'placement', v_place_b1, 'bird_health', 'Review weekly male weight trend', 'Synthetic advisory item for product demonstration.', 'open', v_place_b1, current_date, now() - interval '6 hours', v_owner_id, null, null, null, v_owner_id),
    ('dec00000-0000-4000-8000-000000000003', 'barn', v_barn_c1, 'maintenance', 'Replace drinker regulator', 'Synthetic resolved maintenance history.', 'resolved', v_place_c1, current_date - 70, now() - interval '72 days', v_owner_id, now() - interval '70 days', v_owner_id, 'Regulator replaced and pressure verified.', v_owner_id);

  -- No external destinations are configured in demo. Remove trigger-generated
  -- queue entries so reset never leaves outbound work waiting to run.
  truncate table gsync.outbox restart identity cascade;
  truncate table platform.sync_outbox restart identity cascade;

  update demo_control.environment
  set seeded_at = now(), seed_version = 1
  where singleton = true;

  return jsonb_build_object(
    'ok', true,
    'project_ref', v_expected_project_ref,
    'farm_groups', 1,
    'farms', 3,
    'barns', 6,
    'active_placements', 3,
    'scheduled_placements', 1,
    'archived_placements', 1,
    'outbound_queues_cleared', true,
    'seeded_at', now()
  );
end
$$;

revoke all on function demo_control.reset_showcase_data() from public, anon, authenticated;
grant usage on schema demo_control to service_role;
grant execute on function demo_control.reset_showcase_data() to service_role;

select demo_control.reset_showcase_data();
