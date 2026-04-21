alter table platform.sync_googleapis_sheet_columns
  add column if not exists map_state text;

update platform.sync_googleapis_sheet_columns
set map_state = case
  when coalesce(is_enabled, true) then 'enabled'
  else 'paused'
end
where map_state is null;

alter table platform.sync_googleapis_sheet_columns
  alter column map_state set default 'enabled';

alter table platform.sync_googleapis_sheet_columns
  alter column map_state set not null;

alter table platform.sync_googleapis_sheet_columns
  drop constraint if exists sync_googleapis_sheet_columns_map_state_chk;

alter table platform.sync_googleapis_sheet_columns
  add constraint sync_googleapis_sheet_columns_map_state_chk
  check (map_state in ('enabled', 'audit_log_only', 'paused'));

comment on column platform.sync_googleapis_sheet_columns.map_state is
  'Column map state: enabled writes to the spreadsheet, audit_log_only keeps the datapoint only in FlockTrax history, paused is a temporary inactive state.';
