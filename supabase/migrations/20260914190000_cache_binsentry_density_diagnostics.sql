alter table public.feedbins
  add column if not exists binsentry_last_bulk_density_kg_m3 numeric,
  add column if not exists binsentry_last_bulk_density_lb_ft3 numeric,
  add column if not exists binsentry_last_estimated_volume_m3 numeric,
  add column if not exists binsentry_last_weight_source text;

comment on column public.feedbins.binsentry_last_bulk_density_kg_m3 is
  'Most recent bulk density returned by BinSentry for the bin, in kilograms per cubic meter.';

comment on column public.feedbins.binsentry_last_bulk_density_lb_ft3 is
  'Most recent BinSentry bulk density converted to pounds per cubic foot for operator visibility.';

comment on column public.feedbins.binsentry_last_estimated_volume_m3 is
  'Most recent estimated BinSentry inventory volume in cubic meters.';

comment on column public.feedbins.binsentry_last_weight_source is
  'Source field or calculation used for the cached BinSentry inventory pounds.';

create or replace function demo_control.ensure_binsentry_density_diagnostics()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
begin
  update public.feedbins
  set
    binsentry_last_bulk_density_kg_m3 = case
      when lower(coalesce(accessible_feed_type, '')) = 'starter' then 610
      else 580
    end,
    binsentry_last_bulk_density_lb_ft3 = case
      when lower(coalesce(accessible_feed_type, '')) = 'starter' then 610 * 0.0624279606
      else 580 * 0.0624279606
    end,
    binsentry_last_estimated_volume_m3 = case
      when coalesce(binsentry_last_inventory_lbs, accessible_feed_lbs) is null then null
      else coalesce(binsentry_last_inventory_lbs, accessible_feed_lbs) /
        ((case when lower(coalesce(accessible_feed_type, '')) = 'starter' then 610 else 580 end) * 2.20462)
    end,
    binsentry_last_weight_source = 'calculated:estimatedVolume*bulkDensity'
  where binsentry_bin_ref is not null;
end
$$;

revoke all on function demo_control.ensure_binsentry_density_diagnostics() from public, anon, authenticated;
grant execute on function demo_control.ensure_binsentry_density_diagnostics() to service_role;

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
  perform demo_control.ensure_binsentry_density_diagnostics();
  perform demo_control.ensure_feed_prediction_curves();
  perform demo_control.ensure_future_schedule_showcase();
  perform demo_control.ensure_binsentry_inventory_snapshots();
  perform demo_control.ensure_app_settings_showcase();
  perform demo_control.ensure_daily_age_tasks_showcase();
  return demo_control.full_showcase_status();
end
$$;

revoke all on function public.reset_demo_showcase_data() from public, anon, authenticated;
grant execute on function public.reset_demo_showcase_data() to service_role;

select demo_control.ensure_binsentry_density_diagnostics();
