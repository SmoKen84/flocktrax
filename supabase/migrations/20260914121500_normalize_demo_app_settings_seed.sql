-- Keep the reset baseline in a protected demo_control table so future setting
-- additions can be managed without duplicating the reset/status definitions.

create table if not exists demo_control.app_settings_seed (
  id uuid primary key,
  setting_group text not null,
  setting_name text not null,
  setting_value text not null,
  setting_description text not null,
  unique (setting_group, setting_name)
);

revoke all on table demo_control.app_settings_seed from public, anon, authenticated;

truncate table demo_control.app_settings_seed;

insert into demo_control.app_settings_seed (
  id, setting_group, setting_name, setting_value, setting_description
)
select
  id,
  "group",
  name,
  case when name = 'DOW_Date' then 'ddd, mmm dd' else value end,
  "desc"
from public.app_settings;

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

  delete from public.app_settings;

  insert into public.app_settings (id, "group", name, value, "desc", updated_at)
  select id, setting_group, setting_name, setting_value, setting_description, now()
  from demo_control.app_settings_seed
  order by setting_group, setting_name;

  update demo_control.environment
  set seed_version = greatest(seed_version, 4)
  where singleton = true;
end
$$;

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
    (select count(*) from public.app_settings) = (select count(*) from demo_control.app_settings_seed)
    and not exists (
      select 1
      from demo_control.app_settings_seed expected
      where not exists (
        select 1
        from public.app_settings actual
        where actual.id = expected.id
          and actual."group" = expected.setting_group
          and actual.name = expected.setting_name
          and actual.value = expected.setting_value
          and actual."desc" = expected.setting_description
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

revoke all on function demo_control.ensure_app_settings_showcase() from public, anon, authenticated;
revoke all on function demo_control.full_showcase_status() from public, anon, authenticated;
grant execute on function demo_control.ensure_app_settings_showcase() to service_role;
grant execute on function demo_control.full_showcase_status() to service_role;

select demo_control.ensure_app_settings_showcase();

do $$
declare
  v_status jsonb;
begin
  v_status := demo_control.full_showcase_status();
  if coalesce((v_status ->> 'app_settings_verified')::boolean, false) is not true then
    raise exception 'Normalized demo application settings verification failed: %', v_status;
  end if;
end
$$;
