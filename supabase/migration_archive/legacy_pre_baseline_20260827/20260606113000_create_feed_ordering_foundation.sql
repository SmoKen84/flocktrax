create table if not exists public.feed_inventory_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  farm_id uuid null references public.farms(id) on delete set null,
  barn_id uuid null references public.barns(id) on delete cascade,
  feed_bin_id uuid null references public.feedbins(id) on delete cascade,
  placement_id uuid null references public.placements(id) on delete set null,
  source text not null default 'binsentry',
  captured_at timestamp with time zone not null,
  inventory_lbs numeric(12,2) not null,
  feed_name text null,
  raw_payload jsonb null,
  created_at timestamp with time zone not null default now(),
  created_by uuid null default auth.uid()
);

comment on table public.feed_inventory_snapshots is
  'Latest-known feed inventory observations used to calculate net feed ordering position. Intended to ingest BinSentry or manual inventory snapshots at the barn/bin layer.';

comment on column public.feed_inventory_snapshots.source is
  'Origin of the inventory observation, such as binsentry or manual.';

comment on column public.feed_inventory_snapshots.inventory_lbs is
  'Observed pounds on hand for the captured barn/bin at the time of the snapshot.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feed_inventory_snapshots_inventory_lbs_check'
      and conrelid = 'public.feed_inventory_snapshots'::regclass
  ) then
    alter table public.feed_inventory_snapshots
      add constraint feed_inventory_snapshots_inventory_lbs_check
      check (inventory_lbs >= 0);
  end if;
end
$$;

create index if not exists ix_feed_inventory_snapshots_barn_captured_at
  on public.feed_inventory_snapshots (barn_id, captured_at desc);

create index if not exists ix_feed_inventory_snapshots_bin_captured_at
  on public.feed_inventory_snapshots (feed_bin_id, captured_at desc);

create table if not exists public.feed_order_commitments (
  commitment_id uuid primary key default gen_random_uuid(),
  farm_id uuid null references public.farms(id) on delete set null,
  barn_id uuid null references public.barns(id) on delete set null,
  feed_bin_id uuid null references public.feedbins(id) on delete set null,
  placement_id uuid null references public.placements(id) on delete set null,
  source text not null default 'manual',
  status text not null default 'open',
  expected_delivery_date date null,
  ordered_lbs numeric(12,2) not null,
  received_lbs numeric(12,2) not null default 0,
  feed_name text null,
  external_order_ref text null,
  received_ticket_id uuid null references public.feed_tickets(id) on delete set null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid null default auth.uid(),
  updated_by text null
);

comment on table public.feed_order_commitments is
  'Open or received feed orders used to calculate on-order feed that has been committed but not yet reflected in delivered ticket history.';

comment on column public.feed_order_commitments.status is
  'Order lifecycle state: open, partial, received, or cancelled.';

comment on column public.feed_order_commitments.received_lbs is
  'Delivered pounds already received against the order; remaining pounds stay in the net ordering calculation.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feed_order_commitments_status_check'
      and conrelid = 'public.feed_order_commitments'::regclass
  ) then
    alter table public.feed_order_commitments
      add constraint feed_order_commitments_status_check
      check (status in ('open', 'partial', 'received', 'cancelled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'feed_order_commitments_weight_check'
      and conrelid = 'public.feed_order_commitments'::regclass
  ) then
    alter table public.feed_order_commitments
      add constraint feed_order_commitments_weight_check
      check (ordered_lbs >= 0 and received_lbs >= 0 and received_lbs <= ordered_lbs);
  end if;
end
$$;

create index if not exists ix_feed_order_commitments_status_eta
  on public.feed_order_commitments (status, expected_delivery_date);

create index if not exists ix_feed_order_commitments_placement
  on public.feed_order_commitments (placement_id, status);

create index if not exists ix_feed_order_commitments_barn
  on public.feed_order_commitments (barn_id, status);
