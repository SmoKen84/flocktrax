alter table public.feedbins
  add column if not exists binsentry_bin_ref text,
  add column if not exists binsentry_last_sync_at timestamp with time zone,
  add column if not exists binsentry_last_inventory_lbs numeric(12,2),
  add column if not exists binsentry_sync_note text;

comment on column public.feedbins.binsentry_bin_ref is
  'External BinSentry bin identifier or entity reference used to retrieve live feed inventory for this bin.';

comment on column public.feedbins.binsentry_last_sync_at is
  'Timestamp of the most recent successful or attempted BinSentry sync for this feed bin.';

comment on column public.feedbins.binsentry_last_inventory_lbs is
  'Most recent pounds-on-hand value pulled from BinSentry for this feed bin.';

comment on column public.feedbins.binsentry_sync_note is
  'Last BinSentry sync status note for this feed bin.';
