-- Remove duplicate mortality indexes while preserving the uniqueness required
-- by mortality upserts on (placement_id, log_date).
alter table public.log_mortality
  drop constraint if exists log_mortality_placement_id_log_date_key,
  drop constraint if exists log_mortality_unique,
  drop constraint if exists uq_log_mortality;

drop index if exists public.idx_log_mortality_place_date;
drop index if exists public.idx_log_mortality_placement_date;
drop index if exists public.ix_log_mortality_placement_date;

create index if not exists idx_activity_log_flock_id
  on public.activity_log (flock_id);

create index if not exists idx_feed_drops_queued_from_placement_id
  on public.feed_drops (queued_from_placement_id);

analyze public.log_mortality;
analyze public.activity_log;
analyze public.feed_drops;
