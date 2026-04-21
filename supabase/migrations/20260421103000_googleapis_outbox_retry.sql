create or replace function platform.retry_googleapis_outbox(
  p_outbox_id uuid
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

  select *
    into v_outbox
  from platform.sync_outbox
  where id = p_outbox_id
  for update;

  if v_outbox.id is null then
    raise exception 'Outbox row % was not found.', p_outbox_id;
  end if;

  if v_outbox.status not in ('failed', 'rejected') then
    raise exception 'Only failed or rejected outbox rows can be retried. Current status: %', v_outbox.status;
  end if;

  update platform.sync_outbox
  set
    status = 'pending',
    last_error = null,
    claimed_at = null,
    processed_at = null
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
    jsonb_build_object(
      'action', 'retry_googleapis_outbox',
      'previous_status', v_outbox.status,
      'attempts', v_outbox.attempts
    ),
    jsonb_build_object(
      'status', 'pending',
      'reason', 'manual_retry'
    ),
    202,
    'logged'
  );
end;
$$;

comment on function platform.retry_googleapis_outbox(uuid) is
  'Moves one failed or rejected googleapis-sheets outbox row back to pending and records a manual retry audit entry.';

grant execute on function platform.retry_googleapis_outbox(uuid) to authenticated, service_role;
