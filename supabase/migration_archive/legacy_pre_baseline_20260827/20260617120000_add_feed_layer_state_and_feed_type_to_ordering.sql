alter table if exists public.feedbins
  add column if not exists accessible_feed_type text,
  add column if not exists accessible_feed_lbs numeric(12,2),
  add column if not exists queued_feed_type text,
  add column if not exists queued_feed_lbs numeric(12,2),
  add column if not exists feed_state_effective_at timestamp with time zone,
  add column if not exists feed_state_source text;

comment on column public.feedbins.accessible_feed_type is
  'Feed type currently reachable by birds in this bin. Expected values: starter or grower.';

comment on column public.feedbins.accessible_feed_lbs is
  'Pounds currently believed to be reachable in the accessible feed layer.';

comment on column public.feedbins.queued_feed_type is
  'Next feed type stacked above the accessible layer, if known.';

comment on column public.feedbins.queued_feed_lbs is
  'Pounds currently believed to exist in the queued upper layer.';

comment on column public.feedbins.feed_state_effective_at is
  'Timestamp when the current layered feed interpretation became effective.';

comment on column public.feedbins.feed_state_source is
  'How the current layered feed interpretation was assigned, such as manual or ticket_inferred.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbins_feed_layer_type_check'
      and conrelid = 'public.feedbins'::regclass
  ) then
    alter table public.feedbins
      add constraint feedbins_feed_layer_type_check
      check (
        accessible_feed_type is null or lower(accessible_feed_type) in ('starter', 'grower')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbins_feed_layer_queued_type_check'
      and conrelid = 'public.feedbins'::regclass
  ) then
    alter table public.feedbins
      add constraint feedbins_feed_layer_queued_type_check
      check (
        queued_feed_type is null or lower(queued_feed_type) in ('starter', 'grower')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbins_feed_layer_lbs_check'
      and conrelid = 'public.feedbins'::regclass
  ) then
    alter table public.feedbins
      add constraint feedbins_feed_layer_lbs_check
      check (
        coalesce(accessible_feed_lbs, 0) >= 0
        and coalesce(queued_feed_lbs, 0) >= 0
      );
  end if;
end
$$;

alter table if exists public.feed_order_commitments
  add column if not exists feed_type text;

comment on column public.feed_order_commitments.feed_type is
  'Feed type committed by the order. Expected values: starter or grower.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feed_order_commitments_feed_type_check'
      and conrelid = 'public.feed_order_commitments'::regclass
  ) then
    alter table public.feed_order_commitments
      add constraint feed_order_commitments_feed_type_check
      check (
        feed_type is null or lower(feed_type) in ('starter', 'grower')
      );
  end if;
end
$$;

alter table if exists public.feed_inventory_snapshots
  add column if not exists accessible_feed_type text,
  add column if not exists queued_feed_type text;

comment on column public.feed_inventory_snapshots.accessible_feed_type is
  'Accessible feed layer interpretation at snapshot time, when known.';

comment on column public.feed_inventory_snapshots.queued_feed_type is
  'Queued feed layer interpretation at snapshot time, when known.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feed_inventory_snapshots_accessible_feed_type_check'
      and conrelid = 'public.feed_inventory_snapshots'::regclass
  ) then
    alter table public.feed_inventory_snapshots
      add constraint feed_inventory_snapshots_accessible_feed_type_check
      check (
        accessible_feed_type is null or lower(accessible_feed_type) in ('starter', 'grower')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'feed_inventory_snapshots_queued_feed_type_check'
      and conrelid = 'public.feed_inventory_snapshots'::regclass
  ) then
    alter table public.feed_inventory_snapshots
      add constraint feed_inventory_snapshots_queued_feed_type_check
      check (
        queued_feed_type is null or lower(queued_feed_type) in ('starter', 'grower')
      );
  end if;
end
$$;
