alter table public.placements
  add column if not exists canceled_at timestamp with time zone,
  add column if not exists canceled_by uuid;

comment on column public.placements.canceled_at is
  'Timestamp when a scheduled or awaiting-arrival placement was canceled before birds entered the barn.';

comment on column public.placements.canceled_by is
  'Authenticated user who canceled the placement.';

alter table public.placements
  drop constraint if exists placements_lifecycle_stage_check;

alter table public.placements
  add constraint placements_lifecycle_stage_check
  check (
    lifecycle_stage in (
      'scheduled',
      'awaiting_arrival',
      'in_barn_growing',
      'waiting_closeout',
      'closeout_submitted',
      'archived',
      'canceled'
    )
  );

create or replace function public.cancel_scheduled_placement(
  p_source_placement_id uuid,
  p_target_placement_id uuid default null,
  p_actor_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.placements%rowtype;
  v_source_flock public.flocks%rowtype;
  v_target public.placements%rowtype;
  v_target_flock public.flocks%rowtype;
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_sibling_count integer := 0;
  v_daily_count integer := 0;
  v_mortality_count integer := 0;
  v_weight_count integer := 0;
  v_drop_count integer := 0;
  v_drop_lbs numeric := 0;
  v_queued_drop_count integer := 0;
  v_queued_drop_lbs numeric := 0;
  v_order_count integer := 0;
  v_order_lbs numeric := 0;
  v_feed_count integer := 0;
begin
  if v_actor is null then
    raise exception 'A signed-in user is required to cancel a scheduled flock.';
  end if;

  select p.*
    into v_source
  from public.placements p
  where p.id = p_source_placement_id
  for update;

  if not found then
    raise exception 'The scheduled placement could not be found.';
  end if;

  select f.*
    into v_source_flock
  from public.flocks f
  where f.id = v_source.flock_id
  for update;

  if not found then
    raise exception 'The scheduled flock could not be found.';
  end if;

  if v_source.lifecycle_stage not in ('scheduled', 'awaiting_arrival')
     or v_source.date_removed is not null
     or coalesce(v_source_flock.is_in_barn, false) then
    raise exception 'Only scheduled or awaiting-arrival flocks that have not entered the barn can be canceled.';
  end if;

  select count(*) into v_sibling_count
  from public.placements p
  where p.flock_id = v_source.flock_id;

  if v_sibling_count <> 1 then
    raise exception 'This flock is linked to more than one placement and cannot be canceled from the scheduler.';
  end if;

  select count(*) into v_daily_count
  from public.log_daily d
  where d.placement_id = v_source.id;

  select count(*) into v_mortality_count
  from public.log_mortality m
  where m.placement_id = v_source.id;

  select count(*) into v_weight_count
  from public.log_weight w
  where w.placement_id = v_source.id;

  if v_daily_count + v_mortality_count + v_weight_count > 0 then
    raise exception 'This flock cannot be canceled because daily, mortality, or weight records already exist.';
  end if;

  select count(*), coalesce(sum(abs(coalesce(d.drop_weight, 0))), 0)
    into v_drop_count, v_drop_lbs
  from public.feed_drops d
  where d.placement_id = v_source.id;

  select count(*), coalesce(sum(abs(coalesce(d.drop_weight, 0))), 0)
    into v_queued_drop_count, v_queued_drop_lbs
  from public.feed_drops d
  where d.queued_from_placement_id = v_source.id
    and d.placement_id is distinct from v_source.id;

  select count(*), coalesce(sum(greatest(coalesce(c.ordered_lbs, 0) - coalesce(c.received_lbs, 0), 0)), 0)
    into v_order_count, v_order_lbs
  from public.feed_order_commitments c
  where c.placement_id = v_source.id
    and c.status <> 'cancelled';

  v_feed_count := v_drop_count + v_queued_drop_count + v_order_count;

  if v_feed_count > 0 and p_target_placement_id is null then
    raise exception 'Feed is associated with this flock. Select the flock that should receive it before canceling.';
  end if;

  if p_target_placement_id is not null then
    if p_target_placement_id = v_source.id then
      raise exception 'The canceled flock cannot receive its own feed.';
    end if;

    select p.*
      into v_target
    from public.placements p
    where p.id = p_target_placement_id
    for update;

    if not found then
      raise exception 'The selected destination placement could not be found.';
    end if;

    select f.*
      into v_target_flock
    from public.flocks f
    where f.id = v_target.flock_id
    for update;

    if not found then
      raise exception 'The selected destination flock could not be found.';
    end if;

    if v_target.lifecycle_stage not in ('scheduled', 'awaiting_arrival')
       or v_target.date_removed is not null
       or coalesce(v_target_flock.is_in_barn, false)
       or coalesce(v_target_flock.is_complete, false) then
      raise exception 'Feed can only be moved to a scheduled or awaiting-arrival flock.';
    end if;

    if v_target.date_placed <= v_source.date_placed then
      raise exception 'Feed must be moved to a later scheduled flock.';
    end if;

    if (v_drop_count + v_queued_drop_count) > 0 and v_target.barn_id <> v_source.barn_id then
      raise exception 'Delivered or queued feed must be reassigned to a flock scheduled for the same barn.';
    end if;

    update public.feed_drops
    set placement_id = v_target.id,
        placement_code = v_target.placement_key,
        updated_at = now()
    where placement_id = v_source.id;

    update public.feed_drops
    set queued_from_placement_id = v_target.id,
        queued_from_placement_code = v_target.placement_key,
        updated_at = now()
    where queued_from_placement_id = v_source.id;

    update public.feed_order_commitments
    set placement_id = v_target.id,
        farm_id = v_target.farm_id,
        barn_id = v_target.barn_id,
        feed_bin_id = case when v_target.barn_id = v_source.barn_id then feed_bin_id else null end,
        updated_at = now(),
        updated_by = v_actor::text
    where placement_id = v_source.id
      and status <> 'cancelled';
  end if;

  update public.placements
  set lifecycle_stage = 'canceled',
      is_active = false,
      canceled_at = now(),
      canceled_by = v_actor,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_source.id;

  update public.flocks
  set is_active = false,
      is_in_barn = false,
      is_complete = false,
      is_settled = false,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_source.flock_id;

  return jsonb_build_object(
    'source_placement_id', v_source.id,
    'source_placement_key', v_source.placement_key,
    'source_flock_id', v_source.flock_id,
    'target_placement_id', case when v_feed_count > 0 then v_target.id else null end,
    'target_placement_key', case when v_feed_count > 0 then v_target.placement_key else null end,
    'feed_drop_count', v_drop_count,
    'feed_drop_lbs', v_drop_lbs,
    'queued_feed_drop_count', v_queued_drop_count,
    'queued_feed_drop_lbs', v_queued_drop_lbs,
    'feed_order_count', v_order_count,
    'feed_order_lbs', v_order_lbs
  );
end;
$$;

revoke all on function public.cancel_scheduled_placement(uuid, uuid, uuid) from public;
grant execute on function public.cancel_scheduled_placement(uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_scheduled_placement(uuid, uuid, uuid) to service_role;
