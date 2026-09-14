-- Seed the general application settings shown in the demo Admin console.
--
-- These rows are deliberately synthetic and resettable. The settings seed is
-- applied before the operational data is rebuilt so user-edited thresholds
-- cannot make a subsequent showcase reset non-deterministic.

create or replace function demo_control.ensure_app_settings_showcase()
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
    raise exception 'Demo environment marker mismatch; application settings seed refused';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = v_owner_id
      and lower(email) = 'ken@mothercluckershenhouse.com'
  ) then
    raise exception 'Demo owner identity mismatch; application settings seed refused';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  -- This is a dedicated demo database. Remove evaluator-created rows and
  -- restore the complete, known showcase set on every guarded reset.
  delete from public.app_settings;

  insert into public.app_settings (id, "group", name, value, "desc", updated_at)
  values
    ('dee00000-0000-4000-8000-000000000001', 'INTEGRATOR', 'company_name', 'Evergreen Poultry Integrators', 'Integrator name displayed in dashboard and archive reporting.', now()),
    ('dee00000-0000-4000-8000-000000000002', 'Placements', 'age_checkout_avail', '55', 'Bird age, in days, when the closeout workflow becomes available.', now()),
    ('dee00000-0000-4000-8000-000000000003', 'Placements', 'First-LH', '57', 'Default bird age used to estimate the first livehaul date.', now()),
    ('dee00000-0000-4000-8000-000000000004', 'Placements', 'growout_days', '63', 'Default grow-out duration used by placement scheduling.', now()),
    ('dee00000-0000-4000-8000-000000000005', 'Placements', 'next_place_date', '14', 'Default days between the end of one cycle and the next placement.', now()),
    ('dee00000-0000-4000-8000-000000000006', 'Placements', 'allow_historical_entry', 'false', 'Allows authorized operators to enter historical placement transactions when enabled.', now()),
    ('dee00000-0000-4000-8000-000000000007', 'Feed Planning', 'starter_lbs_per_chick', '2.5', 'Lifetime Starter feed target, in pounds, per chick placed.', now()),
    ('dee00000-0000-4000-8000-000000000008', 'Feed Planning', 'default_density_starter', '40', 'Fallback Starter feed bulk density in pounds per cubic foot.', now()),
    ('dee00000-0000-4000-8000-000000000009', 'Feed Planning', 'default_density_grower', '38', 'Fallback Grower feed bulk density in pounds per cubic foot.', now()),
    ('dee00000-0000-4000-8000-000000000010', 'Alerts', 'mortality_autowarn', 'true', 'Enables automatic mortality and hatchery-quality Action Items.', now()),
    ('dee00000-0000-4000-8000-000000000011', 'Alerts', '7day_warning', '10', 'First-seven-day mortality warning threshold as a percentage.', now()),
    ('dee00000-0000-4000-8000-000000000012', 'Alerts', 'hatchery_issue_level', '3', 'First-day hatchery-quality warning threshold as a percentage.', now()),
    ('dee00000-0000-4000-8000-000000000013', 'feed_tickets', 'voucher_prefix', 'DEMO-', 'Prefix used for internally generated transfer and adjustment vouchers.', now()),
    ('dee00000-0000-4000-8000-000000000014', 'feed_tickets', 'internal_voucher_number', '5001', 'Next internal transfer or adjustment voucher number.', now()),
    ('dee00000-0000-4000-8000-000000000015', 'Mobile Display', 'DOW_Date', 'EEE, MMM d', 'Date format used for estimated first-livehaul display.', now()),
    ('dee00000-0000-4000-8000-000000000016', 'Mobile Display', 'short_date', 'MM/dd/yy', 'Compact date format used in mobile operational views.', now()),
    ('dee00000-0000-4000-8000-000000000017', 'Reports', 'flock_history_title', 'Flock History', 'Button and report title for the complete flock-history package.', now()),
    ('dee00000-0000-4000-8000-000000000018', 'Reports', 'flock_history_pg1', 'Daily Log Matrix', 'Title for the flock-history daily operations page.', now()),
    ('dee00000-0000-4000-8000-000000000019', 'Reports', 'flock_history_pg2', 'Mortality Matrix', 'Title for the flock-history mortality page.', now()),
    ('dee00000-0000-4000-8000-000000000020', 'Reports', 'flock_history_pg4', 'Action Items', 'Title for the flock-history Action Items page.', now());

  update demo_control.environment
  set seed_version = greatest(seed_version, 4)
  where singleton = true;
end
$$;

revoke all on function demo_control.ensure_app_settings_showcase() from public, anon, authenticated;
grant execute on function demo_control.ensure_app_settings_showcase() to service_role;

create or replace function demo_control.full_showcase_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
declare
  v_status jsonb;
  v_feed_ok boolean;
  v_settings_ok boolean;
begin
  v_status := demo_control.showcase_status();
  v_feed_ok :=
    (select count(*) = 3 from public.feed_order_commitments where source = 'binsentry_demo')
    and (select count(*) = 5 from public.feedbins where feed_state_source = 'binsentry_demo' and binsentry_last_inventory_lbs is not null)
    and (select count(*) = 5 from public.feed_inventory_snapshots where source = 'binsentry_demo')
    and (select count(*) = 182 from public.stdbreedspec where geneticname = 'Cobb 500 Demo' and is_active = true)
    and (select count(*) = 5 from public.flocks where id::text like 'de400000-%' and breed_females is not null and breed_males is not null);

  v_settings_ok :=
    (select count(*) = 20 from public.app_settings)
    and not exists (
      select 1
      from (values
        ('INTEGRATOR', 'company_name', 'Evergreen Poultry Integrators'),
        ('Placements', 'age_checkout_avail', '55'),
        ('Placements', 'First-LH', '57'),
        ('Placements', 'growout_days', '63'),
        ('Placements', 'next_place_date', '14'),
        ('Placements', 'allow_historical_entry', 'false'),
        ('Feed Planning', 'starter_lbs_per_chick', '2.5'),
        ('Feed Planning', 'default_density_starter', '40'),
        ('Feed Planning', 'default_density_grower', '38'),
        ('Alerts', 'mortality_autowarn', 'true'),
        ('Alerts', '7day_warning', '10'),
        ('Alerts', 'hatchery_issue_level', '3'),
        ('feed_tickets', 'voucher_prefix', 'DEMO-'),
        ('feed_tickets', 'internal_voucher_number', '5001'),
        ('Mobile Display', 'DOW_Date', 'EEE, MMM d'),
        ('Mobile Display', 'short_date', 'MM/dd/yy'),
        ('Reports', 'flock_history_title', 'Flock History'),
        ('Reports', 'flock_history_pg1', 'Daily Log Matrix'),
        ('Reports', 'flock_history_pg2', 'Mortality Matrix'),
        ('Reports', 'flock_history_pg4', 'Action Items')
      ) as expected(setting_group, setting_name, setting_value)
      where not exists (
        select 1
        from public.app_settings actual
        where actual."group" = expected.setting_group
          and actual.name = expected.setting_name
          and actual.value = expected.setting_value
      )
    );

  return v_status || jsonb_build_object(
    'ok', coalesce((v_status ->> 'ok')::boolean, false) and v_feed_ok and v_settings_ok,
    'binsentry_demo_orders', (select count(*) from public.feed_order_commitments where source = 'binsentry_demo'),
    'binsentry_demo_bins', (select count(*) from public.feed_inventory_snapshots where source = 'binsentry_demo'),
    'feed_prediction_curve_days', (select count(distinct age) from public.stdbreedspec where geneticname = 'Cobb 500 Demo' and is_active = true),
    'app_settings', (select count(*) from public.app_settings),
    'app_settings_verified', v_settings_ok
  );
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
  perform demo_control.reset_showcase_data();
  perform demo_control.ensure_multi_group_showcase();
  perform demo_control.ensure_binsentry_feed_showcase();
  perform demo_control.ensure_feed_prediction_curves();
  perform demo_control.ensure_binsentry_inventory_snapshots();
  perform demo_control.ensure_app_settings_showcase();
  return demo_control.full_showcase_status();
end
$$;

revoke all on function demo_control.full_showcase_status() from public, anon, authenticated;
revoke all on function public.reset_demo_showcase_data() from public, anon, authenticated;
grant execute on function demo_control.full_showcase_status() to service_role;
grant execute on function public.reset_demo_showcase_data() to service_role;

select demo_control.ensure_app_settings_showcase();

do $$
declare
  v_status jsonb;
begin
  v_status := demo_control.full_showcase_status();
  if coalesce((v_status ->> 'app_settings_verified')::boolean, false) is not true then
    raise exception 'Demo application settings verification failed: %', v_status;
  end if;
end
$$;
