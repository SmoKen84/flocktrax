create or replace view public.v_livehaul_schedule_lookup as
select
  lhs.livehaul_id,
  lhs.placement_id,
  lhs.flock_id,
  lhs.farm_id,
  lhs.barn_id,
  lhs.lh_date,
  lhs.sequence_num,
  lhs.actual_date,
  lhs.actual_at,
  lhs.head_target,
  lhs.head_actual,
  lhs.status,
  lhs.comment,
  p.placement_key,
  f.flock_number,
  farm.farm_name,
  barn.barn_code,
  coalesce(load_summary.load_count, 0) as load_count,
  coalesce(load_summary.head_count_total, 0) as load_head_count_total,
  coalesce(load_summary.doa_count_total, 0) as load_doa_count_total
from public.livehaul_schedule lhs
join public.placements p
  on p.id = lhs.placement_id
join public.flocks f
  on f.id = lhs.flock_id
join public.farms farm
  on farm.id = lhs.farm_id
join public.barns barn
  on barn.id = lhs.barn_id
left join (
  select
    ll.livehaul_id,
    count(*) as load_count,
    coalesce(sum(ll.head_count), 0) as head_count_total,
    coalesce(sum(ll.doa_count), 0) as doa_count_total
  from public.livehaul_loads ll
  group by ll.livehaul_id
) load_summary
  on load_summary.livehaul_id = lhs.livehaul_id;

comment on view public.v_livehaul_schedule_lookup is
  'Human-readable livehaul lookup view that exposes the UUID foreign keys plus farm, barn, placement, flock, and load rollup context for troubleshooting and manual edits.';
