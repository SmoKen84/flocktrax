create or replace function platform.invoke_googleapis_outbox_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Google Sheets outbox automation is disabled in the FlockTrax demo environment.';
end;
$$;

revoke all on function platform.invoke_googleapis_outbox_worker() from public, anon, authenticated;
grant execute on function platform.invoke_googleapis_outbox_worker() to service_role;
