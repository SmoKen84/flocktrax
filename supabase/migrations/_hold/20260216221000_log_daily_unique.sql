alter table public.log_daily
  add constraint log_daily_placement_id_log_date_key
  unique (placement_id, log_date);
