create or replace function public.sync_barn_current_state(p_barn_id uuid)
returns void
language plpgsql
as $$
declare
  v_flock_id uuid;
  v_is_in_barn boolean;
begin
  select p.flock_id, f.is_in_barn
    into v_flock_id, v_is_in_barn
  from public.placements p
  join public.flocks f
    on f.id = p.flock_id
  where p.barn_id = p_barn_id
    and p.is_active = true
    and p.date_removed is null
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_flock_id is null then
    update public.barns
      set active_flock_id = null,
          has_flock = false,
          is_empty = true,
          updated_at = now()
    where id = p_barn_id;
    return;
  end if;

  update public.barns
    set active_flock_id = v_flock_id,
        has_flock = coalesce(v_is_in_barn, false),
        is_empty = not coalesce(v_is_in_barn, false),
        updated_at = now()
  where id = p_barn_id;
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
as $$
declare
  v_current record;
  v_next record;
  v_actor text;
begin
  v_actor := auth.uid()::text;

  select p.id, p.flock_id
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

  update public.placements
    set is_active = false,
        date_removed = coalesce(date_removed, p_removed_date),
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = v_current.id;

  update public.flocks
    set is_active = false,
        is_in_barn = false,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = v_current.flock_id;

  select p.id, p.flock_id
    into v_next
  from public.placements p
  where p.barn_id = p_barn_id
    and p.id <> v_current.id
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
