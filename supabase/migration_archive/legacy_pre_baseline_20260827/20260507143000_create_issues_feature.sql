create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('barn', 'placement')),
  entity_id uuid not null,
  issue_type text not null,
  title text not null,
  description text null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  related_placement_id uuid null references public.placements(id) on delete set null,
  reported_log_date date null,
  opened_at timestamptz not null default now(),
  opened_by uuid null,
  resolved_at timestamptz null,
  resolved_by uuid null,
  resolution_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.issues is
  'Forward-only operational issue tracker for barns and live placements.';

comment on column public.issues.entity_type is
  'Owning record type. Barn issues persist on barns; flock-cycle issues persist on placements.';

comment on column public.issues.related_placement_id is
  'Optional placement context when a barn issue is created from within a live placement workflow.';

comment on column public.issues.reported_log_date is
  'Placement log date active in the mobile workflow when the issue was reported.';

create index if not exists issues_entity_status_idx
  on public.issues (entity_type, entity_id, status, opened_at desc);

create index if not exists issues_related_placement_idx
  on public.issues (related_placement_id, status, opened_at desc)
  where related_placement_id is not null;

create or replace function public.set_issue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_issues_set_updated_at on public.issues;

create trigger trg_issues_set_updated_at
before update on public.issues
for each row
execute function public.set_issue_updated_at();

alter table public.issues enable row level security;
