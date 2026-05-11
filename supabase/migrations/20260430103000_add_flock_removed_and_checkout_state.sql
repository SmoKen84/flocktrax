alter table public.flocks
  add column if not exists flock_removed date;

comment on column public.flocks.flock_removed is
  'Date the flock was fully removed from the barn after checkout/shipping.';

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
