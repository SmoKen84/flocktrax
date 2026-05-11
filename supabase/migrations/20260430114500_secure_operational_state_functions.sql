create or replace function public.mark_chicks_arrived(
  p_placement_id uuid,
  p_arrival_date date default current_date
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
  v_barn_id uuid;
  v_flock_id uuid;
  v_other_active uuid;
  v_actor text;
begin
  v_actor := auth.uid()::text;

  select p.barn_id, p.flock_id
    into v_barn_id, v_flock_id
  from public.placements p
  where p.id = p_placement_id;

  if v_barn_id is null or v_flock_id is null then
    raise exception 'Placement % was not found.', p_placement_id;
  end if;

  select p.id
    into v_other_active
  from public.placements p
  where p.barn_id = v_barn_id
    and p.id <> p_placement_id
    and p.is_active = true
    and p.date_removed is null
  limit 1;

  if v_other_active is not null then
    raise exception 'Barn % already has another active placement (%).', v_barn_id, v_other_active;
  end if;

  update public.placements
    set is_active = true,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = p_placement_id;

  update public.flocks
    set is_active = false,
        is_in_barn = false,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id in (
    select p.flock_id
    from public.placements p
    where p.barn_id = v_barn_id
      and p.id <> p_placement_id
  );

  update public.flocks
    set is_active = true,
        is_in_barn = true,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = v_flock_id;

  perform public.sync_barn_current_state(v_barn_id);

  perform public.write_activity_log(
    p_placement_id := p_placement_id,
    p_entry_type := 'state_change',
    p_action_key := 'mark_chicks_arrived',
    p_details := format('Chicks arrived recorded for %s.', p_arrival_date),
    p_source := 'dashboard.state',
    p_meta := jsonb_build_object('arrival_date', p_arrival_date)
  );

  return query
  select p.id, p.barn_id, p.flock_id, p.is_active, f.is_in_barn, b.is_empty
  from public.placements p
  join public.flocks f
    on f.id = p.flock_id
  join public.barns b
    on b.id = p.barn_id
  where p.id = p_placement_id;
end;
$$;

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
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_current.id is null then
    raise exception 'Barn % does not have an active placement to empty.', p_barn_id;
  end if;

  v_current_sort_date := v_current.active_start;

  update public.placements
    set is_active = false,
        date_removed = coalesce(date_removed, p_removed_date),
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = v_current.id;

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
    p_details := format('Flock checked out and barn marked empty for %s.', p_removed_date),
    p_source := 'dashboard.state',
    p_meta := jsonb_build_object('removed_date', p_removed_date, 'workflow', 'checkout_flock')
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
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_next.id is not null then
    update public.placements
      set is_active = true,
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
      p_meta := jsonb_build_object('removed_date', p_removed_date, 'workflow', 'checkout_flock')
    );
  end if;

  perform public.sync_barn_current_state(p_barn_id);

  if v_next.id is not null then
    return query
    select p.id, p.barn_id, p.flock_id, p.is_active, f.is_in_barn, b.is_empty
    from public.placements p
    join public.flocks f
      on f.id = p.flock_id
    join public.barns b
      on b.id = p.barn_id
    where p.id = v_next.id;
  else
    return query
    select null::uuid, b.id, null::uuid, false, false, b.is_empty
    from public.barns b
    where b.id = p_barn_id;
  end if;
end;
$$;
