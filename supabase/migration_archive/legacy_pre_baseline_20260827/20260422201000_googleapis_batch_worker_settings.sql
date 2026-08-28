-- Document and seed Google Sheets outbox worker settings in platform.settings,
-- and change the default Supabase cron cadence to every 15 minutes so the queue
-- can accumulate rows and be flushed in larger grouped batches.

update platform.settings
set value = 'true', is_active = true
where lower(name) = 'googleapis_outbox_batch_writes';

insert into platform.settings (name, value, is_active)
select 'googleapis_outbox_batch_writes', 'true', true
where not exists (
  select 1
  from platform.settings
  where lower(name) = 'googleapis_outbox_batch_writes'
);

update platform.settings
set value = '100', is_active = true
where lower(name) = 'googleapis_outbox_batch_limit';

insert into platform.settings (name, value, is_active)
select 'googleapis_outbox_batch_limit', '100', true
where not exists (
  select 1
  from platform.settings
  where lower(name) = 'googleapis_outbox_batch_limit'
);

update platform.settings
set value = '15', is_active = true
where lower(name) = 'googleapis_outbox_schedule_minutes';

insert into platform.settings (name, value, is_active)
select 'googleapis_outbox_schedule_minutes', '15', true
where not exists (
  select 1
  from platform.settings
  where lower(name) = 'googleapis_outbox_schedule_minutes'
);

select cron.unschedule(jobid)
from cron.job
where jobname = 'googleapis-outbox-process-every-5-min';

select cron.unschedule(jobid)
from cron.job
where jobname = 'googleapis-outbox-process-every-15-min';

select cron.schedule(
  'googleapis-outbox-process-every-15-min',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := 'https://frneaccbbrijpolcesjm.supabase.co/functions/v1/googleapis-outbox-process',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybmVhY2NiYnJpanBvbGNlc2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NjcxMjksImV4cCI6MjA2NDE0MzEyOX0.EH6M6rIAVlYxIKgS8CMBGA0In4GlqGMaOFKgY9aCnho',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybmVhY2NiYnJpanBvbGNlc2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NjcxMjksImV4cCI6MjA2NDE0MzEyOX0.EH6M6rIAVlYxIKgS8CMBGA0In4GlqGMaOFKgY9aCnho'
      ),
      body := '{"limit":100}'::jsonb
    ) as request_id;
  $cron$
);
