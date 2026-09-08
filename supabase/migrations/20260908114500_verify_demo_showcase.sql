-- Machine-readable demo health check plus service-role-only API wrappers.

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
      (select count(*) = 1 from public.farm_groups)
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
      and (select count(*) = 0 from platform.sync_outbox),
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

create or replace function public.get_demo_showcase_status()
returns jsonb
language sql
security definer
set search_path = pg_catalog, demo_control
as $$
  select demo_control.showcase_status();
$$;

create or replace function public.reset_demo_showcase_data()
returns jsonb
language sql
security definer
set search_path = pg_catalog, demo_control
as $$
  select demo_control.reset_showcase_data();
$$;

revoke all on function public.get_demo_showcase_status() from public, anon, authenticated;
revoke all on function public.reset_demo_showcase_data() from public, anon, authenticated;
grant execute on function public.get_demo_showcase_status() to service_role;
grant execute on function public.reset_demo_showcase_data() to service_role;

do $$
declare
  v_status jsonb;
begin
  v_status := demo_control.showcase_status();
  if coalesce((v_status ->> 'ok')::boolean, false) is not true then
    raise exception 'Demo showcase verification failed: %', v_status;
  end if;
end
$$;
