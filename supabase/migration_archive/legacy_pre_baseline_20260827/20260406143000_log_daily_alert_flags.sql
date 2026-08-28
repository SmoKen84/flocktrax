alter table public.log_daily
  add column if not exists maintenance_flag boolean not null default false,
  add column if not exists feedlines_flag boolean not null default false,
  add column if not exists nipple_lines_flag boolean not null default false,
  add column if not exists bird_health_alert boolean not null default false;

comment on column public.log_daily.maintenance_flag is
  'Signals a maintenance issue noted by the worker for this daily log entry.';

comment on column public.log_daily.feedlines_flag is
  'Signals a feedlines issue noted by the worker for this daily log entry.';

comment on column public.log_daily.nipple_lines_flag is
  'Signals a nipple lines issue noted by the worker for this daily log entry.';

comment on column public.log_daily.bird_health_alert is
  'Signals a bird health alert noted by the worker for this daily log entry.';
