-- Give the synthetic flocks a complete breed/feed curve so feed demand is
-- calculated by the real projection engine rather than appearing as zero.

create or replace function demo_control.ensure_feed_prediction_curves()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, demo_control
as $$
declare
  v_owner_id constant uuid := 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a';
  v_female_breed_id constant uuid := 'dee00000-0000-4000-8000-000000000001';
  v_male_breed_id constant uuid := 'dee00000-0000-4000-8000-000000000002';
begin
  if not exists (
    select 1
    from demo_control.environment
    where singleton = true
      and project_ref = 'srkgobayrzidytmvoago'
      and owner_user_id = v_owner_id
      and lower(owner_email) = 'ken@mothercluckershenhouse.com'
  ) then
    raise exception 'Demo environment marker mismatch; feed prediction curve seed refused';
  end if;

  insert into public.breeds (id, code, breed_name, sex, is_active)
  values
    (v_female_breed_id, 'demo_cobb500_f', 'Cobb 500 Demo', 'female', true),
    (v_male_breed_id, 'demo_cobb500_m', 'Cobb 500 Demo', 'male', true)
  on conflict (code) do update
    set breed_name = excluded.breed_name,
        sex = excluded.sex,
        is_active = true,
        updated_at = now();

  delete from public.stdbreedspec
  where geneticname = 'Cobb 500 Demo';

  insert into public.stdbreedspec (
    geneticname, breedid, age, dayfeedperbird, targetweight,
    note, last_userid, created_date, last_updated, is_active
  )
  select
    'Cobb 500 Demo',
    s.sex,
    d.age,
    round((
      case
        when d.age <= 7 then 0.030 + d.age * 0.008
        when d.age <= 21 then 0.086 + (d.age - 7) * 0.010
        when d.age <= 42 then 0.226 + (d.age - 21) * 0.011
        else 0.457 + (d.age - 42) * 0.004
      end
      * case when s.sex = 'male' then 1.08 else 1.00 end
    )::numeric, 4),
    round((
      0.10 + d.age * d.age * 0.0027
    ) * case when s.sex = 'male' then 1.10 else 1.00 end, 3),
    'Synthetic breed standard used only by the isolated demo dataset.',
    v_owner_id::text,
    now(),
    now(),
    true
  from generate_series(0, 90) as d(age)
  cross join (values ('female'), ('male')) as s(sex);

  update public.flocks
  set breed_females = v_female_breed_id,
      breed_males = v_male_breed_id
  where id in (
    'de400000-0000-4000-8000-000000000001'::uuid,
    'de400000-0000-4000-8000-000000000002'::uuid,
    'de400000-0000-4000-8000-000000000003'::uuid,
    'de400000-0000-4000-8000-000000000004'::uuid,
    'de400000-0000-4000-8000-000000000005'::uuid
  );

  update demo_control.environment
  set seed_version = greatest(seed_version, 4)
  where singleton = true;
end
$$;

revoke all on function demo_control.ensure_feed_prediction_curves() from public, anon, authenticated;
grant execute on function demo_control.ensure_feed_prediction_curves() to service_role;

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
    and (select count(*) = 182 from public.stdbreedspec where geneticname = 'Cobb 500 Demo' and is_active = true)
    and (select count(*) = 5 from public.flocks where id::text like 'de400000-%' and breed_females is not null and breed_males is not null);

  return v_status || jsonb_build_object(
    'ok', coalesce((v_status ->> 'ok')::boolean, false) and v_feed_ok,
    'binsentry_demo_orders', (select count(*) from public.feed_order_commitments where source = 'binsentry_demo'),
    'binsentry_demo_bins', (select count(*) from public.feedbins where feed_state_source = 'binsentry_demo' and binsentry_last_inventory_lbs is not null),
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
  return demo_control.full_showcase_status();
end
$$;

revoke all on function demo_control.full_showcase_status() from public, anon, authenticated;
revoke all on function public.reset_demo_showcase_data() from public, anon, authenticated;
grant execute on function demo_control.full_showcase_status() to service_role;
grant execute on function public.reset_demo_showcase_data() to service_role;

select demo_control.ensure_feed_prediction_curves();

do $$
begin
  if (select count(*) from public.stdbreedspec where geneticname = 'Cobb 500 Demo' and is_active = true) <> 182
    or (select count(*) from public.flocks where id::text like 'de400000-%' and breed_females is not null and breed_males is not null) <> 5 then
    raise exception 'Demo feed prediction curve verification failed';
  end if;
end
$$;
