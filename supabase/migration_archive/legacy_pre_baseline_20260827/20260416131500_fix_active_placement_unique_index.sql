drop index if exists public.idx_unique_active_placement_per_barn;
drop index if exists public.uq_active_placement_per_barn;

create unique index if not exists idx_unique_active_placement_per_barn
on public.placements (barn_id)
where (is_active = true and date_removed is null);
