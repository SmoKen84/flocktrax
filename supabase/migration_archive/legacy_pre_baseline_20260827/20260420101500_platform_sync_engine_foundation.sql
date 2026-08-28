create schema if not exists platform;

create or replace function platform.sync_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists platform.sync_adapters (
  id uuid primary key default gen_random_uuid(),
  adapter_key text not null unique,
  adapter_name text not null,
  description text,
  is_active boolean not null default true,
  config_screen_slug text,
  outbox_screen_slug text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint sync_adapters_key_chk check (adapter_key ~ '^[a-z0-9]+(?:[-_][a-z0-9]+)*$')
);

comment on table platform.sync_adapters is
  'Registry of pluggable FlockTrax sync interfaces such as googleapis-sheets, vtam, netman, or oracle.';

comment on column platform.sync_adapters.adapter_key is
  'Stable machine key used to route sync work to the correct adapter implementation.';

create table if not exists platform.sync_endpoints (
  id uuid primary key default gen_random_uuid(),
  adapter_id uuid not null references platform.sync_adapters(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  farm_group_id uuid references public.farm_groups(id) on delete set null,
  endpoint_name text not null,
  is_enabled boolean not null default true,
  placement_tab_rule text not null default 'placement_key',
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint sync_endpoints_tab_rule_chk check (placement_tab_rule = 'placement_key')
);

comment on table platform.sync_endpoints is
  'Per-farm or per-scope sync target registrations. For googleapis-sheets this points a farm to its target workbook.';

comment on column platform.sync_endpoints.placement_tab_rule is
  'Current FlockTrax convention for worksheet selection. Locked to placement_key for the first sync implementation.';

create unique index if not exists ux_sync_endpoints_adapter_farm
  on platform.sync_endpoints (adapter_id, farm_id)
  where farm_id is not null;

create table if not exists platform.sync_googleapis_sheets (
  endpoint_id uuid primary key references platform.sync_endpoints(id) on delete cascade,
  spreadsheet_id text not null,
  spreadsheet_name text,
  header_row integer not null default 6,
  date_header_label text not null default 'DATE',
  workbook_notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint sync_googleapis_sheets_header_row_chk check (header_row >= 1),
  constraint sync_googleapis_sheets_spreadsheet_id_chk check (length(trim(spreadsheet_id)) > 10)
);

comment on table platform.sync_googleapis_sheets is
  'Google Sheets adapter configuration. One workbook per farm, with worksheet/tab names derived from public.placements.placement_key.';

comment on column platform.sync_googleapis_sheets.spreadsheet_id is
  'Google spreadsheet id for the farm workbook. The worksheet/tab name is always placement_key.';

create table if not exists platform.sync_outbox (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references platform.sync_endpoints(id) on delete cascade,
  adapter_id uuid not null references platform.sync_adapters(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  operation text not null,
  placement_id uuid references public.placements(id) on delete set null,
  placement_key text,
  log_date date,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  requested_at timestamp with time zone not null default now(),
  claimed_at timestamp with time zone,
  processed_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint sync_outbox_status_chk check (status in ('pending', 'in_progress', 'sent', 'failed', 'rejected')),
  constraint sync_outbox_operation_chk check (operation in ('upsert_cell', 'clear_cell', 'sync_day', 'sync_placement', 'sync_feed', 'custom'))
);

comment on table platform.sync_outbox is
  'Generic adapter-agnostic sync work queue. Adapter workers claim rows from here and execute interface-specific writes.';

create index if not exists ix_sync_outbox_status_requested
  on platform.sync_outbox (status, requested_at);

create index if not exists ix_sync_outbox_endpoint_status
  on platform.sync_outbox (endpoint_id, status, requested_at);

create index if not exists ix_sync_outbox_placement_date
  on platform.sync_outbox (placement_id, log_date, status);

create table if not exists platform.sync_audit (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid references platform.sync_outbox(id) on delete set null,
  endpoint_id uuid references platform.sync_endpoints(id) on delete cascade,
  adapter_id uuid not null references platform.sync_adapters(id) on delete cascade,
  request_summary jsonb not null default '{}'::jsonb,
  response_summary jsonb not null default '{}'::jsonb,
  status_code integer,
  status text not null default 'logged',
  created_at timestamp with time zone not null default now(),
  constraint sync_audit_status_chk check (status in ('logged', 'sent', 'failed', 'rejected'))
);

comment on table platform.sync_audit is
  'Historical request/response trace for sync work. Used to inspect what the adapter tried to send and how the endpoint answered.';

create index if not exists ix_sync_audit_outbox_created
  on platform.sync_audit (outbox_id, created_at desc);

create index if not exists ix_sync_audit_endpoint_created
  on platform.sync_audit (endpoint_id, created_at desc);

drop trigger if exists sync_adapters_touch_updated_at on platform.sync_adapters;
create trigger sync_adapters_touch_updated_at
before update on platform.sync_adapters
for each row
execute function platform.sync_touch_updated_at();

drop trigger if exists sync_endpoints_touch_updated_at on platform.sync_endpoints;
create trigger sync_endpoints_touch_updated_at
before update on platform.sync_endpoints
for each row
execute function platform.sync_touch_updated_at();

drop trigger if exists sync_googleapis_sheets_touch_updated_at on platform.sync_googleapis_sheets;
create trigger sync_googleapis_sheets_touch_updated_at
before update on platform.sync_googleapis_sheets
for each row
execute function platform.sync_touch_updated_at();

drop trigger if exists sync_outbox_touch_updated_at on platform.sync_outbox;
create trigger sync_outbox_touch_updated_at
before update on platform.sync_outbox
for each row
execute function platform.sync_touch_updated_at();

insert into platform.sync_adapters (
  adapter_key,
  adapter_name,
  description,
  is_active,
  config_screen_slug,
  outbox_screen_slug
)
values (
  'googleapis-sheets',
  'Google APIs / Sheets',
  'Farm workbook sync using one spreadsheet per farm and placement_key as the worksheet name.',
  true,
  '/admin/sync/googleapis-sheets',
  '/admin/sync/googleapis-sheets/outbox'
)
on conflict (adapter_key) do update
set
  adapter_name = excluded.adapter_name,
  description = excluded.description,
  is_active = excluded.is_active,
  config_screen_slug = excluded.config_screen_slug,
  outbox_screen_slug = excluded.outbox_screen_slug,
  updated_at = now();

revoke all on all tables in schema platform from public;
grant select on platform.sync_adapters to authenticated, service_role;
grant select, insert, update, delete on platform.sync_endpoints to authenticated, service_role;
grant select, insert, update, delete on platform.sync_googleapis_sheets to authenticated, service_role;
grant select, insert, update, delete on platform.sync_outbox to authenticated, service_role;
grant select, insert, update, delete on platform.sync_audit to authenticated, service_role;
