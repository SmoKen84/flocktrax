-- Placement scheduling dates live on placements.active_start/active_end.
-- date_placed belongs to flocks and must not be written to placements.
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

revoke all on function public.reassign_unassigned_placement(uuid, uuid, uuid, date, uuid) from public;
grant execute on function public.reassign_unassigned_placement(uuid, uuid, uuid, date, uuid) to authenticated, service_role;
