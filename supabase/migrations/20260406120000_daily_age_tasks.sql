create table if not exists public.daily_age_tasks (
  id uuid primary key default gen_random_uuid(),
  task_label text not null,
  min_age_days integer,
  max_age_days integer,
  display_order integer default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_age_tasks_age_range_chk check (
    min_age_days is null or max_age_days is null or min_age_days <= max_age_days
  )
);

comment on table public.daily_age_tasks is
  'Age-based task definitions for the mobile placement-day daily log reminder block.';

comment on column public.daily_age_tasks.task_label is
  'Worker-facing task text shown in the 4 reminder slots.';

comment on column public.daily_age_tasks.min_age_days is
  'Inclusive lower bound for placement age in days. Null means no lower bound.';

comment on column public.daily_age_tasks.max_age_days is
  'Inclusive upper bound for placement age in days. Null means no upper bound.';

comment on column public.daily_age_tasks.display_order is
  'Lower values appear first in the mobile reminder list.';

create index if not exists ix_daily_age_tasks_active_order
  on public.daily_age_tasks (is_active, display_order, min_age_days, max_age_days);

create or replace function public.set_daily_age_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_daily_age_tasks_set_updated_at on public.daily_age_tasks;

create trigger trg_daily_age_tasks_set_updated_at
before update on public.daily_age_tasks
for each row
execute function public.set_daily_age_tasks_updated_at();

alter table public.daily_age_tasks enable row level security;

drop policy if exists "daily_age_tasks_select_active" on public.daily_age_tasks;

create policy "daily_age_tasks_select_active"
on public.daily_age_tasks
for select
to authenticated
using (is_active = true);
