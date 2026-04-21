alter table platform.sync_outbox
  add column if not exists dedupe_key text;

comment on column platform.sync_outbox.dedupe_key is
  'Adapter-defined uniqueness key used to collapse repeated pending work for the same sync target.';

create unique index if not exists ux_sync_outbox_active_dedupe
  on platform.sync_outbox (adapter_id, endpoint_id, dedupe_key)
  where dedupe_key is not null
    and status in ('pending', 'in_progress');

create or replace function platform.enqueue_googleapis_sync_day(
  p_source_table text,
  p_entity_id uuid,
  p_placement_id uuid,
  p_log_date date,
  p_operation text default 'sync_day'
)
returns uuid
language plpgsql
security definer
set search_path = platform, public
as $$
declare
  v_adapter_id uuid;
  v_existing_id uuid;
  v_outbox_id uuid;
  v_dedupe_key text;
  v_farm_id uuid;
  v_placement_key text;
  v_endpoint_id uuid;
  v_endpoint_name text;
  v_spreadsheet_id text;
  v_header_row integer;
  v_date_header_label text;
begin
  if p_placement_id is null or p_log_date is null then
    return null;
  end if;

  if p_source_table not in ('public.log_daily', 'public.log_mortality', 'public.log_weight') then
    raise exception 'Unsupported googleapis-sheets source table: %', p_source_table;
  end if;

  select id
    into v_adapter_id
  from platform.sync_adapters
  where adapter_key = 'googleapis-sheets'
    and is_active = true
  limit 1;

  if v_adapter_id is null then
    return null;
  end if;

  select
    p.id,
    p.farm_id,
    p.placement_key
    into p_placement_id, v_farm_id, v_placement_key
  from public.placements p
  where p.id = p_placement_id
  limit 1;

  if p_placement_id is null
    or v_farm_id is null
    or nullif(trim(coalesce(v_placement_key, '')), '') is null then
    return null;
  end if;

  select
    e.id as endpoint_id,
    e.endpoint_name,
    g.spreadsheet_id,
    g.header_row,
    g.date_header_label
    into v_endpoint_id, v_endpoint_name, v_spreadsheet_id, v_header_row, v_date_header_label
  from platform.sync_endpoints e
  join platform.sync_googleapis_sheets g
    on g.endpoint_id = e.id
  where e.adapter_id = v_adapter_id
    and e.farm_id = v_farm_id
    and e.is_enabled = true
  limit 1;

  if v_endpoint_id is null then
    return null;
  end if;

  v_dedupe_key := concat_ws(
    '|',
    'googleapis-sheets',
    p_operation,
    p_source_table,
    coalesce(p_entity_id::text, ''),
    coalesce(p_log_date::text, '')
  );

  select o.id
    into v_existing_id
  from platform.sync_outbox o
  where o.adapter_id = v_adapter_id
    and o.endpoint_id = v_endpoint_id
    and o.dedupe_key = v_dedupe_key
    and o.status in ('pending', 'in_progress')
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into platform.sync_outbox (
    endpoint_id,
    adapter_id,
    entity_type,
    entity_id,
    operation,
    placement_id,
    placement_key,
    log_date,
    payload,
    status,
    created_by,
    dedupe_key
  )
  values (
    v_endpoint_id,
    v_adapter_id,
    replace(p_source_table, 'public.', ''),
    p_entity_id,
    p_operation,
    p_placement_id,
    v_placement_key,
    p_log_date,
    jsonb_build_object(
      'payload_version', 1,
      'adapter_key', 'googleapis-sheets',
      'source_table', p_source_table,
      'entity_id', p_entity_id,
      'worksheet', jsonb_build_object(
        'tab_name', v_placement_key
      ),
      'row_locator', jsonb_build_object(
        'mode', 'date_header',
        'log_date', p_log_date,
        'date_header_label', v_date_header_label
      ),
      'workbook', jsonb_build_object(
        'spreadsheet_id', v_spreadsheet_id,
        'header_row', v_header_row,
        'date_header_label', v_date_header_label
      )
    ),
    'pending',
    auth.uid(),
    v_dedupe_key
  )
  returning id into v_outbox_id;

  return v_outbox_id;
end;
$$;

comment on function platform.enqueue_googleapis_sync_day(text, uuid, uuid, date, text) is
  'Queues one googleapis-sheets day-level sync job for a log record tied to a placement and date.';

create or replace function platform.sync_enqueue_googleapis_log_daily()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
begin
  perform platform.enqueue_googleapis_sync_day(
    p_source_table := 'public.log_daily',
    p_entity_id := new.id,
    p_placement_id := new.placement_id,
    p_log_date := new.log_date,
    p_operation := 'sync_day'
  );

  return new;
end;
$$;

create or replace function platform.sync_enqueue_googleapis_log_mortality()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
begin
  perform platform.enqueue_googleapis_sync_day(
    p_source_table := 'public.log_mortality',
    p_entity_id := new.id,
    p_placement_id := new.placement_id,
    p_log_date := new.log_date,
    p_operation := 'sync_day'
  );

  return new;
end;
$$;

create or replace function platform.sync_enqueue_googleapis_log_weight()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
begin
  perform platform.enqueue_googleapis_sync_day(
    p_source_table := 'public.log_weight',
    p_entity_id := new.id,
    p_placement_id := new.placement_id,
    p_log_date := new.log_date,
    p_operation := 'sync_day'
  );

  return new;
end;
$$;

drop trigger if exists trg_sync_enqueue_googleapis_log_daily on public.log_daily;
create trigger trg_sync_enqueue_googleapis_log_daily
after insert or update on public.log_daily
for each row
execute function platform.sync_enqueue_googleapis_log_daily();

drop trigger if exists trg_sync_enqueue_googleapis_log_mortality on public.log_mortality;
create trigger trg_sync_enqueue_googleapis_log_mortality
after insert or update on public.log_mortality
for each row
execute function platform.sync_enqueue_googleapis_log_mortality();

drop trigger if exists trg_sync_enqueue_googleapis_log_weight on public.log_weight;
create trigger trg_sync_enqueue_googleapis_log_weight
after insert or update on public.log_weight
for each row
execute function platform.sync_enqueue_googleapis_log_weight();

grant execute on function platform.enqueue_googleapis_sync_day(text, uuid, uuid, date, text) to authenticated, service_role;
