create table if not exists public.issue_types (
  code text primary key,
  label text not null,
  entity_type text not null check (entity_type in ('barn', 'placement')),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  severity_default text null,
  report_group text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.issue_types is
  'Configurable open-item type definitions for barn and placement operational tracking.';

create table if not exists public.issue_updates (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  entry_type text not null check (entry_type in ('opened', 'note', 'progress', 'parts_ordered', 'resolved')),
  entry_text text not null,
  effective_date date null,
  created_at timestamptz not null default now(),
  created_by uuid null
);

comment on table public.issue_updates is
  'Threaded progress and resolution log for open items.';

create index if not exists issue_updates_issue_created_idx
  on public.issue_updates (issue_id, created_at desc);

create or replace function public.set_issue_type_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_issue_types_set_updated_at on public.issue_types;

create trigger trg_issue_types_set_updated_at
before update on public.issue_types
for each row
execute function public.set_issue_type_updated_at();

insert into public.issue_types (code, label, entity_type, sort_order, severity_default, report_group)
values
  ('maintenance', 'Maintenance / Repair', 'barn', 10, 'warn', 'repairs'),
  ('feedlines', 'Feedlines', 'barn', 20, 'warn', 'repairs'),
  ('nipple_lines', 'Nipple Lines', 'barn', 30, 'warn', 'repairs'),
  ('equipment', 'Equipment', 'barn', 40, 'warn', 'repairs'),
  ('water', 'Water', 'barn', 50, 'warn', 'repairs'),
  ('ventilation', 'Ventilation', 'barn', 60, 'warn', 'repairs'),
  ('bird_health', 'Bird Health Alert', 'placement', 110, 'danger', 'health'),
  ('performance', 'Performance', 'placement', 120, 'warn', 'placement'),
  ('mortality_review', 'Mortality Review', 'placement', 130, 'danger', 'placement')
on conflict (code) do update
set
  label = excluded.label,
  entity_type = excluded.entity_type,
  is_active = true,
  sort_order = excluded.sort_order,
  severity_default = excluded.severity_default,
  report_group = excluded.report_group,
  updated_at = now();

alter table public.issue_types enable row level security;
alter table public.issue_updates enable row level security;
