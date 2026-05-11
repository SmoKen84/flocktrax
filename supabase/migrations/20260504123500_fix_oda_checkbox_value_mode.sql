update platform.sync_googleapis_sheet_columns
set
  value_mode = 'direct',
  notes = 'Checkbox cell: write TRUE/FALSE, not X/blank.'
where source_table = 'public.log_daily'
  and source_field = 'is_oda_open';
