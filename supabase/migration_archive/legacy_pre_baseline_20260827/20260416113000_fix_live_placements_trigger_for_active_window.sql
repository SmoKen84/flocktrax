create or replace function public.placements_set_defaults()
returns trigger
language plpgsql
as $$
declare
  v_farm_id uuid;
  v_barn_code text;
  v_flock_num integer;
  v_flock_farm uuid;
  v_flock_start date;
  v_flock_end date;
begin
  select b.farm_id, b.barn_code
    into v_farm_id, v_barn_code
  from public.barns b
  where b.id = new.barn_id;

  select f.farm_id, f.flock_number, f.date_placed, f.max_date
    into v_flock_farm, v_flock_num, v_flock_start, v_flock_end
  from public.flocks f
  where f.id = new.flock_id;

  if v_farm_id is null or v_flock_farm is null then
    raise exception 'Invalid barn_id or flock_id for placement';
  end if;

  if v_farm_id <> v_flock_farm then
    raise exception 'Farm mismatch: barn.farm_id (%) != flock.farm_id (%)', v_farm_id, v_flock_farm;
  end if;

  new.farm_id := v_farm_id;

  if new.active_start is null then
    new.active_start := v_flock_start;
  end if;

  if new.active_end is null then
    new.active_end := v_flock_end;
  end if;

  new.placement_key := v_flock_num::text || '-' || v_barn_code;
  return new;
end;
$$;
