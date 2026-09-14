-- Expand the resettable demo schedule and seed mobile daily-age reminders.
-- Every demo barn receives two synthetic future flock placements and at least
-- one future livehaul. All dates move with current_date on each reset.

create or replace function demo_control.ensure_daily_age_tasks_showcase()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
declare
  v_owner_id constant uuid := 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a';
begin
  if not exists (
    select 1
    from demo_control.environment
    where singleton = true
      and project_ref = 'srkgobayrzidytmvoago'
      and owner_user_id = v_owner_id
      and lower(owner_email) = 'ken@mothercluckershenhouse.com'
  ) then
    raise exception 'Demo environment marker mismatch; daily age task seed refused';
  end if;

  delete from public.daily_age_tasks;

  insert into public.daily_age_tasks (
    id, task_label, min_age_days, max_age_days, display_order, is_active
  )
  values
    ('deaf0000-0000-4000-8000-000000000001', 'Check chick distribution and comfort', 0, 3, 10, true),
    ('deaf0000-0000-4000-8000-000000000002', 'Verify brooder and floor temperature', 0, 7, 20, true),
    ('deaf0000-0000-4000-8000-000000000003', 'Confirm crop fill and water availability', 0, 7, 30, true),
    ('deaf0000-0000-4000-8000-000000000004', 'Review minimum ventilation settings', 0, 14, 40, true),
    ('deaf0000-0000-4000-8000-000000000005', 'Raise feeders and drinker lines as needed', 7, 21, 50, true),
    ('deaf0000-0000-4000-8000-000000000006', 'Collect and review weekly body weights', 7, 63, 60, true),
    ('deaf0000-0000-4000-8000-000000000007', 'Grade litter and footpad condition', 14, 63, 70, true),
    ('deaf0000-0000-4000-8000-000000000008', 'Inspect feed-bin inventory and delivery needs', 0, 63, 80, true),
    ('deaf0000-0000-4000-8000-000000000009', 'Prepare barn and equipment for livehaul', 50, 63, 90, true),
    ('deaf0000-0000-4000-8000-000000000010', 'Confirm processing schedule and catch plan', 55, 63, 100, true);
end
$$;

create or replace function demo_control.ensure_future_schedule_showcase()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
declare
  v_owner_id constant uuid := 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a';
  v_female_breed_id constant uuid := 'dee00000-0000-4000-8000-000000000001';
  v_male_breed_id constant uuid := 'dee00000-0000-4000-8000-000000000002';
  v_barn record;
  v_cycle integer;
  v_anchor_date date;
  v_start_date date;
  v_end_date date;
  v_flock_id uuid;
  v_placement_id uuid;
  v_flock_number integer;
  v_total_head integer;
  v_female_head integer;
  v_male_head integer;
begin
  if not exists (
    select 1
    from demo_control.environment
    where singleton = true
      and project_ref = 'srkgobayrzidytmvoago'
      and owner_user_id = v_owner_id
      and lower(owner_email) = 'ken@mothercluckershenhouse.com'
  ) then
    raise exception 'Demo environment marker mismatch; future schedule seed refused';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = v_owner_id
      and lower(email) = 'ken@mothercluckershenhouse.com'
  ) then
    raise exception 'Demo owner identity mismatch; future schedule seed refused';
  end if;

  if not exists (select 1 from public.breeds where id = v_female_breed_id)
    or not exists (select 1 from public.breeds where id = v_male_breed_id) then
    raise exception 'Demo breed references are missing; future schedule seed refused';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  -- Make this helper idempotent when applied to an already-running demo.
  delete from public.placements
  where placement_key like 'DEMO-FUTURE-%';

  delete from public.flocks
  where id in (
    select md5('flocktrax-demo-future-flock:' || barn.id::text || ':' || cycle_num::text)::uuid
    from public.barns barn
    cross join generate_series(1, 2) as cycle_num
  );

  for v_barn in
    select
      barn.id,
      barn.farm_id,
      barn.barn_code,
      farm.farm_code,
      row_number() over (order by farm.farm_code, barn.sort_code nulls last, barn.barn_code, barn.id)::integer as barn_index,
      coalesce(nullif(regexp_replace(coalesce(barn.stdroc_head, ''), '[^0-9]', '', 'g'), '')::integer, 12000) as standard_head
    from public.barns barn
    join public.farms farm on farm.id = barn.farm_id
    where barn.is_active is distinct from false
    order by farm.farm_code, barn.sort_code nulls last, barn.barn_code, barn.id
  loop
    select greatest(
      current_date - 7,
      coalesce(max(coalesce(placement.active_end, flock.max_date)), current_date - 7)
    )
    into v_anchor_date
    from public.placements placement
    join public.flocks flock on flock.id = placement.flock_id
    where placement.barn_id = v_barn.id
      and placement.lifecycle_stage is distinct from 'canceled';

    v_total_head := greatest(v_barn.standard_head, 1000);
    v_female_head := round(v_total_head * 0.91)::integer;
    v_male_head := v_total_head - v_female_head;

    for v_cycle in 1..2 loop
      v_start_date := v_anchor_date + 14 + ((v_cycle - 1) * 77);
      v_end_date := v_start_date + 63;
      v_flock_id := md5('flocktrax-demo-future-flock:' || v_barn.id::text || ':' || v_cycle::text)::uuid;
      v_placement_id := md5('flocktrax-demo-future-placement:' || v_barn.id::text || ':' || v_cycle::text)::uuid;
      v_flock_number := 7000 + (v_barn.barn_index * 10) + v_cycle;

      insert into public.flocks (
        id, farm_id, flock_number, date_placed, max_date,
        start_cnt_females, start_cnt_males, is_active, is_complete,
        is_in_barn, is_settled, created_by, female_date_placed,
        male_date_placed, breed_females, breed_males
      )
      values (
        v_flock_id, v_barn.farm_id, v_flock_number, v_start_date, v_end_date,
        v_female_head, v_male_head, false, false,
        false, false, v_owner_id, v_start_date,
        v_start_date + 1, v_female_breed_id, v_male_breed_id
      );

      insert into public.placements (
        id, farm_id, barn_id, flock_id, is_active, placement_key,
        created_by, active_start, active_end, lifecycle_stage, lh1_date
      )
      values (
        v_placement_id,
        v_barn.farm_id,
        v_barn.id,
        v_flock_id,
        false,
        'DEMO-FUTURE-' || v_barn.farm_code || '-' || v_barn.barn_code || '-' || v_flock_number::text,
        v_owner_id,
        v_start_date,
        v_end_date,
        'scheduled',
        case when v_cycle = 1 then v_start_date + 57 else null end
      );

      if v_cycle = 1 then
        insert into public.livehaul_schedule (
          livehaul_id, placement_id, flock_id, farm_id, barn_id,
          lh_date, sequence_num, head_target, head_actual, status,
          comment, created_by, updated_by, target_sex
        )
        values (
          md5('flocktrax-demo-future-livehaul:' || v_barn.id::text)::uuid,
          v_placement_id,
          v_flock_id,
          v_barn.farm_id,
          v_barn.id,
          v_start_date + 57,
          1,
          round(v_total_head * 0.94)::integer,
          null,
          'scheduled',
          'Synthetic future livehaul for demo calendar and planning.',
          v_owner_id,
          v_owner_id::text,
          null
        );
      end if;
    end loop;
  end loop;

  update demo_control.environment
  set seed_version = greatest(seed_version, 5)
  where singleton = true;
end
$$;

create or replace function demo_control.showcase_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
declare
  v_expected_project_ref constant text := 'srkgobayrzidytmvoago';
  v_status jsonb;
  v_future_schedule_ok boolean;
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

  v_future_schedule_ok := not exists (
    select 1
    from public.barns barn
    where barn.is_active is distinct from false
      and (
        (select count(*)
         from public.placements placement
         join public.flocks flock on flock.id = placement.flock_id
         where placement.barn_id = barn.id
           and placement.lifecycle_stage = 'scheduled'
           and flock.date_placed > current_date) < 2
        or
        (select count(*)
         from public.livehaul_schedule livehaul
         where livehaul.barn_id = barn.id
           and livehaul.status = 'scheduled'
           and livehaul.lh_date > current_date) < 1
      )
  );

  select jsonb_build_object(
    'ok',
      (select count(*) = 2 from public.farm_groups)
      and (select count(*) = 3 from public.farms)
      and (select count(*) = 6 from public.barns)
      and (select count(*) = 17 from public.placements)
      and (select count(*) = 17 from public.flocks)
      and (select count(*) = 91 from public.log_daily)
      and (select count(*) = 91 from public.log_mortality)
      and (select count(*) = 22 from public.log_weight)
      and (select count(*) = 3 from public.feed_tickets)
      and (select count(*) = 4 from public.feed_drops)
      and (select count(*) = 8 from public.livehaul_schedule)
      and (select count(*) = 2 from public.livehaul_loads)
      and (select count(*) = 3 from public.issues)
      and (select count(*) = 10 from public.daily_age_tasks)
      and (select count(*) = 0 from gsync.outbox)
      and (select count(*) = 0 from platform.sync_outbox)
      and v_future_schedule_ok
      and exists (
        select 1
        from public.farms farm
        join public.farm_groups farm_group on farm_group.id = farm.farm_group_id
        where farm.id = 'de200000-0000-4000-8000-000000000003'::uuid
          and farm_group.id = 'de100000-0000-4000-8000-000000000002'::uuid
      ),
    'project_ref', v_expected_project_ref,
    'farm_groups', (select count(*) from public.farm_groups),
    'farms', (select count(*) from public.farms),
    'barns', (select count(*) from public.barns),
    'flocks', (select count(*) from public.flocks),
    'placements', (select count(*) from public.placements),
    'future_placements', (select count(*) from public.placements placement join public.flocks flock on flock.id = placement.flock_id where placement.lifecycle_stage = 'scheduled' and flock.date_placed > current_date),
    'daily_logs', (select count(*) from public.log_daily),
    'mortality_logs', (select count(*) from public.log_mortality),
    'weight_samples', (select count(*) from public.log_weight),
    'feed_tickets', (select count(*) from public.feed_tickets),
    'feed_drops', (select count(*) from public.feed_drops),
    'livehaul_events', (select count(*) from public.livehaul_schedule),
    'future_livehaul_events', (select count(*) from public.livehaul_schedule where status = 'scheduled' and lh_date > current_date),
    'livehaul_loads', (select count(*) from public.livehaul_loads),
    'issues', (select count(*) from public.issues),
    'daily_age_tasks', (select count(*) from public.daily_age_tasks),
    'future_schedule_verified', v_future_schedule_ok,
    'google_outbox_pending', (select count(*) from gsync.outbox),
    'platform_outbox_pending', (select count(*) from platform.sync_outbox),
    'seeded_at', (select seeded_at from demo_control.environment where singleton = true)
  ) into v_status;

  return v_status;
end
$$;

create or replace function public.reset_demo_showcase_data()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, demo_control
as $$
begin
  perform demo_control.ensure_app_settings_showcase();
  perform demo_control.ensure_daily_age_tasks_showcase();
  perform demo_control.reset_showcase_data();
  perform demo_control.ensure_multi_group_showcase();
  perform demo_control.ensure_binsentry_feed_showcase();
  perform demo_control.ensure_feed_prediction_curves();
  perform demo_control.ensure_future_schedule_showcase();
  perform demo_control.ensure_binsentry_inventory_snapshots();
  perform demo_control.ensure_app_settings_showcase();
  perform demo_control.ensure_daily_age_tasks_showcase();
  return demo_control.full_showcase_status();
end
$$;

revoke all on function demo_control.ensure_daily_age_tasks_showcase() from public, anon, authenticated;
revoke all on function demo_control.ensure_future_schedule_showcase() from public, anon, authenticated;
revoke all on function demo_control.showcase_status() from public, anon, authenticated;
revoke all on function public.reset_demo_showcase_data() from public, anon, authenticated;
grant execute on function demo_control.ensure_daily_age_tasks_showcase() to service_role;
grant execute on function demo_control.ensure_future_schedule_showcase() to service_role;
grant execute on function demo_control.showcase_status() to service_role;
grant execute on function public.reset_demo_showcase_data() to service_role;

select demo_control.ensure_daily_age_tasks_showcase();
select demo_control.ensure_future_schedule_showcase();

do $$
declare
  v_status jsonb;
begin
  v_status := demo_control.full_showcase_status();
  if coalesce((v_status ->> 'ok')::boolean, false) is not true
    or coalesce((v_status ->> 'future_schedule_verified')::boolean, false) is not true
    or coalesce((v_status ->> 'daily_age_tasks')::integer, 0) <> 10 then
    raise exception 'Expanded demo schedule verification failed: %', v_status;
  end if;
end
$$;
