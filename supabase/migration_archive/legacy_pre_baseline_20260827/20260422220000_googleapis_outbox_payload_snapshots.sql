create or replace function platform.build_googleapis_sync_day_payload(
  p_source_table text,
  p_entity_id uuid,
  p_placement_id uuid,
  p_log_date date,
  p_operation text,
  p_endpoint_id uuid,
  p_endpoint_name text,
  p_spreadsheet_id text,
  p_header_row integer,
  p_date_header_label text,
  p_placement_key text,
  p_farm_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = platform, public
as $$
declare
  v_source_snapshot jsonb := '{}'::jsonb;
  v_placement_snapshot jsonb := '{}'::jsonb;
begin
  if p_source_table = 'public.log_daily' then
    select coalesce(to_jsonb(d), '{}'::jsonb)
      into v_source_snapshot
    from public.log_daily d
    where d.id = p_entity_id
    limit 1;
  elsif p_source_table = 'public.log_mortality' then
    select coalesce(to_jsonb(m), '{}'::jsonb)
      into v_source_snapshot
    from public.log_mortality m
    where m.id = p_entity_id
    limit 1;
  elsif p_source_table = 'public.log_weight' then
    select coalesce(to_jsonb(w), '{}'::jsonb)
      into v_source_snapshot
    from public.log_weight w
    where w.id = p_entity_id
    limit 1;
  end if;

  select coalesce(to_jsonb(p), '{}'::jsonb)
    into v_placement_snapshot
  from public.placements p
  where p.id = p_placement_id
  limit 1;

  return jsonb_build_object(
    'payload_version', 2,
    'captured_at', now(),
    'adapter_key', 'googleapis-sheets',
    'source_table', p_source_table,
    'entity_type', replace(p_source_table, 'public.', ''),
    'entity_id', p_entity_id,
    'operation', p_operation,
    'worksheet', jsonb_build_object(
      'tab_name', p_placement_key
    ),
    'row_locator', jsonb_build_object(
      'mode', 'date_header',
      'log_date', p_log_date,
      'date_header_label', p_date_header_label
    ),
    'workbook', jsonb_build_object(
      'endpoint_id', p_endpoint_id,
      'endpoint_name', p_endpoint_name,
      'farm_id', p_farm_id,
      'spreadsheet_id', p_spreadsheet_id,
      'header_row', p_header_row,
      'date_header_label', p_date_header_label
    ),
    'source_snapshot', coalesce(v_source_snapshot, '{}'::jsonb),
    'placement_snapshot', coalesce(v_placement_snapshot, '{}'::jsonb)
  );
end;
$$;

comment on function platform.build_googleapis_sync_day_payload(text, uuid, uuid, date, text, uuid, text, text, integer, text, text, uuid) is
  'Builds a replayable googleapis-sheets outbox payload containing routing metadata plus frozen source and placement snapshots.';

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
  v_payload jsonb;
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

  v_payload := platform.build_googleapis_sync_day_payload(
    p_source_table := p_source_table,
    p_entity_id := p_entity_id,
    p_placement_id := p_placement_id,
    p_log_date := p_log_date,
    p_operation := p_operation,
    p_endpoint_id := v_endpoint_id,
    p_endpoint_name := v_endpoint_name,
    p_spreadsheet_id := v_spreadsheet_id,
    p_header_row := v_header_row,
    p_date_header_label := v_date_header_label,
    p_placement_key := v_placement_key,
    p_farm_id := v_farm_id
  );

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
    update platform.sync_outbox
    set
      entity_type = replace(p_source_table, 'public.', ''),
      entity_id = p_entity_id,
      operation = p_operation,
      placement_id = p_placement_id,
      placement_key = v_placement_key,
      log_date = p_log_date,
      payload = v_payload,
      requested_at = now()
    where id = v_existing_id;

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
    v_payload,
    'pending',
    auth.uid(),
    v_dedupe_key
  )
  returning id into v_outbox_id;

  return v_outbox_id;
end;
$$;

comment on function platform.enqueue_googleapis_sync_day(text, uuid, uuid, date, text) is
  'Queues one googleapis-sheets day-level sync job for a log record tied to a placement and date, storing a replayable payload snapshot.';

update platform.sync_outbox o
set payload = platform.build_googleapis_sync_day_payload(
  p_source_table := concat('public.', o.entity_type),
  p_entity_id := o.entity_id,
  p_placement_id := o.placement_id,
  p_log_date := o.log_date,
  p_operation := o.operation,
  p_endpoint_id := o.endpoint_id,
  p_endpoint_name := e.endpoint_name,
  p_spreadsheet_id := g.spreadsheet_id,
  p_header_row := g.header_row,
  p_date_header_label := g.date_header_label,
  p_placement_key := o.placement_key,
  p_farm_id := e.farm_id
)
from platform.sync_adapters a,
     platform.sync_endpoints e,
     platform.sync_googleapis_sheets g
where a.id = o.adapter_id
  and a.adapter_key = 'googleapis-sheets'
  and e.id = o.endpoint_id
  and g.endpoint_id = o.endpoint_id
  and o.entity_type in ('log_daily', 'log_mortality', 'log_weight')
  and o.placement_id is not null
  and o.log_date is not null;
