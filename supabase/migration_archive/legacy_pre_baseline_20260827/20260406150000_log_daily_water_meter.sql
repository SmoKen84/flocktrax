alter table public.log_daily
  add column if not exists water_meter_reading numeric(12,1);

comment on column public.log_daily.water_meter_reading is
  'Water meter reading captured on the daily log.';
