alter table if exists public.feed_drops
  add column if not exists queued_from_feed_bin_id uuid references public.feedbins (id) on delete set null,
  add column if not exists queued_from_bin_code text,
  add column if not exists queued_from_barn_id uuid references public.barns (id) on delete set null,
  add column if not exists queued_from_barn_code text,
  add column if not exists queued_from_placement_id uuid references public.placements (id) on delete set null,
  add column if not exists queued_from_placement_code text,
  add column if not exists queued_at timestamptz,
  add column if not exists queued_for_reconciliation boolean not null default false;

comment on column public.feed_drops.queued_for_reconciliation is
  'True when a drop remains on its feed ticket for balancing but is temporarily removed from flock/bin assignment until reconciliation is complete.';

comment on column public.feed_drops.queued_from_feed_bin_id is
  'Original feed bin assignment captured when a drop is queued for reconciliation.';

comment on column public.feed_drops.queued_from_bin_code is
  'Original feed bin code captured when a drop is queued for reconciliation.';

comment on column public.feed_drops.queued_from_barn_id is
  'Original barn assignment captured when a drop is queued for reconciliation.';

comment on column public.feed_drops.queued_from_barn_code is
  'Original barn code captured when a drop is queued for reconciliation.';

comment on column public.feed_drops.queued_from_placement_id is
  'Original placement assignment captured when a drop is queued for reconciliation.';

comment on column public.feed_drops.queued_from_placement_code is
  'Original placement code captured when a drop is queued for reconciliation.';

comment on column public.feed_drops.queued_at is
  'Timestamp when a drop was placed in the reconciliation queue.';
