alter table public.placements
  add column if not exists unassigned_at timestamp with time zone,
  add column if not exists unassigned_by uuid;

comment on column public.placements.unassigned_at is
  'Timestamp when a future placement was released from its barn/date reservation and moved to the unassigned flock queue.';

comment on column public.placements.unassigned_by is
  'Authenticated user who moved the future placement to the unassigned flock queue.';

alter table public.feed_order_commitments
  add column if not exists unassigned_from_placement_id uuid references public.placements(id) on delete set null;

comment on column public.feed_order_commitments.unassigned_from_placement_id is
  'Original placement retained for audit when an order stays with its physical barn while the flock is unassigned.';

alter table public.placements
  drop constraint if exists placements_lifecycle_stage_check;

alter table public.placements
  add constraint placements_lifecycle_stage_check
  check (
    lifecycle_stage in (
      'unassigned',
      'scheduled',
      'awaiting_arrival',
      'in_barn_growing',
      'waiting_closeout',
      'closeout_submitted',
      'archived',
      'canceled'
    )
  );

create index if not exists idx_placements_unassigned_queue
  on public.placements (lifecycle_stage, unassigned_at desc)
  where lifecycle_stage = 'unassigned';

create index if not exists idx_feed_order_commitments_unassigned_from
  on public.feed_order_commitments (unassigned_from_placement_id)
  where unassigned_from_placement_id is not null;

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

-- Checkout may promote the next dated placement in a barn. Unassigned rows retain
-- their former barn/date strictly as audit context, so they must never be selected.
create or replace function public.mark_barn_empty(
  p_barn_id uuid,
  p_removed_date date default current_date
)
returns table (
  placement_id uuid,
  barn_id uuid,
  flock_id uuid,
  placement_is_active boolean,
  flock_is_in_barn boolean,
  barn_is_empty boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current record;
  v_next record;
  v_actor text;
  v_current_sort_date date;
begin
  v_actor := auth.uid()::text;

  select p.id, p.flock_id, p.active_start, p.created_at
    into v_current
  from public.placements p
  where p.barn_id = p_barn_id
    and p.is_active = true
    and p.date_removed is null
    and p.lifecycle_stage not in ('unassigned', 'canceled', 'archived')
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_current.id is null then
    raise exception 'Barn % does not have an active placement to empty.', p_barn_id;
  end if;

  v_current_sort_date := v_current.active_start;

  update public.placements
  set is_active = false,
      date_removed = coalesce(date_removed, p_removed_date),
      lifecycle_stage = 'waiting_closeout',
      updated_at = now(),
      updated_by = coalesce(v_actor, updated_by)
  where id = v_current.id;

  perform public.ensure_placement_closeout_row(v_current.id);

  update public.flocks
  set is_active = false,
      is_in_barn = false,
      flock_removed = coalesce(flock_removed, p_removed_date),
      updated_at = now(),
      updated_by = coalesce(v_actor, updated_by)
  where id = v_current.flock_id;

  perform public.write_activity_log(
    p_placement_id := v_current.id,
    p_entry_type := 'state_change',
    p_action_key := 'mark_barn_empty',
    p_details := format('Flock checked out on %s and moved into closeout pending.', p_removed_date),
    p_source := 'dashboard.state',
    p_meta := jsonb_build_object(
      'removed_date', p_removed_date,
      'workflow', 'checkout_flock',
      'lifecycle_stage', 'waiting_closeout'
    )
  );

  select p.id, p.flock_id, p.active_start, p.created_at
    into v_next
  from public.placements p
  where p.barn_id = p_barn_id
    and p.id <> v_current.id
    and (
      (v_current_sort_date is null and p.created_at > v_current.created_at)
      or (v_current_sort_date is not null and p.active_start > v_current_sort_date)
      or (v_current_sort_date is not null and p.active_start = v_current_sort_date and p.created_at > v_current.created_at)
    )
    and p.date_removed is null
    and p.lifecycle_stage in ('scheduled', 'awaiting_arrival')
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_next.id is not null then
    update public.placements
    set is_active = true,
        lifecycle_stage = 'awaiting_arrival',
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
    where id = v_next.id;

    update public.flocks
    set is_active = true,
        is_in_barn = false,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
    where id = v_next.flock_id;

    perform public.write_activity_log(
      p_placement_id := v_next.id,
      p_entry_type := 'state_change',
      p_action_key := 'promote_next_placement',
      p_details := 'Next scheduled placement promoted into get-ready status for incoming feed and arrival prep.',
      p_source := 'dashboard.state',
      p_meta := jsonb_build_object(
        'removed_date', p_removed_date,
        'workflow', 'checkout_flock',
        'lifecycle_stage', 'awaiting_arrival'
      )
    );
  end if;

  perform public.sync_barn_current_state(p_barn_id);

  if v_next.id is not null then
    return query
    select p.id, p.barn_id, p.flock_id, p.is_active, f.is_in_barn, b.is_empty
    from public.placements p
    join public.flocks f on f.id = p.flock_id
    join public.barns b on b.id = p.barn_id
    where p.id = v_next.id;
  else
    return query
    select null::uuid, b.id, null::uuid, false, false, b.is_empty
    from public.barns b
    where b.id = p_barn_id;
  end if;
end;
$$;

create or replace function public.reassign_unassigned_placement(
  p_placement_id uuid,
  p_farm_id uuid,
  p_barn_id uuid,
  p_start_date date,
  p_actor_id uuid default auth.uid()
)
returns public.placements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_placement public.placements%rowtype;
  v_flock public.flocks%rowtype;
  v_barn public.barns%rowtype;
  v_duration integer;
  v_end_date date;
  v_overlap_key text;
  v_old_start date;
  v_row public.placements%rowtype;
begin
  if v_actor is null then
    raise exception 'A signed-in user is required to assign a flock.';
  end if;

  if p_start_date is null then
    raise exception 'A placement date is required.';
  end if;

  select p.* into v_placement
  from public.placements p
  where p.id = p_placement_id
  for update;

  if not found or v_placement.lifecycle_stage <> 'unassigned' then
    raise exception 'The flock is no longer available in the unassigned queue.';
  end if;

  select f.* into v_flock
  from public.flocks f
  where f.id = v_placement.flock_id
  for update;

  select b.* into v_barn
  from public.barns b
  where b.id = p_barn_id and b.farm_id = p_farm_id and b.is_active = true;

  if not found then
    raise exception 'The selected active barn does not belong to the selected farm.';
  end if;

  if exists (
    select 1
    from public.flocks f
    where f.farm_id = p_farm_id
      and f.flock_number = v_flock.flock_number
      and f.id <> v_flock.id
  ) then
    raise exception 'Flock number % is already in use on the selected farm.', v_flock.flock_number;
  end if;

  v_old_start := coalesce(v_placement.active_start, v_flock.date_placed, p_start_date);
  v_duration := greatest(
    coalesce(v_placement.active_end, v_flock.max_date, v_old_start + 63) - v_old_start,
    1
  );
  v_end_date := p_start_date + v_duration;

  select coalesce(p.placement_key, f.flock_number::text)
    into v_overlap_key
  from public.placements p
  join public.flocks f on f.id = p.flock_id
  where p.barn_id = p_barn_id
    and p.id <> v_placement.id
    and p.lifecycle_stage not in ('unassigned', 'canceled', 'archived')
    and p_start_date <= coalesce(p.date_removed, p.active_end, f.max_date, p_start_date)
    and v_end_date >= coalesce(p.active_start, f.date_placed, v_end_date)
  order by coalesce(p.active_start, f.date_placed) asc
  limit 1;

  if v_overlap_key is not null then
    raise exception 'This assignment overlaps % in the selected barn.', v_overlap_key;
  end if;

  update public.flocks
  set farm_id = p_farm_id,
      date_placed = p_start_date,
      female_date_placed = case
        when female_date_placed is null then null
        else p_start_date + (female_date_placed - v_old_start)
      end,
      male_date_placed = case
        when male_date_placed is null then null
        else p_start_date + (male_date_placed - v_old_start)
      end,
      max_date = v_end_date,
      is_active = false,
      is_complete = false,
      is_in_barn = false,
      is_settled = false,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_placement.flock_id;

  update public.placements
  set farm_id = p_farm_id,
      barn_id = p_barn_id,
      date_placed = p_start_date,
      active_start = p_start_date,
      active_end = v_end_date,
      placement_key = public.compute_placement_key(v_placement.flock_id, p_barn_id),
      lifecycle_stage = 'scheduled',
      is_active = false,
      unassigned_at = null,
      unassigned_by = null,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_placement.id
  returning * into v_row;

  perform public.write_activity_log(
    p_placement_id := v_placement.id,
    p_entry_type := 'state_change',
    p_action_key := 'reassign_unassigned_placement',
    p_details := format('Unassigned flock scheduled into Barn %s beginning %s.', v_barn.barn_code, p_start_date),
    p_source := 'placement_scheduler.state',
    p_actor_user_id := v_actor,
    p_farm_id := p_farm_id,
    p_barn_id := p_barn_id,
    p_flock_id := v_placement.flock_id,
    p_meta := jsonb_build_object(
      'previous_farm_id', v_placement.farm_id,
      'previous_barn_id', v_placement.barn_id,
      'previous_start', v_placement.active_start,
      'new_start', p_start_date,
      'new_end', v_end_date,
      'lifecycle_stage', 'scheduled'
    )
  );

  return v_row;
end;
$$;

revoke all on function public.unassign_scheduled_placement(uuid, uuid) from public;
revoke all on function public.reassign_unassigned_placement(uuid, uuid, uuid, date, uuid) from public;
grant execute on function public.unassign_scheduled_placement(uuid, uuid) to authenticated, service_role;
grant execute on function public.reassign_unassigned_placement(uuid, uuid, uuid, date, uuid) to authenticated, service_role;
