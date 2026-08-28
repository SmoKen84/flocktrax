create or replace view public.v_livehaul_edit_lookup as
select
  lhs.livehaul_id,
  lhs.lh_date,
  lhs.sequence_num,
  lhs.status,
  farm.farm_name,
  barn.barn_code,
  f.flock_number,
  p.placement_key,
  lhs.placement_id,
  lhs.flock_id,
  lhs.farm_id,
  lhs.barn_id
from public.livehaul_schedule lhs
join public.placements p
  on p.id = lhs.placement_id
join public.flocks f
  on f.id = lhs.flock_id
join public.farms farm
  on farm.id = lhs.farm_id
join public.barns barn
  on barn.id = lhs.barn_id;

comment on view public.v_livehaul_edit_lookup is
  'Narrow livehaul edit lookup view for quickly finding a livehaul row by farm, barn, flock, placement, date, and UUID keys.';
