create or replace function public.compute_placement_key(p_flock_id uuid, p_barn_id uuid)
returns text
language sql
stable
as $$
  select f.flock_number::text || '-' || b.barn_code
  from public.flocks f
  join public.barns b on b.id = p_barn_id
  where f.id = p_flock_id
$$;


create or replace function public.sync_placement_keys_for_barn()
returns trigger
language plpgsql
as $$
begin
  if new.barn_code is distinct from old.barn_code then
    update public.placements p
    set placement_key = public.compute_placement_key(p.flock_id, p.barn_id),
        updated_at = now()
    where p.barn_id = new.id
      and p.placement_key is distinct from public.compute_placement_key(p.flock_id, p.barn_id);
  end if;

  return new;
end;
$$;


create or replace function public.sync_placement_keys_for_flock()
returns trigger
language plpgsql
as $$
begin
  if new.flock_number is distinct from old.flock_number then
    update public.placements p
    set placement_key = public.compute_placement_key(p.flock_id, p.barn_id),
        updated_at = now()
    where p.flock_id = new.id
      and p.placement_key is distinct from public.compute_placement_key(p.flock_id, p.barn_id);
  end if;

  return new;
end;
$$;


drop trigger if exists trg_barns_sync_placement_keys on public.barns;
create trigger trg_barns_sync_placement_keys
after update of barn_code on public.barns
for each row
execute function public.sync_placement_keys_for_barn();


drop trigger if exists trg_flocks_sync_placement_keys on public.flocks;
create trigger trg_flocks_sync_placement_keys
after update of flock_number on public.flocks
for each row
execute function public.sync_placement_keys_for_flock();


update public.placements p
set placement_key = public.compute_placement_key(p.flock_id, p.barn_id),
    updated_at = now()
where p.placement_key is distinct from public.compute_placement_key(p.flock_id, p.barn_id);


do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'feed_drops'
      and column_name = 'placement_id'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'feed_drops'
      and column_name = 'placement_code'
  ) then
    update public.feed_drops fd
    set placement_code = p.placement_key
    from public.placements p
    where fd.placement_id = p.id
      and fd.placement_code is distinct from p.placement_key;
  end if;
end;
$$;
