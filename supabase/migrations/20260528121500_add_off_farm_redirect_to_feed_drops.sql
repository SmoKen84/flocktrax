alter table if exists public.feed_drops
  add column if not exists off_farm_redirect boolean not null default false;

comment on column public.feed_drops.off_farm_redirect is
  'Marks a feed drop as an emergency off-farm redirect that should not allocate to an internal bin or flock.';
