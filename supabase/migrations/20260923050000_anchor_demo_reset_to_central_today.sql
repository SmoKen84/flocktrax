-- Demo only: rebuild history relative to the owner's current Central date.
do $$ begin
  if not exists (select 1 from demo_control.environment where singleton and project_ref = 'srkgobayrzidytmvoago') then
    raise exception 'Demo project marker missing; refusing reset change';
  end if;
end $$;

create or replace function public.reset_demo_showcase_data()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, demo_control
set timezone = 'America/Chicago'
as $$
declare
  v_status jsonb;
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
  perform demo_control.ensure_closeout_documents_showcase();

  if (select max(log_date) from public.log_daily) is distinct from current_date
     or (select max(log_date) from public.log_mortality) is distinct from current_date then
    raise exception 'Demo reset did not create activity through today; reset rolled back';
  end if;
  v_status := demo_control.full_showcase_status();
  if (v_status->>'ok')::boolean is distinct from true then
    raise exception 'Demo reset verification failed; reset rolled back';
  end if;
  return v_status || jsonb_build_object('anchor_date', current_date, 'date_timezone', 'America/Chicago');
end
$$;
