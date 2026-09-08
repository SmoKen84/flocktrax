-- Populate the inventory-snapshot table consumed by the projection engine.
-- The feed-bin rows remain the editable current-state representation; these
-- reset-time observations make the report's on-hand totals demonstrable.

create or replace function demo_control.ensure_binsentry_inventory_snapshots()
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
    raise exception 'Demo environment marker mismatch; inventory snapshot seed refused';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  delete from public.feed_inventory_snapshots
  where source = 'binsentry_demo';

  insert into public.feed_inventory_snapshots (
    snapshot_id, farm_id, barn_id, feed_bin_id, placement_id, source,
    captured_at, inventory_lbs, feed_name, raw_payload, created_by,
    accessible_feed_type, queued_feed_type
  )
  values
    ('def00000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000001', 'de300000-0000-4000-8000-000000000001', 'de700000-0000-4000-8000-000000000001', 'de500000-0000-4000-8000-000000000001', 'binsentry_demo', now() - interval '18 minutes', 8600, 'Evergreen Starter Crumble', '{"simulated":true}'::jsonb, v_owner_id, 'starter', null),
    ('def00000-0000-4000-8000-000000000002', 'de200000-0000-4000-8000-000000000001', 'de300000-0000-4000-8000-000000000001', 'de700000-0000-4000-8000-000000000002', 'de500000-0000-4000-8000-000000000001', 'binsentry_demo', now() - interval '16 minutes', 17200, 'Evergreen Grower Pellet', '{"simulated":true}'::jsonb, v_owner_id, 'grower', null),
    ('def00000-0000-4000-8000-000000000003', 'de200000-0000-4000-8000-000000000001', 'de300000-0000-4000-8000-000000000002', 'de700000-0000-4000-8000-000000000003', 'de500000-0000-4000-8000-000000000002', 'binsentry_demo', now() - interval '12 minutes', 6100, 'Evergreen Grower Pellet', '{"simulated":true}'::jsonb, v_owner_id, 'grower', 'starter'),
    ('def00000-0000-4000-8000-000000000004', 'de200000-0000-4000-8000-000000000002', 'de300000-0000-4000-8000-000000000003', 'de700000-0000-4000-8000-000000000004', 'de500000-0000-4000-8000-000000000003', 'binsentry_demo', now() - interval '8 minutes', 11900, 'Evergreen Grower Pellet', '{"simulated":true}'::jsonb, v_owner_id, 'grower', null),
    ('def00000-0000-4000-8000-000000000005', 'de200000-0000-4000-8000-000000000002', 'de300000-0000-4000-8000-000000000004', 'de700000-0000-4000-8000-000000000005', 'de500000-0000-4000-8000-000000000004', 'binsentry_demo', now() - interval '5 minutes', 0, 'Empty demo bin', '{"simulated":true}'::jsonb, v_owner_id, null, null);
end
$$;

revoke all on function demo_control.ensure_binsentry_inventory_snapshots() from public, anon, authenticated;
grant execute on function demo_control.ensure_binsentry_inventory_snapshots() to service_role;

create or replace function demo_control.full_showcase_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
declare
  v_status jsonb;
  v_feed_ok boolean;
begin
  v_status := demo_control.showcase_status();
  v_feed_ok :=
    (select count(*) = 3 from public.feed_order_commitments where source = 'binsentry_demo')
    and (select count(*) = 5 from public.feedbins where feed_state_source = 'binsentry_demo' and binsentry_last_inventory_lbs is not null)
    and (select count(*) = 5 from public.feed_inventory_snapshots where source = 'binsentry_demo')
    and (select count(*) = 182 from public.stdbreedspec where geneticname = 'Cobb 500 Demo' and is_active = true)
    and (select count(*) = 5 from public.flocks where id::text like 'de400000-%' and breed_females is not null and breed_males is not null);

  return v_status || jsonb_build_object(
    'ok', coalesce((v_status ->> 'ok')::boolean, false) and v_feed_ok,
    'binsentry_demo_orders', (select count(*) from public.feed_order_commitments where source = 'binsentry_demo'),
    'binsentry_demo_bins', (select count(*) from public.feed_inventory_snapshots where source = 'binsentry_demo'),
    'feed_prediction_curve_days', (select count(distinct age) from public.stdbreedspec where geneticname = 'Cobb 500 Demo' and is_active = true)
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
  perform demo_control.reset_showcase_data();
  perform demo_control.ensure_multi_group_showcase();
  perform demo_control.ensure_binsentry_feed_showcase();
  perform demo_control.ensure_feed_prediction_curves();
  perform demo_control.ensure_binsentry_inventory_snapshots();
  return demo_control.full_showcase_status();
end
$$;

revoke all on function demo_control.full_showcase_status() from public, anon, authenticated;
revoke all on function public.reset_demo_showcase_data() from public, anon, authenticated;
grant execute on function demo_control.full_showcase_status() to service_role;
grant execute on function public.reset_demo_showcase_data() to service_role;

select demo_control.ensure_binsentry_inventory_snapshots();

do $$
begin
  if (select count(*) from public.feed_inventory_snapshots where source = 'binsentry_demo') <> 5 then
    raise exception 'Demo BinSentry inventory snapshot verification failed';
  end if;
end
$$;
