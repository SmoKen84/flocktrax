-- Unassigned placements retain their former barn and date window as audit
-- context, but they do not reserve barn capacity. Keep them out of the
-- database-level overlap constraint, matching the scheduler business rules.
alter table public.placements
  drop constraint if exists placements_no_overlap_per_barn;

alter table public.placements
  add constraint placements_no_overlap_per_barn
  exclude using gist (
    barn_id with =,
    daterange(active_start, coalesce(active_end, 'infinity'::date), '[)') with &&
  )
  where (
    lifecycle_stage is distinct from 'canceled'
    and lifecycle_stage is distinct from 'unassigned'
    and lifecycle_stage is distinct from 'archived'
  );
