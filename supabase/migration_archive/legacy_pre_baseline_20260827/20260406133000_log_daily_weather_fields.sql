alter table public.log_daily
  rename column ambient_temp to rel_humidity;

alter table public.log_daily
  add column if not exists outside_temp_current numeric(5,1),
  add column if not exists outside_temp_low numeric(5,1),
  add column if not exists outside_temp_high numeric(5,1);

comment on column public.log_daily.rel_humidity is
  'Relative humidity captured on the daily log.';

comment on column public.log_daily.outside_temp_current is
  'Current outside temperature captured on the daily log.';

comment on column public.log_daily.outside_temp_low is
  'Forecast or observed outside low temperature captured on the daily log.';

comment on column public.log_daily.outside_temp_high is
  'Forecast or observed outside high temperature captured on the daily log.';
