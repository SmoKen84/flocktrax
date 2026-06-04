create table if not exists public.livehaul_schedule (
  livehaul_id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  flock_id uuid not null references public.flocks(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  barn_id uuid not null references public.barns(id) on delete cascade,
  lh_date date not null,
  sequence_num integer null,
  actual_date date null,
  actual_at timestamp with time zone null,
  head_target integer null,
  head_actual integer null,
  status text not null default 'scheduled',
  comment text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid null default auth.uid(),
  updated_by text null
);

comment on table public.livehaul_schedule is
  'Placement-level livehaul schedule rows. Each row represents one planned or completed livehaul event for a flock placement.';

comment on column public.livehaul_schedule.lh_date is
  'Scheduled livehaul date for the placement event.';

comment on column public.livehaul_schedule.sequence_num is
  'Optional ordering number for the livehaul sequence on a placement.';

comment on column public.livehaul_schedule.actual_date is
  'Actual date the livehaul event occurred, when known.';

comment on column public.livehaul_schedule.actual_at is
  'Actual timestamp the livehaul event occurred, when known.';

comment on column public.livehaul_schedule.head_target is
  'Optional planned target head count for the scheduled livehaul.';

comment on column public.livehaul_schedule.head_actual is
  'Optional actual total head count hauled for the livehaul event once closeout values are known.';

comment on column public.livehaul_schedule.status is
  'Current schedule state such as scheduled, completed, cancelled, or legacy_migrated.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'livehaul_schedule_status_check'
      and conrelid = 'public.livehaul_schedule'::regclass
  ) then
    alter table public.livehaul_schedule
      add constraint livehaul_schedule_status_check
      check (status in ('scheduled', 'completed', 'cancelled', 'legacy_migrated'));
  end if;
end
$$;

create unique index if not exists ux_livehaul_schedule_lhdate_placement_flock_farm_barn
  on public.livehaul_schedule (lh_date, placement_id, flock_id, farm_id, barn_id);

create index if not exists ix_livehaul_schedule_placement_date
  on public.livehaul_schedule (placement_id, lh_date, sequence_num);

create index if not exists ix_livehaul_schedule_flock_date
  on public.livehaul_schedule (flock_id, lh_date);

create table if not exists public.livehaul_loads (
  load_id uuid primary key default gen_random_uuid(),
  livehaul_id uuid not null references public.livehaul_schedule(livehaul_id) on delete cascade,
  truck_num text null,
  trailer_num text null,
  scale_location text null,
  scale_empty numeric(12,2) null,
  scale_loaded numeric(12,2) null,
  live_weight numeric(12,2) null,
  head_count integer null,
  doa_count integer null,
  comment text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid null default auth.uid(),
  updated_by text null
);

comment on table public.livehaul_loads is
  'Truck/load-level livehaul execution rows recorded under a livehaul schedule event.';

comment on column public.livehaul_loads.scale_empty is
  'Empty scale weight for the truck/trailer when captured.';

comment on column public.livehaul_loads.scale_loaded is
  'Loaded scale weight for the truck/trailer when captured.';

comment on column public.livehaul_loads.live_weight is
  'Net live bird weight for this load when captured.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'livehaul_loads_head_count_check'
      and conrelid = 'public.livehaul_loads'::regclass
  ) then
    alter table public.livehaul_loads
      add constraint livehaul_loads_head_count_check
      check (head_count is null or head_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'livehaul_loads_doa_count_check'
      and conrelid = 'public.livehaul_loads'::regclass
  ) then
    alter table public.livehaul_loads
      add constraint livehaul_loads_doa_count_check
      check (doa_count is null or doa_count >= 0);
  end if;
end
$$;

create index if not exists ix_livehaul_loads_livehaul_id
  on public.livehaul_loads (livehaul_id);

insert into public.livehaul_schedule (
  placement_id,
  flock_id,
  farm_id,
  barn_id,
  lh_date,
  sequence_num,
  status,
  comment
)
select
  p.id,
  p.flock_id,
  p.farm_id,
  p.barn_id,
  dates.lh_date,
  dates.sequence_num,
  'legacy_migrated',
  format('Backfilled from placements.lh%s_date during livehaul schedule migration.', dates.sequence_num)
from public.placements p
cross join lateral (
  values
    (1, p.lh1_date),
    (2, p.lh2_date),
    (3, p.lh3_date)
) as dates(sequence_num, lh_date)
where dates.lh_date is not null
on conflict (lh_date, placement_id, flock_id, farm_id, barn_id) do nothing;
