create table if not exists platform.sync_googleapis_sheet_columns (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references platform.sync_endpoints(id) on delete cascade,
  source_table text not null,
  source_field text not null,
  source_variant text not null default '',
  sheet_label text not null,
  value_mode text not null default 'direct',
  is_enabled boolean not null default true,
  sort_order integer not null default 100,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint sync_googleapis_sheet_columns_source_table_chk check (
    source_table in ('public.log_daily', 'public.log_mortality', 'public.log_weight')
  ),
  constraint sync_googleapis_sheet_columns_value_mode_chk check (
    value_mode in ('direct', 'boolean_flag', 'note', 'derived')
  ),
  constraint sync_googleapis_sheet_columns_label_chk check (length(trim(sheet_label)) > 0)
);

comment on table platform.sync_googleapis_sheet_columns is
  'Per-endpoint column map for the googleapis-sheets adapter. Maps FlockTrax source fields to worksheet header labels.';

comment on column platform.sync_googleapis_sheet_columns.source_variant is
  'Optional field variant such as male/female for weight datasets that fan out to distinct worksheet columns.';

create unique index if not exists ux_sync_googleapis_sheet_columns_key
  on platform.sync_googleapis_sheet_columns (
    endpoint_id,
    source_table,
    source_field,
    source_variant
  );

drop trigger if exists sync_googleapis_sheet_columns_touch_updated_at on platform.sync_googleapis_sheet_columns;
create trigger sync_googleapis_sheet_columns_touch_updated_at
before update on platform.sync_googleapis_sheet_columns
for each row
execute function platform.sync_touch_updated_at();

create or replace function platform.ensure_googleapis_sheet_columns(p_endpoint_id uuid)
returns integer
language plpgsql
security definer
set search_path = platform, public
as $$
declare
  v_count integer;
begin
  if p_endpoint_id is null then
    return 0;
  end if;

  insert into platform.sync_googleapis_sheet_columns (
    endpoint_id,
    source_table,
    source_field,
    source_variant,
    sheet_label,
    value_mode,
    is_enabled,
    sort_order,
    notes
  )
  select
    p_endpoint_id,
    seed.source_table,
    seed.source_field,
    seed.source_variant,
    seed.sheet_label,
    seed.value_mode,
    true,
    seed.sort_order,
    seed.notes
  from (
    values
      ('public.log_daily', 'age_days', '', 'Day', 'derived', 10, 'Verify actual worksheet label.'),
      ('public.log_daily', 'am_temp', '', 'AM Temp', 'direct', 20, null),
      ('public.log_daily', 'set_temp', '', 'Set Temp', 'direct', 30, null),
      ('public.log_daily', 'rel_humidity', '', 'Humidity', 'direct', 40, null),
      ('public.log_daily', 'outside_temp_current', '', 'Outside Temp', 'direct', 50, 'Verify actual worksheet label.'),
      ('public.log_daily', 'outside_temp_low', '', 'Outside Low', 'direct', 60, 'Verify actual worksheet label.'),
      ('public.log_daily', 'outside_temp_high', '', 'Outside High', 'direct', 70, 'Verify actual worksheet label.'),
      ('public.log_daily', 'water_meter_reading', '', 'Water Meter', 'direct', 80, 'Verify actual worksheet label.'),
      ('public.log_daily', 'maintenance_flag', '', 'Maintenance', 'boolean_flag', 90, 'Decide whether worksheet wants X, Y/N, or TRUE/FALSE.'),
      ('public.log_daily', 'feedlines_flag', '', 'Feedlines', 'boolean_flag', 100, 'Decide whether worksheet wants X, Y/N, or TRUE/FALSE.'),
      ('public.log_daily', 'nipple_lines_flag', '', 'Nipple Lines', 'boolean_flag', 110, 'Decide whether worksheet wants X, Y/N, or TRUE/FALSE.'),
      ('public.log_daily', 'bird_health_alert', '', 'Health Alert', 'boolean_flag', 120, 'Verify actual worksheet label.'),
      ('public.log_daily', 'min_vent', '', 'Min Vent', 'direct', 130, 'Verify actual worksheet label.'),
      ('public.log_daily', 'is_oda_open', '', 'ODA Open', 'boolean_flag', 140, 'Verify actual worksheet label.'),
      ('public.log_daily', 'oda_exception', '', 'ODA Exception', 'note', 150, 'May remain diary-only if workbook has no column.'),
      ('public.log_daily', 'naoh', '', 'NaOH', 'direct', 160, 'Verify actual worksheet capitalization.'),
      ('public.log_daily', 'comment', '', 'Comments', 'note', 170, null),
      ('public.log_mortality', 'dead_female', '', 'Hen Mortality', 'direct', 210, 'Verify actual worksheet label.'),
      ('public.log_mortality', 'dead_male', '', 'Rooster Mortality', 'direct', 220, 'Verify actual worksheet label.'),
      ('public.log_mortality', 'cull_female', '', 'Hen Culls', 'direct', 230, 'Verify actual worksheet label.'),
      ('public.log_mortality', 'cull_male', '', 'Rooster Culls', 'direct', 240, 'Verify actual worksheet label.'),
      ('public.log_mortality', 'cull_female_note', '', 'Hen Cull Note', 'note', 250, 'May remain diary-only if no worksheet column exists.'),
      ('public.log_mortality', 'cull_male_note', '', 'Rooster Cull Note', 'note', 260, 'May remain diary-only if no worksheet column exists.'),
      ('public.log_mortality', 'dead_reason', '', 'Mortality Reason', 'note', 270, 'May remain diary-only if no worksheet column exists.'),
      ('public.log_mortality', 'grade_litter', '', 'Litter', 'direct', 280, 'Verify actual worksheet label.'),
      ('public.log_mortality', 'grade_footpad', '', 'Footpad', 'direct', 290, 'Verify actual worksheet label.'),
      ('public.log_mortality', 'grade_feathers', '', 'Feathers', 'direct', 300, 'Verify actual worksheet label.'),
      ('public.log_mortality', 'grade_lame', '', 'Lame', 'direct', 310, 'Verify actual worksheet label.'),
      ('public.log_mortality', 'grade_pecking', '', 'Pecking', 'direct', 320, 'Verify actual worksheet label.'),
      ('public.log_weight', 'avg_weight', 'male', 'Male Avg', 'direct', 410, null),
      ('public.log_weight', 'avg_weight', 'female', 'Female Avg', 'direct', 420, null),
      ('public.log_weight', 'cnt_weighed', 'male', 'Sample M', 'direct', 430, null),
      ('public.log_weight', 'cnt_weighed', 'female', 'Sample F', 'direct', 440, null),
      ('public.log_weight', 'stddev_weight', 'male', 'Male StdDev', 'direct', 450, 'Only keep if workbook carries deviation columns.'),
      ('public.log_weight', 'stddev_weight', 'female', 'Female StdDev', 'direct', 460, 'Only keep if workbook carries deviation columns.'),
      ('public.log_weight', 'procure', 'male', 'Male Procure', 'derived', 470, 'Business meaning still needs confirmation.'),
      ('public.log_weight', 'procure', 'female', 'Female Procure', 'derived', 480, 'Business meaning still needs confirmation.'),
      ('public.log_weight', 'other_note', '', 'Weight Notes', 'note', 490, 'May remain diary-only if no worksheet column exists.'),
      ('public.log_weight', 'age_days', '', 'Day', 'derived', 500, 'Usually not needed if row date already determines age.')
  ) as seed(source_table, source_field, source_variant, sheet_label, value_mode, sort_order, notes)
  on conflict (endpoint_id, source_table, source_field, source_variant) do nothing;

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

comment on function platform.ensure_googleapis_sheet_columns(uuid) is
  'Ensures the default googleapis-sheets column map exists for a configured farm endpoint.';

select platform.ensure_googleapis_sheet_columns(e.id)
from platform.sync_endpoints e
join platform.sync_adapters a
  on a.id = e.adapter_id
where a.adapter_key = 'googleapis-sheets';

grant select, insert, update, delete on platform.sync_googleapis_sheet_columns to authenticated, service_role;
grant execute on function platform.ensure_googleapis_sheet_columns(uuid) to authenticated, service_role;
