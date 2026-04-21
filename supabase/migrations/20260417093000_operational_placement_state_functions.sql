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
  order by coalesce(p.active_start, p.date_placed) asc nulls last, p.created_at asc
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

create or replace function public.placements_sync_barn_state()
returns trigger
language plpgsql
as $$
begin
  perform public.sync_barn_current_state(new.barn_id);

  if tg_op = 'UPDATE' and old.barn_id is distinct from new.barn_id then
    perform public.sync_barn_current_state(old.barn_id);
  end if;

  return new;
end;
$$;

create or replace function public.flocks_sync_barn_state()
returns trigger
language plpgsql
as $$
declare
  v_barn_id uuid;
begin
  for v_barn_id in
    select distinct p.barn_id
    from public.placements p
    where p.flock_id in (new.id, old.id)
      and p.is_active = true
      and p.date_removed is null
  loop
    perform public.sync_barn_current_state(v_barn_id);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_flocks_sync_barn_state on public.flocks;

create trigger trg_flocks_sync_barn_state
after update of is_in_barn, is_active on public.flocks
for each row
execute function public.flocks_sync_barn_state();

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
  order by coalesce(p.active_start, p.date_placed) asc nulls last, p.created_at asc
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
  order by coalesce(p.active_start, p.date_placed) asc nulls last, p.created_at asc
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

grant execute on function public.sync_barn_current_state(uuid) to anon, authenticated, service_role;
grant execute on function public.mark_chicks_arrived(uuid, date) to anon, authenticated, service_role;
grant execute on function public.mark_barn_empty(uuid, date) to anon, authenticated, service_role;
