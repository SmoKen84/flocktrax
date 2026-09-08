-- Expand the showcase to demonstrate integrator-level management across more
-- than one grower group. This composes with the original reset so future
-- resets always rebuild both groups.

create or replace function demo_control.ensure_multi_group_showcase()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
declare
  v_owner_id constant uuid := 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a';
  v_second_group_id constant uuid := 'de100000-0000-4000-8000-000000000002';
  v_pine_farm_id constant uuid := 'de200000-0000-4000-8000-000000000003';
  v_super_admin_role_id uuid;
begin
  if not exists (
    select 1
    from demo_control.environment
    where singleton = true
      and project_ref = 'srkgobayrzidytmvoago'
      and owner_user_id = v_owner_id
  ) then
    raise exception 'Demo environment marker mismatch; multi-group seed refused';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = v_owner_id
      and lower(email) = 'ken@mothercluckershenhouse.com'
  ) then
    raise exception 'Demo owner identity mismatch; multi-group seed refused';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  select id into v_super_admin_role_id
  from public.roles
  where lower(replace(code, '-', '_')) in ('super_admin', 'superadmin')
  order by case when lower(replace(code, '-', '_')) = 'super_admin' then 0 else 1 end
  limit 1;

  insert into public.farm_groups (
    id, group_name, group_contact_name, contact_title, city, st, zip,
    comments, created_by, updated_by, is_active, name
  )
  values (
    v_second_group_id,
    'Blue River Growers',
    'Taylor Morgan',
    'Grower Group Manager',
    'Maple Run',
    'AR',
    '72002',
    'Second synthetic grower group for integrator-level demonstration.',
    v_owner_id,
    v_owner_id,
    true,
    'Blue River Growers'
  )
  on conflict (group_name) do update
    set group_contact_name = excluded.group_contact_name,
        contact_title = excluded.contact_title,
        city = excluded.city,
        st = excluded.st,
        zip = excluded.zip,
        comments = excluded.comments,
        updated_by = excluded.updated_by,
        is_active = true,
        name = excluded.name;

  update public.farms
  set farm_group = 'Blue River Growers',
      farm_group_id = v_second_group_id,
      updated_by = v_owner_id
  where id = v_pine_farm_id;

  insert into public.farm_group_memberships (
    id, user_id, farm_group_id, role_id, active
  )
  values (
    'de600000-0000-4000-8000-000000000002',
    v_owner_id,
    v_second_group_id,
    v_super_admin_role_id,
    true
  )
  on conflict (user_id, farm_group_id) do update
    set role_id = excluded.role_id,
        active = true;
end
$$;

revoke all on function demo_control.ensure_multi_group_showcase() from public, anon, authenticated;
grant execute on function demo_control.ensure_multi_group_showcase() to service_role;

create or replace function demo_control.showcase_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
declare
  v_expected_project_ref constant text := 'srkgobayrzidytmvoago';
  v_status jsonb;
begin
  if not exists (
    select 1
    from demo_control.environment
    where singleton = true
      and project_ref = v_expected_project_ref
      and owner_user_id = 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a'::uuid
  ) then
    raise exception 'Demo environment marker mismatch; status check refused';
  end if;

  select jsonb_build_object(
    'ok',
      (select count(*) = 2 from public.farm_groups)
      and (select count(*) = 3 from public.farms)
      and (select count(*) = 6 from public.barns)
      and (select count(*) = 5 from public.placements)
      and (select count(*) = 91 from public.log_daily)
      and (select count(*) = 91 from public.log_mortality)
      and (select count(*) = 22 from public.log_weight)
      and (select count(*) = 3 from public.feed_tickets)
      and (select count(*) = 4 from public.feed_drops)
      and (select count(*) = 2 from public.livehaul_schedule)
      and (select count(*) = 2 from public.livehaul_loads)
      and (select count(*) = 3 from public.issues)
      and (select count(*) = 0 from gsync.outbox)
      and (select count(*) = 0 from platform.sync_outbox)
      and exists (
        select 1
        from public.farms f
        join public.farm_groups fg on fg.id = f.farm_group_id
        where f.id = 'de200000-0000-4000-8000-000000000003'::uuid
          and fg.id = 'de100000-0000-4000-8000-000000000002'::uuid
      ),
    'project_ref', v_expected_project_ref,
    'farm_groups', (select count(*) from public.farm_groups),
    'farms', (select count(*) from public.farms),
    'barns', (select count(*) from public.barns),
    'placements', (select count(*) from public.placements),
    'daily_logs', (select count(*) from public.log_daily),
    'mortality_logs', (select count(*) from public.log_mortality),
    'weight_samples', (select count(*) from public.log_weight),
    'feed_tickets', (select count(*) from public.feed_tickets),
    'feed_drops', (select count(*) from public.feed_drops),
    'livehaul_events', (select count(*) from public.livehaul_schedule),
    'livehaul_loads', (select count(*) from public.livehaul_loads),
    'issues', (select count(*) from public.issues),
    'google_outbox_pending', (select count(*) from gsync.outbox),
    'platform_outbox_pending', (select count(*) from platform.sync_outbox),
    'seeded_at', (select seeded_at from demo_control.environment where singleton = true)
  ) into v_status;

  return v_status;
end
$$;

revoke all on function demo_control.showcase_status() from public, anon, authenticated;
grant execute on function demo_control.showcase_status() to service_role;

create or replace function public.reset_demo_showcase_data()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, demo_control
as $$
begin
  perform demo_control.reset_showcase_data();
  perform demo_control.ensure_multi_group_showcase();
  return demo_control.showcase_status();
end
$$;

revoke all on function public.reset_demo_showcase_data() from public, anon, authenticated;
grant execute on function public.reset_demo_showcase_data() to service_role;

select demo_control.ensure_multi_group_showcase();

do $$
declare
  v_status jsonb;
begin
  v_status := demo_control.showcase_status();
  if coalesce((v_status ->> 'ok')::boolean, false) is not true then
    raise exception 'Multi-group demo verification failed: %', v_status;
  end if;
end
$$;
