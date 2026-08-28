-- feed_drops does not have an updated_at column. Replace the unassign function
-- without attempting to write that nonexistent field.
create or replace function public.unassign_scheduled_placement(
  p_placement_id uuid,
  p_actor_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_placement public.placements%rowtype;
  v_flock public.flocks%rowtype;
  v_barn_code text;
  v_daily_count integer := 0;
  v_mortality_count integer := 0;
  v_weight_count integer := 0;
  v_feed_drop_count integer := 0;
  v_feed_order_count integer := 0;
begin
  if v_actor is null then
    raise exception 'A signed-in user is required to unassign a flock.';
  end if;

  select p.* into v_placement
  from public.placements p
  where p.id = p_placement_id
  for update;

  if not found then
    raise exception 'The scheduled placement could not be found.';
  end if;

  select f.* into v_flock
  from public.flocks f
  where f.id = v_placement.flock_id
  for update;

  if not found then
    raise exception 'The flock linked to this placement could not be found.';
  end if;

  if v_placement.lifecycle_stage not in ('scheduled', 'awaiting_arrival')
     or v_placement.date_removed is not null
     or coalesce(v_flock.is_in_barn, false) then
    raise exception 'Only a scheduled or awaiting-arrival flock that has not entered a barn can be unassigned.';
  end if;

  select count(*) into v_daily_count from public.log_daily where placement_id = v_placement.id;
  select count(*) into v_mortality_count from public.log_mortality where placement_id = v_placement.id;
  select count(*) into v_weight_count from public.log_weight where placement_id = v_placement.id;

  if v_daily_count + v_mortality_count + v_weight_count > 0 then
    raise exception 'This flock cannot be unassigned because operational production records already exist.';
  end if;

  select barn_code into v_barn_code from public.barns where id = v_placement.barn_id;

  update public.feed_drops
  set queued_from_barn_id = coalesce(queued_from_barn_id, v_placement.barn_id),
      queued_from_barn_code = coalesce(queued_from_barn_code, v_barn_code),
      queued_from_placement_id = coalesce(queued_from_placement_id, v_placement.id),
      queued_from_placement_code = coalesce(queued_from_placement_code, v_placement.placement_key),
      queued_at = coalesce(queued_at, now()),
      queued_for_reconciliation = true,
      placement_id = null,
      placement_code = null
  where placement_id = v_placement.id;
  get diagnostics v_feed_drop_count = row_count;

  update public.feed_order_commitments
  set unassigned_from_placement_id = coalesce(unassigned_from_placement_id, v_placement.id),
      placement_id = null,
      updated_at = now(),
      updated_by = v_actor::text
  where placement_id = v_placement.id
    and status <> 'cancelled';
  get diagnostics v_feed_order_count = row_count;

  update public.placements
  set lifecycle_stage = 'unassigned',
      is_active = false,
      unassigned_at = now(),
      unassigned_by = v_actor,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_placement.id;

  update public.flocks
  set is_active = false,
      is_in_barn = false,
      is_complete = false,
      is_settled = false,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_placement.flock_id;

  perform public.sync_barn_current_state(v_placement.barn_id);

  perform public.write_activity_log(
    p_placement_id := v_placement.id,
    p_entry_type := 'state_change',
    p_action_key := 'unassign_scheduled_placement',
    p_details := format('Flock released from %s and moved to the unassigned queue.', coalesce(v_barn_code, 'its barn')),
    p_source := 'placement_scheduler.state',
    p_actor_user_id := v_actor,
    p_farm_id := v_placement.farm_id,
    p_barn_id := v_placement.barn_id,
    p_flock_id := v_placement.flock_id,
    p_meta := jsonb_build_object(
      'previous_farm_id', v_placement.farm_id,
      'previous_barn_id', v_placement.barn_id,
      'previous_start', v_placement.active_start,
      'previous_end', v_placement.active_end,
      'feed_drop_count', v_feed_drop_count,
      'feed_order_count', v_feed_order_count,
      'lifecycle_stage', 'unassigned'
    )
  );

  return jsonb_build_object(
    'placement_id', v_placement.id,
    'placement_key', v_placement.placement_key,
    'flock_id', v_placement.flock_id,
    'previous_farm_id', v_placement.farm_id,
    'previous_barn_id', v_placement.barn_id,
    'feed_drop_count', v_feed_drop_count,
    'feed_order_count', v_feed_order_count
  );
end;
$$;

revoke all on function public.unassign_scheduled_placement(uuid, uuid) from public;
grant execute on function public.unassign_scheduled_placement(uuid, uuid) to authenticated, service_role;
