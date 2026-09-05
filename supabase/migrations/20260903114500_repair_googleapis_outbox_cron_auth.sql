create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function platform.invoke_googleapis_outbox_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cron_secret text;
  v_request_id bigint;
begin
  select decrypted_secret
  into v_cron_secret
  from vault.decrypted_secrets
  where name = 'googleapis_outbox_cron_secret'
  order by created_at desc
  limit 1;

  if nullif(btrim(v_cron_secret), '') is null then
    raise exception 'Missing Vault secret: googleapis_outbox_cron_secret';
  end if;

  select net.http_post(
    url := 'https://frneaccbbrijpolcesjm.supabase.co/functions/v1/googleapis-outbox-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-flocktrax-cron-secret', v_cron_secret
    ),
    body := '{"limit":100}'::jsonb
  ) into v_request_id;

  return v_request_id;
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

select cron.schedule(
  'googleapis-outbox-process-every-15-min',
  '*/15 * * * *',
  $cron$
    select platform.invoke_googleapis_outbox_worker();
  $cron$
);
