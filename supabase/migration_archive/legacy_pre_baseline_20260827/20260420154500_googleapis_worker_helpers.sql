create or replace function platform.claim_googleapis_outbox(
  p_limit integer default 10
)
returns table (
  id uuid,
  endpoint_id uuid,
  adapter_id uuid,
  entity_type text,
  entity_id uuid,
  operation text,
  placement_id uuid,
  placement_key text,
  log_date date,
  payload jsonb,
  attempts integer,
  requested_at timestamp with time zone,
  spreadsheet_id text,
  spreadsheet_name text,
  header_row integer,
  date_header_label text,
  endpoint_name text
)
language plpgsql
security definer
set search_path = platform, public
as $$
begin
  return query
  with candidate as (
    select o.id
    from platform.sync_outbox o
    join platform.sync_adapters a
      on a.id = o.adapter_id
    where a.adapter_key = 'googleapis-sheets'
      and o.status = 'pending'
    order by o.requested_at, o.created_at
    limit greatest(coalesce(p_limit, 1), 1)
    for update of o skip locked
  ),
  claimed as (
    update platform.sync_outbox o
    set
      status = 'in_progress',
      claimed_at = now(),
      attempts = o.attempts + 1,
      last_error = null
    from candidate c
    where o.id = c.id
    returning o.*
  )
  select
    c.id,
    c.endpoint_id,
    c.adapter_id,
    c.entity_type,
    c.entity_id,
    c.operation,
    c.placement_id,
    c.placement_key,
    c.log_date,
    c.payload,
    c.attempts,
    c.requested_at,
    g.spreadsheet_id,
    g.spreadsheet_name,
    g.header_row,
    g.date_header_label,
    e.endpoint_name
  from claimed c
  join platform.sync_endpoints e
    on e.id = c.endpoint_id
  join platform.sync_googleapis_sheets g
    on g.endpoint_id = c.endpoint_id
  order by c.requested_at, c.created_at;
end;
$$;

comment on function platform.claim_googleapis_outbox(integer) is
  'Claims pending googleapis-sheets outbox rows for worker processing and returns the workbook metadata needed to execute them.';

create or replace function platform.complete_googleapis_outbox(
  p_outbox_id uuid,
  p_status text,
  p_last_error text default null,
  p_request_summary jsonb default '{}'::jsonb,
  p_response_summary jsonb default '{}'::jsonb,
  p_status_code integer default null
)
returns void
language plpgsql
security definer
set search_path = platform, public
as $$
declare
  v_outbox platform.sync_outbox%rowtype;
begin
  if p_outbox_id is null then
    raise exception 'Outbox id is required.';
  end if;

  if p_status not in ('sent', 'failed', 'rejected') then
    raise exception 'Unsupported completion status: %', p_status;
  end if;

  select *
    into v_outbox
  from platform.sync_outbox
  where id = p_outbox_id
  for update;

  if v_outbox.id is null then
    raise exception 'Outbox row % was not found.', p_outbox_id;
  end if;

  update platform.sync_outbox
  set
    status = p_status,
    last_error = case when p_status = 'sent' then null else nullif(trim(coalesce(p_last_error, '')), '') end,
    processed_at = now()
  where id = p_outbox_id;

  insert into platform.sync_audit (
    outbox_id,
    endpoint_id,
    adapter_id,
    request_summary,
    response_summary,
    status_code,
    status
  )
  values (
    v_outbox.id,
    v_outbox.endpoint_id,
    v_outbox.adapter_id,
    coalesce(p_request_summary, '{}'::jsonb),
    coalesce(p_response_summary, '{}'::jsonb),
    p_status_code,
    p_status
  );
end;
$$;

comment on function platform.complete_googleapis_outbox(uuid, text, text, jsonb, jsonb, integer) is
  'Finalizes a googleapis-sheets outbox row and records one sync_audit entry describing the request and response.';

grant execute on function platform.claim_googleapis_outbox(integer) to authenticated, service_role;
grant execute on function platform.complete_googleapis_outbox(uuid, text, text, jsonb, jsonb, integer) to authenticated, service_role;
