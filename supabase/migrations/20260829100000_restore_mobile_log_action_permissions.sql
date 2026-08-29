-- Restore authorized mobile worker writes after P0 authorization containment.
--
-- The mobile submit functions already authorize daily, mortality, and weight
-- operations through roles_actions_permissions. P0 incorrectly applied the
-- separate manager-only can_write_farm() rule to log inserts and updates,
-- blocking FarmHand and other explicitly authorized operational roles.

begin;

create or replace function public.can_perform_farm_action(
  target_farm_id uuid,
  target_action text,
  target_operation text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.farm_memberships fm
      join public.roles_actions_permissions rap on rap.role_id = fm.role_id
      join public.sysactions sa on sa.id = rap.action_id
      where fm.user_id = auth.uid()
        and fm.farm_id = target_farm_id
        and fm.is_active = true
        and lower(sa.action) = lower(target_action)
        and case lower(target_operation)
          when 'create' then rap.createyn is true
          when 'update' then rap.updateyn is true
          else false
        end
    )
    or exists (
      select 1
      from public.farms f
      join public.farm_group_memberships fgm
        on fgm.farm_group_id = f.farm_group_id
      join public.roles_actions_permissions rap on rap.role_id = fgm.role_id
      join public.sysactions sa on sa.id = rap.action_id
      where f.id = target_farm_id
        and fgm.user_id = auth.uid()
        and fgm.active = true
        and lower(sa.action) = lower(target_action)
        and case lower(target_operation)
          when 'create' then rap.createyn is true
          when 'update' then rap.updateyn is true
          else false
        end
    );
$$;

revoke all privileges on function public.can_perform_farm_action(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.can_perform_farm_action(uuid, text, text)
  to authenticated, service_role;

-- The daily and weight implementations write audit rows through the internal
-- owner-rights write_activity_log() function. Keep that function private by
-- moving all three mobile save implementations behind same-signature wrappers
-- that authorize the actor and target farm before executing as the owner.
alter function public.save_log_daily_mobile(uuid, date, jsonb)
  rename to save_log_daily_mobile_internal;
alter function public.save_log_mortality_mobile(uuid, date, jsonb)
  rename to save_log_mortality_mobile_internal;
alter function public.save_log_weight_mobile(uuid, date, text, jsonb)
  rename to save_log_weight_mobile_internal;

revoke all privileges on function public.save_log_daily_mobile_internal(uuid, date, jsonb)
  from public, anon, authenticated;
revoke all privileges on function public.save_log_mortality_mobile_internal(uuid, date, jsonb)
  from public, anon, authenticated;
revoke all privileges on function public.save_log_weight_mobile_internal(uuid, date, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_log_daily_mobile_internal(uuid, date, jsonb)
  to service_role;
grant execute on function public.save_log_mortality_mobile_internal(uuid, date, jsonb)
  to service_role;
grant execute on function public.save_log_weight_mobile_internal(uuid, date, text, jsonb)
  to service_role;

create function public.save_log_daily_mobile(
  p_placement_id uuid,
  p_log_date date,
  p_payload jsonb default '{}'::jsonb
)
returns public.log_daily
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_farm_id uuid;
  v_operation text;
begin
  select p.farm_id into v_farm_id
  from public.placements p
  where p.id = p_placement_id;

  if v_farm_id is null then
    raise exception 'Placement not found.' using errcode = 'P0002';
  end if;

  select case when exists (
    select 1 from public.log_daily d
    where d.placement_id = p_placement_id
      and d.log_date = p_log_date
  ) then 'update' else 'create' end
  into v_operation;

  if not public.can_perform_farm_action(
    v_farm_id, 'daily_logs', v_operation
  ) then
    raise exception 'Not authorized to save daily logs for this farm.'
      using errcode = '42501';
  end if;

  return public.save_log_daily_mobile_internal(
    p_placement_id, p_log_date, p_payload
  );
end;
$$;

create function public.save_log_mortality_mobile(
  p_placement_id uuid,
  p_log_date date,
  p_payload jsonb default '{}'::jsonb
)
returns public.log_mortality
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_farm_id uuid;
  v_operation text;
begin
  select p.farm_id into v_farm_id
  from public.placements p
  where p.id = p_placement_id;

  if v_farm_id is null then
    raise exception 'Placement not found.' using errcode = 'P0002';
  end if;

  select case when exists (
    select 1 from public.log_mortality m
    where m.placement_id = p_placement_id
      and m.log_date = p_log_date
  ) then 'update' else 'create' end
  into v_operation;

  if not public.can_perform_farm_action(
    v_farm_id, 'log_mortality', v_operation
  ) then
    raise exception 'Not authorized to save mortality logs for this farm.'
      using errcode = '42501';
  end if;

  return public.save_log_mortality_mobile_internal(
    p_placement_id, p_log_date, p_payload
  );
end;
$$;

create function public.save_log_weight_mobile(
  p_placement_id uuid,
  p_log_date date,
  p_sex text,
  p_payload jsonb default '{}'::jsonb
)
returns public.log_weight
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_farm_id uuid;
  v_operation text;
begin
  select p.farm_id into v_farm_id
  from public.placements p
  where p.id = p_placement_id;

  if v_farm_id is null then
    raise exception 'Placement not found.' using errcode = 'P0002';
  end if;

  select case when exists (
    select 1 from public.log_weight w
    where w.placement_id = p_placement_id
      and w.log_date = p_log_date
      and lower(coalesce(w.sex, '')) = lower(coalesce(p_sex, ''))
  ) then 'update' else 'create' end
  into v_operation;

  if not public.can_perform_farm_action(
    v_farm_id, 'weight_samples', v_operation
  ) then
    raise exception 'Not authorized to save weight logs for this farm.'
      using errcode = '42501';
  end if;

  return public.save_log_weight_mobile_internal(
    p_placement_id, p_log_date, p_sex, p_payload
  );
end;
$$;

revoke all privileges on function public.save_log_daily_mobile(uuid, date, jsonb)
  from public, anon, authenticated;
revoke all privileges on function public.save_log_mortality_mobile(uuid, date, jsonb)
  from public, anon, authenticated;
revoke all privileges on function public.save_log_weight_mobile(uuid, date, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_log_daily_mobile(uuid, date, jsonb)
  to authenticated, service_role;
grant execute on function public.save_log_mortality_mobile(uuid, date, jsonb)
  to authenticated, service_role;
grant execute on function public.save_log_weight_mobile(uuid, date, text, jsonb)
  to authenticated, service_role;

drop policy if exists log_daily_insert_scoped on public.log_daily;
drop policy if exists log_daily_update_scoped on public.log_daily;
create policy log_daily_insert_scoped
  on public.log_daily for insert to authenticated
  with check (exists (
    select 1 from public.placements p
    where p.id = log_daily.placement_id
      and public.can_perform_farm_action(p.farm_id, 'daily_logs', 'create')
  ));
create policy log_daily_update_scoped
  on public.log_daily for update to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_daily.placement_id
      and public.can_perform_farm_action(p.farm_id, 'daily_logs', 'update')
  ))
  with check (exists (
    select 1 from public.placements p
    where p.id = log_daily.placement_id
      and public.can_perform_farm_action(p.farm_id, 'daily_logs', 'update')
  ));

drop policy if exists log_mortality_insert_scoped on public.log_mortality;
drop policy if exists log_mortality_update_scoped on public.log_mortality;
create policy log_mortality_insert_scoped
  on public.log_mortality for insert to authenticated
  with check (exists (
    select 1 from public.placements p
    where p.id = log_mortality.placement_id
      and public.can_perform_farm_action(p.farm_id, 'log_mortality', 'create')
  ));
create policy log_mortality_update_scoped
  on public.log_mortality for update to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_mortality.placement_id
      and public.can_perform_farm_action(p.farm_id, 'log_mortality', 'update')
  ))
  with check (exists (
    select 1 from public.placements p
    where p.id = log_mortality.placement_id
      and public.can_perform_farm_action(p.farm_id, 'log_mortality', 'update')
  ));

drop policy if exists log_weight_insert_scoped on public.log_weight;
drop policy if exists log_weight_update_scoped on public.log_weight;
create policy log_weight_insert_scoped
  on public.log_weight for insert to authenticated
  with check (exists (
    select 1 from public.placements p
    where p.id = log_weight.placement_id
      and public.can_perform_farm_action(p.farm_id, 'weight_samples', 'create')
  ));
create policy log_weight_update_scoped
  on public.log_weight for update to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_weight.placement_id
      and public.can_perform_farm_action(p.farm_id, 'weight_samples', 'update')
  ))
  with check (exists (
    select 1 from public.placements p
    where p.id = log_weight.placement_id
      and public.can_perform_farm_action(p.farm_id, 'weight_samples', 'update')
  ));

commit;
