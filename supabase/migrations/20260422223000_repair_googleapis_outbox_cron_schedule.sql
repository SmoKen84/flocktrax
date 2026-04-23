create extension if not exists pg_net;
create extension if not exists pg_cron;

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
