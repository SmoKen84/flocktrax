-- Supply the demo feed reports with resettable, synthetic BinSentry inputs.
-- Operational demand continues to come from the ordinary demo placement,
-- mortality, breed-standard, and livehaul tables. No vendor endpoint is used.

create or replace function demo_control.ensure_binsentry_feed_showcase()
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
    raise exception 'Demo environment marker mismatch; BinSentry showcase seed refused';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = v_owner_id
      and lower(email) = 'ken@mothercluckershenhouse.com'
  ) then
    raise exception 'Demo owner identity mismatch; BinSentry showcase seed refused';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  update public.feedbins
  set binsentry_last_sync_at = case id
        when 'de700000-0000-4000-8000-000000000001'::uuid then now() - interval '18 minutes'
        when 'de700000-0000-4000-8000-000000000002'::uuid then now() - interval '16 minutes'
        when 'de700000-0000-4000-8000-000000000003'::uuid then now() - interval '12 minutes'
        when 'de700000-0000-4000-8000-000000000004'::uuid then now() - interval '8 minutes'
        else now() - interval '5 minutes'
      end,
      binsentry_sync_note = 'Synthetic BinSentry reading for the isolated demo environment',
      feed_state_source = 'binsentry_demo'
  where id in (
    'de700000-0000-4000-8000-000000000001'::uuid,
    'de700000-0000-4000-8000-000000000002'::uuid,
    'de700000-0000-4000-8000-000000000003'::uuid,
    'de700000-0000-4000-8000-000000000004'::uuid,
    'de700000-0000-4000-8000-000000000005'::uuid
  );

  delete from public.feed_order_commitments
  where source = 'binsentry_demo';

  insert into public.feed_order_commitments (
    commitment_id, farm_id, barn_id, feed_bin_id, placement_id,
    source, status, expected_delivery_date, ordered_lbs, received_lbs,
    feed_name, external_order_ref, notes, created_by, updated_by, feed_type
  )
  values
    (
      'ded00000-0000-4000-8000-000000000001',
      'de200000-0000-4000-8000-000000000001',
      'de300000-0000-4000-8000-000000000001',
      'de700000-0000-4000-8000-000000000001',
      null,
      'binsentry_demo', 'open', current_date + 2, 16000, 0,
      'Evergreen Starter Crumble', 'BS-DEMO-4107',
      'Synthetic scheduled BinSentry order. No vendor system was contacted.',
      v_owner_id, v_owner_id::text, 'starter'
    ),
    (
      'ded00000-0000-4000-8000-000000000002',
      'de200000-0000-4000-8000-000000000001',
      'de300000-0000-4000-8000-000000000002',
      'de700000-0000-4000-8000-000000000003',
      null,
      'binsentry_demo', 'partial', current_date + 1, 22000, 4000,
      'Evergreen Grower Pellet', 'BS-DEMO-4112',
      'Synthetic partially fulfilled BinSentry order. No vendor system was contacted.',
      v_owner_id, v_owner_id::text, 'grower'
    ),
    (
      'ded00000-0000-4000-8000-000000000003',
      'de200000-0000-4000-8000-000000000002',
      'de300000-0000-4000-8000-000000000003',
      'de700000-0000-4000-8000-000000000004',
      null,
      'binsentry_demo', 'open', current_date + 4, 12000, 0,
      'Evergreen Grower Pellet', 'BS-DEMO-4120',
      'Synthetic scheduled BinSentry order before livehaul. No vendor system was contacted.',
      v_owner_id, v_owner_id::text, 'grower'
    );

  update demo_control.environment
  set seed_version = greatest(seed_version, 3)
  where singleton = true;
end
$$;

revoke all on function demo_control.ensure_binsentry_feed_showcase() from public, anon, authenticated;
grant execute on function demo_control.ensure_binsentry_feed_showcase() to service_role;

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
    and (select count(*) = 5 from public.feedbins where feed_state_source = 'binsentry_demo' and binsentry_last_inventory_lbs is not null);

  return v_status || jsonb_build_object(
    'ok', coalesce((v_status ->> 'ok')::boolean, false) and v_feed_ok,
    'binsentry_demo_orders', (select count(*) from public.feed_order_commitments where source = 'binsentry_demo'),
    'binsentry_demo_bins', (select count(*) from public.feedbins where feed_state_source = 'binsentry_demo' and binsentry_last_inventory_lbs is not null)
  );
end
$$;

revoke all on function demo_control.full_showcase_status() from public, anon, authenticated;
grant execute on function demo_control.full_showcase_status() to service_role;

create or replace function public.get_demo_showcase_status()
returns jsonb
language sql
security definer
set search_path = pg_catalog, demo_control
as $$
  select demo_control.full_showcase_status();
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
  return demo_control.full_showcase_status();
end
$$;

revoke all on function public.get_demo_showcase_status() from public, anon, authenticated;
revoke all on function public.reset_demo_showcase_data() from public, anon, authenticated;
grant execute on function public.get_demo_showcase_status() to service_role;
grant execute on function public.reset_demo_showcase_data() to service_role;

select demo_control.ensure_binsentry_feed_showcase();

do $$
begin
  if (select count(*) from public.feed_order_commitments where source = 'binsentry_demo') <> 3
    or (select count(*) from public.feedbins where feed_state_source = 'binsentry_demo' and binsentry_last_inventory_lbs is not null) <> 5 then
    raise exception 'BinSentry demo seed verification failed';
  end if;
end
$$;
