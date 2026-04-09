do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'feed_drops'
      and column_name = 'placement_code`'
  ) then
    execute 'alter table public.feed_drops rename column "placement_code`" to placement_code';
  end if;
end
$$;

alter table if exists public.feed_tickets
  add column if not exists feed_name text;

alter table if exists public.feed_tickets
  add column if not exists source_type text not null default 'mill';

alter table if exists public.feed_drops
  add column if not exists feed_bin_id uuid;

alter table if exists public.feed_drops
  add column if not exists placement_id uuid;

alter table if exists public.feed_drops
  add column if not exists drop_order integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'feed_drops'
      and constraint_name = 'feed_drops_feed_bin_id_fkey'
  ) then
    alter table public.feed_drops
      add constraint feed_drops_feed_bin_id_fkey
      foreign key (feed_bin_id)
      references public.feedbins(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'feed_drops'
      and constraint_name = 'feed_drops_placement_id_fkey'
  ) then
    alter table public.feed_drops
      add constraint feed_drops_placement_id_fkey
      foreign key (placement_id)
      references public.placements(id)
      on delete set null;
  end if;
end
$$;

create index if not exists feed_drops_feed_ticket_id_idx
  on public.feed_drops (feed_ticket_id);

create index if not exists feed_drops_feed_bin_id_idx
  on public.feed_drops (feed_bin_id);

create index if not exists feed_drops_placement_id_idx
  on public.feed_drops (placement_id);
