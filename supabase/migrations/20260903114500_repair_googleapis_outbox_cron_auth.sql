create extension if not exists pg_net;
create extension if not exists pg_cron;

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

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'googleapis-outbox-process-every-5-min',
  'googleapis-outbox-process-every-15-min'
);

-- Deliberately do not schedule an outbound worker in demo. A later reviewed
-- migration may add a demo-only schedule after sandbox Sheets are provisioned.
