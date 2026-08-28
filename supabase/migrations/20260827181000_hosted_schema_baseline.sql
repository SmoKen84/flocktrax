


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "gsync";


ALTER SCHEMA "gsync" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE SCHEMA IF NOT EXISTS "platform";


ALTER SCHEMA "platform" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "tuning";


ALTER SCHEMA "tuning" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";






CREATE TYPE "public"."gsync_job_kind" AS ENUM (
    'manual',
    'scheduled',
    'webhook'
);


ALTER TYPE "public"."gsync_job_kind" OWNER TO "postgres";


CREATE TYPE "public"."gsync_job_status" AS ENUM (
    'started',
    'succeeded',
    'failed',
    'partial'
);


ALTER TYPE "public"."gsync_job_status" OWNER TO "postgres";


CREATE TYPE "public"."gsync_write_status" AS ENUM (
    'pending',
    'sent',
    'failed'
);


ALTER TYPE "public"."gsync_write_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "platform"."build_googleapis_sync_day_payload"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text", "p_endpoint_id" "uuid", "p_endpoint_name" "text", "p_spreadsheet_id" "text", "p_header_row" integer, "p_date_header_label" "text", "p_placement_key" "text", "p_farm_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'platform', 'public'
    AS $$
declare
  v_source_snapshot jsonb := '{}'::jsonb;
  v_placement_snapshot jsonb := '{}'::jsonb;
begin
  if p_source_table = 'public.log_daily' then
    select coalesce(to_jsonb(d), '{}'::jsonb)
      into v_source_snapshot
    from public.log_daily d
    where d.id = p_entity_id
    limit 1;
  elsif p_source_table = 'public.log_mortality' then
    select coalesce(to_jsonb(m), '{}'::jsonb)
      into v_source_snapshot
    from public.log_mortality m
    where m.id = p_entity_id
    limit 1;
  elsif p_source_table = 'public.log_weight' then
    select coalesce(to_jsonb(w), '{}'::jsonb)
      into v_source_snapshot
    from public.log_weight w
    where w.id = p_entity_id
    limit 1;
  end if;

  select coalesce(to_jsonb(p), '{}'::jsonb)
    into v_placement_snapshot
  from public.placements p
  where p.id = p_placement_id
  limit 1;

  return jsonb_build_object(
    'payload_version', 2,
    'captured_at', now(),
    'adapter_key', 'googleapis-sheets',
    'source_table', p_source_table,
    'entity_type', replace(p_source_table, 'public.', ''),
    'entity_id', p_entity_id,
    'operation', p_operation,
    'worksheet', jsonb_build_object(
      'tab_name', p_placement_key
    ),
    'row_locator', jsonb_build_object(
      'mode', 'date_header',
      'log_date', p_log_date,
      'date_header_label', p_date_header_label
    ),
    'workbook', jsonb_build_object(
      'endpoint_id', p_endpoint_id,
      'endpoint_name', p_endpoint_name,
      'farm_id', p_farm_id,
      'spreadsheet_id', p_spreadsheet_id,
      'header_row', p_header_row,
      'date_header_label', p_date_header_label
    ),
    'source_snapshot', coalesce(v_source_snapshot, '{}'::jsonb),
    'placement_snapshot', coalesce(v_placement_snapshot, '{}'::jsonb)
  );
end;
$$;


ALTER FUNCTION "platform"."build_googleapis_sync_day_payload"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text", "p_endpoint_id" "uuid", "p_endpoint_name" "text", "p_spreadsheet_id" "text", "p_header_row" integer, "p_date_header_label" "text", "p_placement_key" "text", "p_farm_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "platform"."build_googleapis_sync_day_payload"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text", "p_endpoint_id" "uuid", "p_endpoint_name" "text", "p_spreadsheet_id" "text", "p_header_row" integer, "p_date_header_label" "text", "p_placement_key" "text", "p_farm_id" "uuid") IS 'Builds a replayable googleapis-sheets outbox payload containing routing metadata plus frozen source and placement snapshots.';



CREATE OR REPLACE FUNCTION "platform"."can_replay"("status" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select status in ('sent', 'failed', 'rejected');
$$;


ALTER FUNCTION "platform"."can_replay"("status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "platform"."claim_googleapis_outbox"("p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "endpoint_id" "uuid", "adapter_id" "uuid", "entity_type" "text", "entity_id" "uuid", "operation" "text", "placement_id" "uuid", "placement_key" "text", "log_date" "date", "payload" "jsonb", "attempts" integer, "requested_at" timestamp with time zone, "spreadsheet_id" "text", "spreadsheet_name" "text", "header_row" integer, "date_header_label" "text", "endpoint_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'platform', 'public'
    AS $$
begin
  return query
  with candidate as (
    select o.id
    from platform.sync_outbox o
    join platform.sync_adapters a
      on a.id = o.adapter_id
    where a.adapter_key = 'googleapis-sheets'
      and o.status = 'pending'
    order by o.requested_at, o.created_at
    limit greatest(coalesce(p_limit, 1), 1)
    for update of o skip locked
  ),
  claimed as (
    update platform.sync_outbox o
    set
      status = 'in_progress',
      claimed_at = now(),
      attempts = o.attempts + 1,
      last_error = null
    from candidate c
    where o.id = c.id
    returning o.*
  )
  select
    c.id,
    c.endpoint_id,
    c.adapter_id,
    c.entity_type,
    c.entity_id,
    c.operation,
    c.placement_id,
    c.placement_key,
    c.log_date,
    c.payload,
    c.attempts,
    c.requested_at,
    g.spreadsheet_id,
    g.spreadsheet_name,
    g.header_row,
    g.date_header_label,
    e.endpoint_name
  from claimed c
  join platform.sync_endpoints e
    on e.id = c.endpoint_id
  join platform.sync_googleapis_sheets g
    on g.endpoint_id = c.endpoint_id
  order by c.requested_at, c.created_at;
end;
$$;


ALTER FUNCTION "platform"."claim_googleapis_outbox"("p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "platform"."claim_googleapis_outbox"("p_limit" integer) IS 'Claims pending googleapis-sheets outbox rows for worker processing and returns the workbook metadata needed to execute them.';



CREATE OR REPLACE FUNCTION "platform"."complete_googleapis_outbox"("p_outbox_id" "uuid", "p_status" "text", "p_last_error" "text" DEFAULT NULL::"text", "p_request_summary" "jsonb" DEFAULT '{}'::"jsonb", "p_response_summary" "jsonb" DEFAULT '{}'::"jsonb", "p_status_code" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'platform', 'public'
    AS $$
declare
  v_outbox platform.sync_outbox%rowtype;
begin
  if p_outbox_id is null then
    raise exception 'Outbox id is required.';
  end if;

  if p_status not in ('sent', 'failed', 'rejected') then
    raise exception 'Unsupported completion status: %', p_status;
  end if;

  select *
    into v_outbox
  from platform.sync_outbox
  where id = p_outbox_id
  for update;

  if v_outbox.id is null then
    raise exception 'Outbox row % was not found.', p_outbox_id;
  end if;

  update platform.sync_outbox
  set
    status = p_status,
    last_error = case when p_status = 'sent' then null else nullif(trim(coalesce(p_last_error, '')), '') end,
    processed_at = now()
  where id = p_outbox_id;

  insert into platform.sync_audit (
    outbox_id,
    endpoint_id,
    adapter_id,
    request_summary,
    response_summary,
    status_code,
    status
  )
  values (
    v_outbox.id,
    v_outbox.endpoint_id,
    v_outbox.adapter_id,
    coalesce(p_request_summary, '{}'::jsonb),
    coalesce(p_response_summary, '{}'::jsonb),
    p_status_code,
    p_status
  );
end;
$$;


ALTER FUNCTION "platform"."complete_googleapis_outbox"("p_outbox_id" "uuid", "p_status" "text", "p_last_error" "text", "p_request_summary" "jsonb", "p_response_summary" "jsonb", "p_status_code" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "platform"."complete_googleapis_outbox"("p_outbox_id" "uuid", "p_status" "text", "p_last_error" "text", "p_request_summary" "jsonb", "p_response_summary" "jsonb", "p_status_code" integer) IS 'Finalizes a googleapis-sheets outbox row and records one sync_audit entry describing the request and response.';



CREATE OR REPLACE FUNCTION "platform"."enqueue_googleapis_sync_day"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text" DEFAULT 'sync_day'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'platform', 'public'
    AS $$
declare
  v_adapter_id uuid;
  v_existing_id uuid;
  v_outbox_id uuid;
  v_dedupe_key text;
  v_farm_id uuid;
  v_placement_key text;
  v_endpoint_id uuid;
  v_endpoint_name text;
  v_spreadsheet_id text;
  v_header_row integer;
  v_date_header_label text;
  v_payload jsonb;
begin
  if p_placement_id is null or p_log_date is null then
    return null;
  end if;

  if p_source_table not in ('public.log_daily', 'public.log_mortality', 'public.log_weight') then
    raise exception 'Unsupported googleapis-sheets source table: %', p_source_table;
  end if;

  select id
    into v_adapter_id
  from platform.sync_adapters
  where adapter_key = 'googleapis-sheets'
    and is_active = true
  limit 1;

  if v_adapter_id is null then
    return null;
  end if;

  select
    p.id,
    p.farm_id,
    p.placement_key
    into p_placement_id, v_farm_id, v_placement_key
  from public.placements p
  where p.id = p_placement_id
  limit 1;

  if p_placement_id is null
    or v_farm_id is null
    or nullif(trim(coalesce(v_placement_key, '')), '') is null then
    return null;
  end if;

  select
    e.id as endpoint_id,
    e.endpoint_name,
    g.spreadsheet_id,
    g.header_row,
    g.date_header_label
    into v_endpoint_id, v_endpoint_name, v_spreadsheet_id, v_header_row, v_date_header_label
  from platform.sync_endpoints e
  join platform.sync_googleapis_sheets g
    on g.endpoint_id = e.id
  where e.adapter_id = v_adapter_id
    and e.farm_id = v_farm_id
    and e.is_enabled = true
  limit 1;

  if v_endpoint_id is null then
    return null;
  end if;

  v_payload := platform.build_googleapis_sync_day_payload(
    p_source_table := p_source_table,
    p_entity_id := p_entity_id,
    p_placement_id := p_placement_id,
    p_log_date := p_log_date,
    p_operation := p_operation,
    p_endpoint_id := v_endpoint_id,
    p_endpoint_name := v_endpoint_name,
    p_spreadsheet_id := v_spreadsheet_id,
    p_header_row := v_header_row,
    p_date_header_label := v_date_header_label,
    p_placement_key := v_placement_key,
    p_farm_id := v_farm_id
  );

  v_dedupe_key := concat_ws(
    '|',
    'googleapis-sheets',
    p_operation,
    p_source_table,
    coalesce(p_entity_id::text, ''),
    coalesce(p_log_date::text, '')
  );

  select o.id
    into v_existing_id
  from platform.sync_outbox o
  where o.adapter_id = v_adapter_id
    and o.endpoint_id = v_endpoint_id
    and o.dedupe_key = v_dedupe_key
    and o.status in ('pending', 'in_progress')
  limit 1;

  if v_existing_id is not null then
    update platform.sync_outbox
    set
      entity_type = replace(p_source_table, 'public.', ''),
      entity_id = p_entity_id,
      operation = p_operation,
      placement_id = p_placement_id,
      placement_key = v_placement_key,
      log_date = p_log_date,
      payload = v_payload,
      requested_at = now()
    where id = v_existing_id;

    return v_existing_id;
  end if;

  insert into platform.sync_outbox (
    endpoint_id,
    adapter_id,
    entity_type,
    entity_id,
    operation,
    placement_id,
    placement_key,
    log_date,
    payload,
    status,
    created_by,
    dedupe_key
  )
  values (
    v_endpoint_id,
    v_adapter_id,
    replace(p_source_table, 'public.', ''),
    p_entity_id,
    p_operation,
    p_placement_id,
    v_placement_key,
    p_log_date,
    v_payload,
    'pending',
    auth.uid(),
    v_dedupe_key
  )
  returning id into v_outbox_id;

  return v_outbox_id;
end;
$$;


ALTER FUNCTION "platform"."enqueue_googleapis_sync_day"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "platform"."enqueue_googleapis_sync_day"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text") IS 'Queues one googleapis-sheets day-level sync job for a log record tied to a placement and date, storing a replayable payload snapshot.';



CREATE OR REPLACE FUNCTION "platform"."ensure_googleapis_sheet_columns"("p_endpoint_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'platform', 'public'
    AS $$
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


ALTER FUNCTION "platform"."ensure_googleapis_sheet_columns"("p_endpoint_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "platform"."ensure_googleapis_sheet_columns"("p_endpoint_id" "uuid") IS 'Ensures the default googleapis-sheets column map exists for a configured farm endpoint.';



CREATE OR REPLACE FUNCTION "platform"."sync_enqueue_googleapis_log_daily"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'platform', 'public'
    AS $$
begin
  if tg_op = 'UPDATE' then
    if not (
      new.log_date is distinct from old.log_date
      or new.age_days is distinct from old.age_days
      or new.am_temp is distinct from old.am_temp
      or new.set_temp is distinct from old.set_temp
      or new.rel_humidity is distinct from old.rel_humidity
      or new.outside_temp_current is distinct from old.outside_temp_current
      or new.outside_temp_low is distinct from old.outside_temp_low
      or new.outside_temp_high is distinct from old.outside_temp_high
      or new.water_meter_reading is distinct from old.water_meter_reading
      or new.maintenance_flag is distinct from old.maintenance_flag
      or new.feedlines_flag is distinct from old.feedlines_flag
      or new.nipple_lines_flag is distinct from old.nipple_lines_flag
      or new.bird_health_alert is distinct from old.bird_health_alert
      or new.min_vent is distinct from old.min_vent
      or new.is_oda_open is distinct from old.is_oda_open
      or new.oda_exception is distinct from old.oda_exception
      or new.naoh is distinct from old.naoh
      or new.comment is distinct from old.comment
      or new.is_active is distinct from old.is_active
    ) then
      return new;
    end if;
  end if;

  perform platform.enqueue_googleapis_sync_day(
    p_source_table := 'public.log_daily',
    p_entity_id := new.id,
    p_placement_id := new.placement_id,
    p_log_date := new.log_date,
    p_operation := 'sync_day'
  );

  return new;
end;
$$;


ALTER FUNCTION "platform"."sync_enqueue_googleapis_log_daily"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "platform"."sync_enqueue_googleapis_log_mortality"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'platform', 'public'
    AS $$
begin
  if tg_op = 'UPDATE' then
    if not (
      new.log_date is distinct from old.log_date
      or new.dead_female is distinct from old.dead_female
      or new.dead_male is distinct from old.dead_male
      or new.cull_female is distinct from old.cull_female
      or new.cull_male is distinct from old.cull_male
      or new.cull_female_note is distinct from old.cull_female_note
      or new.cull_male_note is distinct from old.cull_male_note
      or new.dead_reason is distinct from old.dead_reason
      or new.grade_litter is distinct from old.grade_litter
      or new.grade_footpad is distinct from old.grade_footpad
      or new.grade_feathers is distinct from old.grade_feathers
      or new.grade_lame is distinct from old.grade_lame
      or new.grade_pecking is distinct from old.grade_pecking
      or new.is_active is distinct from old.is_active
    ) then
      return new;
    end if;
  end if;

  perform platform.enqueue_googleapis_sync_day(
    p_source_table := 'public.log_mortality',
    p_entity_id := new.id,
    p_placement_id := new.placement_id,
    p_log_date := new.log_date,
    p_operation := 'sync_day'
  );

  return new;
end;
$$;


ALTER FUNCTION "platform"."sync_enqueue_googleapis_log_mortality"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "platform"."sync_enqueue_googleapis_log_weight"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'platform', 'public'
    AS $$
begin
  if tg_op = 'UPDATE' then
    if not (
      new.log_date is distinct from old.log_date
      or new.sex is distinct from old.sex
      or new.age_days is distinct from old.age_days
      or new.cnt_weighed is distinct from old.cnt_weighed
      or new.avg_weight is distinct from old.avg_weight
      or new.stddev_weight is distinct from old.stddev_weight
      or new.procure is distinct from old.procure
      or new.other_note is distinct from old.other_note
      or new.is_active is distinct from old.is_active
    ) then
      return new;
    end if;
  end if;

  perform platform.enqueue_googleapis_sync_day(
    p_source_table := 'public.log_weight',
    p_entity_id := new.id,
    p_placement_id := new.placement_id,
    p_log_date := new.log_date,
    p_operation := 'sync_day'
  );

  return new;
end;
$$;


ALTER FUNCTION "platform"."sync_enqueue_googleapis_log_weight"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "platform"."sync_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "platform"."sync_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_issue_memo"("p_issue_id" "uuid", "p_entry_text" "text", "p_effective_date" "date", "p_created_by" "uuid", "p_resolved" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_status text;
  v_update_id uuid;
  v_now timestamptz := now();
begin
  if nullif(btrim(coalesce(p_entry_text, '')), '') is null then
    raise exception 'Memo text is required.';
  end if;

  select status
  into v_status
  from public.issues
  where id = p_issue_id
  for update;

  if not found then
    raise exception 'Action Item was not found.';
  end if;

  if v_status <> 'open' then
    raise exception 'Resolved Action Items cannot be updated.';
  end if;

  insert into public.issue_updates (
    issue_id,
    entry_type,
    entry_text,
    effective_date,
    created_by
  )
  values (
    p_issue_id,
    case when p_resolved then 'resolved' else 'note' end,
    btrim(p_entry_text),
    coalesce(p_effective_date, v_now::date),
    p_created_by
  )
  returning id into v_update_id;

  update public.issues
  set
    updated_by = p_created_by,
    updated_at = v_now,
    status = case when p_resolved then 'resolved' else status end,
    resolved_at = case when p_resolved then v_now else resolved_at end,
    resolved_by = case when p_resolved then p_created_by else resolved_by end,
    resolution_note = case when p_resolved then btrim(p_entry_text) else resolution_note end
  where id = p_issue_id;

  return v_update_id;
end;
$$;


ALTER FUNCTION "public"."append_issue_memo"("p_issue_id" "uuid", "p_entry_text" "text", "p_effective_date" "date", "p_created_by" "uuid", "p_resolved" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."append_issue_memo"("p_issue_id" "uuid", "p_entry_text" "text", "p_effective_date" "date", "p_created_by" "uuid", "p_resolved" boolean) IS 'Atomically appends an immutable Action Item memo, updates parent audit fields, and optionally resolves the parent.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."placements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "barn_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "date_removed" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "placement_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "lh1_date" "date",
    "lh2_date" "date",
    "lh3_date" "date",
    "active_start" "date" NOT NULL,
    "active_end" "date",
    "version" integer DEFAULT 1 NOT NULL,
    "lifecycle_stage" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "closeout_submitted_at" timestamp with time zone,
    "closeout_submitted_by" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "canceled_at" timestamp with time zone,
    "canceled_by" "uuid",
    "unassigned_at" timestamp with time zone,
    "unassigned_by" "uuid",
    CONSTRAINT "placements_lifecycle_stage_check" CHECK (("lifecycle_stage" = ANY (ARRAY['unassigned'::"text", 'scheduled'::"text", 'awaiting_arrival'::"text", 'in_barn_growing'::"text", 'waiting_closeout'::"text", 'closeout_submitted'::"text", 'archived'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."placements" OWNER TO "postgres";


COMMENT ON TABLE "public"."placements" IS 'These records create the primary dataset of FlockTRAX.  This dataset brings the Farm.Barn physical location and assigns an integrator''s set of chicks (Flock) together to create the statistical backbone of FlockTRAX.  Using this dataset, the sync_engine backend will automatically maintain the integrator''s database of choice without the individual FlockTRAX users needing access.';



COMMENT ON COLUMN "public"."placements"."lifecycle_stage" IS 'Authoritative business lifecycle stage for the placement operational lifecycle.';



COMMENT ON COLUMN "public"."placements"."closeout_submitted_at" IS 'Timestamp when flock closeout was submitted.';



COMMENT ON COLUMN "public"."placements"."closeout_submitted_by" IS 'Authenticated user who submitted flock closeout.';



COMMENT ON COLUMN "public"."placements"."archived_at" IS 'Timestamp when the placement was finalized into archive/history.';



COMMENT ON COLUMN "public"."placements"."archived_by" IS 'Authenticated user who archived the placement lifecycle record.';



COMMENT ON COLUMN "public"."placements"."canceled_at" IS 'Timestamp when a scheduled or awaiting-arrival placement was canceled before birds entered the barn.';



COMMENT ON COLUMN "public"."placements"."canceled_by" IS 'Authenticated user who canceled the placement.';



COMMENT ON COLUMN "public"."placements"."unassigned_at" IS 'Timestamp when a future placement was released from its barn/date reservation and moved to the unassigned flock queue.';



COMMENT ON COLUMN "public"."placements"."unassigned_by" IS 'Authenticated user who moved the future placement to the unassigned flock queue.';



CREATE OR REPLACE FUNCTION "public"."archive_flock_closeout"("p_placement_id" "uuid") RETURNS "public"."placements"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid;
  v_flock_id uuid;
  v_row public.placements%rowtype;
begin
  v_actor := auth.uid();

  perform public.ensure_placement_closeout_row(p_placement_id);

  select flock_id
    into v_flock_id
  from public.placements
  where id = p_placement_id;

  update public.placements
    set lifecycle_stage = 'archived',
        archived_at = now(),
        archived_by = coalesce(v_actor, archived_by),
        is_active = false,
        updated_at = now(),
        updated_by = coalesce(v_actor::text, updated_by)
  where id = p_placement_id
    and lifecycle_stage in ('waiting_closeout', 'closeout_submitted')
  returning *
  into v_row;

  if v_row.id is null then
    raise exception 'Placement % is not eligible for archive.', p_placement_id;
  end if;

  update public.placement_closeouts
    set status = 'archived',
        archived_at = coalesce(archived_at, now()),
        archived_by = coalesce(archived_by, v_actor),
        updated_at = now(),
        updated_by = coalesce(v_actor::text, updated_by)
  where placement_id = p_placement_id;

  update public.flocks
    set is_active = false,
        is_complete = true,
        is_in_barn = false,
        updated_at = now(),
        updated_by = coalesce(v_actor::text, updated_by)
  where id = v_flock_id;

  perform public.write_activity_log(
    p_placement_id := p_placement_id,
    p_entry_type := 'state_change',
    p_action_key := 'archive_flock_closeout',
    p_details := 'Flock closeout archived into history.',
    p_source := 'closeout.state',
    p_meta := jsonb_build_object('lifecycle_stage', 'archived')
  );

  return v_row;
end;
$$;


ALTER FUNCTION "public"."archive_flock_closeout"("p_placement_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_version_on_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bump_version_on_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_farm"("target_farm_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select
    (select public.is_admin())
    or exists (
      select 1
      from public.farm_memberships fm
      where fm.user_id = (select auth.uid())
        and fm.farm_id = target_farm_id
        and fm.is_active = true
    );
$$;


ALTER FUNCTION "public"."can_access_farm"("target_farm_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_write_farm"("target_farm_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select
    (select public.is_admin())
    or exists (
      select 1
      from public.farm_memberships fm
      join public.roles r on r.id = fm.role_id
      where fm.user_id = (select auth.uid())
        and fm.farm_id = target_farm_id
        and fm.is_active = true
        and r.code in ('admin', 'manager')
    );
$$;


ALTER FUNCTION "public"."can_write_farm"("target_farm_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_scheduled_placement"("p_source_placement_id" "uuid", "p_target_placement_id" "uuid" DEFAULT NULL::"uuid", "p_actor_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_source public.placements%rowtype;
  v_source_flock public.flocks%rowtype;
  v_target public.placements%rowtype;
  v_target_flock public.flocks%rowtype;
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_sibling_count integer := 0;
  v_daily_count integer := 0;
  v_mortality_count integer := 0;
  v_weight_count integer := 0;
  v_drop_count integer := 0;
  v_drop_lbs numeric := 0;
  v_queued_drop_count integer := 0;
  v_queued_drop_lbs numeric := 0;
  v_order_count integer := 0;
  v_order_lbs numeric := 0;
  v_feed_count integer := 0;
begin
  if v_actor is null then
    raise exception 'A signed-in user is required to cancel a scheduled flock.';
  end if;

  select p.*
    into v_source
  from public.placements p
  where p.id = p_source_placement_id
  for update;

  if not found then
    raise exception 'The scheduled placement could not be found.';
  end if;

  select f.*
    into v_source_flock
  from public.flocks f
  where f.id = v_source.flock_id
  for update;

  if not found then
    raise exception 'The scheduled flock could not be found.';
  end if;

  if v_source.lifecycle_stage not in ('scheduled', 'awaiting_arrival')
     or v_source.date_removed is not null
     or coalesce(v_source_flock.is_in_barn, false) then
    raise exception 'Only scheduled or awaiting-arrival flocks that have not entered the barn can be canceled.';
  end if;

  select count(*) into v_sibling_count
  from public.placements p
  where p.flock_id = v_source.flock_id;

  if v_sibling_count <> 1 then
    raise exception 'This flock is linked to more than one placement and cannot be canceled from the scheduler.';
  end if;

  select count(*) into v_daily_count
  from public.log_daily d
  where d.placement_id = v_source.id;

  select count(*) into v_mortality_count
  from public.log_mortality m
  where m.placement_id = v_source.id;

  select count(*) into v_weight_count
  from public.log_weight w
  where w.placement_id = v_source.id;

  if v_daily_count + v_mortality_count + v_weight_count > 0 then
    raise exception 'This flock cannot be canceled because daily, mortality, or weight records already exist.';
  end if;

  select count(*), coalesce(sum(abs(coalesce(d.drop_weight, 0))), 0)
    into v_drop_count, v_drop_lbs
  from public.feed_drops d
  where d.placement_id = v_source.id;

  select count(*), coalesce(sum(abs(coalesce(d.drop_weight, 0))), 0)
    into v_queued_drop_count, v_queued_drop_lbs
  from public.feed_drops d
  where d.queued_from_placement_id = v_source.id
    and d.placement_id is distinct from v_source.id;

  select count(*), coalesce(sum(greatest(coalesce(c.ordered_lbs, 0) - coalesce(c.received_lbs, 0), 0)), 0)
    into v_order_count, v_order_lbs
  from public.feed_order_commitments c
  where c.placement_id = v_source.id
    and c.status <> 'cancelled';

  v_feed_count := v_drop_count + v_queued_drop_count + v_order_count;

  if v_feed_count > 0 and p_target_placement_id is null then
    raise exception 'Feed is associated with this flock. Select the flock that should receive it before canceling.';
  end if;

  if p_target_placement_id is not null then
    if p_target_placement_id = v_source.id then
      raise exception 'The canceled flock cannot receive its own feed.';
    end if;

    select p.*
      into v_target
    from public.placements p
    where p.id = p_target_placement_id
    for update;

    if not found then
      raise exception 'The selected destination placement could not be found.';
    end if;

    select f.*
      into v_target_flock
    from public.flocks f
    where f.id = v_target.flock_id
    for update;

    if not found then
      raise exception 'The selected destination flock could not be found.';
    end if;

    if v_target.lifecycle_stage not in ('scheduled', 'awaiting_arrival')
       or v_target.date_removed is not null
       or coalesce(v_target_flock.is_in_barn, false)
       or coalesce(v_target_flock.is_complete, false) then
      raise exception 'Feed can only be moved to a scheduled or awaiting-arrival flock.';
    end if;

    if v_target.date_placed <= v_source.date_placed then
      raise exception 'Feed must be moved to a later scheduled flock.';
    end if;

    if (v_drop_count + v_queued_drop_count) > 0 and v_target.barn_id <> v_source.barn_id then
      raise exception 'Delivered or queued feed must be reassigned to a flock scheduled for the same barn.';
    end if;

    update public.feed_drops
    set placement_id = v_target.id,
        placement_code = v_target.placement_key,
        updated_at = now()
    where placement_id = v_source.id;

    update public.feed_drops
    set queued_from_placement_id = v_target.id,
        queued_from_placement_code = v_target.placement_key,
        updated_at = now()
    where queued_from_placement_id = v_source.id;

    update public.feed_order_commitments
    set placement_id = v_target.id,
        farm_id = v_target.farm_id,
        barn_id = v_target.barn_id,
        feed_bin_id = case when v_target.barn_id = v_source.barn_id then feed_bin_id else null end,
        updated_at = now(),
        updated_by = v_actor::text
    where placement_id = v_source.id
      and status <> 'cancelled';
  end if;

  update public.placements
  set lifecycle_stage = 'canceled',
      is_active = false,
      canceled_at = now(),
      canceled_by = v_actor,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_source.id;

  update public.flocks
  set is_active = false,
      is_in_barn = false,
      is_complete = false,
      is_settled = false,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_source.flock_id;

  return jsonb_build_object(
    'source_placement_id', v_source.id,
    'source_placement_key', v_source.placement_key,
    'source_flock_id', v_source.flock_id,
    'target_placement_id', case when v_feed_count > 0 then v_target.id else null end,
    'target_placement_key', case when v_feed_count > 0 then v_target.placement_key else null end,
    'feed_drop_count', v_drop_count,
    'feed_drop_lbs', v_drop_lbs,
    'queued_feed_drop_count', v_queued_drop_count,
    'queued_feed_drop_lbs', v_queued_drop_lbs,
    'feed_order_count', v_order_count,
    'feed_order_lbs', v_order_lbs
  );
end;
$$;


ALTER FUNCTION "public"."cancel_scheduled_placement"("p_source_placement_id" "uuid", "p_target_placement_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_placement_key"("p_flock_id" "uuid", "p_barn_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select f.flock_number::text || '-' || b.barn_code
  from public.flocks f
  join public.barns b on b.id = p_barn_id
  where f.id = p_flock_id
$$;


ALTER FUNCTION "public"."compute_placement_key"("p_flock_id" "uuid", "p_barn_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."placement_closeouts" (
    "closeout_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "placement_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "barn_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "processed_head_final" integer,
    "live_weight_final" numeric(12,2),
    "feed_delivered_total_lbs" numeric(12,2),
    "feed_remaining_credit_lbs" numeric(12,2),
    "feed_consumed_total_lbs" numeric(12,2),
    "starter_consumed_lbs" numeric(12,2),
    "grower_consumed_lbs" numeric(12,2),
    "feed_per_head_lbs" numeric(12,4),
    "starter_per_head_lbs" numeric(12,4),
    "grower_per_head_lbs" numeric(12,4),
    "feed_conversion" numeric(12,4),
    "breed_stat_snapshot" "jsonb",
    "breed_stat_comparison" "jsonb",
    "notes" "text",
    "manual_override_reason" "text",
    "submitted_at" timestamp with time zone,
    "submitted_by" "uuid",
    "settlement_received_at" timestamp with time zone,
    "settlement_received_by" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "text",
    "livehaul_complete_at" timestamp with time zone,
    "livehaul_complete_by" "uuid",
    "feed_verified_at" timestamp with time zone,
    "feed_verified_by" "uuid",
    "invoice_created_at" timestamp with time zone,
    "invoice_created_by" "uuid",
    "closeout_completed_at" timestamp with time zone,
    "closeout_completed_by" "uuid",
    CONSTRAINT "placement_closeouts_processed_head_final_check" CHECK ((("processed_head_final" IS NULL) OR ("processed_head_final" >= 0))),
    CONSTRAINT "placement_closeouts_ratio_totals_check" CHECK (((("feed_per_head_lbs" IS NULL) OR ("feed_per_head_lbs" >= (0)::numeric)) AND (("starter_per_head_lbs" IS NULL) OR ("starter_per_head_lbs" >= (0)::numeric)) AND (("grower_per_head_lbs" IS NULL) OR ("grower_per_head_lbs" >= (0)::numeric)) AND (("feed_conversion" IS NULL) OR ("feed_conversion" >= (0)::numeric)))),
    CONSTRAINT "placement_closeouts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'settlement_received'::"text", 'archived'::"text"]))),
    CONSTRAINT "placement_closeouts_weight_totals_check" CHECK (((("live_weight_final" IS NULL) OR ("live_weight_final" >= (0)::numeric)) AND (("feed_delivered_total_lbs" IS NULL) OR ("feed_delivered_total_lbs" >= (0)::numeric)) AND (("feed_remaining_credit_lbs" IS NULL) OR ("feed_remaining_credit_lbs" >= (0)::numeric)) AND (("feed_consumed_total_lbs" IS NULL) OR ("feed_consumed_total_lbs" >= (0)::numeric)) AND (("starter_consumed_lbs" IS NULL) OR ("starter_consumed_lbs" >= (0)::numeric)) AND (("grower_consumed_lbs" IS NULL) OR ("grower_consumed_lbs" >= (0)::numeric))))
);


ALTER TABLE "public"."placement_closeouts" OWNER TO "postgres";


COMMENT ON TABLE "public"."placement_closeouts" IS 'Placement-level closeout record that stores the authoritative closeout workflow state, frozen final values, and settlement/archive milestones for a flock placement.';



COMMENT ON COLUMN "public"."placement_closeouts"."status" IS 'Closeout workflow state: draft, submitted, settlement_received, or archived.';



COMMENT ON COLUMN "public"."placement_closeouts"."processed_head_final" IS 'Confirmed final processed or delivered-for-processing head count for the placement closeout.';



COMMENT ON COLUMN "public"."placement_closeouts"."live_weight_final" IS 'Confirmed final live bird weight produced across the closeout.';



COMMENT ON COLUMN "public"."placement_closeouts"."feed_delivered_total_lbs" IS 'Total feed delivered to the flock during the placement lifecycle before closeout adjustments.';



COMMENT ON COLUMN "public"."placement_closeouts"."feed_remaining_credit_lbs" IS 'Unused feed remaining at closeout that will be credited forward to the next flock.';



COMMENT ON COLUMN "public"."placement_closeouts"."feed_consumed_total_lbs" IS 'Total feed consumed after subtracting remaining credited feed from delivered feed.';



COMMENT ON COLUMN "public"."placement_closeouts"."starter_consumed_lbs" IS 'Starter feed consumed by the flock during the placement lifecycle.';



COMMENT ON COLUMN "public"."placement_closeouts"."grower_consumed_lbs" IS 'Grower feed consumed by the flock during the placement lifecycle.';



COMMENT ON COLUMN "public"."placement_closeouts"."feed_conversion" IS 'Feed conversion ratio calculated as feed consumed divided by final live weight.';



COMMENT ON COLUMN "public"."placement_closeouts"."breed_stat_snapshot" IS 'Snapshot of the breed-standard values used at closeout time so later reference data changes do not alter historical submissions.';



COMMENT ON COLUMN "public"."placement_closeouts"."breed_stat_comparison" IS 'Structured comparison payload between closeout actuals and the breed-standard snapshot.';



COMMENT ON COLUMN "public"."placement_closeouts"."livehaul_complete_at" IS 'Timestamp when livehaul reconciliation and load entry were confirmed complete for closeout.';



COMMENT ON COLUMN "public"."placement_closeouts"."livehaul_complete_by" IS 'Authenticated user who marked livehaul reconciliation complete.';



COMMENT ON COLUMN "public"."placement_closeouts"."feed_verified_at" IS 'Timestamp when closeout feed totals were verified against ticket activity.';



COMMENT ON COLUMN "public"."placement_closeouts"."feed_verified_by" IS 'Authenticated user who verified closeout feed totals.';



COMMENT ON COLUMN "public"."placement_closeouts"."invoice_created_at" IS 'Timestamp when the invoice or settlement-facing closeout document was created.';



COMMENT ON COLUMN "public"."placement_closeouts"."invoice_created_by" IS 'Authenticated user who marked the invoice-created milestone complete.';



COMMENT ON COLUMN "public"."placement_closeouts"."closeout_completed_at" IS 'Timestamp when all closeout tasks were complete and the flock was ready for final archive.';



COMMENT ON COLUMN "public"."placement_closeouts"."closeout_completed_by" IS 'Authenticated user who marked the closeout-complete milestone.';



CREATE OR REPLACE FUNCTION "public"."ensure_placement_closeout_row"("p_placement_id" "uuid") RETURNS "public"."placement_closeouts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.placement_closeouts%rowtype;
begin
  insert into public.placement_closeouts (
    placement_id,
    flock_id,
    farm_id,
    barn_id,
    status
  )
  select
    p.id,
    p.flock_id,
    p.farm_id,
    p.barn_id,
    case
      when p.lifecycle_stage = 'archived' then 'archived'
      when p.lifecycle_stage = 'closeout_submitted' then 'submitted'
      else 'draft'
    end
  from public.placements p
  where p.id = p_placement_id
  on conflict (placement_id) do update
    set flock_id = excluded.flock_id,
        farm_id = excluded.farm_id,
        barn_id = excluded.barn_id,
        updated_at = now()
  returning *
  into v_row;

  if v_row.closeout_id is null then
    raise exception 'Placement % was not found for closeout initialization.', p_placement_id;
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."ensure_placement_closeout_row"("p_placement_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."feedbins_updatable_iud"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  _id uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.feedbins (id, farm_id, barn_id, bin_num, capacity)
    values (coalesce(new.id, gen_random_uuid()), new.farm_id, new.barn_id, new.bin_num, new.capacity)
    returning id into _id;

    select v.* into new
    from public.feedbins_updatable v
    where v.id = _id;

    return new;

  elsif tg_op = 'UPDATE' then
    update public.feedbins
       set farm_id = new.farm_id,
           barn_id = new.barn_id,
           bin_num = new.bin_num,
           capacity = new.capacity
     where id = old.id
    returning id into _id;

    select v.* into new
    from public.feedbins_updatable v
    where v.id = _id;

    return new;

  elsif tg_op = 'DELETE' then
    delete from public.feedbins where id = old.id;
    return old;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."feedbins_updatable_iud"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_farms_updated_by_nulls"("target" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  patched integer := 0;
begin
  update public.farms
  set updated_by = target
  where updated_by is null;
  get diagnostics patched = row_count;
  return patched;
end;
$$;


ALTER FUNCTION "public"."fix_farms_updated_by_nulls"("target" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_farms_updated_by_once"("target" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  patched int := 0;
begin
  update public.farms set updated_by = target where updated_by is null;
  get diagnostics patched = row_count;
  return patched;
end;
$$;


ALTER FUNCTION "public"."fix_farms_updated_by_once"("target" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."flocks_sync_barn_state"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_barn_id uuid;
begin
  for v_barn_id in
    select distinct p.barn_id
    from public.placements p
    where p.flock_id in (new.id, old.id)
      and p.is_active = true
      and p.date_removed is null
  loop
    perform public.sync_barn_current_state(v_barn_id);
  end loop;

  return new;
end;
$$;


ALTER FUNCTION "public"."flocks_sync_barn_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, NULL), COALESCE(NEW.raw_user_meta_data->>'full_name', NULL))
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Insert only if not exists (safety for retries)
  INSERT INTO public.profiles(id, email, full_name, created_at, updated_at)
  VALUES (NEW.id, COALESCE(NEW.email, (NEW.raw_user_meta_data->>'email')), NULL, now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inspect_placement_state"("p_placement_key" "text") RETURNS TABLE("placement_key" "text", "placement_id" "uuid", "barn_code" "text", "placement_is_active" boolean, "date_removed" "date", "flock_number" integer, "flock_is_active" boolean, "flock_is_in_barn" boolean, "barn_is_empty" boolean, "barn_has_flock" boolean, "active_flock_id" "uuid", "active_start" "date", "active_end" "date")
    LANGUAGE "sql"
    AS $$
  select
    p.placement_key,
    p.id,
    b.barn_code,
    p.is_active,
    p.date_removed,
    f.flock_number,
    f.is_active,
    f.is_in_barn,
    b.is_empty,
    b.has_flock,
    b.active_flock_id,
    p.active_start,
    p.active_end
  from public.placements p
  join public.flocks f
    on f.id = p.flock_id
  join public.barns b
    on b.id = p.barn_id
  where p.placement_key = p_placement_key;
$$;


ALTER FUNCTION "public"."inspect_placement_state"("p_placement_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and (
        lower(r.code) = 'admin'
        or lower(r.code) = 'superadmin'
        or lower(r.code) = 'super_admin'
      )
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."make_placement_current"("p_placement_id" "uuid") RETURNS TABLE("placement_id" "uuid", "barn_id" "uuid", "flock_id" "uuid", "placement_is_active" boolean, "flock_is_in_barn" boolean, "barn_is_empty" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_barn_id uuid;
  v_flock_id uuid;
  v_other_active uuid;
  v_actor text;
begin
  v_actor := auth.uid()::text;

  select p.barn_id, p.flock_id
    into v_barn_id, v_flock_id
  from public.placements p
  where p.id = p_placement_id;

  if v_barn_id is null or v_flock_id is null then
    raise exception 'Placement % was not found.', p_placement_id;
  end if;

  select p.id
    into v_other_active
  from public.placements p
  where p.barn_id = v_barn_id
    and p.id <> p_placement_id
    and p.is_active = true
    and p.date_removed is null
  limit 1;

  if v_other_active is not null then
    raise exception 'Barn % already has another active placement (%).', v_barn_id, v_other_active;
  end if;

  update public.placements
    set is_active = true,
        lifecycle_stage = 'awaiting_arrival',
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = p_placement_id;

  update public.flocks
    set is_active = false,
        is_in_barn = false,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id in (
    select p.flock_id
    from public.placements p
    where p.barn_id = v_barn_id
      and p.id <> p_placement_id
      and p.date_removed is null
  );

  update public.flocks
    set is_active = true,
        is_in_barn = false,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = v_flock_id;

  perform public.sync_barn_current_state(v_barn_id);

  perform public.write_activity_log(
    p_placement_id := p_placement_id,
    p_entry_type := 'state_change',
    p_action_key := 'make_placement_current',
    p_details := 'Placement promoted into get-ready status while the barn remains empty awaiting chick arrival.',
    p_source := 'dashboard.state',
    p_meta := jsonb_build_object('lifecycle_stage', 'awaiting_arrival')
  );

  return query
  select p.id, p.barn_id, p.flock_id, p.is_active, f.is_in_barn, b.is_empty
  from public.placements p
  join public.flocks f
    on f.id = p.flock_id
  join public.barns b
    on b.id = p.barn_id
  where p.id = p_placement_id;
end;
$$;


ALTER FUNCTION "public"."make_placement_current"("p_placement_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_barn_empty"("p_barn_id" "uuid", "p_removed_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("placement_id" "uuid", "barn_id" "uuid", "flock_id" "uuid", "placement_is_active" boolean, "flock_is_in_barn" boolean, "barn_is_empty" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_current record;
  v_next record;
  v_actor text;
  v_current_sort_date date;
begin
  v_actor := auth.uid()::text;

  select p.id, p.flock_id, p.active_start, p.created_at
    into v_current
  from public.placements p
  where p.barn_id = p_barn_id
    and p.is_active = true
    and p.date_removed is null
    and p.lifecycle_stage not in ('unassigned', 'canceled', 'archived')
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_current.id is null then
    raise exception 'Barn % does not have an active placement to empty.', p_barn_id;
  end if;

  v_current_sort_date := v_current.active_start;

  update public.placements
  set is_active = false,
      date_removed = coalesce(date_removed, p_removed_date),
      lifecycle_stage = 'waiting_closeout',
      updated_at = now(),
      updated_by = coalesce(v_actor, updated_by)
  where id = v_current.id;

  perform public.ensure_placement_closeout_row(v_current.id);

  update public.flocks
  set is_active = false,
      is_in_barn = false,
      flock_removed = coalesce(flock_removed, p_removed_date),
      updated_at = now(),
      updated_by = coalesce(v_actor, updated_by)
  where id = v_current.flock_id;

  perform public.write_activity_log(
    p_placement_id := v_current.id,
    p_entry_type := 'state_change',
    p_action_key := 'mark_barn_empty',
    p_details := format('Flock checked out on %s and moved into closeout pending.', p_removed_date),
    p_source := 'dashboard.state',
    p_meta := jsonb_build_object(
      'removed_date', p_removed_date,
      'workflow', 'checkout_flock',
      'lifecycle_stage', 'waiting_closeout'
    )
  );

  select p.id, p.flock_id, p.active_start, p.created_at
    into v_next
  from public.placements p
  where p.barn_id = p_barn_id
    and p.id <> v_current.id
    and (
      (v_current_sort_date is null and p.created_at > v_current.created_at)
      or (v_current_sort_date is not null and p.active_start > v_current_sort_date)
      or (v_current_sort_date is not null and p.active_start = v_current_sort_date and p.created_at > v_current.created_at)
    )
    and p.date_removed is null
    and p.lifecycle_stage in ('scheduled', 'awaiting_arrival')
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_next.id is not null then
    update public.placements
    set is_active = true,
        lifecycle_stage = 'awaiting_arrival',
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
    where id = v_next.id;

    update public.flocks
    set is_active = true,
        is_in_barn = false,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
    where id = v_next.flock_id;

    perform public.write_activity_log(
      p_placement_id := v_next.id,
      p_entry_type := 'state_change',
      p_action_key := 'promote_next_placement',
      p_details := 'Next scheduled placement promoted into get-ready status for incoming feed and arrival prep.',
      p_source := 'dashboard.state',
      p_meta := jsonb_build_object(
        'removed_date', p_removed_date,
        'workflow', 'checkout_flock',
        'lifecycle_stage', 'awaiting_arrival'
      )
    );
  end if;

  perform public.sync_barn_current_state(p_barn_id);

  if v_next.id is not null then
    return query
    select p.id, p.barn_id, p.flock_id, p.is_active, f.is_in_barn, b.is_empty
    from public.placements p
    join public.flocks f on f.id = p.flock_id
    join public.barns b on b.id = p.barn_id
    where p.id = v_next.id;
  else
    return query
    select null::uuid, b.id, null::uuid, false, false, b.is_empty
    from public.barns b
    where b.id = p_barn_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."mark_barn_empty"("p_barn_id" "uuid", "p_removed_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_chicks_arrived"("p_placement_id" "uuid", "p_arrival_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("placement_id" "uuid", "barn_id" "uuid", "flock_id" "uuid", "placement_is_active" boolean, "flock_is_in_barn" boolean, "barn_is_empty" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_barn_id uuid;
  v_flock_id uuid;
  v_other_active uuid;
  v_actor text;
begin
  v_actor := auth.uid()::text;

  select p.barn_id, p.flock_id
    into v_barn_id, v_flock_id
  from public.placements p
  where p.id = p_placement_id;

  if v_barn_id is null or v_flock_id is null then
    raise exception 'Placement % was not found.', p_placement_id;
  end if;

  select p.id
    into v_other_active
  from public.placements p
  where p.barn_id = v_barn_id
    and p.id <> p_placement_id
    and p.is_active = true
    and p.date_removed is null
  limit 1;

  if v_other_active is not null then
    raise exception 'Barn % already has another active placement (%).', v_barn_id, v_other_active;
  end if;

  update public.placements
    set is_active = true,
        lifecycle_stage = 'in_barn_growing',
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = p_placement_id;

  update public.flocks
    set is_active = false,
        is_in_barn = false,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id in (
    select p.flock_id
    from public.placements p
    where p.barn_id = v_barn_id
      and p.id <> p_placement_id
  );

  update public.flocks
    set is_active = true,
        is_in_barn = true,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = v_flock_id;

  perform public.sync_barn_current_state(v_barn_id);

  perform public.write_activity_log(
    p_placement_id := p_placement_id,
    p_entry_type := 'state_change',
    p_action_key := 'mark_chicks_arrived',
    p_details := format('Chicks arrived recorded for %s.', p_arrival_date),
    p_source := 'dashboard.state',
    p_meta := jsonb_build_object('arrival_date', p_arrival_date, 'lifecycle_stage', 'in_barn_growing')
  );

  return query
  select p.id, p.barn_id, p.flock_id, p.is_active, f.is_in_barn, b.is_empty
  from public.placements p
  join public.flocks f
    on f.id = p.flock_id
  join public.barns b
    on b.id = p.barn_id
  where p.id = p_placement_id;
end;
$$;


ALTER FUNCTION "public"."mark_chicks_arrived"("p_placement_id" "uuid", "p_arrival_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."placements_set_active_dates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  SELECT f.date_placed, COALESCE(f.max_date, NEW.date_removed)
    INTO NEW.active_start, NEW.active_end
  FROM public.flocks f
  WHERE f.id = NEW.flock_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."placements_set_active_dates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."placements_set_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_farm_id uuid;
  v_barn_code text;
  v_flock_num integer;
  v_flock_farm uuid;
  v_flock_start date;
  v_flock_end date;
begin
  select b.farm_id, b.barn_code
    into v_farm_id, v_barn_code
  from public.barns b
  where b.id = new.barn_id;

  select f.farm_id, f.flock_number, f.date_placed, f.max_date
    into v_flock_farm, v_flock_num, v_flock_start, v_flock_end
  from public.flocks f
  where f.id = new.flock_id;

  if v_farm_id is null or v_flock_farm is null then
    raise exception 'Invalid barn_id or flock_id for placement';
  end if;

  if v_farm_id <> v_flock_farm then
    raise exception 'Farm mismatch: barn.farm_id (%) != flock.farm_id (%)', v_farm_id, v_flock_farm;
  end if;

  new.farm_id := v_farm_id;

  if new.active_start is null then
    new.active_start := v_flock_start;
  end if;

  if new.active_end is null then
    new.active_end := v_flock_end;
  end if;

  new.placement_key := v_flock_num::text || '-' || v_barn_code;
  return new;
end;
$$;


ALTER FUNCTION "public"."placements_set_defaults"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."placements_sync_barn_state"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.sync_barn_current_state(new.barn_id);

  if tg_op = 'UPDATE' and old.barn_id is distinct from new.barn_id then
    perform public.sync_barn_current_state(old.barn_id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."placements_sync_barn_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_issue_update_edit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'Saved Action Item memos are append-only and cannot be edited.';
end;
$$;


ALTER FUNCTION "public"."prevent_issue_update_edit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_unassigned_placement"("p_placement_id" "uuid", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_start_date" "date", "p_actor_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "public"."placements"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_placement public.placements%rowtype;
  v_flock public.flocks%rowtype;
  v_barn public.barns%rowtype;
  v_duration integer;
  v_end_date date;
  v_overlap_key text;
  v_old_start date;
  v_row public.placements%rowtype;
begin
  if v_actor is null then
    raise exception 'A signed-in user is required to assign a flock.';
  end if;

  if p_start_date is null then
    raise exception 'A placement date is required.';
  end if;

  select p.* into v_placement
  from public.placements p
  where p.id = p_placement_id
  for update;

  if not found or v_placement.lifecycle_stage <> 'unassigned' then
    raise exception 'The flock is no longer available in the unassigned queue.';
  end if;

  select f.* into v_flock
  from public.flocks f
  where f.id = v_placement.flock_id
  for update;

  select b.* into v_barn
  from public.barns b
  where b.id = p_barn_id and b.farm_id = p_farm_id and b.is_active = true;

  if not found then
    raise exception 'The selected active barn does not belong to the selected farm.';
  end if;

  if exists (
    select 1
    from public.flocks f
    where f.farm_id = p_farm_id
      and f.flock_number = v_flock.flock_number
      and f.id <> v_flock.id
  ) then
    raise exception 'Flock number % is already in use on the selected farm.', v_flock.flock_number;
  end if;

  v_old_start := coalesce(v_placement.active_start, v_flock.date_placed, p_start_date);
  v_duration := greatest(
    coalesce(v_placement.active_end, v_flock.max_date, v_old_start + 63) - v_old_start,
    1
  );
  v_end_date := p_start_date + v_duration;

  select coalesce(p.placement_key, f.flock_number::text)
    into v_overlap_key
  from public.placements p
  join public.flocks f on f.id = p.flock_id
  where p.barn_id = p_barn_id
    and p.id <> v_placement.id
    and p.lifecycle_stage not in ('unassigned', 'canceled', 'archived')
    and p_start_date <= coalesce(p.date_removed, p.active_end, f.max_date, p_start_date)
    and v_end_date >= coalesce(p.active_start, f.date_placed, v_end_date)
  order by coalesce(p.active_start, f.date_placed) asc
  limit 1;

  if v_overlap_key is not null then
    raise exception 'This assignment overlaps % in the selected barn.', v_overlap_key;
  end if;

  update public.flocks
  set farm_id = p_farm_id,
      date_placed = p_start_date,
      female_date_placed = case
        when female_date_placed is null then null
        else p_start_date + (female_date_placed - v_old_start)
      end,
      male_date_placed = case
        when male_date_placed is null then null
        else p_start_date + (male_date_placed - v_old_start)
      end,
      max_date = v_end_date,
      is_active = false,
      is_complete = false,
      is_in_barn = false,
      is_settled = false,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_placement.flock_id;

  update public.placements
  set farm_id = p_farm_id,
      barn_id = p_barn_id,
      date_placed = p_start_date,
      active_start = p_start_date,
      active_end = v_end_date,
      placement_key = public.compute_placement_key(v_placement.flock_id, p_barn_id),
      lifecycle_stage = 'scheduled',
      is_active = false,
      unassigned_at = null,
      unassigned_by = null,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_placement.id
  returning * into v_row;

  perform public.write_activity_log(
    p_placement_id := v_placement.id,
    p_entry_type := 'state_change',
    p_action_key := 'reassign_unassigned_placement',
    p_details := format('Unassigned flock scheduled into Barn %s beginning %s.', v_barn.barn_code, p_start_date),
    p_source := 'placement_scheduler.state',
    p_actor_user_id := v_actor,
    p_farm_id := p_farm_id,
    p_barn_id := p_barn_id,
    p_flock_id := v_placement.flock_id,
    p_meta := jsonb_build_object(
      'previous_farm_id', v_placement.farm_id,
      'previous_barn_id', v_placement.barn_id,
      'previous_start', v_placement.active_start,
      'new_start', p_start_date,
      'new_end', v_end_date,
      'lifecycle_stage', 'scheduled'
    )
  );

  return v_row;
end;
$$;


ALTER FUNCTION "public"."reassign_unassigned_placement"("p_placement_id" "uuid", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_start_date" "date", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_signup_code"("p_code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_code record;
begin
  -- Lock the row to ensure atomicity across concurrent redemptions
  select * into v_code
  from public.signup_codes
  where code = p_code
  for update;

  if not found then
    raise exception 'Invalid code';
  end if;

  if v_code.active is not true then
    raise exception 'Code inactive';
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    raise exception 'Code expired';
  end if;

  if v_code.max_uses is not null and v_code.uses >= v_code.max_uses then
    raise exception 'Code usage limit reached';
  end if;

  update public.signup_codes
  set uses = uses + 1,
      active = case when v_code.max_uses is not null and v_code.uses + 1 >= v_code.max_uses then false else active end,
      updated_at = now()
  where id = v_code.id;
end;
$$;


ALTER FUNCTION "public"."redeem_signup_code"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_internal_voucher_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_prefix text;
  v_counter_id uuid;
  v_counter_value text;
  v_next_number bigint;
begin
  select s.value
    into v_prefix
  from public.app_settings s
  where s.name = 'voucher_prefix'
    and (s."group" = 'feed_tickets' or s."group" is null)
  order by
    case when s."group" = 'feed_tickets' then 0 else 1 end,
    s.updated_at desc nulls last,
    s.created_at desc nulls last
  limit 1;

  select s.id, s.value
    into v_counter_id, v_counter_value
  from public.app_settings s
  where s.name in ('internal_voucher_number', 'internal_voucher_num')
    and (s."group" = 'feed_tickets' or s."group" is null)
  order by
    case when s.name = 'internal_voucher_number' then 0 else 1 end,
    case when s."group" = 'feed_tickets' then 0 else 1 end,
    s.updated_at desc nulls last,
    s.created_at desc nulls last
  limit 1
  for update;

  if v_counter_id is null then
    v_next_number := 1;

    insert into public.app_settings ("group", name, value, "desc", updated_at)
    values (
      'feed_tickets',
      'internal_voucher_number',
      '2',
      'Next internal voucher number used for xTran, iTran, and f2f feed tickets.',
      now()
    )
    on conflict ("group", name)
    do update
      set value = excluded.value,
          updated_at = now();
  else
    v_next_number := greatest(coalesce(nullif(btrim(v_counter_value), '')::bigint, 1), 1);

    update public.app_settings
    set name = 'internal_voucher_number',
        value = (v_next_number + 1)::text,
        updated_at = now()
    where id = v_counter_id;
  end if;

  return coalesce(v_prefix, '') || v_next_number::text;
exception
  when invalid_text_representation then
    raise exception 'app_settings.internal_voucher_number must contain a whole number';
end;
$$;


ALTER FUNCTION "public"."reserve_internal_voucher_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_user"("p_user_id" "uuid") RETURNS TABLE("user_id" "uuid", "display_name" "text", "email" "text", "source" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  with auth_side as (
    select
      u.id as user_id,
      coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', u.email) as display_name,
      coalesce(p.email, u.email) as email,
      'auth.users'::text as source
    from auth.users u
    left join public.profiles p
      on p.id = u.id
    where u.id = p_user_id
  ),
  app_side as (
    select
      a.user_id,
      coalesce(a.display_name, a.email) as display_name,
      a.email,
      'public.app_users'::text as source
    from public.app_users a
    where a.user_id = p_user_id
  )
  select * from auth_side
  union all
  select * from app_side
  limit 1;
$$;


ALTER FUNCTION "public"."resolve_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "placement_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "age_days" integer,
    "am_temp" numeric,
    "set_temp" numeric,
    "rel_humidity" numeric,
    "min_vent" "text",
    "is_oda_open" boolean DEFAULT false NOT NULL,
    "oda_exception" "text",
    "naoh" "text",
    "comment" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "version" integer DEFAULT 1 NOT NULL,
    "outside_temp_current" numeric(5,1),
    "outside_temp_low" numeric(5,1),
    "outside_temp_high" numeric(5,1),
    "maintenance_flag" boolean DEFAULT false NOT NULL,
    "feedlines_flag" boolean DEFAULT false NOT NULL,
    "nipple_lines_flag" boolean DEFAULT false NOT NULL,
    "bird_health_alert" boolean DEFAULT false NOT NULL,
    "water_meter_reading" numeric(12,1)
);


ALTER TABLE "public"."log_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."log_daily" IS 'General environmental & conditions data for a flock.  These records maybe 1 per day or multiple rows for each day.';



COMMENT ON COLUMN "public"."log_daily"."rel_humidity" IS 'Relative humidity captured on the daily log.';



COMMENT ON COLUMN "public"."log_daily"."outside_temp_current" IS 'Current outside temperature captured on the daily log.';



COMMENT ON COLUMN "public"."log_daily"."outside_temp_low" IS 'Forecast or observed outside low temperature captured on the daily log.';



COMMENT ON COLUMN "public"."log_daily"."outside_temp_high" IS 'Forecast or observed outside high temperature captured on the daily log.';



COMMENT ON COLUMN "public"."log_daily"."maintenance_flag" IS 'Signals a maintenance issue noted by the worker for this daily log entry.';



COMMENT ON COLUMN "public"."log_daily"."feedlines_flag" IS 'Signals a feedlines issue noted by the worker for this daily log entry.';



COMMENT ON COLUMN "public"."log_daily"."nipple_lines_flag" IS 'Signals a nipple lines issue noted by the worker for this daily log entry.';



COMMENT ON COLUMN "public"."log_daily"."bird_health_alert" IS 'Signals a bird health alert noted by the worker for this daily log entry.';



COMMENT ON COLUMN "public"."log_daily"."water_meter_reading" IS 'Water meter reading captured on the daily log.';



CREATE OR REPLACE FUNCTION "public"."save_log_daily_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."log_daily"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing_id uuid;
  v_row public.log_daily;
  v_mode text;
begin
  select id
  into v_existing_id
  from public.log_daily
  where placement_id = p_placement_id
    and log_date = p_log_date
  limit 1;

  if v_existing_id is null then
    insert into public.log_daily (
      placement_id,
      log_date,
      age_days,
      am_temp,
      set_temp,
      rel_humidity,
      outside_temp_current,
      outside_temp_low,
      outside_temp_high,
      water_meter_reading,
      maintenance_flag,
      feedlines_flag,
      nipple_lines_flag,
      bird_health_alert,
      min_vent,
      is_oda_open,
      oda_exception,
      naoh,
      comment,
      is_active
    )
    values (
      p_placement_id,
      p_log_date,
      case when p_payload ? 'age_days' and jsonb_typeof(p_payload->'age_days') <> 'null' then (p_payload->>'age_days')::integer else null end,
      case when p_payload ? 'am_temp' and jsonb_typeof(p_payload->'am_temp') <> 'null' then (p_payload->>'am_temp')::numeric else null end,
      case when p_payload ? 'set_temp' and jsonb_typeof(p_payload->'set_temp') <> 'null' then (p_payload->>'set_temp')::numeric else null end,
      case when p_payload ? 'rel_humidity' and jsonb_typeof(p_payload->'rel_humidity') <> 'null' then (p_payload->>'rel_humidity')::numeric else null end,
      case when p_payload ? 'outside_temp_current' and jsonb_typeof(p_payload->'outside_temp_current') <> 'null' then (p_payload->>'outside_temp_current')::numeric else null end,
      case when p_payload ? 'outside_temp_low' and jsonb_typeof(p_payload->'outside_temp_low') <> 'null' then (p_payload->>'outside_temp_low')::numeric else null end,
      case when p_payload ? 'outside_temp_high' and jsonb_typeof(p_payload->'outside_temp_high') <> 'null' then (p_payload->>'outside_temp_high')::numeric else null end,
      case when p_payload ? 'water_meter_reading' and jsonb_typeof(p_payload->'water_meter_reading') <> 'null' then (p_payload->>'water_meter_reading')::numeric else null end,
      case when p_payload ? 'maintenance_flag' and jsonb_typeof(p_payload->'maintenance_flag') <> 'null' then (p_payload->>'maintenance_flag')::boolean else false end,
      case when p_payload ? 'feedlines_flag' and jsonb_typeof(p_payload->'feedlines_flag') <> 'null' then (p_payload->>'feedlines_flag')::boolean else false end,
      case when p_payload ? 'nipple_lines_flag' and jsonb_typeof(p_payload->'nipple_lines_flag') <> 'null' then (p_payload->>'nipple_lines_flag')::boolean else false end,
      case when p_payload ? 'bird_health_alert' and jsonb_typeof(p_payload->'bird_health_alert') <> 'null' then (p_payload->>'bird_health_alert')::boolean else false end,
      case when p_payload ? 'min_vent' then p_payload->>'min_vent' else null end,
      case when p_payload ? 'is_oda_open' and jsonb_typeof(p_payload->'is_oda_open') <> 'null' then (p_payload->>'is_oda_open')::boolean else false end,
      case when p_payload ? 'oda_exception' then p_payload->>'oda_exception' else null end,
      case when p_payload ? 'naoh' then p_payload->>'naoh' else null end,
      case when p_payload ? 'comment' then p_payload->>'comment' else null end,
      case when p_payload ? 'daily_is_active' and jsonb_typeof(p_payload->'daily_is_active') <> 'null' then (p_payload->>'daily_is_active')::boolean else true end
    )
    returning * into v_row;
    v_mode := 'insert';
  else
    update public.log_daily as d
    set
      age_days = case when p_payload ? 'age_days' then case when jsonb_typeof(p_payload->'age_days') = 'null' then null else (p_payload->>'age_days')::integer end else d.age_days end,
      am_temp = case when p_payload ? 'am_temp' then case when jsonb_typeof(p_payload->'am_temp') = 'null' then null else (p_payload->>'am_temp')::numeric end else d.am_temp end,
      set_temp = case when p_payload ? 'set_temp' then case when jsonb_typeof(p_payload->'set_temp') = 'null' then null else (p_payload->>'set_temp')::numeric end else d.set_temp end,
      rel_humidity = case when p_payload ? 'rel_humidity' then case when jsonb_typeof(p_payload->'rel_humidity') = 'null' then null else (p_payload->>'rel_humidity')::numeric end else d.rel_humidity end,
      outside_temp_current = case when p_payload ? 'outside_temp_current' then case when jsonb_typeof(p_payload->'outside_temp_current') = 'null' then null else (p_payload->>'outside_temp_current')::numeric end else d.outside_temp_current end,
      outside_temp_low = case when p_payload ? 'outside_temp_low' then case when jsonb_typeof(p_payload->'outside_temp_low') = 'null' then null else (p_payload->>'outside_temp_low')::numeric end else d.outside_temp_low end,
      outside_temp_high = case when p_payload ? 'outside_temp_high' then case when jsonb_typeof(p_payload->'outside_temp_high') = 'null' then null else (p_payload->>'outside_temp_high')::numeric end else d.outside_temp_high end,
      water_meter_reading = case when p_payload ? 'water_meter_reading' then case when jsonb_typeof(p_payload->'water_meter_reading') = 'null' then null else (p_payload->>'water_meter_reading')::numeric end else d.water_meter_reading end,
      maintenance_flag = case when p_payload ? 'maintenance_flag' then case when jsonb_typeof(p_payload->'maintenance_flag') = 'null' then null else (p_payload->>'maintenance_flag')::boolean end else d.maintenance_flag end,
      feedlines_flag = case when p_payload ? 'feedlines_flag' then case when jsonb_typeof(p_payload->'feedlines_flag') = 'null' then null else (p_payload->>'feedlines_flag')::boolean end else d.feedlines_flag end,
      nipple_lines_flag = case when p_payload ? 'nipple_lines_flag' then case when jsonb_typeof(p_payload->'nipple_lines_flag') = 'null' then null else (p_payload->>'nipple_lines_flag')::boolean end else d.nipple_lines_flag end,
      bird_health_alert = case when p_payload ? 'bird_health_alert' then case when jsonb_typeof(p_payload->'bird_health_alert') = 'null' then null else (p_payload->>'bird_health_alert')::boolean end else d.bird_health_alert end,
      min_vent = case when p_payload ? 'min_vent' then p_payload->>'min_vent' else d.min_vent end,
      is_oda_open = case when p_payload ? 'is_oda_open' then case when jsonb_typeof(p_payload->'is_oda_open') = 'null' then null else (p_payload->>'is_oda_open')::boolean end else d.is_oda_open end,
      oda_exception = case when p_payload ? 'oda_exception' then p_payload->>'oda_exception' else d.oda_exception end,
      naoh = case when p_payload ? 'naoh' then p_payload->>'naoh' else d.naoh end,
      comment = case when p_payload ? 'comment' then p_payload->>'comment' else d.comment end,
      is_active = case when p_payload ? 'daily_is_active' then case when jsonb_typeof(p_payload->'daily_is_active') = 'null' then null else (p_payload->>'daily_is_active')::boolean end else d.is_active end
    where d.id = v_existing_id
    returning * into v_row;
    v_mode := 'update';
  end if;

  perform public.write_activity_log(
    p_placement_id := p_placement_id,
    p_entry_type := 'functCall',
    p_action_key := 'save_log_daily_mobile',
    p_details := format('log_daily() saved for %s', p_log_date),
    p_source := 'mobile.log_daily',
    p_meta := jsonb_build_object('log_date', p_log_date, 'record_id', v_row.id, 'mode', v_mode)
  );

  if nullif(trim(coalesce(v_row.comment, '')), '') is not null then
    perform public.write_activity_log(
      p_placement_id := p_placement_id,
      p_entry_type := 'comment',
      p_action_key := 'log_daily.comment',
      p_details := v_row.comment,
      p_source := 'mobile.log_daily',
      p_meta := jsonb_build_object('log_date', p_log_date, 'record_id', v_row.id)
    );
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."save_log_daily_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_mortality" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "placement_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "dead_female" integer,
    "dead_male" integer,
    "cull_female" integer,
    "cull_male" integer,
    "cull_female_note" "text",
    "cull_male_note" "text",
    "dead_reason" "text",
    "grade_litter" integer,
    "grade_footpad" integer,
    "grade_feathers" integer,
    "grade_lame" integer,
    "grade_pecking" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "version" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."log_mortality" OWNER TO "postgres";


COMMENT ON TABLE "public"."log_mortality" IS 'This data records the mortality & other losses during a flock cycle.  There is also field for analysis of health markers during the flock cycle.  There maybe a single entry per day or multiple entries.';



COMMENT ON COLUMN "public"."log_mortality"."dead_female" IS 'Female mortality count. NULL means not collected; zero means intentionally recorded as none.';



COMMENT ON COLUMN "public"."log_mortality"."dead_male" IS 'Male mortality count. NULL means not collected; zero means intentionally recorded as none.';



COMMENT ON COLUMN "public"."log_mortality"."cull_female" IS 'Female cull count. NULL means not collected; zero means intentionally recorded as none.';



COMMENT ON COLUMN "public"."log_mortality"."cull_male" IS 'Male cull count. NULL means not collected; zero means intentionally recorded as none.';



CREATE OR REPLACE FUNCTION "public"."save_log_mortality_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."log_mortality"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing_id uuid;
  v_row public.log_mortality;
begin
  select id
  into v_existing_id
  from public.log_mortality
  where placement_id = p_placement_id
    and log_date = p_log_date
  limit 1;

  if v_existing_id is null then
    insert into public.log_mortality (
      placement_id,
      log_date,
      dead_female,
      dead_male,
      cull_female,
      cull_male,
      cull_female_note,
      cull_male_note,
      dead_reason,
      grade_litter,
      grade_footpad,
      grade_feathers,
      grade_lame,
      grade_pecking,
      is_active
    )
    values (
      p_placement_id,
      p_log_date,
      case when p_payload ? 'dead_female' and jsonb_typeof(p_payload->'dead_female') <> 'null' then (p_payload->>'dead_female')::integer else null end,
      case when p_payload ? 'dead_male' and jsonb_typeof(p_payload->'dead_male') <> 'null' then (p_payload->>'dead_male')::integer else null end,
      case when p_payload ? 'cull_female' and jsonb_typeof(p_payload->'cull_female') <> 'null' then (p_payload->>'cull_female')::integer else null end,
      case when p_payload ? 'cull_male' and jsonb_typeof(p_payload->'cull_male') <> 'null' then (p_payload->>'cull_male')::integer else null end,
      case when p_payload ? 'cull_female_note' then p_payload->>'cull_female_note' else null end,
      case when p_payload ? 'cull_male_note' then p_payload->>'cull_male_note' else null end,
      case when p_payload ? 'dead_reason' then p_payload->>'dead_reason' else null end,
      case when p_payload ? 'grade_litter' and jsonb_typeof(p_payload->'grade_litter') <> 'null' then (p_payload->>'grade_litter')::integer else null end,
      case when p_payload ? 'grade_footpad' and jsonb_typeof(p_payload->'grade_footpad') <> 'null' then (p_payload->>'grade_footpad')::integer else null end,
      case when p_payload ? 'grade_feathers' and jsonb_typeof(p_payload->'grade_feathers') <> 'null' then (p_payload->>'grade_feathers')::integer else null end,
      case when p_payload ? 'grade_lame' and jsonb_typeof(p_payload->'grade_lame') <> 'null' then (p_payload->>'grade_lame')::integer else null end,
      case when p_payload ? 'grade_pecking' and jsonb_typeof(p_payload->'grade_pecking') <> 'null' then (p_payload->>'grade_pecking')::integer else null end,
      case when p_payload ? 'mortality_is_active' and jsonb_typeof(p_payload->'mortality_is_active') <> 'null' then (p_payload->>'mortality_is_active')::boolean else true end
    )
    returning * into v_row;
  else
    update public.log_mortality as m
    set
      dead_female = case when p_payload ? 'dead_female' then case when jsonb_typeof(p_payload->'dead_female') = 'null' then null else (p_payload->>'dead_female')::integer end else m.dead_female end,
      dead_male = case when p_payload ? 'dead_male' then case when jsonb_typeof(p_payload->'dead_male') = 'null' then null else (p_payload->>'dead_male')::integer end else m.dead_male end,
      cull_female = case when p_payload ? 'cull_female' then case when jsonb_typeof(p_payload->'cull_female') = 'null' then null else (p_payload->>'cull_female')::integer end else m.cull_female end,
      cull_male = case when p_payload ? 'cull_male' then case when jsonb_typeof(p_payload->'cull_male') = 'null' then null else (p_payload->>'cull_male')::integer end else m.cull_male end,
      cull_female_note = case when p_payload ? 'cull_female_note' then p_payload->>'cull_female_note' else m.cull_female_note end,
      cull_male_note = case when p_payload ? 'cull_male_note' then p_payload->>'cull_male_note' else m.cull_male_note end,
      dead_reason = case when p_payload ? 'dead_reason' then p_payload->>'dead_reason' else m.dead_reason end,
      grade_litter = case when p_payload ? 'grade_litter' then case when jsonb_typeof(p_payload->'grade_litter') = 'null' then null else (p_payload->>'grade_litter')::integer end else m.grade_litter end,
      grade_footpad = case when p_payload ? 'grade_footpad' then case when jsonb_typeof(p_payload->'grade_footpad') = 'null' then null else (p_payload->>'grade_footpad')::integer end else m.grade_footpad end,
      grade_feathers = case when p_payload ? 'grade_feathers' then case when jsonb_typeof(p_payload->'grade_feathers') = 'null' then null else (p_payload->>'grade_feathers')::integer end else m.grade_feathers end,
      grade_lame = case when p_payload ? 'grade_lame' then case when jsonb_typeof(p_payload->'grade_lame') = 'null' then null else (p_payload->>'grade_lame')::integer end else m.grade_lame end,
      grade_pecking = case when p_payload ? 'grade_pecking' then case when jsonb_typeof(p_payload->'grade_pecking') = 'null' then null else (p_payload->>'grade_pecking')::integer end else m.grade_pecking end,
      is_active = case when p_payload ? 'mortality_is_active' then case when jsonb_typeof(p_payload->'mortality_is_active') = 'null' then null else (p_payload->>'mortality_is_active')::boolean end else m.is_active end
    where m.id = v_existing_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."save_log_mortality_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_weight" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "placement_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "age_days" integer,
    "sex" "text",
    "cnt_weighed" integer,
    "avg_weight" numeric,
    "stddev_weight" numeric,
    "procure" numeric,
    "other_note" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "created_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."log_weight" OWNER TO "postgres";


COMMENT ON TABLE "public"."log_weight" IS 'These records maintain actual scale weighs obtained during the flock cycle.';



CREATE OR REPLACE FUNCTION "public"."save_log_weight_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_sex" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."log_weight"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing_id uuid;
  v_row public.log_weight;
  v_mode text;
  v_placed_date date;
begin
  select f.date_placed
  into v_placed_date
  from public.placements p
  join public.flocks f
    on f.id = p.flock_id
  where p.id = p_placement_id
  limit 1;

  if v_placed_date is not null and p_log_date < v_placed_date then
    raise exception 'Weight date cannot be before the flock was placed.';
  end if;

  if p_log_date > current_date then
    raise exception 'Weight date cannot be in the future.';
  end if;

  select id
  into v_existing_id
  from public.log_weight
  where placement_id = p_placement_id
    and log_date = p_log_date
    and lower(coalesce(sex, '')) = lower(coalesce(p_sex, ''))
  limit 1;

  if v_existing_id is null then
    insert into public.log_weight (
      placement_id,
      log_date,
      age_days,
      sex,
      cnt_weighed,
      avg_weight,
      stddev_weight,
      procure,
      other_note,
      is_active
    )
    values (
      p_placement_id,
      p_log_date,
      case when p_payload ? 'age_days' and jsonb_typeof(p_payload->'age_days') <> 'null' then (p_payload->>'age_days')::integer else null end,
      p_sex,
      case when p_payload ? 'cnt_weighed' and jsonb_typeof(p_payload->'cnt_weighed') <> 'null' then (p_payload->>'cnt_weighed')::integer else null end,
      case when p_payload ? 'avg_weight' and jsonb_typeof(p_payload->'avg_weight') <> 'null' then (p_payload->>'avg_weight')::numeric else null end,
      case when p_payload ? 'stddev_weight' and jsonb_typeof(p_payload->'stddev_weight') <> 'null' then (p_payload->>'stddev_weight')::numeric else null end,
      case when p_payload ? 'procure' and jsonb_typeof(p_payload->'procure') <> 'null' then (p_payload->>'procure')::numeric else null end,
      case when p_payload ? 'other_note' then p_payload->>'other_note' else null end,
      case when p_payload ? 'is_active' and jsonb_typeof(p_payload->'is_active') <> 'null' then (p_payload->>'is_active')::boolean else true end
    )
    returning * into v_row;
    v_mode := 'insert';
  else
    update public.log_weight as w
    set
      age_days = case when p_payload ? 'age_days' then case when jsonb_typeof(p_payload->'age_days') = 'null' then null else (p_payload->>'age_days')::integer end else w.age_days end,
      cnt_weighed = case when p_payload ? 'cnt_weighed' then case when jsonb_typeof(p_payload->'cnt_weighed') = 'null' then null else (p_payload->>'cnt_weighed')::integer end else w.cnt_weighed end,
      avg_weight = case when p_payload ? 'avg_weight' then case when jsonb_typeof(p_payload->'avg_weight') = 'null' then null else (p_payload->>'avg_weight')::numeric end else w.avg_weight end,
      stddev_weight = case when p_payload ? 'stddev_weight' then case when jsonb_typeof(p_payload->'stddev_weight') = 'null' then null else (p_payload->>'stddev_weight')::numeric end else w.stddev_weight end,
      procure = case when p_payload ? 'procure' then case when jsonb_typeof(p_payload->'procure') = 'null' then null else (p_payload->>'procure')::numeric end else w.procure end,
      other_note = case when p_payload ? 'other_note' then p_payload->>'other_note' else w.other_note end,
      is_active = case when p_payload ? 'is_active' then case when jsonb_typeof(p_payload->'is_active') = 'null' then null else (p_payload->>'is_active')::boolean end else w.is_active end
    where w.id = v_existing_id
    returning * into v_row;
    v_mode := 'update';
  end if;

  perform public.write_activity_log(
    p_placement_id := p_placement_id,
    p_entry_type := 'functCall',
    p_action_key := 'save_log_weight_mobile',
    p_details := format('log_weight() saved for %s (%s)', p_log_date, coalesce(p_sex, 'unknown')),
    p_source := 'mobile.log_weight',
    p_meta := jsonb_build_object('log_date', p_log_date, 'record_id', v_row.id, 'mode', v_mode, 'sex', p_sex)
  );

  if nullif(trim(coalesce(v_row.other_note, '')), '') is not null then
    perform public.write_activity_log(
      p_placement_id := p_placement_id,
      p_entry_type := 'comment',
      p_action_key := 'log_weight.note',
      p_details := v_row.other_note,
      p_source := 'mobile.log_weight',
      p_meta := jsonb_build_object('log_date', p_log_date, 'record_id', v_row.id, 'sex', p_sex)
    );
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."save_log_weight_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_sex" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sec_vacate_barn"("p_barn_id" "uuid", "p_vacate_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  PERFORM public.vacate_barn(p_barn_id, p_vacate_date);
END;
$$;


ALTER FUNCTION "public"."sec_vacate_barn"("p_barn_id" "uuid", "p_vacate_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_audit_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_date IS NULL THEN NEW.created_date := NOW(); END IF;
    IF NEW.last_updated IS NULL THEN NEW.last_updated := NOW(); END IF;
    IF NEW.is_active IS NULL THEN NEW.is_active := true; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.last_updated := NOW();
  END IF;
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."set_audit_timestamps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_audit_user_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;

    if pg_typeof(new.updated_by) = 'uuid'::regtype then
      new.updated_by := auth.uid();
    else
      new.updated_by := auth.uid()::text;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if pg_typeof(new.updated_by) = 'uuid'::regtype then
      new.updated_by := auth.uid();
    else
      new.updated_by := auth.uid()::text;
    end if;

    return new;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_audit_user_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_daily_age_tasks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_daily_age_tasks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_flock_max_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.date_placed IS NOT NULL THEN
    NEW.max_date := NEW.date_placed + INTERVAL '63 days';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_flock_max_date"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_issue_type_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_issue_type_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_issue_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_issue_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_timestamp_farm_groups"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_on := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_timestamp_farm_groups"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_flock_closeout"("p_placement_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."placements"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid;
  v_row public.placements%rowtype;
begin
  v_actor := auth.uid();

  perform public.ensure_placement_closeout_row(p_placement_id);

  update public.placements
    set lifecycle_stage = 'closeout_submitted',
        closeout_submitted_at = now(),
        closeout_submitted_by = coalesce(v_actor, closeout_submitted_by),
        updated_at = now(),
        updated_by = coalesce(v_actor::text, updated_by)
  where id = p_placement_id
    and lifecycle_stage = 'waiting_closeout'
  returning *
  into v_row;

  if v_row.id is null then
    raise exception 'Placement % is not in waiting_closeout.', p_placement_id;
  end if;

  update public.placement_closeouts
    set status = 'submitted',
        submitted_at = coalesce(submitted_at, now()),
        submitted_by = coalesce(submitted_by, v_actor),
        notes = case
          when nullif(trim(p_notes), '') is null then notes
          when notes is null or btrim(notes) = '' then trim(p_notes)
          else notes || E'\n' || trim(p_notes)
        end,
        updated_at = now(),
        updated_by = coalesce(v_actor::text, updated_by)
  where placement_id = p_placement_id;

  perform public.write_activity_log(
    p_placement_id := p_placement_id,
    p_entry_type := 'state_change',
    p_action_key := 'submit_flock_closeout',
    p_details := coalesce(nullif(trim(p_notes), ''), 'Flock closeout submitted.'),
    p_source := 'closeout.state',
    p_meta := jsonb_build_object('lifecycle_stage', 'closeout_submitted')
  );

  return v_row;
end;
$$;


ALTER FUNCTION "public"."submit_flock_closeout"("p_placement_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_barn_current_state"("p_barn_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_flock_id uuid;
  v_is_in_barn boolean;
begin
  select p.flock_id, f.is_in_barn
    into v_flock_id, v_is_in_barn
  from public.placements p
  join public.flocks f
    on f.id = p.flock_id
  where p.barn_id = p_barn_id
    and p.is_active = true
    and p.date_removed is null
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_flock_id is null then
    update public.barns
      set active_flock_id = null,
          has_flock = false,
          is_empty = true,
          updated_at = now()
    where id = p_barn_id;
    return;
  end if;

  update public.barns
    set active_flock_id = v_flock_id,
        has_flock = coalesce(v_is_in_barn, false),
        is_empty = not coalesce(v_is_in_barn, false),
        updated_at = now()
  where id = p_barn_id;
end;
$$;


ALTER FUNCTION "public"."sync_barn_current_state"("p_barn_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_derived_placement_issues"("p_placement_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("placement_id" "uuid", "severe_early_mortality_open" boolean, "hatchery_quality_open" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_default_severe_threshold numeric := 0.10;
  v_default_hatchery_threshold numeric := 0.03;
  v_severe_threshold numeric := v_default_severe_threshold;
  v_hatchery_threshold numeric := v_default_hatchery_threshold;
  v_autowarn_enabled boolean := true;
  v_auto_prefix text := 'Auto-derived:';
  v_now timestamptz := now();
  v_setting_raw text;
  v_setting_numeric numeric;
  v_row record;
  v_started_total integer;
  v_first7_total integer;
  v_day1_total integer;
  v_first7_pct numeric;
  v_day1_pct numeric;
  v_severe_desc text;
  v_hatchery_desc text;
begin
  select nullif(btrim(value), '')
    into v_setting_raw
  from public.app_settings
  where lower(name) = 'mortality_autowarn'
  order by updated_at desc nulls last, id desc
  limit 1;

  if v_setting_raw is not null then
    v_autowarn_enabled := lower(v_setting_raw) in ('1', 'true', 'yes', 'on');
  end if;

  select nullif(btrim(value), '')
    into v_setting_raw
  from public.app_settings
  where lower(name) = '7day_warning'
  order by updated_at desc nulls last, id desc
  limit 1;

  if v_setting_raw is not null then
    begin
      v_setting_numeric := v_setting_raw::numeric;
      v_severe_threshold := case
        when v_setting_numeric > 1 then v_setting_numeric / 100.0
        when v_setting_numeric < 0 then v_default_severe_threshold
        else v_setting_numeric
      end;
    exception
      when others then
        v_severe_threshold := v_default_severe_threshold;
    end;
  end if;

  select nullif(btrim(value), '')
    into v_setting_raw
  from public.app_settings
  where lower(name) = 'hatchery_issue_level'
  order by updated_at desc nulls last, id desc
  limit 1;

  if v_setting_raw is not null then
    begin
      v_setting_numeric := v_setting_raw::numeric;
      v_hatchery_threshold := case
        when v_setting_numeric > 1 then v_setting_numeric / 100.0
        when v_setting_numeric < 0 then v_default_hatchery_threshold
        else v_setting_numeric
      end;
    exception
      when others then
        v_hatchery_threshold := v_default_hatchery_threshold;
    end;
  end if;

  update public.issues as issue
     set status = 'resolved',
         resolved_at = coalesce(issue.resolved_at, v_now),
         resolution_note = coalesce(
           issue.resolution_note,
           case
             when v_autowarn_enabled
               then 'Auto-resolved after the placement left the active flock cycle.'
             else 'Auto-resolved because mortality auto-warning is disabled in app settings.'
           end
         ),
         updated_at = v_now
    from public.placements as placement
   where issue.entity_type = 'placement'
     and issue.status = 'open'
     and issue.entity_id = placement.id
     and issue.description like v_auto_prefix || '%'
     and (
       not v_autowarn_enabled
       or placement.is_active is distinct from true
       or placement.date_removed is not null
     );

  for v_row in
    with scoped_placements as (
      select
        placement.id as placement_id,
        placement.barn_id,
        placement.is_active,
        placement.date_removed,
        flock.date_placed,
        coalesce(flock.start_cnt_females, 0) as started_female_count,
        coalesce(flock.start_cnt_males, 0) as started_male_count
      from public.placements as placement
      join public.flocks as flock
        on flock.id = placement.flock_id
      where p_placement_ids is null or cardinality(p_placement_ids) = 0 or placement.id = any(p_placement_ids)
    ),
    mortality_rollups as (
      select
        scoped.placement_id,
        scoped.barn_id,
        scoped.is_active,
        scoped.date_removed,
        scoped.date_placed,
        scoped.started_female_count,
        scoped.started_male_count,
        coalesce(sum(
          case
            when mortality.log_date >= scoped.date_placed
             and mortality.log_date < scoped.date_placed + 7
            then coalesce(mortality.dead_female, 0) + coalesce(mortality.cull_female, 0)
            else 0
          end
        ), 0) as female_first7_total,
        coalesce(sum(
          case
            when mortality.log_date >= scoped.date_placed
             and mortality.log_date < scoped.date_placed + 7
            then coalesce(mortality.dead_male, 0) + coalesce(mortality.cull_male, 0)
            else 0
          end
        ), 0) as male_first7_total,
        coalesce(sum(
          case
            when mortality.log_date = scoped.date_placed
            then coalesce(mortality.dead_female, 0) + coalesce(mortality.cull_female, 0)
            else 0
          end
        ), 0) as female_day1_total,
        coalesce(sum(
          case
            when mortality.log_date = scoped.date_placed
            then coalesce(mortality.dead_male, 0) + coalesce(mortality.cull_male, 0)
            else 0
          end
        ), 0) as male_day1_total
      from scoped_placements as scoped
      left join public.log_mortality as mortality
        on mortality.placement_id = scoped.placement_id
       and coalesce(mortality.is_active, true) = true
      group by
        scoped.placement_id,
        scoped.barn_id,
        scoped.is_active,
        scoped.date_removed,
        scoped.date_placed,
        scoped.started_female_count,
        scoped.started_male_count
    )
    select *
    from mortality_rollups
  loop
    v_started_total := v_row.started_female_count + v_row.started_male_count;
    v_first7_total := v_row.female_first7_total + v_row.male_first7_total;
    v_day1_total := v_row.female_day1_total + v_row.male_day1_total;
    v_first7_pct := case
      when v_started_total > 0 then v_first7_total::numeric / v_started_total::numeric
      else 0
    end;
    v_day1_pct := case
      when v_started_total > 0 then v_day1_total::numeric / v_started_total::numeric
      else 0
    end;

    severe_early_mortality_open :=
      v_autowarn_enabled
      and v_row.is_active = true
      and v_row.date_removed is null
      and v_row.date_placed is not null
      and v_started_total > 0
      and v_first7_total > 0
      and v_first7_pct >= v_severe_threshold;

    hatchery_quality_open :=
      v_autowarn_enabled
      and v_row.is_active = true
      and v_row.date_removed is null
      and v_row.date_placed is not null
      and v_started_total > 0
      and v_day1_total > 0
      and v_day1_pct >= v_hatchery_threshold;

    if severe_early_mortality_open then
      v_severe_desc :=
        v_auto_prefix || ' First 7-day mortality reached ' ||
        round(v_first7_pct * 100.0, 1)::text || '% (' ||
        v_first7_total::text || ' birds out of ' ||
        v_started_total::text || ' started) for the ' ||
        v_row.date_placed::text || ' through ' ||
        (v_row.date_placed + 6)::text || ' early-placement window.';

      if not exists (
        select 1
        from public.issues as issue
        where issue.entity_type = 'placement'
          and issue.entity_id = v_row.placement_id
          and issue.issue_type = 'mortality_review'
          and issue.title = 'Severe Early Mortality'
          and issue.status = 'resolved'
          and issue.resolved_by is not null
          and left(coalesce(issue.description, ''), 13) = 'Auto-derived:'
      ) then
        insert into public.issues (
          entity_type,
          entity_id,
          issue_type,
          title,
          description,
          status,
          related_placement_id,
          reported_log_date,
          opened_at
        )
        values (
          'placement',
          v_row.placement_id,
          'mortality_review',
          'Severe Early Mortality',
          v_severe_desc,
          'open',
          v_row.placement_id,
          least(current_date, v_row.date_placed + 6),
          v_now
        )
        on conflict (entity_type, entity_id, issue_type, title)
        where status = 'open'
          and left(coalesce(description, ''), 13) = 'Auto-derived:'
        do update
          set description = excluded.description,
              related_placement_id = excluded.related_placement_id,
              reported_log_date = excluded.reported_log_date,
              updated_at = v_now;
      end if;
    else
      update public.issues as issue
         set status = 'resolved',
             resolved_at = coalesce(issue.resolved_at, v_now),
             resolution_note = coalesce(
               issue.resolution_note,
               case
                 when not v_autowarn_enabled
                   then 'Auto-resolved because mortality auto-warning is disabled in app settings.'
                 else 'Auto-resolved after the severe early mortality signal returned below threshold.'
               end
             ),
             updated_at = v_now
       where issue.entity_type = 'placement'
         and issue.entity_id = v_row.placement_id
         and issue.issue_type = 'mortality_review'
         and issue.title = 'Severe Early Mortality'
         and issue.status = 'open'
         and issue.description like v_auto_prefix || '%';
    end if;

    if hatchery_quality_open then
      v_hatchery_desc :=
        v_auto_prefix || ' Day 1 losses reached ' ||
        round(v_day1_pct * 100.0, 1)::text || '% (' ||
        v_day1_total::text || ' birds out of ' ||
        v_started_total::text || ' started), matching the hatchery-quality incident pattern.';

      if not exists (
        select 1
        from public.issues as issue
        where issue.entity_type = 'placement'
          and issue.entity_id = v_row.placement_id
          and issue.issue_type = 'bird_health'
          and issue.title = 'Hatchery Quality Incident'
          and issue.status = 'resolved'
          and issue.resolved_by is not null
          and left(coalesce(issue.description, ''), 13) = 'Auto-derived:'
      ) then
        insert into public.issues (
          entity_type,
          entity_id,
          issue_type,
          title,
          description,
          status,
          related_placement_id,
          reported_log_date,
          opened_at
        )
        values (
          'placement',
          v_row.placement_id,
          'bird_health',
          'Hatchery Quality Incident',
          v_hatchery_desc,
          'open',
          v_row.placement_id,
          v_row.date_placed,
          v_now
        )
        on conflict (entity_type, entity_id, issue_type, title)
        where status = 'open'
          and left(coalesce(description, ''), 13) = 'Auto-derived:'
        do update
          set description = excluded.description,
              related_placement_id = excluded.related_placement_id,
              reported_log_date = excluded.reported_log_date,
              updated_at = v_now;
      end if;
    else
      update public.issues as issue
         set status = 'resolved',
             resolved_at = coalesce(issue.resolved_at, v_now),
             resolution_note = coalesce(
               issue.resolution_note,
               case
                 when not v_autowarn_enabled
                   then 'Auto-resolved because mortality auto-warning is disabled in app settings.'
                 else 'Auto-resolved after the hatchery-quality signal returned below threshold.'
               end
             ),
             updated_at = v_now
       where issue.entity_type = 'placement'
         and issue.entity_id = v_row.placement_id
         and issue.issue_type = 'bird_health'
         and issue.title = 'Hatchery Quality Incident'
         and issue.status = 'open'
         and issue.description like v_auto_prefix || '%';
    end if;

    placement_id := v_row.placement_id;
    return next;
  end loop;
end;
$$;


ALTER FUNCTION "public"."sync_derived_placement_issues"("p_placement_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_derived_placement_issues"("p_placement_ids" "uuid"[]) IS 'Auto-manages placement issues for severe early mortality and hatchery-quality incidents using app_settings thresholds and a master mortality_autowarn switch, with first-7 and day-1 windows now including placement day.';



CREATE OR REPLACE FUNCTION "public"."sync_placement_keys_for_barn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.barn_code is distinct from old.barn_code then
    update public.placements p
    set placement_key = public.compute_placement_key(p.flock_id, p.barn_id),
        updated_at = now()
    where p.barn_id = new.id
      and p.placement_key is distinct from public.compute_placement_key(p.flock_id, p.barn_id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_placement_keys_for_barn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_placement_keys_for_flock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.flock_number is distinct from old.flock_number then
    update public.placements p
    set placement_key = public.compute_placement_key(p.flock_id, p.barn_id),
        updated_at = now()
    where p.flock_id = new.id
      and p.placement_key is distinct from public.compute_placement_key(p.flock_id, p.barn_id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_placement_keys_for_flock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unassign_scheduled_placement"("p_placement_id" "uuid", "p_actor_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_placement public.placements%rowtype;
  v_flock public.flocks%rowtype;
  v_barn_code text;
  v_daily_count integer := 0;
  v_mortality_count integer := 0;
  v_weight_count integer := 0;
  v_feed_drop_count integer := 0;
  v_feed_order_count integer := 0;
begin
  if v_actor is null then
    raise exception 'A signed-in user is required to unassign a flock.';
  end if;

  select p.* into v_placement
  from public.placements p
  where p.id = p_placement_id
  for update;

  if not found then
    raise exception 'The scheduled placement could not be found.';
  end if;

  select f.* into v_flock
  from public.flocks f
  where f.id = v_placement.flock_id
  for update;

  if not found then
    raise exception 'The flock linked to this placement could not be found.';
  end if;

  if v_placement.lifecycle_stage not in ('scheduled', 'awaiting_arrival')
     or v_placement.date_removed is not null
     or coalesce(v_flock.is_in_barn, false) then
    raise exception 'Only a scheduled or awaiting-arrival flock that has not entered a barn can be unassigned.';
  end if;

  select count(*) into v_daily_count from public.log_daily where placement_id = v_placement.id;
  select count(*) into v_mortality_count from public.log_mortality where placement_id = v_placement.id;
  select count(*) into v_weight_count from public.log_weight where placement_id = v_placement.id;

  if v_daily_count + v_mortality_count + v_weight_count > 0 then
    raise exception 'This flock cannot be unassigned because operational production records already exist.';
  end if;

  select barn_code into v_barn_code from public.barns where id = v_placement.barn_id;

  update public.feed_drops
  set queued_from_barn_id = coalesce(queued_from_barn_id, v_placement.barn_id),
      queued_from_barn_code = coalesce(queued_from_barn_code, v_barn_code),
      queued_from_placement_id = coalesce(queued_from_placement_id, v_placement.id),
      queued_from_placement_code = coalesce(queued_from_placement_code, v_placement.placement_key),
      queued_at = coalesce(queued_at, now()),
      queued_for_reconciliation = true,
      placement_id = null,
      placement_code = null
  where placement_id = v_placement.id;
  get diagnostics v_feed_drop_count = row_count;

  update public.feed_order_commitments
  set unassigned_from_placement_id = coalesce(unassigned_from_placement_id, v_placement.id),
      placement_id = null,
      updated_at = now(),
      updated_by = v_actor::text
  where placement_id = v_placement.id
    and status <> 'cancelled';
  get diagnostics v_feed_order_count = row_count;

  update public.placements
  set lifecycle_stage = 'unassigned',
      is_active = false,
      unassigned_at = now(),
      unassigned_by = v_actor,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_placement.id;

  update public.flocks
  set is_active = false,
      is_in_barn = false,
      is_complete = false,
      is_settled = false,
      updated_at = now(),
      updated_by = v_actor::text
  where id = v_placement.flock_id;

  perform public.sync_barn_current_state(v_placement.barn_id);

  perform public.write_activity_log(
    p_placement_id := v_placement.id,
    p_entry_type := 'state_change',
    p_action_key := 'unassign_scheduled_placement',
    p_details := format('Flock released from %s and moved to the unassigned queue.', coalesce(v_barn_code, 'its barn')),
    p_source := 'placement_scheduler.state',
    p_actor_user_id := v_actor,
    p_farm_id := v_placement.farm_id,
    p_barn_id := v_placement.barn_id,
    p_flock_id := v_placement.flock_id,
    p_meta := jsonb_build_object(
      'previous_farm_id', v_placement.farm_id,
      'previous_barn_id', v_placement.barn_id,
      'previous_start', v_placement.active_start,
      'previous_end', v_placement.active_end,
      'feed_drop_count', v_feed_drop_count,
      'feed_order_count', v_feed_order_count,
      'lifecycle_stage', 'unassigned'
    )
  );

  return jsonb_build_object(
    'placement_id', v_placement.id,
    'placement_key', v_placement.placement_key,
    'flock_id', v_placement.flock_id,
    'previous_farm_id', v_placement.farm_id,
    'previous_barn_id', v_placement.barn_id,
    'feed_drop_count', v_feed_drop_count,
    'feed_order_count', v_feed_order_count
  );
end;
$$;


ALTER FUNCTION "public"."unassign_scheduled_placement"("p_placement_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v_placement_daily_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  d_old public.log_daily%ROWTYPE;
  m_old public.log_mortality%ROWTYPE;
BEGIN
  -- Daily branch
  IF NEW.age_days IS NOT NULL OR NEW.am_temp IS NOT NULL OR NEW.set_temp IS NOT NULL OR NEW.ambient_temp IS NOT NULL OR NEW.min_vent IS NOT NULL OR NEW.is_oda_open IS NOT NULL OR NEW.oda_exception IS NOT NULL OR NEW.naoh IS NOT NULL OR NEW.comment IS NOT NULL OR NEW.daily_is_active IS NOT NULL THEN
    -- Try insert first; if conflict, compare and update only if something changed
    INSERT INTO public.log_daily AS d(
      placement_id, log_date,
      age_days, am_temp, set_temp, ambient_temp, min_vent,
      is_oda_open, oda_exception, naoh, comment, is_active,
      created_by, updated_by
    )
    VALUES (
      NEW.placement_id::uuid, NEW.log_date,
      NEW.age_days, NEW.am_temp, NEW.set_temp, NEW.ambient_temp, NEW.min_vent,
      COALESCE(NEW.is_oda_open, false), NEW.oda_exception, NEW.naoh, NEW.comment, COALESCE(NEW.daily_is_active, true),
      COALESCE(NEW.daily_created_by, NEW.daily_updated_by), NULL -- keep updated_by NULL on initial insert
    )
    ON CONFLICT (placement_id, log_date) DO NOTHING;

    -- If row exists, perform conditional update
    IF NOT FOUND THEN
      SELECT * INTO d_old FROM public.log_daily
       WHERE placement_id = NEW.placement_id::uuid AND log_date = NEW.log_date FOR UPDATE;

      IF d_old IS NULL THEN
        RAISE EXCEPTION 'Unexpected: daily row missing after conflict';
      END IF;

      IF (COALESCE(NEW.age_days, d_old.age_days)          IS DISTINCT FROM d_old.age_days) OR
         (COALESCE(NEW.am_temp, d_old.am_temp)            IS DISTINCT FROM d_old.am_temp) OR
         (COALESCE(NEW.set_temp, d_old.set_temp)          IS DISTINCT FROM d_old.set_temp) OR
         (COALESCE(NEW.ambient_temp, d_old.ambient_temp)  IS DISTINCT FROM d_old.ambient_temp) OR
         (COALESCE(NEW.min_vent, d_old.min_vent)          IS DISTINCT FROM d_old.min_vent) OR
         (COALESCE(NEW.is_oda_open, d_old.is_oda_open)    IS DISTINCT FROM d_old.is_oda_open) OR
         (COALESCE(NEW.oda_exception, d_old.oda_exception)IS DISTINCT FROM d_old.oda_exception) OR
         (COALESCE(NEW.naoh, d_old.naoh)                  IS DISTINCT FROM d_old.naoh) OR
         (COALESCE(NEW.comment, d_old.comment)            IS DISTINCT FROM d_old.comment) OR
         (COALESCE(NEW.daily_is_active, d_old.is_active)  IS DISTINCT FROM d_old.is_active) THEN
        UPDATE public.log_daily AS d
          SET age_days     = COALESCE(NEW.age_days, d.age_days),
              am_temp      = COALESCE(NEW.am_temp, d.am_temp),
              set_temp     = COALESCE(NEW.set_temp, d.set_temp),
              ambient_temp = COALESCE(NEW.ambient_temp, d.ambient_temp),
              min_vent     = COALESCE(NEW.min_vent, d.min_vent),
              is_oda_open  = COALESCE(NEW.is_oda_open, d.is_oda_open),
              oda_exception= COALESCE(NEW.oda_exception, d.oda_exception),
              naoh         = COALESCE(NEW.naoh, d.naoh),
              comment      = COALESCE(NEW.comment, d.comment),
              is_active    = COALESCE(NEW.daily_is_active, d.is_active),
              updated_by   = COALESCE(NEW.daily_updated_by, d.updated_by)
        WHERE d.placement_id = NEW.placement_id::uuid AND d.log_date = NEW.log_date;
      END IF;
    END IF;
  END IF;

  -- Mortality branch
  IF NEW.dead_female IS NOT NULL OR NEW.dead_male IS NOT NULL OR NEW.cull_female IS NOT NULL OR NEW.cull_male IS NOT NULL OR NEW.cull_female_note IS NOT NULL OR NEW.cull_male_note IS NOT NULL OR NEW.dead_reason IS NOT NULL OR NEW.grade_litter IS NOT NULL OR NEW.grade_footpad IS NOT NULL OR NEW.grade_feathers IS NOT NULL OR NEW.grade_lame IS NOT NULL OR NEW.grade_pecking IS NOT NULL OR NEW.mortality_is_active IS NOT NULL THEN
    INSERT INTO public.log_mortality AS m(
      placement_id, log_date,
      dead_female, dead_male, cull_female, cull_male,
      cull_female_note, cull_male_note, dead_reason,
      grade_litter, grade_footpad, grade_feathers, grade_lame, grade_pecking,
      is_active,
      created_by, updated_by
    )
    VALUES (
      NEW.placement_id::uuid, NEW.log_date,
      COALESCE(NEW.dead_female, 0), COALESCE(NEW.dead_male, 0), COALESCE(NEW.cull_female, 0), COALESCE(NEW.cull_male, 0),
      NEW.cull_female_note, NEW.cull_male_note, NEW.dead_reason,
      NEW.grade_litter, NEW.grade_footpad, NEW.grade_feathers, NEW.grade_lame, NEW.grade_pecking,
      COALESCE(NEW.mortality_is_active, true),
      COALESCE(NEW.mortality_created_by, NEW.mortality_updated_by), NULL -- keep updated_by NULL on initial insert
    )
    ON CONFLICT (placement_id, log_date) DO NOTHING;

    IF NOT FOUND THEN
      SELECT * INTO m_old FROM public.log_mortality
       WHERE placement_id = NEW.placement_id::uuid AND log_date = NEW.log_date FOR UPDATE;

      IF m_old IS NULL THEN
        RAISE EXCEPTION 'Unexpected: mortality row missing after conflict';
      END IF;

      IF (COALESCE(NEW.dead_female, m_old.dead_female)     IS DISTINCT FROM m_old.dead_female) OR
         (COALESCE(NEW.dead_male, m_old.dead_male)         IS DISTINCT FROM m_old.dead_male) OR
         (COALESCE(NEW.cull_female, m_old.cull_female)     IS DISTINCT FROM m_old.cull_female) OR
         (COALESCE(NEW.cull_male, m_old.cull_male)         IS DISTINCT FROM m_old.cull_male) OR
         (COALESCE(NEW.cull_female_note, m_old.cull_female_note) IS DISTINCT FROM m_old.cull_female_note) OR
         (COALESCE(NEW.cull_male_note, m_old.cull_male_note)     IS DISTINCT FROM m_old.cull_male_note) OR
         (COALESCE(NEW.dead_reason, m_old.dead_reason)     IS DISTINCT FROM m_old.dead_reason) OR
         (COALESCE(NEW.grade_litter, m_old.grade_litter)   IS DISTINCT FROM m_old.grade_litter) OR
         (COALESCE(NEW.grade_footpad, m_old.grade_footpad) IS DISTINCT FROM m_old.grade_footpad) OR
         (COALESCE(NEW.grade_feathers, m_old.grade_feathers) IS DISTINCT FROM m_old.grade_feathers) OR
         (COALESCE(NEW.grade_lame, m_old.grade_lame)       IS DISTINCT FROM m_old.grade_lame) OR
         (COALESCE(NEW.grade_pecking, m_old.grade_pecking) IS DISTINCT FROM m_old.grade_pecking) OR
         (COALESCE(NEW.mortality_is_active, m_old.is_active) IS DISTINCT FROM m_old.is_active) THEN
        UPDATE public.log_mortality AS m
          SET dead_female      = COALESCE(NEW.dead_female, m.dead_female),
              dead_male        = COALESCE(NEW.dead_male, m.dead_male),
              cull_female      = COALESCE(NEW.cull_female, m.cull_female),
              cull_male        = COALESCE(NEW.cull_male, m.cull_male),
              cull_female_note = COALESCE(NEW.cull_female_note, m.cull_female_note),
              cull_male_note   = COALESCE(NEW.cull_male_note, m.cull_male_note),
              dead_reason      = COALESCE(NEW.dead_reason, m.dead_reason),
              grade_litter     = COALESCE(NEW.grade_litter, m.grade_litter),
              grade_footpad    = COALESCE(NEW.grade_footpad, m.grade_footpad),
              grade_feathers   = COALESCE(NEW.grade_feathers, m.grade_feathers),
              grade_lame       = COALESCE(NEW.grade_lame, m.grade_lame),
              grade_pecking    = COALESCE(NEW.grade_pecking, m.grade_pecking),
              is_active        = COALESCE(NEW.mortality_is_active, m.is_active),
              updated_by       = COALESCE(NEW.mortality_updated_by, m.updated_by)
        WHERE m.placement_id = NEW.placement_id::uuid AND m.log_date = NEW.log_date;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."v_placement_daily_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v_placement_insert_daily"("p_placement_id" "uuid", "p_log_date" "date", "p_age_days" integer DEFAULT NULL::integer, "p_am_temp" numeric DEFAULT NULL::numeric, "p_set_temp" numeric DEFAULT NULL::numeric, "p_ambient_temp" numeric DEFAULT NULL::numeric, "p_min_vent" numeric DEFAULT NULL::numeric, "p_is_oda_open" boolean DEFAULT NULL::boolean, "p_oda_exception" "text" DEFAULT NULL::"text", "p_naoh" "text" DEFAULT NULL::"text", "p_comment" "text" DEFAULT NULL::"text", "p_daily_is_active" boolean DEFAULT NULL::boolean, "p_daily_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.v_placement (
    placement_id, log_date,
    age_days, am_temp, set_temp, ambient_temp, min_vent,
    is_oda_open, oda_exception, naoh, comment, daily_is_active, daily_created_by, daily_updated_by,
    dead_female, dead_male, cull_female, cull_male, cull_female_note, cull_male_note, dead_reason,
    grade_litter, grade_footpad, grade_feathers, grade_lame, grade_pecking,
    mortality_is_active, mortality_created_by, mortality_updated_by
  ) VALUES (
    p_placement_id, p_log_date,
    p_age_days, p_am_temp, p_set_temp, p_ambient_temp, p_min_vent,
    p_is_oda_open, p_oda_exception, p_naoh, p_comment, p_daily_is_active, p_daily_created_by, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL
  );
END;
$$;


ALTER FUNCTION "public"."v_placement_insert_daily"("p_placement_id" "uuid", "p_log_date" "date", "p_age_days" integer, "p_am_temp" numeric, "p_set_temp" numeric, "p_ambient_temp" numeric, "p_min_vent" numeric, "p_is_oda_open" boolean, "p_oda_exception" "text", "p_naoh" "text", "p_comment" "text", "p_daily_is_active" boolean, "p_daily_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v_placement_insert_mortality"("p_placement_id" "uuid", "p_log_date" "date", "p_dead_female" integer DEFAULT NULL::integer, "p_dead_male" integer DEFAULT NULL::integer, "p_cull_female" integer DEFAULT NULL::integer, "p_cull_male" integer DEFAULT NULL::integer, "p_cull_female_note" "text" DEFAULT NULL::"text", "p_cull_male_note" "text" DEFAULT NULL::"text", "p_dead_reason" "text" DEFAULT NULL::"text", "p_grade_litter" integer DEFAULT NULL::integer, "p_grade_footpad" integer DEFAULT NULL::integer, "p_grade_feathers" integer DEFAULT NULL::integer, "p_grade_lame" integer DEFAULT NULL::integer, "p_grade_pecking" integer DEFAULT NULL::integer, "p_mortality_is_active" boolean DEFAULT NULL::boolean, "p_mortality_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.v_placement (
    placement_id, log_date,
    age_days, am_temp, set_temp, ambient_temp, min_vent,
    is_oda_open, oda_exception, naoh, comment, daily_is_active, daily_created_by, daily_updated_by,
    dead_female, dead_male, cull_female, cull_male, cull_female_note, cull_male_note, dead_reason,
    grade_litter, grade_footpad, grade_feathers, grade_lame, grade_pecking,
    mortality_is_active, mortality_created_by, mortality_updated_by
  ) VALUES (
    p_placement_id, p_log_date,
    NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    p_dead_female, p_dead_male, p_cull_female, p_cull_male, p_cull_female_note, p_cull_male_note, p_dead_reason,
    p_grade_litter, p_grade_footpad, p_grade_feathers, p_grade_lame, p_grade_pecking,
    p_mortality_is_active, p_mortality_created_by, NULL
  );
END;
$$;


ALTER FUNCTION "public"."v_placement_insert_mortality"("p_placement_id" "uuid", "p_log_date" "date", "p_dead_female" integer, "p_dead_male" integer, "p_cull_female" integer, "p_cull_male" integer, "p_cull_female_note" "text", "p_cull_male_note" "text", "p_dead_reason" "text", "p_grade_litter" integer, "p_grade_footpad" integer, "p_grade_feathers" integer, "p_grade_lame" integer, "p_grade_pecking" integer, "p_mortality_is_active" boolean, "p_mortality_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v_placement_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  d_old public.log_daily%ROWTYPE;
  m_old public.log_mortality%ROWTYPE;
BEGIN
  -- INSERT path: do not set updated_by; avoid casts
  IF TG_OP = 'INSERT' THEN
    -- daily insert/upsert when any daily field provided
    IF NEW.age_days IS NOT NULL OR NEW.am_temp IS NOT NULL OR NEW.set_temp IS NOT NULL OR NEW.ambient_temp IS NOT NULL OR NEW.min_vent IS NOT NULL OR NEW.is_oda_open IS NOT NULL OR NEW.oda_exception IS NOT NULL OR NEW.naoh IS NOT NULL OR NEW.comment IS NOT NULL OR NEW.daily_is_active IS NOT NULL OR NEW.daily_created_by IS NOT NULL THEN
      INSERT INTO public.log_daily AS d (
        placement_id, log_date,
        age_days, am_temp, set_temp, ambient_temp, min_vent,
        is_oda_open, oda_exception, naoh, comment, is_active,
        created_by, updated_by
      ) VALUES (
        NEW.placement_id, NEW.log_date,
        NEW.age_days, NEW.am_temp, NEW.set_temp, NEW.ambient_temp, NEW.min_vent,
        COALESCE(NEW.is_oda_open, false), NEW.oda_exception, NEW.naoh, NEW.comment, COALESCE(NEW.daily_is_active, true),
        NEW.daily_created_by, NULL
      )
      ON CONFLICT (placement_id, log_date) DO UPDATE SET
        age_days     = COALESCE(EXCLUDED.age_days, d.age_days),
        am_temp      = COALESCE(EXCLUDED.am_temp, d.am_temp),
        set_temp     = COALESCE(EXCLUDED.set_temp, d.set_temp),
        ambient_temp = COALESCE(EXCLUDED.ambient_temp, d.ambient_temp),
        min_vent     = COALESCE(EXCLUDED.min_vent, d.min_vent),
        is_oda_open  = COALESCE(EXCLUDED.is_oda_open, d.is_oda_open),
        oda_exception= COALESCE(EXCLUDED.oda_exception, d.oda_exception),
        naoh         = COALESCE(EXCLUDED.naoh, d.naoh),
        comment      = COALESCE(EXCLUDED.comment, d.comment),
        is_active    = COALESCE(EXCLUDED.is_active, d.is_active)
      WHERE (
        (EXCLUDED.age_days     IS DISTINCT FROM d.age_days) OR
        (EXCLUDED.am_temp      IS DISTINCT FROM d.am_temp) OR
        (EXCLUDED.set_temp     IS DISTINCT FROM d.set_temp) OR
        (EXCLUDED.ambient_temp IS DISTINCT FROM d.ambient_temp) OR
        (EXCLUDED.min_vent     IS DISTINCT FROM d.min_vent) OR
        (EXCLUDED.is_oda_open  IS DISTINCT FROM d.is_oda_open) OR
        (EXCLUDED.oda_exception IS DISTINCT FROM d.oda_exception) OR
        (EXCLUDED.naoh         IS DISTINCT FROM d.naoh) OR
        (EXCLUDED.comment      IS DISTINCT FROM d.comment) OR
        (EXCLUDED.is_active    IS DISTINCT FROM d.is_active)
      );
    END IF;

    -- mortality insert/upsert
    IF NEW.dead_female IS NOT NULL OR NEW.dead_male IS NOT NULL OR NEW.cull_female IS NOT NULL OR NEW.cull_male IS NOT NULL OR NEW.cull_female_note IS NOT NULL OR NEW.cull_male_note IS NOT NULL OR NEW.dead_reason IS NOT NULL OR NEW.grade_litter IS NOT NULL OR NEW.grade_footpad IS NOT NULL OR NEW.grade_feathers IS NOT NULL OR NEW.grade_lame IS NOT NULL OR NEW.grade_pecking IS NOT NULL OR NEW.mortality_is_active IS NOT NULL OR NEW.mortality_created_by IS NOT NULL THEN
      INSERT INTO public.log_mortality AS m (
        placement_id, log_date,
        dead_female, dead_male, cull_female, cull_male,
        cull_female_note, cull_male_note, dead_reason,
        grade_litter, grade_footpad, grade_feathers, grade_lame, grade_pecking,
        is_active,
        created_by, updated_by
      ) VALUES (
        NEW.placement_id, NEW.log_date,
        COALESCE(NEW.dead_female, 0), COALESCE(NEW.dead_male, 0), COALESCE(NEW.cull_female, 0), COALESCE(NEW.cull_male, 0),
        NEW.cull_female_note, NEW.cull_male_note, NEW.dead_reason,
        NEW.grade_litter, NEW.grade_footpad, NEW.grade_feathers, NEW.grade_lame, NEW.grade_pecking,
        COALESCE(NEW.mortality_is_active, true),
        NEW.mortality_created_by, NULL
      )
      ON CONFLICT (placement_id, log_date) DO UPDATE SET
        dead_female      = COALESCE(EXCLUDED.dead_female, m.dead_female),
        dead_male        = COALESCE(EXCLUDED.dead_male, m.dead_male),
        cull_female      = COALESCE(EXCLUDED.cull_female, m.cull_female),
        cull_male        = COALESCE(EXCLUDED.cull_male, m.cull_male),
        cull_female_note = COALESCE(EXCLUDED.cull_female_note, m.cull_female_note),
        cull_male_note   = COALESCE(EXCLUDED.cull_male_note, m.cull_male_note),
        dead_reason      = COALESCE(EXCLUDED.dead_reason, m.dead_reason),
        grade_litter     = COALESCE(EXCLUDED.grade_litter, m.grade_litter),
        grade_footpad    = COALESCE(EXCLUDED.grade_footpad, m.grade_footpad),
        grade_feathers   = COALESCE(EXCLUDED.grade_feathers, m.grade_feathers),
        grade_lame       = COALESCE(EXCLUDED.grade_lame, m.grade_lame),
        grade_pecking    = COALESCE(EXCLUDED.grade_pecking, m.grade_pecking),
        is_active        = COALESCE(EXCLUDED.is_active, m.is_active)
      WHERE (
        (EXCLUDED.dead_female      IS DISTINCT FROM m.dead_female) OR
        (EXCLUDED.dead_male        IS DISTINCT FROM m.dead_male) OR
        (EXCLUDED.cull_female      IS DISTINCT FROM m.cull_female) OR
        (EXCLUDED.cull_male        IS DISTINCT FROM m.cull_male) OR
        (EXCLUDED.cull_female_note IS DISTINCT FROM m.cull_female_note) OR
        (EXCLUDED.cull_male_note   IS DISTINCT FROM m.cull_male_note) OR
        (EXCLUDED.dead_reason      IS DISTINCT FROM m.dead_reason) OR
        (EXCLUDED.grade_litter     IS DISTINCT FROM m.grade_litter) OR
        (EXCLUDED.grade_footpad    IS DISTINCT FROM m.grade_footpad) OR
        (EXCLUDED.grade_feathers   IS DISTINCT FROM m.grade_feathers) OR
        (EXCLUDED.grade_lame       IS DISTINCT FROM m.grade_lame) OR
        (EXCLUDED.grade_pecking    IS DISTINCT FROM m.grade_pecking) OR
        (EXCLUDED.is_active        IS DISTINCT FROM m.is_active)
      );
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE path: only update changed columns and set updated_by
  IF TG_OP = 'UPDATE' THEN
    -- daily
    SELECT * INTO d_old FROM public.log_daily WHERE placement_id = NEW.placement_id AND log_date = NEW.log_date FOR UPDATE;
    IF d_old.placement_id IS NOT NULL THEN
      IF (COALESCE(NEW.age_days, d_old.age_days)          IS DISTINCT FROM d_old.age_days) OR
         (COALESCE(NEW.am_temp, d_old.am_temp)            IS DISTINCT FROM d_old.am_temp) OR
         (COALESCE(NEW.set_temp, d_old.set_temp)          IS DISTINCT FROM d_old.set_temp) OR
         (COALESCE(NEW.ambient_temp, d_old.ambient_temp)  IS DISTINCT FROM d_old.ambient_temp) OR
         (COALESCE(NEW.min_vent, d_old.min_vent)          IS DISTINCT FROM d_old.min_vent) OR
         (COALESCE(NEW.is_oda_open, d_old.is_oda_open)    IS DISTINCT FROM d_old.is_oda_open) OR
         (COALESCE(NEW.oda_exception, d_old.oda_exception)IS DISTINCT FROM d_old.oda_exception) OR
         (COALESCE(NEW.naoh, d_old.naoh)                  IS DISTINCT FROM d_old.naoh) OR
         (COALESCE(NEW.comment, d_old.comment)            IS DISTINCT FROM d_old.comment) OR
         (COALESCE(NEW.daily_is_active, d_old.is_active)  IS DISTINCT FROM d_old.is_active) THEN
        UPDATE public.log_daily AS d
          SET age_days     = COALESCE(NEW.age_days, d.age_days),
              am_temp      = COALESCE(NEW.am_temp, d.am_temp),
              set_temp     = COALESCE(NEW.set_temp, d.set_temp),
              ambient_temp = COALESCE(NEW.ambient_temp, d.ambient_temp),
              min_vent     = COALESCE(NEW.min_vent, d.min_vent),
              is_oda_open  = COALESCE(NEW.is_oda_open, d.is_oda_open),
              oda_exception= COALESCE(NEW.oda_exception, d.oda_exception),
              naoh         = COALESCE(NEW.naoh, d.naoh),
              comment      = COALESCE(NEW.comment, d.comment),
              is_active    = COALESCE(NEW.daily_is_active, d.is_active),
              updated_by   = NEW.daily_updated_by
        WHERE d.placement_id = NEW.placement_id AND d.log_date = NEW.log_date;
      END IF;
    END IF;

    -- mortality
    SELECT * INTO m_old FROM public.log_mortality WHERE placement_id = NEW.placement_id AND log_date = NEW.log_date FOR UPDATE;
    IF m_old.placement_id IS NOT NULL THEN
      IF (COALESCE(NEW.dead_female, m_old.dead_female)     IS DISTINCT FROM m_old.dead_female) OR
         (COALESCE(NEW.dead_male, m_old.dead_male)         IS DISTINCT FROM m_old.dead_male) OR
         (COALESCE(NEW.cull_female, m_old.cull_female)     IS DISTINCT FROM m_old.cull_female) OR
         (COALESCE(NEW.cull_male, m_old.cull_male)         IS DISTINCT FROM m_old.cull_male) OR
         (COALESCE(NEW.cull_female_note, m_old.cull_female_note) IS DISTINCT FROM m_old.cull_female_note) OR
         (COALESCE(NEW.cull_male_note, m_old.cull_male_note)     IS DISTINCT FROM m_old.cull_male_note) OR
         (COALESCE(NEW.dead_reason, m_old.dead_reason)     IS DISTINCT FROM m_old.dead_reason) OR
         (COALESCE(NEW.grade_litter, m_old.grade_litter)   IS DISTINCT FROM m_old.grade_litter) OR
         (COALESCE(NEW.grade_footpad, m_old.grade_footpad) IS DISTINCT FROM m_old.grade_footpad) OR
         (COALESCE(NEW.grade_feathers, m_old.grade_feathers) IS DISTINCT FROM m_old.grade_feathers) OR
         (COALESCE(NEW.grade_lame, m_old.grade_lame)       IS DISTINCT FROM m_old.grade_lame) OR
         (COALESCE(NEW.grade_pecking, m_old.grade_pecking) IS DISTINCT FROM m_old.grade_pecking) OR
         (COALESCE(NEW.mortality_is_active, m_old.is_active) IS DISTINCT FROM m_old.is_active) THEN
        UPDATE public.log_mortality AS m
          SET dead_female      = COALESCE(NEW.dead_female, m.dead_female),
              dead_male        = COALESCE(NEW.dead_male, m.dead_male),
              cull_female      = COALESCE(NEW.cull_female, m.cull_female),
              cull_male        = COALESCE(NEW.cull_male, m.cull_male),
              cull_female_note = COALESCE(NEW.cull_female_note, m.cull_female_note),
              cull_male_note   = COALESCE(NEW.cull_male_note, m.cull_male_note),
              dead_reason      = COALESCE(NEW.dead_reason, m.dead_reason),
              grade_litter     = COALESCE(NEW.grade_litter, m.grade_litter),
              grade_footpad    = COALESCE(NEW.grade_footpad, m.grade_footpad),
              grade_feathers   = COALESCE(NEW.grade_feathers, m.grade_feathers),
              grade_lame       = COALESCE(NEW.grade_lame, m.grade_lame),
              grade_pecking    = COALESCE(NEW.grade_pecking, m.grade_pecking),
              is_active        = COALESCE(NEW.mortality_is_active, m.is_active),
              updated_by       = NEW.mortality_updated_by
        WHERE m.placement_id = NEW.placement_id AND m.log_date = NEW.log_date;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."v_placement_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vacate_barn"("p_barn_id" "uuid", "p_vacate_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_placement_id uuid;
  v_flock_id uuid;
  v_date_placed date;
BEGIN
  -- Find the single active placement for this barn (date_removed is NULL)
  SELECT p.id, p.flock_id, f.date_placed
  INTO v_placement_id, v_flock_id, v_date_placed
  FROM public.placements p
  JOIN public.flocks f ON f.id = p.flock_id
  WHERE p.barn_id = p_barn_id AND p.date_removed IS NULL
  FOR UPDATE;

  IF v_placement_id IS NULL THEN
    RAISE EXCEPTION 'No active placement found for barn %', p_barn_id USING ERRCODE = 'NO_DATA_FOUND';
  END IF;

  IF p_vacate_date < v_date_placed THEN
    RAISE EXCEPTION 'Vacate date % cannot be earlier than date_placed % for flock %', p_vacate_date, v_date_placed, v_flock_id;
  END IF;

  -- Close the placement window
  UPDATE public.placements
  SET date_removed = p_vacate_date
  WHERE id = v_placement_id;

  -- Deactivate the flock and snap max_date to vacate date
  UPDATE public.flocks
  SET is_active = false,
      max_date  = GREATEST(p_vacate_date, v_date_placed)
  WHERE id = v_flock_id;
END;
$$;


ALTER FUNCTION "public"."vacate_barn"("p_barn_id" "uuid", "p_vacate_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."write_activity_log"("p_placement_id" "uuid" DEFAULT NULL::"uuid", "p_entry_type" "text" DEFAULT 'event'::"text", "p_action_key" "text" DEFAULT 'activity'::"text", "p_details" "text" DEFAULT ''::"text", "p_source" "text" DEFAULT NULL::"text", "p_actor_user_id" "uuid" DEFAULT NULL::"uuid", "p_actor_name" "text" DEFAULT NULL::"text", "p_farm_id" "uuid" DEFAULT NULL::"uuid", "p_barn_id" "uuid" DEFAULT NULL::"uuid", "p_flock_id" "uuid" DEFAULT NULL::"uuid", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_log_id uuid;
  v_actor_id uuid;
  v_actor_name text;
  v_placement_id uuid;
  v_flock_id uuid;
  v_farm_id uuid;
  v_barn_id uuid;
  v_placement_code text;
  v_farm_name text;
  v_barn_code text;
begin
  v_actor_id := coalesce(p_actor_user_id, auth.uid());
  v_actor_name := nullif(trim(coalesce(p_actor_name, '')), '');

  if v_actor_name is null and v_actor_id is not null then
    select nullif(trim(full_name), '')
      into v_actor_name
    from public.profiles
    where id = v_actor_id;
  end if;

  v_placement_id := p_placement_id;
  v_farm_id := p_farm_id;
  v_barn_id := p_barn_id;
  v_flock_id := p_flock_id;

  if v_placement_id is not null then
    select
      p.id,
      p.flock_id,
      p.farm_id,
      p.barn_id,
      p.placement_key,
      b.barn_code,
      coalesce(fu.farm_name, f.farm_name)
    into
      v_placement_id,
      v_flock_id,
      v_farm_id,
      v_barn_id,
      v_placement_code,
      v_barn_code,
      v_farm_name
    from public.placements p
    left join public.barns b
      on b.id = p.barn_id
    left join public.farms f
      on f.id = p.farm_id
    left join public.farms_ui fu
      on fu.id = p.farm_id
    where p.id = p_placement_id;
  else
    if v_barn_id is not null then
      select barn_code, farm_id
        into v_barn_code, v_farm_id
      from public.barns
      where id = v_barn_id;
    end if;

    if v_farm_id is not null then
      select coalesce(fu.farm_name, f.farm_name)
        into v_farm_name
      from public.farms f
      left join public.farms_ui fu
        on fu.id = f.id
      where f.id = v_farm_id;
    end if;
  end if;

  insert into public.activity_log (
    entry_type,
    action_key,
    details,
    source,
    placement_id,
    flock_id,
    farm_id,
    barn_id,
    user_id,
    user_name,
    placement_code,
    farm_name,
    barn_code,
    meta
  )
  values (
    coalesce(nullif(trim(p_entry_type), ''), 'event'),
    coalesce(nullif(trim(p_action_key), ''), 'activity'),
    coalesce(p_details, ''),
    nullif(trim(coalesce(p_source, '')), ''),
    v_placement_id,
    v_flock_id,
    v_farm_id,
    v_barn_id,
    v_actor_id,
    v_actor_name,
    v_placement_code,
    v_farm_name,
    v_barn_code,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;


ALTER FUNCTION "public"."write_activity_log"("p_placement_id" "uuid", "p_entry_type" "text", "p_action_key" "text", "p_details" "text", "p_source" "text", "p_actor_user_id" "uuid", "p_actor_name" "text", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_flock_id" "uuid", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "tuning"."baseline_run_id"() RETURNS bigint
    LANGUAGE "sql" STABLE
    AS $$
  select id
  from tuning.runs
  where label = 'baseline'
  order by run_at asc, id asc
  limit 1;
$$;


ALTER FUNCTION "tuning"."baseline_run_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "tuning"."capture_and_get_report_payload"("p_label" "text" DEFAULT 'weekly'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'tuning'
    AS $$
declare
  v_run_id bigint;
begin
  v_run_id := tuning.capture_snapshot(p_label);
  return tuning.report_payload_json(v_run_id);
end;
$$;


ALTER FUNCTION "tuning"."capture_and_get_report_payload"("p_label" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "tuning"."capture_snapshot"("p_label" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'tuning'
    AS $$
declare
  v_run_id bigint;
  v_has_pgss boolean;
begin
  insert into tuning.runs(label) values (p_label)
  returning id into v_run_id;

  insert into tuning.metrics(run_id, metric_name, metric_value)
  values
    (v_run_id, 'db_size_bytes', pg_database_size(current_database())),
    (v_run_id, 'db_numbackends', (select numbackends::numeric from pg_stat_database where datname = current_database())),
    (v_run_id, 'public_storage_platform_gsync_table_bytes', (
      select coalesce(sum(pg_relation_size(c.oid)),0)::numeric
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname in ('public','storage','platform','gsync')
    )),
    (v_run_id, 'public_storage_platform_gsync_index_bytes', (
      select coalesce(sum(pg_indexes_size(c.oid)),0)::numeric
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname in ('public','storage','platform','gsync')
    )),
    (v_run_id, 'dead_tuples_estimate', (
      select coalesce(sum(s.n_dead_tup),0)::numeric
      from pg_stat_user_tables s
      join pg_class c on c.oid = s.relid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public','storage','platform','gsync')
    )),
    (v_run_id, 'seq_scans_total', (
      select coalesce(sum(s.seq_scan),0)::numeric
      from pg_stat_user_tables s
      join pg_class c on c.oid = s.relid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public','storage','platform','gsync')
    )),
    (v_run_id, 'idx_scans_total', (
      select coalesce(sum(s.idx_scan),0)::numeric
      from pg_stat_user_tables s
      join pg_class c on c.oid = s.relid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public','storage','platform','gsync')
    ));

  insert into tuning.metrics(run_id, metric_name, metric_value)
  select
    v_run_id,
    'duplicate_index_count',
    count(*)::numeric
  from pg_index ix
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  join (
    select indrelid, indkey, indexprs, indpred
    from pg_index
    where indisvalid
    group by indrelid, indkey, indexprs, indpred
    having count(*) > 1
  ) d on d.indrelid = ix.indrelid
     and d.indkey is not distinct from ix.indkey
     and d.indexprs is not distinct from ix.indexprs
     and d.indpred is not distinct from ix.indpred
  where n.nspname in ('public','storage','platform','gsync');

  insert into tuning.metrics(run_id, metric_name, metric_value)
  select
    v_run_id,
    'duplicate_index_bytes',
    coalesce(sum(pg_relation_size(i.oid)),0)::numeric
  from pg_index ix
  join pg_class i on i.oid = ix.indexrelid
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  join (
    select indrelid, indkey, indexprs, indpred
    from pg_index
    where indisvalid
    group by indrelid, indkey, indexprs, indpred
    having count(*) > 1
  ) d on d.indrelid = ix.indrelid
     and d.indkey is not distinct from ix.indkey
     and d.indexprs is not distinct from ix.indexprs
     and d.indpred is not distinct from ix.indpred
  where n.nspname in ('public','storage','platform','gsync');

  insert into tuning.metrics(run_id, metric_name, metric_value)
  select
    v_run_id,
    'missing_fk_index_count',
    count(*)::numeric
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f'
    and n.nspname in ('public','storage','platform','gsync')
    and not exists (
      select 1
      from pg_index i
      where i.indrelid = con.conrelid
        and i.indisvalid
        and (i.indkey::int2[])[0:cardinality(con.conkey)-1] @> con.conkey
    );

  insert into tuning.findings(run_id, finding_type, schema_name, table_name, object_name, details)
  select
    v_run_id,
    'duplicate_index',
    n.nspname,
    t.relname,
    i.relname,
    jsonb_build_object(
      'index_definition', pg_get_indexdef(ix.indexrelid),
      'index_size_bytes', pg_relation_size(i.oid)
    )
  from pg_index ix
  join pg_class i on i.oid = ix.indexrelid
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  join (
    select indrelid, indkey, indexprs, indpred
    from pg_index
    where indisvalid
    group by indrelid, indkey, indexprs, indpred
    having count(*) > 1
  ) d on d.indrelid = ix.indrelid
     and d.indkey is not distinct from ix.indkey
     and d.indexprs is not distinct from ix.indexprs
     and d.indpred is not distinct from ix.indpred
  where n.nspname in ('public','storage','platform','gsync');

  insert into tuning.findings(run_id, finding_type, schema_name, table_name, object_name, details)
  select
    v_run_id,
    'missing_fk_index',
    n.nspname,
    c.relname,
    con.conname,
    jsonb_build_object(
      'constraint_definition', pg_get_constraintdef(con.oid),
      'suggested_create_sql', format(
        'create index concurrently if not exists %I on %I.%I (%s);',
        'idx_' || c.relname || '_' || con.conname,
        n.nspname,
        c.relname,
        (
          select string_agg(format('%I', a.attname), ', ' order by u.ord)
          from unnest(con.conkey) with ordinality as u(attnum, ord)
          join pg_attribute a on a.attrelid = c.oid and a.attnum = u.attnum
        )
      )
    )
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f'
    and n.nspname in ('public','storage','platform','gsync')
    and not exists (
      select 1
      from pg_index i
      where i.indrelid = con.conrelid
        and i.indisvalid
        and (i.indkey::int2[])[0:cardinality(con.conkey)-1] @> con.conkey
    );

  v_has_pgss := to_regclass('public.pg_stat_statements') is not null;

  if v_has_pgss then
    insert into tuning.metrics(run_id, metric_name, metric_value)
    select v_run_id, 'pg_stat_statements_total_exec_time', coalesce(sum(total_exec_time),0)::numeric
    from public.pg_stat_statements;

    insert into tuning.metrics(run_id, metric_name, metric_value)
    select v_run_id, 'pg_stat_statements_total_calls', coalesce(sum(calls),0)::numeric
    from public.pg_stat_statements;
  end if;

  return v_run_id;
end;
$$;


ALTER FUNCTION "tuning"."capture_snapshot"("p_label" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "tuning"."compare_runs"("p_run_a" bigint, "p_run_b" bigint) RETURNS TABLE("metric_name" "text", "run_a_value" numeric, "run_b_value" numeric, "delta_value" numeric, "pct_change" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  with a as (
    select metric_name, metric_value
    from tuning.metrics
    where run_id = p_run_a
  ),
  b as (
    select metric_name, metric_value
    from tuning.metrics
    where run_id = p_run_b
  )
  select
    coalesce(a.metric_name, b.metric_name) as metric_name,
    a.metric_value as run_a_value,
    b.metric_value as run_b_value,
    (b.metric_value - a.metric_value) as delta_value,
    case
      when a.metric_value is null or a.metric_value = 0 or b.metric_value is null then null
      else round(((b.metric_value - a.metric_value) / a.metric_value) * 100.0, 2)
    end as pct_change
  from a
  full outer join b on b.metric_name = a.metric_name
  order by 1;
$$;


ALTER FUNCTION "tuning"."compare_runs"("p_run_a" bigint, "p_run_b" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "tuning"."latest_two_nonbaseline_run_ids"() RETURNS TABLE("latest_run_id" bigint, "previous_run_id" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  with ordered as (
    select
      id,
      row_number() over (order by run_at desc, id desc) as rn
    from tuning.runs
    where coalesce(label, '') <> 'baseline'
  )
  select
    max(case when rn = 1 then id end) as latest_run_id,
    max(case when rn = 2 then id end) as previous_run_id
  from ordered;
$$;


ALTER FUNCTION "tuning"."latest_two_nonbaseline_run_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "tuning"."report_payload_json"("p_run_id" bigint DEFAULT NULL::bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  v_run_id bigint;
  v_prev_run_id bigint;
  v_base_run_id bigint;
  v_generated_at timestamptz := now();
  v_summary jsonb;
  v_vs_previous jsonb;
  v_vs_baseline jsonb;
  v_top_findings jsonb;
begin
  if p_run_id is null then
    select latest_run_id, previous_run_id
    into v_run_id, v_prev_run_id
    from tuning.latest_two_nonbaseline_run_ids();
  else
    v_run_id := p_run_id;
    select id into v_prev_run_id
    from tuning.runs
    where id < v_run_id
      and coalesce(label, '') <> 'baseline'
    order by id desc
    limit 1;
  end if;

  v_base_run_id := tuning.baseline_run_id();

  if v_run_id is null then
    raise exception 'No non-baseline tuning run available yet.';
  end if;

  select jsonb_object_agg(metric_name, metric_value)
  into v_summary
  from tuning.metrics
  where run_id = v_run_id;

  if v_prev_run_id is not null then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.metric_name), '[]'::jsonb)
    into v_vs_previous
    from tuning.compare_runs(v_prev_run_id, v_run_id) x;
  else
    v_vs_previous := '[]'::jsonb;
  end if;

  if v_base_run_id is not null and v_base_run_id <> v_run_id then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.metric_name), '[]'::jsonb)
    into v_vs_baseline
    from tuning.compare_runs(v_base_run_id, v_run_id) x;
  else
    v_vs_baseline := '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'finding_type', finding_type,
        'schema_name', schema_name,
        'table_name', table_name,
        'object_name', object_name,
        'details', details
      )
      order by finding_type, schema_name, table_name, object_name
    ),
    '[]'::jsonb
  )
  into v_top_findings
  from (
    select finding_type, schema_name, table_name, object_name, details
    from tuning.findings
    where run_id = v_run_id
    limit 100
  ) f;

  return jsonb_build_object(
    'generated_at', v_generated_at,
    'current_run_id', v_run_id,
    'previous_run_id', v_prev_run_id,
    'baseline_run_id', v_base_run_id,
    'summary_metrics', coalesce(v_summary, '{}'::jsonb),
    'vs_previous', v_vs_previous,
    'vs_baseline', v_vs_baseline,
    'findings', v_top_findings
  );
end;
$$;


ALTER FUNCTION "tuning"."report_payload_json"("p_run_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "tuning"."send_weekly_report_email"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'tuning', 'vault'
    AS $$
declare
  v_payload jsonb;
  v_current_run bigint;
  v_prev_run bigint;
  v_base_run bigint;
  v_summary jsonb;
  v_vs_previous jsonb;
  v_vs_baseline jsonb;
  v_findings jsonb;

  v_html text;
  v_subject text;
  v_to text;
  v_from text;
  v_resend_key text;
  v_request_id bigint;

  v_findings_count int;
  v_summary_kpis_html text;
  v_prev_regressions_html text;
  v_base_regressions_html text;
  v_findings_highlights_html text;
  v_finding_types_html text;
begin
  v_payload := tuning.capture_and_get_report_payload('weekly');

  v_current_run := (v_payload->>'current_run_id')::bigint;
  v_prev_run := nullif(v_payload->>'previous_run_id', '')::bigint;
  v_base_run := nullif(v_payload->>'baseline_run_id', '')::bigint;
  v_summary := coalesce(v_payload->'summary_metrics', '{}'::jsonb);
  v_vs_previous := coalesce(v_payload->'vs_previous', '[]'::jsonb);
  v_vs_baseline := coalesce(v_payload->'vs_baseline', '[]'::jsonb);
  v_findings := coalesce(v_payload->'findings', '[]'::jsonb);

  v_findings_count := jsonb_array_length(v_findings);

  select coalesce(string_agg(item_html, ''), '<li>No summary KPIs captured.</li>')
  into v_summary_kpis_html
  from (
    select format('<li><strong>%s:</strong> %s</li>', k.key, k.value) as item_html
    from jsonb_each_text(v_summary) as k(key, value)
    order by k.key
    limit 12
  ) s;

  select coalesce(string_agg(item_html, ''), '<li>No significant changes vs previous run.</li>')
  into v_prev_regressions_html
  from (
    select format(
      '<li><strong>%s</strong> changed by <strong>%s%%</strong> (%s → %s)</li>',
      coalesce(x.metric_name, 'unknown_metric'),
      coalesce(x.pct_change::text, 'n/a'),
      coalesce(x.run_a_value::text, 'n/a'),
      coalesce(x.run_b_value::text, 'n/a')
    ) as item_html
    from jsonb_to_recordset(v_vs_previous) as x(
      metric_name text,
      run_a_value numeric,
      run_b_value numeric,
      delta_value numeric,
      pct_change numeric
    )
    where x.pct_change is not null
      and abs(x.pct_change) >= 10
    order by abs(x.pct_change) desc, x.metric_name
    limit 8
  ) s;

  select coalesce(string_agg(item_html, ''), '<li>No significant changes vs baseline.</li>')
  into v_base_regressions_html
  from (
    select format(
      '<li><strong>%s</strong> changed by <strong>%s%%</strong> (%s → %s)</li>',
      coalesce(x.metric_name, 'unknown_metric'),
      coalesce(x.pct_change::text, 'n/a'),
      coalesce(x.run_a_value::text, 'n/a'),
      coalesce(x.run_b_value::text, 'n/a')
    ) as item_html
    from jsonb_to_recordset(v_vs_baseline) as x(
      metric_name text,
      run_a_value numeric,
      run_b_value numeric,
      delta_value numeric,
      pct_change numeric
    )
    where x.pct_change is not null
      and abs(x.pct_change) >= 10
    order by abs(x.pct_change) desc, x.metric_name
    limit 8
  ) s;

  select coalesce(string_agg(item_html, ''), '<li>No findings recorded in this snapshot.</li>')
  into v_findings_highlights_html
  from (
    select format(
      '<li><strong>%s</strong> on %s%s%s — %s</li>',
      coalesce(x.finding_type, 'unknown'),
      coalesce(x.schema_name, 'n/a'),
      case when x.table_name is not null then '.' || x.table_name else '' end,
      case when x.object_name is not null then ' (' || x.object_name || ')' else '' end,
      left(coalesce(x.details, ''), 220)
    ) as item_html
    from jsonb_to_recordset(v_findings) as x(
      finding_type text,
      schema_name text,
      table_name text,
      object_name text,
      details text
    )
    order by x.finding_type, x.schema_name, x.table_name, x.object_name
    limit 10
  ) s;

  select coalesce(string_agg(item_html, ''), '<li>No finding categories.</li>')
  into v_finding_types_html
  from (
    select format('<li><strong>%s:</strong> %s</li>', coalesce(finding_type, 'unknown'), cnt) as item_html
    from (
      select x.finding_type, count(*) as cnt
      from jsonb_to_recordset(v_findings) as x(
        finding_type text,
        schema_name text,
        table_name text,
        object_name text,
        details text
      )
      group by x.finding_type
      order by count(*) desc, x.finding_type
      limit 8
    ) t
  ) s;

  select decrypted_secret into v_to
  from vault.decrypted_secrets
  where name = 'tuning_report_to_email'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_from
  from vault.decrypted_secrets
  where name = 'tuning_report_from_email'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_resend_key
  from vault.decrypted_secrets
  where name = 'tuning_resend_api_key'
  order by created_at desc
  limit 1;

  if v_to is null or v_from is null or v_resend_key is null then
    raise exception 'Missing Vault secrets. Required: tuning_report_to_email, tuning_report_from_email, tuning_resend_api_key';
  end if;

  v_subject := format('Weekly DB Performance Report (run %s)', v_current_run);

  v_html :=
    '<h2>Weekly Supabase Performance Report</h2>' ||
    '<p><em>Business summary first, detailed data below.</em></p>' ||
    '<h3>At a glance</h3>' ||
    '<ul>' ||
      format('<li><strong>Current run:</strong> %s</li>', v_current_run) ||
      format('<li><strong>Previous run:</strong> %s</li>', coalesce(v_prev_run::text, 'n/a')) ||
      format('<li><strong>Baseline run:</strong> %s</li>', coalesce(v_base_run::text, 'n/a')) ||
      format('<li><strong>Total findings:</strong> %s</li>', v_findings_count) ||
    '</ul>' ||
    '<h3>Key KPIs</h3><ul>' || v_summary_kpis_html || '</ul>' ||
    '<h3>Potential regressions vs previous run (|change| ≥ 10%)</h3><ul>' || v_prev_regressions_html || '</ul>' ||
    '<h3>Potential regressions vs baseline (|change| ≥ 10%)</h3><ul>' || v_base_regressions_html || '</ul>' ||
    '<h3>Top finding categories</h3><ul>' || v_finding_types_html || '</ul>' ||
    '<h3>Top findings to review</h3><ul>' || v_findings_highlights_html || '</ul>' ||
    '<hr />' ||
    '<h3>Detailed data</h3>' ||
    '<h4>Compared to Previous Week</h4><pre>' || coalesce(jsonb_pretty(v_vs_previous), '[]') || '</pre>' ||
    '<h4>Compared to Baseline</h4><pre>' || coalesce(jsonb_pretty(v_vs_baseline), '[]') || '</pre>' ||
    '<h4>Current Summary Metrics</h4><pre>' || coalesce(jsonb_pretty(v_summary), '{}') || '</pre>' ||
    '<h4>Current Findings (first 100)</h4><pre>' || coalesce(jsonb_pretty(v_findings), '[]') || '</pre>';

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_resend_key
    ),
    body := jsonb_build_object(
      'from', v_from,
      'to', jsonb_build_array(v_to),
      'subject', v_subject,
      'html', v_html
    ),
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;


ALTER FUNCTION "tuning"."send_weekly_report_email"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "gsync"."column_map" (
    "map_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "dataset_key" "text" NOT NULL,
    "header_label" "text",
    "column_index" integer,
    "column_letter" "text",
    "required" boolean DEFAULT false NOT NULL,
    "transform_sql" "text",
    CONSTRAINT "one_position" CHECK (((((("header_label" IS NOT NULL))::integer + (("column_index" IS NOT NULL))::integer) + (("column_letter" IS NOT NULL))::integer) = 1))
);


ALTER TABLE "gsync"."column_map" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "gsync"."outbox" (
    "id" bigint NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "target_date" "date" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "public"."gsync_write_status" DEFAULT 'pending'::"public"."gsync_write_status" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone
);


ALTER TABLE "gsync"."outbox" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "gsync"."outbox_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "gsync"."outbox_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "gsync"."outbox_id_seq" OWNED BY "gsync"."outbox"."id";



CREATE TABLE IF NOT EXISTS "gsync"."sheet" (
    "sheet_id" "text" NOT NULL,
    "title" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "idxfarm" integer
);


ALTER TABLE "gsync"."sheet" OWNER TO "postgres";


COMMENT ON COLUMN "gsync"."sheet"."idxfarm" IS 'The farm this record applies to..';



CREATE TABLE IF NOT EXISTS "gsync"."sync_job" (
    "job_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "kind" "public"."gsync_job_kind" DEFAULT 'manual'::"public"."gsync_job_kind" NOT NULL,
    "status" "public"."gsync_job_status" DEFAULT 'started'::"public"."gsync_job_status" NOT NULL,
    "rows_written" integer DEFAULT 0 NOT NULL,
    "rows_failed" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone
);


ALTER TABLE "gsync"."sync_job" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "gsync"."tab" (
    "tab_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sheet_id" "text" NOT NULL,
    "tab_gid" bigint NOT NULL,
    "tab_name" "text" NOT NULL,
    "header_row" integer DEFAULT 6 NOT NULL,
    "date_header_label" "text" DEFAULT 'DATE'::"text" NOT NULL,
    "date_format" "text" DEFAULT 'YYYY-MM-DD'::"text",
    "last_synced_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "gsync"."tab" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "gsync"."trax2sheets_map" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "updated_last" timestamp with time zone,
    "sheetid" "text" DEFAULT ''::"text",
    "sheet_labelrow" integer,
    "trax_label" "text",
    "sheet_label" "text"
);


ALTER TABLE "gsync"."trax2sheets_map" OWNER TO "postgres";


COMMENT ON TABLE "gsync"."trax2sheets_map" IS 'Cross references FlockTRAX table.field names to Google Sheets column labels for API sync';



ALTER TABLE "gsync"."trax2sheets_map" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "gsync"."trax2sheets_map_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "platform"."control" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT "auth"."uid"(),
    "group" "text",
    "version" "text",
    "build" smallint,
    "released" "date",
    "build_label" "text"
);


ALTER TABLE "platform"."control" OWNER TO "postgres";


COMMENT ON TABLE "platform"."control" IS 'Release labels and identifiers for application display';



COMMENT ON COLUMN "platform"."control"."version" IS 'Display version string for the platform surface, e.g. 1.0.2 or 1.0.2 (13).';



COMMENT ON COLUMN "platform"."control"."build_label" IS 'Optional display build label for published surfaces, e.g. 4, 4.1, or 5.2 while numeric build remains the base release counter.';



ALTER TABLE "platform"."control" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "platform"."control_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "platform"."license_policy" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT "auth"."uid"(),
    "name" "text",
    "display_txt" "text",
    "note" "text",
    "scrn_location" "text"
);


ALTER TABLE "platform"."license_policy" OWNER TO "postgres";


ALTER TABLE "platform"."license_policy" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "platform"."license_policy_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "platform"."reportoptions" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rpt_group" "text",
    "rpt_location" "text",
    "rpt_title" "text",
    "rpt_subtitle" "text",
    "rpt_button_txt" "text",
    "rpt_function" "text",
    "run_count" integer,
    "name" "text"
);


ALTER TABLE "platform"."reportoptions" OWNER TO "postgres";


COMMENT ON TABLE "platform"."reportoptions" IS 'Report titles,subtitles and options';



COMMENT ON COLUMN "platform"."reportoptions"."name" IS 'Name of printed report and display screen';



ALTER TABLE "platform"."reportoptions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "platform"."reportoptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "platform"."screen_txt" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT "auth"."uid"(),
    "name" "text",
    "display" "text",
    "note" "text",
    "scrn_location" "text"
);


ALTER TABLE "platform"."screen_txt" OWNER TO "postgres";


ALTER TABLE "platform"."screen_txt" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "platform"."screen_txt_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "platform"."settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "value" "text",
    "desc" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "updated_by" "uuid"
);


ALTER TABLE "platform"."settings" OWNER TO "postgres";


COMMENT ON TABLE "platform"."settings" IS 'platform level options';



CREATE TABLE IF NOT EXISTS "platform"."sync_adapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "adapter_key" "text" NOT NULL,
    "adapter_name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "config_screen_slug" "text",
    "outbox_screen_slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sync_adapters_key_chk" CHECK (("adapter_key" ~ '^[a-z0-9]+(?:[-_][a-z0-9]+)*$'::"text"))
);


ALTER TABLE "platform"."sync_adapters" OWNER TO "postgres";


COMMENT ON TABLE "platform"."sync_adapters" IS 'Registry of pluggable FlockTrax sync interfaces such as googleapis-sheets, vtam, netman, or oracle.';



COMMENT ON COLUMN "platform"."sync_adapters"."adapter_key" IS 'Stable machine key used to route sync work to the correct adapter implementation.';



CREATE TABLE IF NOT EXISTS "platform"."sync_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "outbox_id" "uuid",
    "endpoint_id" "uuid",
    "adapter_id" "uuid" NOT NULL,
    "request_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "response_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status_code" integer,
    "status" "text" DEFAULT 'logged'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sync_audit_status_chk" CHECK (("status" = ANY (ARRAY['logged'::"text", 'sent'::"text", 'failed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "platform"."sync_audit" OWNER TO "postgres";


COMMENT ON TABLE "platform"."sync_audit" IS 'Historical request/response trace for sync work. Used to inspect what the adapter tried to send and how the endpoint answered.';



CREATE TABLE IF NOT EXISTS "platform"."sync_endpoints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "adapter_id" "uuid" NOT NULL,
    "farm_id" "uuid",
    "farm_group_id" "uuid",
    "endpoint_name" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "placement_tab_rule" "text" DEFAULT 'placement_key'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sync_endpoints_tab_rule_chk" CHECK (("placement_tab_rule" = 'placement_key'::"text"))
);


ALTER TABLE "platform"."sync_endpoints" OWNER TO "postgres";


COMMENT ON TABLE "platform"."sync_endpoints" IS 'Per-farm or per-scope sync target registrations. For googleapis-sheets this points a farm to its target workbook.';



COMMENT ON COLUMN "platform"."sync_endpoints"."placement_tab_rule" IS 'Current FlockTrax convention for worksheet selection. Locked to placement_key for the first sync implementation.';



CREATE TABLE IF NOT EXISTS "platform"."sync_googleapis_sheet_columns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endpoint_id" "uuid" NOT NULL,
    "source_table" "text" NOT NULL,
    "source_field" "text" NOT NULL,
    "source_variant" "text" DEFAULT ''::"text" NOT NULL,
    "sheet_label" "text" NOT NULL,
    "value_mode" "text" DEFAULT 'direct'::"text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "map_state" "text" DEFAULT 'enabled'::"text" NOT NULL,
    CONSTRAINT "sync_googleapis_sheet_columns_label_chk" CHECK (("length"(TRIM(BOTH FROM "sheet_label")) > 0)),
    CONSTRAINT "sync_googleapis_sheet_columns_map_state_chk" CHECK (("map_state" = ANY (ARRAY['enabled'::"text", 'audit_log_only'::"text", 'paused'::"text"]))),
    CONSTRAINT "sync_googleapis_sheet_columns_source_table_chk" CHECK (("source_table" = ANY (ARRAY['public.log_daily'::"text", 'public.log_mortality'::"text", 'public.log_weight'::"text"]))),
    CONSTRAINT "sync_googleapis_sheet_columns_value_mode_chk" CHECK (("value_mode" = ANY (ARRAY['direct'::"text", 'boolean_flag'::"text", 'note'::"text", 'derived'::"text"])))
);


ALTER TABLE "platform"."sync_googleapis_sheet_columns" OWNER TO "postgres";


COMMENT ON TABLE "platform"."sync_googleapis_sheet_columns" IS 'Per-endpoint column map for the googleapis-sheets adapter. Maps FlockTrax source fields to worksheet header labels.';



COMMENT ON COLUMN "platform"."sync_googleapis_sheet_columns"."source_variant" IS 'Optional field variant such as male/female for weight datasets that fan out to distinct worksheet columns.';



COMMENT ON COLUMN "platform"."sync_googleapis_sheet_columns"."map_state" IS 'Column map state: enabled writes to the spreadsheet, audit_log_only keeps the datapoint only in FlockTrax history, paused is a temporary inactive state.';



CREATE TABLE IF NOT EXISTS "platform"."sync_googleapis_sheets" (
    "endpoint_id" "uuid" NOT NULL,
    "spreadsheet_id" "text" NOT NULL,
    "spreadsheet_name" "text",
    "header_row" integer DEFAULT 6 NOT NULL,
    "date_header_label" "text" DEFAULT 'DATE'::"text" NOT NULL,
    "workbook_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sync_googleapis_sheets_header_row_chk" CHECK (("header_row" >= 1)),
    CONSTRAINT "sync_googleapis_sheets_spreadsheet_id_chk" CHECK (("length"(TRIM(BOTH FROM "spreadsheet_id")) > 10))
);


ALTER TABLE "platform"."sync_googleapis_sheets" OWNER TO "postgres";


COMMENT ON TABLE "platform"."sync_googleapis_sheets" IS 'Google Sheets adapter configuration. One workbook per farm, with worksheet/tab names derived from public.placements.placement_key.';



COMMENT ON COLUMN "platform"."sync_googleapis_sheets"."spreadsheet_id" IS 'Google spreadsheet id for the farm workbook. The worksheet/tab name is always placement_key.';



CREATE TABLE IF NOT EXISTS "platform"."sync_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endpoint_id" "uuid" NOT NULL,
    "adapter_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "operation" "text" NOT NULL,
    "placement_id" "uuid",
    "placement_key" "text",
    "log_date" "date",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claimed_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dedupe_key" "text",
    CONSTRAINT "sync_outbox_operation_chk" CHECK (("operation" = ANY (ARRAY['upsert_cell'::"text", 'clear_cell'::"text", 'sync_day'::"text", 'sync_placement'::"text", 'sync_feed'::"text", 'custom'::"text"]))),
    CONSTRAINT "sync_outbox_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'sent'::"text", 'failed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "platform"."sync_outbox" OWNER TO "postgres";


COMMENT ON TABLE "platform"."sync_outbox" IS 'Generic adapter-agnostic sync work queue. Adapter workers claim rows from here and execute interface-specific writes.';



COMMENT ON COLUMN "platform"."sync_outbox"."dedupe_key" IS 'Adapter-defined uniqueness key used to collapse repeated pending work for the same sync target.';



CREATE TABLE IF NOT EXISTS "public"."barns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "barn_code" "text" NOT NULL,
    "sort_code" "text",
    "length_ft" numeric,
    "width_ft" numeric,
    "sqft" numeric,
    "stdroc_head" "text",
    "active_flock_id" "uuid",
    "has_flock" boolean DEFAULT false NOT NULL,
    "is_empty" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."barns" OWNER TO "postgres";


COMMENT ON TABLE "public"."barns" IS 'Defines the physical growing divisions available for assignment of flocks.';



CREATE TABLE IF NOT EXISTS "public"."farms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "farm_code" "text" NOT NULL,
    "farm_name" "text" NOT NULL,
    "farm_group" "text",
    "addr" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "map_url" "text",
    "farm_group_id" "uuid",
    "name" "text",
    "latitude" numeric,
    "longitude" numeric,
    CONSTRAINT "farms_updated_by_present_ck" CHECK (("updated_by" IS NOT NULL))
);


ALTER TABLE "public"."farms" OWNER TO "postgres";


COMMENT ON TABLE "public"."farms" IS 'Defines locations where grower operates under a Group';



COMMENT ON COLUMN "public"."farms"."latitude" IS 'Farm latitude in decimal degrees for services such as weather lookup.';



COMMENT ON COLUMN "public"."farms"."longitude" IS 'Farm longitude in decimal degrees for services such as weather lookup.';



CREATE TABLE IF NOT EXISTS "public"."flocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "flock_number" integer NOT NULL,
    "date_placed" "date" NOT NULL,
    "max_date" "date" NOT NULL,
    "start_cnt_females" integer,
    "start_cnt_males" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_complete" boolean DEFAULT false NOT NULL,
    "is_in_barn" boolean DEFAULT false NOT NULL,
    "is_settled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "breed_males" "uuid",
    "breed_females" "uuid",
    "flock_removed" "date",
    "female_date_placed" "date",
    "male_date_placed" "date",
    CONSTRAINT "flocks_max_after_or_equal_date_placed" CHECK (("max_date" >= "date_placed"))
);


ALTER TABLE "public"."flocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."flocks" IS 'Base dataset that creats a group of chicks started together and grown in the same location (farm-barn) as a group.';



COMMENT ON COLUMN "public"."flocks"."flock_removed" IS 'Date the flock was fully removed from the barn after checkout/shipping.';



COMMENT ON COLUMN "public"."flocks"."female_date_placed" IS 'Arrival date for female birds when a flock is placed across multiple days. Defaults to the primary placement date.';



COMMENT ON COLUMN "public"."flocks"."male_date_placed" IS 'Arrival date for male birds when a flock is placed across multiple days. Defaults to the primary placement date.';



CREATE OR REPLACE VIEW "public"."active_barns" AS
 SELECT "b"."id" AS "barn_id",
    "b"."farm_id",
    "f"."farm_code",
    "b"."barn_code",
    "b"."active_flock_id",
    "fl"."flock_number" AS "active_flock_number",
    "b"."has_flock",
    "b"."is_empty",
    "b"."is_active"
   FROM (("public"."barns" "b"
     JOIN "public"."farms" "f" ON (("f"."id" = "b"."farm_id")))
     LEFT JOIN "public"."flocks" "fl" ON (("fl"."id" = "b"."active_flock_id")))
  WHERE ("b"."active_flock_id" IS NOT NULL);


ALTER VIEW "public"."active_barns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entry_type" "text" NOT NULL,
    "action_key" "text" NOT NULL,
    "details" "text" DEFAULT ''::"text" NOT NULL,
    "source" "text",
    "placement_id" "uuid",
    "flock_id" "uuid",
    "farm_id" "uuid",
    "barn_id" "uuid",
    "user_id" "uuid",
    "user_name" "text",
    "placement_code" "text",
    "farm_name" "text",
    "barn_code" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_log" IS 'Thin chronological diary of meaningful flock-management events. Stores the who/when/where/what narrative without duplicating operational detail rows.';



COMMENT ON COLUMN "public"."activity_log"."entry_type" IS 'Broad category such as functCall, comment, task_check, or state_change.';



COMMENT ON COLUMN "public"."activity_log"."action_key" IS 'Specific save or workflow key, for example save_log_daily_mobile or mark_chicks_arrived.';



CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone,
    "group" "text",
    "name" "text",
    "value" "text",
    "desc" "text"
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_settings" IS 'General settings & options that configure FlockTrax and its behavior';



CREATE TABLE IF NOT EXISTS "public"."app_users" (
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "adalo_user_id" "text" NOT NULL,
    "email" "text",
    "display_name" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone
);


ALTER TABLE "public"."app_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Supabase Authenticated Users';



CREATE OR REPLACE VIEW "public"."auth_audit_log_readable" AS
 WITH "audit" AS (
         SELECT "a"."id" AS "audit_id",
            "a"."created_at",
            COALESCE(
              "a"."payload" ->> 'ip_address'::"text",
              "a"."payload" ->> 'ip'::"text"
            ) AS "ip_address",
            "a"."payload",
            ("a"."payload" ->> 'action'::"text") AS "action",
            ("a"."payload" ->> 'log_type'::"text") AS "log_type",
            ("a"."payload" ->> 'actor_username'::"text") AS "actor_username",
            ("a"."payload" ->> 'actor_name'::"text") AS "actor_name",
            COALESCE((("a"."payload" ->> 'actor_via_sso'::"text"))::boolean, false) AS "actor_via_sso",
            (("a"."payload" -> 'traits'::"text") ->> 'provider'::"text") AS "provider",
                CASE
                    WHEN (("a"."payload" ->> 'actor_id'::"text") ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::"text") THEN (("a"."payload" ->> 'actor_id'::"text"))::"uuid"
                    ELSE NULL::"uuid"
                END AS "actor_user_id"
           FROM "auth"."audit_log_entries" "a"
        )
 SELECT "audit"."audit_id",
    "audit"."created_at",
    "audit"."ip_address",
    "audit"."action",
    "audit"."log_type",
    "audit"."provider",
    "audit"."actor_via_sso",
    "audit"."actor_user_id",
    COALESCE("p"."full_name", "audit"."actor_name") AS "actor_display_name",
    COALESCE("u"."email", ("p"."email")::character varying, ("audit"."actor_username")::character varying) AS "actor_email",
    ("u"."raw_user_meta_data" ->> 'phone'::"text") AS "actor_phone",
    "audit"."payload",
    "concat_ws"(' • '::"text", "audit"."log_type", "audit"."action", COALESCE("u"."email", ("p"."email")::character varying, ("audit"."actor_username")::character varying)) AS "event_summary"
   FROM (("audit"
     LEFT JOIN "auth"."users" "u" ON (("u"."id" = "audit"."actor_user_id")))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "audit"."actor_user_id")));


ALTER VIEW "public"."auth_audit_log_readable" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."barn_view_ui" AS
 SELECT "b"."id" AS "barn_id",
    "b"."farm_id",
    "f"."farm_code",
    "f"."farm_name",
    "b"."barn_code",
    "b"."active_flock_id",
    "fl"."flock_number" AS "active_flock_number",
    "b"."has_flock",
    "b"."is_empty",
    "b"."is_active"
   FROM (("public"."barns" "b"
     JOIN "public"."farms" "f" ON (("f"."id" = "b"."farm_id")))
     LEFT JOIN "public"."flocks" "fl" ON (("fl"."id" = "b"."active_flock_id")));


ALTER VIEW "public"."barn_view_ui" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breeds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "breed_name" "text" NOT NULL,
    "sex" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "breeds_sex_check" CHECK (("sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'unsexed'::"text"])))
);


ALTER TABLE "public"."breeds" OWNER TO "postgres";


COMMENT ON TABLE "public"."breeds" IS 'Breed lookup for flock male/female selections.';



COMMENT ON COLUMN "public"."breeds"."code" IS 'Stable application code for the breed option.';



COMMENT ON COLUMN "public"."breeds"."breed_name" IS 'Human-readable breed family or line name.';



COMMENT ON COLUMN "public"."breeds"."sex" IS 'Optional sex-specific variant for the breed option.';



CREATE TABLE IF NOT EXISTS "public"."core_users" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."core_users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."core_users_ui" AS
 SELECT "cu"."id" AS "user_id",
    "u"."email",
    ("u"."raw_user_meta_data" ->> 'display_name'::"text") AS "display_name"
   FROM ("public"."core_users" "cu"
     LEFT JOIN "auth"."users" "u" ON (("u"."id" = "cu"."id")));


ALTER VIEW "public"."core_users_ui" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_age_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_label" "text" NOT NULL,
    "min_age_days" integer,
    "max_age_days" integer,
    "display_order" integer DEFAULT 1,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_age_tasks_age_range_chk" CHECK ((("min_age_days" IS NULL) OR ("max_age_days" IS NULL) OR ("min_age_days" <= "max_age_days")))
);


ALTER TABLE "public"."daily_age_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_age_tasks" IS 'Age-based task definitions for the mobile placement-day daily log reminder block.';



COMMENT ON COLUMN "public"."daily_age_tasks"."task_label" IS 'Worker-facing task text shown in the 4 reminder slots.';



COMMENT ON COLUMN "public"."daily_age_tasks"."min_age_days" IS 'Inclusive lower bound for placement age in days. Null means no lower bound.';



COMMENT ON COLUMN "public"."daily_age_tasks"."max_age_days" IS 'Inclusive upper bound for placement age in days. Null means no upper bound.';



COMMENT ON COLUMN "public"."daily_age_tasks"."display_order" IS 'Lower values appear first in the mobile reminder list.';



CREATE TABLE IF NOT EXISTS "public"."document_archives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_role" "text" NOT NULL,
    "placement_id" "uuid",
    "feed_ticket_id" "uuid",
    "livehaul_schedule_id" "uuid",
    "livehaul_load_id" "uuid",
    "placement_closeout_id" "uuid",
    "storage_bucket" "text" DEFAULT 'flocktrax-document-archive'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text",
    "byte_size" bigint,
    "sha256" "text",
    "source_kind" "text" DEFAULT 'manual_upload'::"text" NOT NULL,
    "captured_at" timestamp with time zone,
    "notes" "text",
    "is_current" boolean DEFAULT true NOT NULL,
    "replaced_at" timestamp with time zone,
    "replaced_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "document_archives_byte_size_check" CHECK ((("byte_size" IS NULL) OR ("byte_size" >= 0))),
    CONSTRAINT "document_archives_document_role_check" CHECK (("document_role" = ANY (ARRAY['hatch_ticket'::"text", 'feed_ticket_original'::"text", 'bill_of_lading'::"text", 'scale_ticket'::"text", 'closeout_sheet_snapshot'::"text", 'misc_document'::"text"]))),
    CONSTRAINT "document_archives_parent_reference_check" CHECK (("num_nonnulls"("placement_id", "feed_ticket_id", "livehaul_schedule_id", "livehaul_load_id", "placement_closeout_id") = 1)),
    CONSTRAINT "document_archives_source_kind_check" CHECK (("source_kind" = ANY (ARRAY['scanner_pdf'::"text", 'mobile_camera'::"text", 'manual_upload'::"text", 'sheet_export'::"text", 'backfill_import'::"text"])))
);


ALTER TABLE "public"."document_archives" OWNER TO "postgres";


COMMENT ON TABLE "public"."document_archives" IS 'Immutable audit-document archive metadata for FlockTrax records. Originals live in private Supabase Storage and are reopened from linked records.';



COMMENT ON COLUMN "public"."document_archives"."document_role" IS 'Business role of the archived document such as hatch_ticket, feed_ticket_original, bill_of_lading, scale_ticket, or closeout_sheet_snapshot.';



COMMENT ON COLUMN "public"."document_archives"."source_kind" IS 'Acquisition path for the original document such as scanner_pdf, mobile_camera, manual_upload, sheet_export, or backfill_import.';



COMMENT ON COLUMN "public"."document_archives"."is_current" IS 'True when this row is the latest active archive version for its linked record and role.';



CREATE TABLE IF NOT EXISTS "public"."farm_group_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "farm_group_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."farm_group_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."farm_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_name" "text" NOT NULL,
    "group_contact_name" "text",
    "contact_title" "text",
    "addr1" "text",
    "addr2" "text",
    "city" "text",
    "st" "text",
    "zip" "text",
    "phone" "text",
    "fed_taxid" "text",
    "state_taxid" "text",
    "ag_taxexemptid" "text",
    "comments" "text",
    "created_on" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "updated_on" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "name" "text"
);


ALTER TABLE "public"."farm_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."farm_group_memberships_ui" AS
 SELECT "fgm"."id",
    "fgm"."user_id",
    "u"."email",
    "au"."display_name",
    "fgm"."farm_group_id",
    "fg"."group_name" AS "farm_group_name",
    "fgm"."role_id",
    "r"."code" AS "role_code",
    "r"."description" AS "role_description",
    "fgm"."active",
    "fgm"."created_at"
   FROM (((("public"."farm_group_memberships" "fgm"
     LEFT JOIN "auth"."users" "u" ON (("u"."id" = "fgm"."user_id")))
     LEFT JOIN "public"."app_users" "au" ON (("au"."user_id" = "fgm"."user_id")))
     LEFT JOIN "public"."farm_groups" "fg" ON (("fg"."id" = "fgm"."farm_group_id")))
     LEFT JOIN "public"."roles" "r" ON (("r"."id" = "fgm"."role_id")));


ALTER VIEW "public"."farm_group_memberships_ui" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."farm_memberships" (
    "user_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "role_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."farm_memberships" OWNER TO "postgres";


COMMENT ON TABLE "public"."farm_memberships" IS 'UI & Supabase Security Controls.  For a users to have any access to the UI mobile or tablet app for a farm, the user must first be a member of that farm.';



CREATE OR REPLACE VIEW "public"."farm_memberships_ui" AS
 SELECT "fm"."user_id",
    "u"."email",
    "au"."display_name",
    "fm"."farm_id",
    "f"."farm_name",
    "f"."farm_code",
    "f"."farm_group_id",
    "fg"."group_name" AS "farm_group_name",
    "fm"."role_id",
    "r"."code" AS "role_code",
    "r"."description" AS "role_description",
    "fm"."is_active",
    "fm"."created_at",
    "fm"."updated_at"
   FROM ((((("public"."farm_memberships" "fm"
     LEFT JOIN "auth"."users" "u" ON (("u"."id" = "fm"."user_id")))
     LEFT JOIN "public"."app_users" "au" ON (("au"."user_id" = "fm"."user_id")))
     LEFT JOIN "public"."farms" "f" ON (("f"."id" = "fm"."farm_id")))
     LEFT JOIN "public"."farm_groups" "fg" ON (("fg"."id" = "f"."farm_group_id")))
     LEFT JOIN "public"."roles" "r" ON (("r"."id" = "fm"."role_id")));


ALTER VIEW "public"."farm_memberships_ui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."farms_admin_ui" AS
 SELECT "f"."id",
    "f"."farm_code",
    "f"."farm_name",
    "f"."farm_group",
    "f"."addr",
    "f"."city",
    "f"."state",
    "f"."zip",
    "f"."is_active",
    "f"."created_at",
    "f"."updated_at",
    "f"."updated_by",
    "f"."created_by",
    "f"."map_url",
    "f"."farm_group_id",
    "f"."name",
    "cu_created"."email" AS "created_by_email",
    "cu_created"."display_name" AS "created_by_name",
    "cu_updated"."email" AS "updated_by_email",
    "cu_updated"."display_name" AS "updated_by_name"
   FROM (("public"."farms" "f"
     LEFT JOIN "public"."core_users_ui" "cu_created" ON (("cu_created"."user_id" = "f"."created_by")))
     LEFT JOIN "public"."core_users_ui" "cu_updated" ON (("cu_updated"."user_id" = "f"."updated_by")));


ALTER VIEW "public"."farms_admin_ui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."farms_ui" AS
 SELECT "f"."id",
    "f"."farm_name",
    "f"."farm_code",
    "f"."addr",
    "f"."city",
    "f"."state",
    "f"."zip",
    "f"."is_active",
    "f"."created_at",
    "f"."updated_at",
    "f"."created_by",
    "f"."updated_by",
    "f"."map_url",
    "f"."farm_group_id",
    "fg"."group_name" AS "farm_group_name"
   FROM ("public"."farms" "f"
     LEFT JOIN "public"."farm_groups" "fg" ON (("fg"."id" = "f"."farm_group_id")));


ALTER VIEW "public"."farms_ui" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feed_drops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feed_ticket_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "ticket_num" "text" DEFAULT ''::"text",
    "bin_code" "text",
    "placement_code" "text",
    "type" character varying DEFAULT ''::character varying,
    "drop_weight" numeric,
    "comment" "text" DEFAULT ''::"text",
    "farm_id" "uuid",
    "barn_id" "uuid",
    "feed_bin_id" "uuid",
    "placement_id" "uuid",
    "drop_order" integer DEFAULT 1 NOT NULL,
    "off_farm_redirect" boolean DEFAULT false NOT NULL,
    "queued_from_feed_bin_id" "uuid",
    "queued_from_bin_code" "text",
    "queued_from_barn_id" "uuid",
    "queued_from_barn_code" "text",
    "queued_from_placement_id" "uuid",
    "queued_from_placement_code" "text",
    "queued_at" timestamp with time zone,
    "queued_for_reconciliation" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."feed_drops" OWNER TO "postgres";


COMMENT ON TABLE "public"."feed_drops" IS 'Linked to a single feed_ticket, these multiple feed_drop records describe the type, location & allocation of the feed declared in each feed_ticket';



COMMENT ON COLUMN "public"."feed_drops"."off_farm_redirect" IS 'Marks a feed drop as an emergency off-farm redirect that should not allocate to an internal bin or flock.';



COMMENT ON COLUMN "public"."feed_drops"."queued_from_feed_bin_id" IS 'Original feed bin assignment captured when a drop is queued for reconciliation.';



COMMENT ON COLUMN "public"."feed_drops"."queued_from_bin_code" IS 'Original feed bin code captured when a drop is queued for reconciliation.';



COMMENT ON COLUMN "public"."feed_drops"."queued_from_barn_id" IS 'Original barn assignment captured when a drop is queued for reconciliation.';



COMMENT ON COLUMN "public"."feed_drops"."queued_from_barn_code" IS 'Original barn code captured when a drop is queued for reconciliation.';



COMMENT ON COLUMN "public"."feed_drops"."queued_from_placement_id" IS 'Original placement assignment captured when a drop is queued for reconciliation.';



COMMENT ON COLUMN "public"."feed_drops"."queued_from_placement_code" IS 'Original placement code captured when a drop is queued for reconciliation.';



COMMENT ON COLUMN "public"."feed_drops"."queued_at" IS 'Timestamp when a drop was placed in the reconciliation queue.';



COMMENT ON COLUMN "public"."feed_drops"."queued_for_reconciliation" IS 'True when a drop remains on its feed ticket for balancing but is temporarily removed from flock/bin assignment until reconciliation is complete.';



CREATE TABLE IF NOT EXISTS "public"."feed_inventory_snapshots" (
    "snapshot_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "farm_id" "uuid",
    "barn_id" "uuid",
    "feed_bin_id" "uuid",
    "placement_id" "uuid",
    "source" "text" DEFAULT 'binsentry'::"text" NOT NULL,
    "captured_at" timestamp with time zone NOT NULL,
    "inventory_lbs" numeric(12,2) NOT NULL,
    "feed_name" "text",
    "raw_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "accessible_feed_type" "text",
    "queued_feed_type" "text",
    CONSTRAINT "feed_inventory_snapshots_accessible_feed_type_check" CHECK ((("accessible_feed_type" IS NULL) OR ("lower"("accessible_feed_type") = ANY (ARRAY['starter'::"text", 'grower'::"text"])))),
    CONSTRAINT "feed_inventory_snapshots_inventory_lbs_check" CHECK (("inventory_lbs" >= (0)::numeric)),
    CONSTRAINT "feed_inventory_snapshots_queued_feed_type_check" CHECK ((("queued_feed_type" IS NULL) OR ("lower"("queued_feed_type") = ANY (ARRAY['starter'::"text", 'grower'::"text"]))))
);


ALTER TABLE "public"."feed_inventory_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."feed_inventory_snapshots" IS 'Latest-known feed inventory observations used to calculate net feed ordering position. Intended to ingest BinSentry or manual inventory snapshots at the barn/bin layer.';



COMMENT ON COLUMN "public"."feed_inventory_snapshots"."source" IS 'Origin of the inventory observation, such as binsentry or manual.';



COMMENT ON COLUMN "public"."feed_inventory_snapshots"."inventory_lbs" IS 'Observed pounds on hand for the captured barn/bin at the time of the snapshot.';



COMMENT ON COLUMN "public"."feed_inventory_snapshots"."accessible_feed_type" IS 'Accessible feed layer interpretation at snapshot time, when known.';



COMMENT ON COLUMN "public"."feed_inventory_snapshots"."queued_feed_type" IS 'Queued feed layer interpretation at snapshot time, when known.';



CREATE TABLE IF NOT EXISTS "public"."feed_order_commitments" (
    "commitment_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "farm_id" "uuid",
    "barn_id" "uuid",
    "feed_bin_id" "uuid",
    "placement_id" "uuid",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "expected_delivery_date" "date",
    "ordered_lbs" numeric(12,2) NOT NULL,
    "received_lbs" numeric(12,2) DEFAULT 0 NOT NULL,
    "feed_name" "text",
    "external_order_ref" "text",
    "received_ticket_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "text",
    "feed_type" "text",
    "unassigned_from_placement_id" "uuid",
    CONSTRAINT "feed_order_commitments_feed_type_check" CHECK ((("feed_type" IS NULL) OR ("lower"("feed_type") = ANY (ARRAY['starter'::"text", 'grower'::"text"])))),
    CONSTRAINT "feed_order_commitments_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'partial'::"text", 'received'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "feed_order_commitments_weight_check" CHECK ((("ordered_lbs" >= (0)::numeric) AND ("received_lbs" >= (0)::numeric) AND ("received_lbs" <= "ordered_lbs")))
);


ALTER TABLE "public"."feed_order_commitments" OWNER TO "postgres";


COMMENT ON TABLE "public"."feed_order_commitments" IS 'Open or received feed orders used to calculate on-order feed that has been committed but not yet reflected in delivered ticket history.';



COMMENT ON COLUMN "public"."feed_order_commitments"."status" IS 'Order lifecycle state: open, partial, received, or cancelled.';



COMMENT ON COLUMN "public"."feed_order_commitments"."received_lbs" IS 'Delivered pounds already received against the order; remaining pounds stay in the net ordering calculation.';



COMMENT ON COLUMN "public"."feed_order_commitments"."feed_type" IS 'Feed type committed by the order. Expected values: starter or grower.';



COMMENT ON COLUMN "public"."feed_order_commitments"."unassigned_from_placement_id" IS 'Original placement retained for audit when an order stays with its physical barn while the flock is unassigned.';



CREATE TABLE IF NOT EXISTS "public"."feed_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "ticket_num" "text" DEFAULT ''::"text",
    "feedmill" "text" DEFAULT ''::"text",
    "delivery_date" "date",
    "comment" "text" DEFAULT ''::"text",
    "feed_weight" numeric,
    "feed_name" "text",
    "source_type" "text" DEFAULT 'mill'::"text" NOT NULL,
    "ticket_type" "text" DEFAULT 'Reg'::"text" NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "feed_tickets_ticket_type_check" CHECK (("ticket_type" = ANY (ARRAY['Reg'::"text", 'xTran'::"text", 'iTran'::"text", 'f2f'::"text"])))
);


ALTER TABLE "public"."feed_tickets" OWNER TO "postgres";


COMMENT ON TABLE "public"."feed_tickets" IS 'Feed Tickets represent a single delivery load of chicken feed.  These tickets are parent objects to feed_drops that complete the  feed receiving process';



CREATE TABLE IF NOT EXISTS "public"."feedbins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "farm_id" "uuid",
    "barn_id" "uuid",
    "bin_num" smallint,
    "capacity" integer,
    "binsentry_bin_ref" "text",
    "binsentry_last_sync_at" timestamp with time zone,
    "binsentry_last_inventory_lbs" numeric(12,2),
    "binsentry_sync_note" "text",
    "accessible_feed_type" "text",
    "accessible_feed_lbs" numeric(12,2),
    "queued_feed_type" "text",
    "queued_feed_lbs" numeric(12,2),
    "feed_state_effective_at" timestamp with time zone,
    "feed_state_source" "text",
    CONSTRAINT "feedbins_feed_layer_lbs_check" CHECK (((COALESCE("accessible_feed_lbs", (0)::numeric) >= (0)::numeric) AND (COALESCE("queued_feed_lbs", (0)::numeric) >= (0)::numeric))),
    CONSTRAINT "feedbins_feed_layer_queued_type_check" CHECK ((("queued_feed_type" IS NULL) OR ("lower"("queued_feed_type") = ANY (ARRAY['starter'::"text", 'grower'::"text"])))),
    CONSTRAINT "feedbins_feed_layer_type_check" CHECK ((("accessible_feed_type" IS NULL) OR ("lower"("accessible_feed_type") = ANY (ARRAY['starter'::"text", 'grower'::"text"]))))
);


ALTER TABLE "public"."feedbins" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedbins" IS 'Feedbins for feed drops';



COMMENT ON COLUMN "public"."feedbins"."binsentry_bin_ref" IS 'External BinSentry bin identifier or entity reference used to retrieve live feed inventory for this bin.';



COMMENT ON COLUMN "public"."feedbins"."binsentry_last_sync_at" IS 'Timestamp of the most recent successful or attempted BinSentry sync for this feed bin.';



COMMENT ON COLUMN "public"."feedbins"."binsentry_last_inventory_lbs" IS 'Most recent pounds-on-hand value pulled from BinSentry for this feed bin.';



COMMENT ON COLUMN "public"."feedbins"."binsentry_sync_note" IS 'Last BinSentry sync status note for this feed bin.';



COMMENT ON COLUMN "public"."feedbins"."accessible_feed_type" IS 'Feed type currently reachable by birds in this bin. Expected values: starter or grower.';



COMMENT ON COLUMN "public"."feedbins"."accessible_feed_lbs" IS 'Pounds currently believed to be reachable in the accessible feed layer.';



COMMENT ON COLUMN "public"."feedbins"."queued_feed_type" IS 'Next feed type stacked above the accessible layer, if known.';



COMMENT ON COLUMN "public"."feedbins"."queued_feed_lbs" IS 'Pounds currently believed to exist in the queued upper layer.';



COMMENT ON COLUMN "public"."feedbins"."feed_state_effective_at" IS 'Timestamp when the current layered feed interpretation became effective.';



COMMENT ON COLUMN "public"."feedbins"."feed_state_source" IS 'How the current layered feed interpretation was assigned, such as manual or ticket_inferred.';



CREATE OR REPLACE VIEW "public"."feedbins_updatable" AS
 SELECT "fb"."id",
    "fb"."created_at",
    "fb"."farm_id",
    "fb"."barn_id",
    "fb"."bin_num",
    "fb"."capacity",
    "f"."farm_name",
    "f"."farm_code",
    "b"."barn_code",
    "b"."sort_code"
   FROM (("public"."feedbins" "fb"
     LEFT JOIN "public"."farms" "f" ON (("f"."id" = "fb"."farm_id")))
     LEFT JOIN "public"."barns" "b" ON (("b"."id" = "fb"."barn_id")));


ALTER VIEW "public"."feedbins_updatable" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issue_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "severity_default" "text",
    "report_group" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "issue_types_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['barn'::"text", 'placement'::"text"])))
);


ALTER TABLE "public"."issue_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."issue_types" IS 'Configurable open-item type definitions for barn and placement operational tracking.';



CREATE TABLE IF NOT EXISTS "public"."issue_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "entry_type" "text" NOT NULL,
    "entry_text" "text" NOT NULL,
    "effective_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "issue_updates_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['opened'::"text", 'note'::"text", 'progress'::"text", 'parts_ordered'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."issue_updates" OWNER TO "postgres";


COMMENT ON TABLE "public"."issue_updates" IS 'Threaded progress and resolution log for open items.';



CREATE TABLE IF NOT EXISTS "public"."issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "issue_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "related_placement_id" "uuid",
    "reported_log_date" "date",
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "opened_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "issues_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['barn'::"text", 'placement'::"text"]))),
    CONSTRAINT "issues_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."issues" OWNER TO "postgres";


COMMENT ON TABLE "public"."issues" IS 'Forward-only operational issue tracker for barns and live placements.';



COMMENT ON COLUMN "public"."issues"."entity_type" IS 'Owning record type. Barn issues persist on barns; flock-cycle issues persist on placements.';



COMMENT ON COLUMN "public"."issues"."related_placement_id" IS 'Optional placement context when a barn issue is created from within a live placement workflow.';



COMMENT ON COLUMN "public"."issues"."reported_log_date" IS 'Placement log date active in the mobile workflow when the issue was reported.';



COMMENT ON COLUMN "public"."issues"."updated_by" IS 'User who created the most recent immutable memo linked to the Action Item.';



CREATE TABLE IF NOT EXISTS "public"."livehaul_loads" (
    "load_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "livehaul_id" "uuid" NOT NULL,
    "truck_num" "text",
    "trailer_num" "text",
    "scale_location" "text",
    "scale_empty" numeric(12,2),
    "scale_loaded" numeric(12,2),
    "live_weight" numeric(12,2),
    "head_count" integer,
    "doa_count" integer,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "text",
    CONSTRAINT "livehaul_loads_doa_count_check" CHECK ((("doa_count" IS NULL) OR ("doa_count" >= 0))),
    CONSTRAINT "livehaul_loads_head_count_check" CHECK ((("head_count" IS NULL) OR ("head_count" >= 0)))
);


ALTER TABLE "public"."livehaul_loads" OWNER TO "postgres";


COMMENT ON TABLE "public"."livehaul_loads" IS 'Truck/load-level livehaul execution rows recorded under a livehaul schedule event.';



COMMENT ON COLUMN "public"."livehaul_loads"."scale_empty" IS 'Empty scale weight for the truck/trailer when captured.';



COMMENT ON COLUMN "public"."livehaul_loads"."scale_loaded" IS 'Loaded scale weight for the truck/trailer when captured.';



COMMENT ON COLUMN "public"."livehaul_loads"."live_weight" IS 'Net live bird weight for this load when captured.';



CREATE TABLE IF NOT EXISTS "public"."livehaul_schedule" (
    "livehaul_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "placement_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "barn_id" "uuid" NOT NULL,
    "lh_date" "date" NOT NULL,
    "sequence_num" integer,
    "actual_date" "date",
    "actual_at" timestamp with time zone,
    "head_target" integer,
    "head_actual" integer,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "text",
    "target_sex" "text",
    CONSTRAINT "livehaul_schedule_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'cancelled'::"text", 'legacy_migrated'::"text"]))),
    CONSTRAINT "livehaul_schedule_target_sex_check" CHECK ((("target_sex" IS NULL) OR ("target_sex" = ANY (ARRAY['male'::"text", 'female'::"text"]))))
);


ALTER TABLE "public"."livehaul_schedule" OWNER TO "postgres";


COMMENT ON TABLE "public"."livehaul_schedule" IS 'Placement-level livehaul schedule rows. Each row represents one planned or completed livehaul event for a flock placement.';



COMMENT ON COLUMN "public"."livehaul_schedule"."lh_date" IS 'Scheduled livehaul date for the placement event.';



COMMENT ON COLUMN "public"."livehaul_schedule"."sequence_num" IS 'Optional ordering number for the livehaul sequence on a placement.';



COMMENT ON COLUMN "public"."livehaul_schedule"."actual_date" IS 'Actual date the livehaul event occurred, when known.';



COMMENT ON COLUMN "public"."livehaul_schedule"."actual_at" IS 'Actual timestamp the livehaul event occurred, when known.';



COMMENT ON COLUMN "public"."livehaul_schedule"."head_target" IS 'Optional planned target head count for the scheduled livehaul.';



COMMENT ON COLUMN "public"."livehaul_schedule"."head_actual" IS 'Optional actual total head count hauled for the livehaul event once closeout values are known.';



COMMENT ON COLUMN "public"."livehaul_schedule"."status" IS 'Current schedule state such as scheduled, completed, cancelled, or legacy_migrated.';



COMMENT ON COLUMN "public"."livehaul_schedule"."target_sex" IS 'Optional sex target for the livehaul event so breed comparisons can be evaluated against the correct male or female standard.';



CREATE OR REPLACE VIEW "public"."log_mortality_readable" AS
 SELECT "lm"."id",
    "lm"."log_date",
    "lm"."placement_id",
    "p"."placement_key",
    "p"."farm_id",
    "f"."farm_name",
    "p"."barn_id",
    "b"."barn_code",
    "p"."flock_id",
    "fl"."flock_number",
    "lm"."dead_female",
    "lm"."dead_male",
    "lm"."cull_female",
    "lm"."cull_male",
    "lm"."cull_female_note",
    "lm"."cull_male_note",
    "lm"."dead_reason",
    "lm"."grade_litter",
    "lm"."grade_footpad",
    "lm"."grade_feathers",
    "lm"."grade_lame",
    "lm"."grade_pecking",
    "lm"."is_active",
    "lm"."created_at",
    "lm"."updated_at",
    "lm"."updated_by",
    "lm"."created_by",
    "lm"."version"
   FROM (((("public"."log_mortality" "lm"
     LEFT JOIN "public"."placements" "p" ON (("p"."id" = "lm"."placement_id")))
     LEFT JOIN "public"."farms" "f" ON (("f"."id" = "p"."farm_id")))
     LEFT JOIN "public"."barns" "b" ON (("b"."id" = "p"."barn_id")))
     LEFT JOIN "public"."flocks" "fl" ON (("fl"."id" = "p"."flock_id")));


ALTER VIEW "public"."log_mortality_readable" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."placement_day_ui" WITH ("security_invoker"='on') AS
 SELECT COALESCE("d"."placement_id", "m"."placement_id") AS "placement_id",
    "p"."placement_key" AS "placement_code",
    "p"."farm_id",
    "f"."farm_name",
    "p"."barn_id",
    "b"."barn_code",
    "p"."flock_id",
    "fl"."flock_number",
    "fl"."date_placed" AS "placed_date",
    (COALESCE("d"."log_date", "m"."log_date") - "fl"."date_placed") AS "placement_age_days",
    COALESCE("d"."log_date", "m"."log_date") AS "log_date",
    "d"."age_days",
    "d"."am_temp",
    "d"."set_temp",
    "d"."rel_humidity" AS "ambient_temp",
    "d"."min_vent",
    "d"."is_oda_open",
    "d"."oda_exception",
    "d"."naoh",
    "d"."comment",
    "d"."is_active" AS "daily_is_active",
    "m"."dead_female",
    "m"."dead_male",
    "m"."cull_female",
    "m"."cull_male",
    "m"."cull_female_note",
    "m"."cull_male_note",
    "m"."dead_reason",
    "m"."grade_litter",
    "m"."grade_footpad",
    "m"."grade_feathers",
    "m"."grade_lame",
    "m"."grade_pecking",
    "m"."is_active" AS "mortality_is_active",
    "p"."is_active" AS "placement_is_active",
    ("p"."date_removed" IS NOT NULL) AS "placement_is_removed"
   FROM ((((("public"."log_daily" "d"
     FULL JOIN "public"."log_mortality" "m" ON ((("m"."placement_id" = "d"."placement_id") AND ("m"."log_date" = "d"."log_date"))))
     JOIN "public"."placements" "p" ON (("p"."id" = COALESCE("d"."placement_id", "m"."placement_id"))))
     JOIN "public"."farms" "f" ON (("f"."id" = "p"."farm_id")))
     JOIN "public"."barns" "b" ON (("b"."id" = "p"."barn_id")))
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "p"."flock_id")));


ALTER VIEW "public"."placement_day_ui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."placement_log_daily_ui" AS
 SELECT "p"."id" AS "placement_id",
    "f"."date_placed",
    (("f"."date_placed" + '38 days'::interval))::"date" AS "first_catch",
    "p"."lh1_date",
    "p"."lh2_date",
    "p"."lh3_date",
    "p"."date_removed",
    "p"."active_start",
    "p"."active_end"
   FROM ("public"."placements" "p"
     JOIN "public"."flocks" "f" ON (("f"."id" = "p"."flock_id")));


ALTER VIEW "public"."placement_log_daily_ui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."placement_log_daily_ui2" AS
 SELECT "p"."id" AS "placement_id",
    "f"."date_placed",
    (("f"."date_placed" + '38 days'::interval))::"date" AS "first_catch",
    "p"."lh1_date",
    "p"."lh2_date",
    "p"."lh3_date",
    "p"."date_removed",
    "p"."active_start",
    "p"."active_end"
   FROM ("public"."placements" "p"
     JOIN "public"."flocks" "f" ON (("f"."id" = "p"."flock_id")));


ALTER VIEW "public"."placement_log_daily_ui2" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."placements_dashboard_ui" WITH ("security_invoker"='on') AS
 SELECT "p"."id" AS "placement_id",
    "p"."farm_id",
    "f"."farm_name",
    "p"."barn_id",
    "b"."barn_code",
    "p"."flock_id",
    "p"."placement_key" AS "placement_code",
    "fl"."date_placed" AS "placed_date",
    (("fl"."date_placed" + '38 days'::interval))::"date" AS "est_first_catch",
    ("ceil"((EXTRACT(epoch FROM ("now"() - ("fl"."date_placed")::timestamp with time zone)) / 86400.0)))::integer AS "age_days",
    (COALESCE("fl"."start_cnt_females", 0) + COALESCE("fl"."start_cnt_males", 0)) AS "head_count",
    "p"."is_active",
    ("p"."date_removed" IS NOT NULL) AS "is_removed",
    "fl"."is_complete",
    "fl"."is_in_barn",
    "fl"."is_settled",
    "b"."sort_code",
    "p"."created_at",
    "p"."updated_at"
   FROM ((("public"."placements" "p"
     JOIN "public"."farms" "f" ON (("f"."id" = "p"."farm_id")))
     JOIN "public"."barns" "b" ON (("b"."id" = "p"."barn_id")))
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "p"."flock_id")));


ALTER VIEW "public"."placements_dashboard_ui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."placements_ui" AS
 SELECT "p"."id",
    "p"."farm_id",
    "p"."barn_id",
    "p"."flock_id",
    "p"."lh1_date",
    "p"."lh2_date",
    "p"."lh3_date",
    "p"."date_removed",
    "p"."active_start",
    "p"."active_end",
    "p"."is_active",
    "p"."placement_key",
    "p"."created_at",
    "p"."updated_at"
   FROM "public"."placements" "p";


ALTER VIEW "public"."placements_ui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."placements_ui2" AS
 SELECT "p"."id",
    "p"."farm_id",
    "p"."barn_id",
    "p"."flock_id",
    "p"."date_removed",
    "p"."is_active",
    "p"."placement_key",
    "p"."created_at",
    "p"."updated_at",
    "p"."updated_by",
    "p"."created_by",
    "p"."lh1_date",
    "p"."lh2_date",
    "p"."lh3_date",
    "p"."active_start",
    "p"."active_end",
    "p"."version",
    "f"."date_placed",
    (("f"."date_placed" + '38 days'::interval))::"date" AS "first_catch",
    "fa"."farm_name",
    "b"."sort_code"
   FROM ((("public"."placements" "p"
     JOIN "public"."flocks" "f" ON (("f"."id" = "p"."flock_id")))
     JOIN "public"."farms" "fa" ON (("fa"."id" = "p"."farm_id")))
     JOIN "public"."barns" "b" ON (("b"."id" = "p"."barn_id")))
  ORDER BY "b"."sort_code";


ALTER VIEW "public"."placements_ui2" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "resource" "text" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles_actions_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "action_id" "uuid" NOT NULL,
    "menu_access" boolean DEFAULT false NOT NULL,
    "createyn" boolean DEFAULT false NOT NULL,
    "readyn" boolean DEFAULT false NOT NULL,
    "updateyn" boolean DEFAULT false NOT NULL,
    "deleteyn" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles_actions_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signup_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "max_uses" integer,
    "uses" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."signup_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stdbreedspec" (
    "id" integer NOT NULL,
    "geneticname" "text",
    "breedid" "text",
    "age" integer,
    "dayfeedperbird" numeric,
    "targetweight" numeric,
    "note" "text",
    "last_userid" "text",
    "created_date" timestamp with time zone,
    "last_updated" timestamp with time zone,
    "is_active" boolean
);


ALTER TABLE "public"."stdbreedspec" OWNER TO "postgres";


COMMENT ON TABLE "public"."stdbreedspec" IS 'Normalized broad spectrum breeder specs to compare collected flock performance';



CREATE SEQUENCE IF NOT EXISTS "public"."stdbreedspec_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."stdbreedspec_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stdbreedspec_id_seq" OWNED BY "public"."stdbreedspec"."id";



CREATE TABLE IF NOT EXISTS "public"."sync_control-index" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "barnid" integer NOT NULL,
    "flockid" integer NOT NULL,
    "idxfarm" integer NOT NULL
);


ALTER TABLE "public"."sync_control-index" OWNER TO "postgres";


COMMENT ON TABLE "public"."sync_control-index" IS 'Identifies the flock currently being sync''d for a barn being updated.';



ALTER TABLE "public"."sync_control-index" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sync_control-index_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."sysactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action" "text" DEFAULT ''::"text"
);


ALTER TABLE "public"."sysactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sysactions" IS 'functional elements of FlockTrax';



CREATE TABLE IF NOT EXISTS "public"."todos" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tasks" "text"
);


ALTER TABLE "public"."todos" OWNER TO "postgres";


COMMENT ON TABLE "public"."todos" IS 'API Tasks';



ALTER TABLE "public"."todos" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."todos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'UI & Supabase Permission Classifications';



COMMENT ON COLUMN "public"."user_roles"."role" IS 'Legacy role code retained temporarily for compatibility; role_id is authoritative.';



COMMENT ON COLUMN "public"."user_roles"."role_id" IS 'Normalized foreign key to public.roles.id';



CREATE OR REPLACE VIEW "public"."v_livehaul_edit_lookup" AS
 SELECT "lhs"."livehaul_id",
    "lhs"."lh_date",
    "lhs"."sequence_num",
    "lhs"."status",
    "farm"."farm_name",
    "barn"."barn_code",
    "f"."flock_number",
    "p"."placement_key",
    "lhs"."placement_id",
    "lhs"."flock_id",
    "lhs"."farm_id",
    "lhs"."barn_id"
   FROM (((("public"."livehaul_schedule" "lhs"
     JOIN "public"."placements" "p" ON (("p"."id" = "lhs"."placement_id")))
     JOIN "public"."flocks" "f" ON (("f"."id" = "lhs"."flock_id")))
     JOIN "public"."farms" "farm" ON (("farm"."id" = "lhs"."farm_id")))
     JOIN "public"."barns" "barn" ON (("barn"."id" = "lhs"."barn_id")));


ALTER VIEW "public"."v_livehaul_edit_lookup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_livehaul_schedule_lookup" AS
 SELECT "lhs"."livehaul_id",
    "lhs"."placement_id",
    "lhs"."flock_id",
    "lhs"."farm_id",
    "lhs"."barn_id",
    "lhs"."lh_date",
    "lhs"."sequence_num",
    "lhs"."actual_date",
    "lhs"."actual_at",
    "lhs"."head_target",
    "lhs"."head_actual",
    "lhs"."status",
    "lhs"."comment",
    "p"."placement_key",
    "f"."flock_number",
    "farm"."farm_name",
    "barn"."barn_code",
    COALESCE("load_summary"."load_count", (0)::bigint) AS "load_count",
    COALESCE("load_summary"."head_count_total", (0)::bigint) AS "load_head_count_total",
    COALESCE("load_summary"."doa_count_total", (0)::bigint) AS "load_doa_count_total"
   FROM ((((("public"."livehaul_schedule" "lhs"
     JOIN "public"."placements" "p" ON (("p"."id" = "lhs"."placement_id")))
     JOIN "public"."flocks" "f" ON (("f"."id" = "lhs"."flock_id")))
     JOIN "public"."farms" "farm" ON (("farm"."id" = "lhs"."farm_id")))
     JOIN "public"."barns" "barn" ON (("barn"."id" = "lhs"."barn_id")))
     LEFT JOIN ( SELECT "ll"."livehaul_id",
            "count"(*) AS "load_count",
            COALESCE("sum"("ll"."head_count"), (0)::bigint) AS "head_count_total",
            COALESCE("sum"("ll"."doa_count"), (0)::bigint) AS "doa_count_total"
           FROM "public"."livehaul_loads" "ll"
          GROUP BY "ll"."livehaul_id") "load_summary" ON (("load_summary"."livehaul_id" = "lhs"."livehaul_id")));


ALTER VIEW "public"."v_livehaul_schedule_lookup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_placement" AS
 SELECT "p"."id",
    "p"."farm_id",
    "p"."barn_id",
    "p"."flock_id",
    "p"."lh1_date",
    "p"."lh2_date",
    "p"."lh3_date",
    "p"."date_removed"
   FROM "public"."placements" "p";


ALTER VIEW "public"."v_placement" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_placement_daily" AS
 SELECT "d"."id",
    "d"."placement_id",
    "d"."log_date",
    "d"."age_days",
    "d"."am_temp",
    "d"."set_temp",
    "d"."rel_humidity" AS "ambient_temp",
    "d"."min_vent",
    "d"."is_oda_open",
    "d"."oda_exception",
    "d"."naoh",
    "d"."comment",
    "d"."is_active",
    "d"."created_at",
    "d"."updated_at",
    "d"."updated_by",
    "d"."created_by"
   FROM "public"."log_daily" "d";


ALTER VIEW "public"."v_placement_daily" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_placement_day" AS
 SELECT "d"."id" AS "id_daily",
    "m"."id" AS "id_mort",
    "d"."placement_id",
    "d"."log_date",
    "d"."age_days",
    "d"."am_temp",
    "d"."set_temp",
    "d"."rel_humidity" AS "ambient_temp",
    "d"."min_vent",
    "d"."is_oda_open",
    "d"."oda_exception",
    "d"."naoh",
    "d"."comment",
    "d"."is_active" AS "is_active_daily",
    "d"."created_at" AS "created_at_daily",
    "d"."updated_at" AS "updated_at_daily",
    "d"."updated_by" AS "updated_by_daily",
    "d"."created_by" AS "created_by_daily",
    "m"."dead_female",
    "m"."dead_male",
    "m"."cull_female",
    "m"."cull_male",
    "m"."cull_female_note",
    "m"."cull_male_note",
    "m"."dead_reason",
    "m"."grade_litter",
    "m"."grade_footpad",
    "m"."grade_feathers",
    "m"."grade_lame",
    "m"."grade_pecking",
    "m"."is_active" AS "is_active_mort",
    "m"."created_at" AS "created_at_mort",
    "m"."updated_at" AS "updated_at_mort",
    "m"."updated_by" AS "updated_by_mort",
    "m"."created_by" AS "created_by_mort"
   FROM ("public"."log_daily" "d"
     LEFT JOIN "public"."log_mortality" "m" ON ((("m"."placement_id" = "d"."placement_id") AND ("m"."log_date" = "d"."log_date"))));


ALTER VIEW "public"."v_placement_day" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_records_with_creator" AS
 SELECT "s"."source_table",
    "s"."record_id",
    "s"."created_by",
    "s"."created_at",
    "u"."display_name" AS "created_by_name",
    "u"."email" AS "created_by_email",
    "u"."source" AS "created_by_source"
   FROM (( SELECT 'public.issues'::"text" AS "source_table",
            "i"."id" AS "record_id",
            "i"."opened_by" AS "created_by",
            "i"."opened_at" AS "created_at"
           FROM "public"."issues" "i"
        UNION ALL
         SELECT 'public.issue_updates'::"text" AS "source_table",
            "iu"."id" AS "record_id",
            "iu"."created_by",
            "iu"."created_at"
           FROM "public"."issue_updates" "iu"
        UNION ALL
         SELECT 'public.log_daily'::"text" AS "source_table",
            "ld"."id" AS "record_id",
            "ld"."created_by",
            "ld"."created_at"
           FROM "public"."log_daily" "ld"
        UNION ALL
         SELECT 'public.log_mortality'::"text" AS "source_table",
            "lm"."id" AS "record_id",
            "lm"."created_by",
            "lm"."created_at"
           FROM "public"."log_mortality" "lm"
        UNION ALL
         SELECT 'public.feed_tickets'::"text" AS "source_table",
            "ft"."id" AS "record_id",
            "ft"."created_by",
            "ft"."created_at"
           FROM "public"."feed_tickets" "ft"
        UNION ALL
         SELECT 'public.feed_drops'::"text" AS "source_table",
            "fd"."id" AS "record_id",
            "fd"."created_by",
            "fd"."created_at"
           FROM "public"."feed_drops" "fd"
        UNION ALL
         SELECT 'platform.sync_outbox'::"text" AS "source_table",
            "so"."id" AS "record_id",
            "so"."created_by",
            "so"."created_at"
           FROM "platform"."sync_outbox" "so") "s"
     LEFT JOIN LATERAL "public"."resolve_user"("s"."created_by") "u"("user_id", "display_name", "email", "source") ON (true));


ALTER VIEW "public"."v_records_with_creator" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_role_action_permissions" AS
 SELECT "rap"."id",
    "rap"."role_id",
    "r"."code" AS "role_code",
    "rap"."action_id",
    "sa"."action" AS "action_name",
    "rap"."menu_access",
    "rap"."createyn",
    "rap"."readyn",
    "rap"."updateyn",
    "rap"."deleteyn",
    "rap"."created_at"
   FROM (("public"."roles_actions_permissions" "rap"
     LEFT JOIN "public"."roles" "r" ON (("r"."id" = "rap"."role_id")))
     LEFT JOIN "public"."sysactions" "sa" ON (("sa"."id" = "rap"."action_id")));


ALTER VIEW "public"."v_role_action_permissions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_role_permissions" AS
 SELECT "r"."id" AS "role_id",
    "r"."code" AS "role_code",
    "r"."description" AS "role_description",
    "rp"."id" AS "role_permission_id",
    "rp"."resource",
    "rp"."action",
    "rp"."created_at" AS "permission_created_at"
   FROM ("public"."roles" "r"
     LEFT JOIN "public"."role_permissions" "rp" ON (("rp"."role_id" = "r"."id")));


ALTER VIEW "public"."v_role_permissions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_user_role_permissions" AS
 SELECT "ur"."user_id",
    "p"."email" AS "user_email",
    "ur"."role" AS "assigned_role_code",
    "vrp"."role_id",
    "vrp"."role_description",
    "vrp"."role_permission_id",
    "vrp"."resource",
    "vrp"."action",
    "ur"."created_at" AS "role_assigned_at"
   FROM (("public"."user_roles" "ur"
     LEFT JOIN "public"."v_role_permissions" "vrp" ON (("vrp"."role_code" = "ur"."role")))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "ur"."user_id")));


ALTER VIEW "public"."v_user_role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "tuning"."findings" (
    "id" bigint NOT NULL,
    "run_id" bigint NOT NULL,
    "finding_type" "text" NOT NULL,
    "schema_name" "text",
    "table_name" "text",
    "object_name" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "tuning"."findings" OWNER TO "postgres";


ALTER TABLE "tuning"."findings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "tuning"."findings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "tuning"."metrics" (
    "run_id" bigint NOT NULL,
    "metric_name" "text" NOT NULL,
    "metric_value" numeric NOT NULL,
    "metric_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "tuning"."metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "tuning"."runs" (
    "id" bigint NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "label" "text",
    "created_by" "text" DEFAULT CURRENT_USER NOT NULL,
    "notes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "tuning"."runs" OWNER TO "postgres";


ALTER TABLE "tuning"."runs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "tuning"."runs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "gsync"."outbox" ALTER COLUMN "id" SET DEFAULT "nextval"('"gsync"."outbox_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."stdbreedspec" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stdbreedspec_id_seq"'::"regclass");



ALTER TABLE ONLY "gsync"."column_map"
    ADD CONSTRAINT "column_map_pkey" PRIMARY KEY ("map_id");



ALTER TABLE ONLY "gsync"."column_map"
    ADD CONSTRAINT "column_map_tab_id_dataset_key_key" UNIQUE ("tab_id", "dataset_key");



ALTER TABLE ONLY "gsync"."outbox"
    ADD CONSTRAINT "outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "gsync"."sheet"
    ADD CONSTRAINT "sheet_pkey" PRIMARY KEY ("sheet_id");



ALTER TABLE ONLY "gsync"."sync_job"
    ADD CONSTRAINT "sync_job_pkey" PRIMARY KEY ("job_id");



ALTER TABLE ONLY "gsync"."tab"
    ADD CONSTRAINT "tab_pkey" PRIMARY KEY ("tab_id");



ALTER TABLE ONLY "gsync"."tab"
    ADD CONSTRAINT "tab_sheet_id_tab_gid_key" UNIQUE ("sheet_id", "tab_gid");



ALTER TABLE ONLY "gsync"."tab"
    ADD CONSTRAINT "tab_sheet_id_tab_name_key" UNIQUE ("sheet_id", "tab_name");



ALTER TABLE ONLY "gsync"."trax2sheets_map"
    ADD CONSTRAINT "trax2sheets_map_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."control"
    ADD CONSTRAINT "control_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."license_policy"
    ADD CONSTRAINT "license_policy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."reportoptions"
    ADD CONSTRAINT "reportoptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."screen_txt"
    ADD CONSTRAINT "screen_txt_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."sync_adapters"
    ADD CONSTRAINT "sync_adapters_adapter_key_key" UNIQUE ("adapter_key");



ALTER TABLE ONLY "platform"."sync_adapters"
    ADD CONSTRAINT "sync_adapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."sync_audit"
    ADD CONSTRAINT "sync_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."sync_endpoints"
    ADD CONSTRAINT "sync_endpoints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."sync_googleapis_sheet_columns"
    ADD CONSTRAINT "sync_googleapis_sheet_columns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."sync_googleapis_sheets"
    ADD CONSTRAINT "sync_googleapis_sheets_pkey" PRIMARY KEY ("endpoint_id");



ALTER TABLE ONLY "platform"."sync_outbox"
    ADD CONSTRAINT "sync_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_adalo_user_id_key" UNIQUE ("adalo_user_id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE "public"."barns"
    ADD CONSTRAINT "barns_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."barns"
    ADD CONSTRAINT "barns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breeds"
    ADD CONSTRAINT "breeds_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."breeds"
    ADD CONSTRAINT "breeds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."core_users"
    ADD CONSTRAINT "core_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_age_tasks"
    ADD CONSTRAINT "daily_age_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_archives"
    ADD CONSTRAINT "document_archives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."farm_group_memberships"
    ADD CONSTRAINT "farm_group_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."farm_group_memberships"
    ADD CONSTRAINT "farm_group_memberships_user_id_farm_group_id_key" UNIQUE ("user_id", "farm_group_id");



ALTER TABLE ONLY "public"."farm_groups"
    ADD CONSTRAINT "farm_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."farm_memberships"
    ADD CONSTRAINT "farm_memberships_pkey" PRIMARY KEY ("user_id", "farm_id");



ALTER TABLE "public"."farms"
    ADD CONSTRAINT "farms_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."farms"
    ADD CONSTRAINT "farms_farm_code_key" UNIQUE ("farm_code");



ALTER TABLE ONLY "public"."farms"
    ADD CONSTRAINT "farms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_drops"
    ADD CONSTRAINT "feed_drops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_inventory_snapshots"
    ADD CONSTRAINT "feed_inventory_snapshots_pkey" PRIMARY KEY ("snapshot_id");



ALTER TABLE ONLY "public"."feed_order_commitments"
    ADD CONSTRAINT "feed_order_commitments_pkey" PRIMARY KEY ("commitment_id");



ALTER TABLE ONLY "public"."feed_tickets"
    ADD CONSTRAINT "feed_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedbins"
    ADD CONSTRAINT "feedbins_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."flocks"
    ADD CONSTRAINT "flocks_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_farm_id_flock_number_key" UNIQUE ("farm_id", "flock_number");



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issue_types"
    ADD CONSTRAINT "issue_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."issue_updates"
    ADD CONSTRAINT "issue_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."livehaul_loads"
    ADD CONSTRAINT "livehaul_loads_pkey" PRIMARY KEY ("load_id");



ALTER TABLE ONLY "public"."livehaul_schedule"
    ADD CONSTRAINT "livehaul_schedule_pkey" PRIMARY KEY ("livehaul_id");



ALTER TABLE "public"."log_daily"
    ADD CONSTRAINT "log_daily_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."log_daily"
    ADD CONSTRAINT "log_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_daily"
    ADD CONSTRAINT "log_daily_placement_date_uk" UNIQUE ("placement_id", "log_date");



ALTER TABLE ONLY "public"."log_daily"
    ADD CONSTRAINT "log_daily_placement_date_unique" UNIQUE ("placement_id", "log_date");



ALTER TABLE ONLY "public"."log_daily"
    ADD CONSTRAINT "log_daily_placement_id_log_date_key" UNIQUE ("placement_id", "log_date");



ALTER TABLE ONLY "public"."log_daily"
    ADD CONSTRAINT "log_daily_unique" UNIQUE ("placement_id", "log_date");



ALTER TABLE "public"."log_mortality"
    ADD CONSTRAINT "log_mortality_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."log_mortality"
    ADD CONSTRAINT "log_mortality_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_mortality"
    ADD CONSTRAINT "log_mortality_placement_date_uk" UNIQUE ("placement_id", "log_date");



ALTER TABLE "public"."log_weight"
    ADD CONSTRAINT "log_weight_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."log_weight"
    ADD CONSTRAINT "log_weight_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."placement_closeouts"
    ADD CONSTRAINT "placement_closeouts_pkey" PRIMARY KEY ("closeout_id");



ALTER TABLE "public"."placements"
    ADD CONSTRAINT "placements_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_no_overlap_per_barn" EXCLUDE USING "gist" ("barn_id" WITH =, "daterange"("active_start", COALESCE("active_end", 'infinity'::"date"), '[)'::"text") WITH &&) WHERE (("lifecycle_stage" IS DISTINCT FROM 'canceled'::"text"));



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_no_overlap_per_flock" EXCLUDE USING "gist" ("flock_id" WITH =, "daterange"("active_start", COALESCE("active_end", 'infinity'::"date"), '[)'::"text") WITH &&) WHERE (("lifecycle_stage" IS DISTINCT FROM 'canceled'::"text"));



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_resource_action_key" UNIQUE ("role_id", "resource", "action");



ALTER TABLE ONLY "public"."roles_actions_permissions"
    ADD CONSTRAINT "roles_actions_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles_actions_permissions"
    ADD CONSTRAINT "roles_actions_permissions_role_id_action_id_key" UNIQUE ("role_id", "action_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signup_codes"
    ADD CONSTRAINT "signup_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."signup_codes"
    ADD CONSTRAINT "signup_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stdbreedspec"
    ADD CONSTRAINT "stdbreedspec_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_control-index"
    ADD CONSTRAINT "sync_control-index_barnid_key" UNIQUE ("barnid");



ALTER TABLE ONLY "public"."sync_control-index"
    ADD CONSTRAINT "sync_control-index_flockid_key" UNIQUE ("flockid");



ALTER TABLE ONLY "public"."sync_control-index"
    ADD CONSTRAINT "sync_control-index_idxfarm_key" UNIQUE ("idxfarm");



ALTER TABLE ONLY "public"."sync_control-index"
    ADD CONSTRAINT "sync_control-index_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sysactions"
    ADD CONSTRAINT "sysactions_key" UNIQUE ("action");



ALTER TABLE ONLY "public"."sysactions"
    ADD CONSTRAINT "sysactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barns"
    ADD CONSTRAINT "uq_barns_farm_code" UNIQUE ("farm_id", "barn_code");



ALTER TABLE ONLY "public"."farm_groups"
    ADD CONSTRAINT "uq_farm_groups_group_name" UNIQUE ("group_name");



ALTER TABLE ONLY "public"."log_daily"
    ADD CONSTRAINT "uq_log_daily" UNIQUE ("placement_id", "log_date");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");



ALTER TABLE ONLY "tuning"."findings"
    ADD CONSTRAINT "findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tuning"."metrics"
    ADD CONSTRAINT "metrics_pkey" PRIMARY KEY ("run_id", "metric_name");



ALTER TABLE ONLY "tuning"."runs"
    ADD CONSTRAINT "runs_pkey" PRIMARY KEY ("id");



CREATE INDEX "outbox_pending_idx" ON "gsync"."outbox" USING "btree" ("status", "created_at");



CREATE INDEX "ix_sync_audit_endpoint_created" ON "platform"."sync_audit" USING "btree" ("endpoint_id", "created_at" DESC);



CREATE INDEX "ix_sync_audit_outbox_created" ON "platform"."sync_audit" USING "btree" ("outbox_id", "created_at" DESC);



CREATE INDEX "ix_sync_outbox_endpoint_status" ON "platform"."sync_outbox" USING "btree" ("endpoint_id", "status", "requested_at");



CREATE INDEX "ix_sync_outbox_placement_date" ON "platform"."sync_outbox" USING "btree" ("placement_id", "log_date", "status");



CREATE INDEX "ix_sync_outbox_status_requested" ON "platform"."sync_outbox" USING "btree" ("status", "requested_at");



CREATE UNIQUE INDEX "settings_name_lower_uidx" ON "platform"."settings" USING "btree" ("lower"("name"));



CREATE UNIQUE INDEX "ux_sync_endpoints_adapter_farm" ON "platform"."sync_endpoints" USING "btree" ("adapter_id", "farm_id") WHERE ("farm_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_sync_googleapis_sheet_columns_key" ON "platform"."sync_googleapis_sheet_columns" USING "btree" ("endpoint_id", "source_table", "source_field", "source_variant");



CREATE UNIQUE INDEX "ux_sync_outbox_active_dedupe" ON "platform"."sync_outbox" USING "btree" ("adapter_id", "endpoint_id", "dedupe_key") WHERE (("dedupe_key" IS NOT NULL) AND ("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text"])));



CREATE UNIQUE INDEX "breeds_name_sex_key" ON "public"."breeds" USING "btree" ("breed_name", COALESCE("sex", ''::"text"));



CREATE INDEX "feed_drops_feed_bin_id_idx" ON "public"."feed_drops" USING "btree" ("feed_bin_id");



CREATE INDEX "feed_drops_feed_ticket_id_idx" ON "public"."feed_drops" USING "btree" ("feed_ticket_id");



CREATE INDEX "feed_drops_placement_id_idx" ON "public"."feed_drops" USING "btree" ("placement_id");



CREATE UNIQUE INDEX "feed_tickets_ticket_num_unique_idx" ON "public"."feed_tickets" USING "btree" ("lower"("btrim"("ticket_num"))) WHERE (("ticket_num" IS NOT NULL) AND ("btrim"("ticket_num") <> ''::"text"));



CREATE INDEX "feed_tickets_updated_by_idx" ON "public"."feed_tickets" USING "btree" ("updated_by");



CREATE INDEX "idx_activity_log_flock_id" ON "public"."activity_log" USING "btree" ("flock_id");



CREATE INDEX "idx_app_users_adalo_user_id" ON "public"."app_users" USING "btree" ("adalo_user_id");



CREATE INDEX "idx_barns_created_by" ON "public"."barns" USING "btree" ("created_by");



CREATE INDEX "idx_farm_group_memberships_group" ON "public"."farm_group_memberships" USING "btree" ("farm_group_id");



CREATE INDEX "idx_farm_group_memberships_user" ON "public"."farm_group_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_farm_groups_created_by" ON "public"."farm_groups" USING "btree" ("created_by");



CREATE INDEX "idx_farm_groups_group_name" ON "public"."farm_groups" USING "btree" ("group_name");



CREATE INDEX "idx_farm_memberships_farm" ON "public"."farm_memberships" USING "btree" ("farm_id");



CREATE INDEX "idx_farm_memberships_role" ON "public"."farm_memberships" USING "btree" ("role_id");



CREATE INDEX "idx_farm_memberships_user" ON "public"."farm_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_farm_memberships_user_farm" ON "public"."farm_memberships" USING "btree" ("user_id", "farm_id");



CREATE INDEX "idx_farm_memberships_user_id" ON "public"."farm_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_farms_created_by" ON "public"."farms" USING "btree" ("created_by");



CREATE INDEX "idx_farms_farm_group_id" ON "public"."farms" USING "btree" ("farm_group_id");



CREATE INDEX "idx_feed_drops_queued_from_placement_id" ON "public"."feed_drops" USING "btree" ("queued_from_placement_id");



CREATE INDEX "idx_feed_order_commitments_unassigned_from" ON "public"."feed_order_commitments" USING "btree" ("unassigned_from_placement_id") WHERE ("unassigned_from_placement_id" IS NOT NULL);



CREATE INDEX "idx_flocks_created_by" ON "public"."flocks" USING "btree" ("created_by");



CREATE INDEX "idx_log_daily_created_by" ON "public"."log_daily" USING "btree" ("created_by");



CREATE INDEX "idx_log_daily_log_date" ON "public"."log_daily" USING "btree" ("log_date");



CREATE INDEX "idx_log_daily_place_date" ON "public"."log_daily" USING "btree" ("placement_id", "log_date");



CREATE INDEX "idx_log_daily_placement" ON "public"."log_daily" USING "btree" ("placement_id");



CREATE INDEX "idx_log_daily_placement_date" ON "public"."log_daily" USING "btree" ("placement_id", "log_date");



CREATE INDEX "idx_log_mortality_created_by" ON "public"."log_mortality" USING "btree" ("created_by");



CREATE INDEX "idx_log_weight_created_by" ON "public"."log_weight" USING "btree" ("created_by");



CREATE INDEX "idx_placements_created_by" ON "public"."placements" USING "btree" ("created_by");



CREATE INDEX "idx_placements_lifecycle_stage_farm_barn" ON "public"."placements" USING "btree" ("lifecycle_stage", "farm_id", "barn_id");



CREATE INDEX "idx_placements_unassigned_queue" ON "public"."placements" USING "btree" ("lifecycle_stage", "unassigned_at" DESC) WHERE ("lifecycle_stage" = 'unassigned'::"text");



CREATE INDEX "idx_profiles_id" ON "public"."profiles" USING "btree" ("id");



CREATE INDEX "idx_role_permissions_resource_action" ON "public"."role_permissions" USING "btree" ("resource", "action");



CREATE INDEX "idx_role_permissions_role_id" ON "public"."role_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_stdbreedspec_breed_age" ON "public"."stdbreedspec" USING "btree" ("breedid", "age");



CREATE UNIQUE INDEX "idx_unique_active_placement_per_barn" ON "public"."placements" USING "btree" ("barn_id") WHERE (("is_active" = true) AND ("date_removed" IS NULL));



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_user_role_id" ON "public"."user_roles" USING "btree" ("user_id", "role_id");



CREATE INDEX "issue_updates_issue_created_idx" ON "public"."issue_updates" USING "btree" ("issue_id", "created_at" DESC);



CREATE UNIQUE INDEX "issues_auto_derived_open_unique_idx" ON "public"."issues" USING "btree" ("entity_type", "entity_id", "issue_type", "title") WHERE (("status" = 'open'::"text") AND ("left"(COALESCE("description", ''::"text"), 13) = 'Auto-derived:'::"text"));



CREATE INDEX "issues_entity_status_idx" ON "public"."issues" USING "btree" ("entity_type", "entity_id", "status", "opened_at" DESC);



CREATE INDEX "issues_related_placement_idx" ON "public"."issues" USING "btree" ("related_placement_id", "status", "opened_at" DESC) WHERE ("related_placement_id" IS NOT NULL);



CREATE INDEX "ix_activity_log_barn" ON "public"."activity_log" USING "btree" ("barn_id", "occurred_at" DESC);



CREATE INDEX "ix_activity_log_farm" ON "public"."activity_log" USING "btree" ("farm_id", "occurred_at" DESC);



CREATE INDEX "ix_activity_log_occurred_at" ON "public"."activity_log" USING "btree" ("occurred_at" DESC);



CREATE INDEX "ix_activity_log_placement" ON "public"."activity_log" USING "btree" ("placement_id", "occurred_at" DESC);



CREATE INDEX "ix_barns_active_flock" ON "public"."barns" USING "btree" ("active_flock_id");



CREATE INDEX "ix_barns_farm" ON "public"."barns" USING "btree" ("farm_id");



CREATE INDEX "ix_daily_age_tasks_active_order" ON "public"."daily_age_tasks" USING "btree" ("is_active", "display_order", "min_age_days", "max_age_days");



CREATE INDEX "ix_document_archives_closeout_current" ON "public"."document_archives" USING "btree" ("placement_closeout_id", "document_role", "is_current", "created_at" DESC) WHERE ("placement_closeout_id" IS NOT NULL);



CREATE INDEX "ix_document_archives_feed_ticket_current" ON "public"."document_archives" USING "btree" ("feed_ticket_id", "document_role", "is_current", "created_at" DESC) WHERE ("feed_ticket_id" IS NOT NULL);



CREATE INDEX "ix_document_archives_livehaul_load_current" ON "public"."document_archives" USING "btree" ("livehaul_load_id", "document_role", "is_current", "created_at" DESC) WHERE ("livehaul_load_id" IS NOT NULL);



CREATE INDEX "ix_document_archives_livehaul_schedule_current" ON "public"."document_archives" USING "btree" ("livehaul_schedule_id", "document_role", "is_current", "created_at" DESC) WHERE ("livehaul_schedule_id" IS NOT NULL);



CREATE INDEX "ix_document_archives_placement_current" ON "public"."document_archives" USING "btree" ("placement_id", "document_role", "is_current", "created_at" DESC) WHERE ("placement_id" IS NOT NULL);



CREATE INDEX "ix_farm_memberships_user_farm" ON "public"."farm_memberships" USING "btree" ("user_id", "farm_id");



CREATE INDEX "ix_feed_inventory_snapshots_barn_captured_at" ON "public"."feed_inventory_snapshots" USING "btree" ("barn_id", "captured_at" DESC);



CREATE INDEX "ix_feed_inventory_snapshots_bin_captured_at" ON "public"."feed_inventory_snapshots" USING "btree" ("feed_bin_id", "captured_at" DESC);



CREATE INDEX "ix_feed_order_commitments_barn" ON "public"."feed_order_commitments" USING "btree" ("barn_id", "status");



CREATE INDEX "ix_feed_order_commitments_placement" ON "public"."feed_order_commitments" USING "btree" ("placement_id", "status");



CREATE INDEX "ix_feed_order_commitments_status_eta" ON "public"."feed_order_commitments" USING "btree" ("status", "expected_delivery_date");



CREATE INDEX "ix_flocks_active" ON "public"."flocks" USING "btree" ("is_active");



CREATE INDEX "ix_flocks_farm" ON "public"."flocks" USING "btree" ("farm_id");



CREATE INDEX "ix_livehaul_loads_livehaul_id" ON "public"."livehaul_loads" USING "btree" ("livehaul_id");



CREATE INDEX "ix_livehaul_schedule_flock_date" ON "public"."livehaul_schedule" USING "btree" ("flock_id", "lh_date");



CREATE INDEX "ix_livehaul_schedule_placement_date" ON "public"."livehaul_schedule" USING "btree" ("placement_id", "lh_date", "sequence_num");



CREATE INDEX "ix_log_daily_placement_date" ON "public"."log_daily" USING "btree" ("placement_id", "log_date");



CREATE INDEX "ix_log_weight_placement_date" ON "public"."log_weight" USING "btree" ("placement_id", "log_date");



CREATE INDEX "ix_logs_daily_place" ON "public"."log_daily" USING "btree" ("placement_id");



CREATE INDEX "ix_logs_mortality_place" ON "public"."log_mortality" USING "btree" ("placement_id");



CREATE INDEX "ix_logs_weight_place" ON "public"."log_weight" USING "btree" ("placement_id");



CREATE INDEX "ix_placement_closeouts_flock" ON "public"."placement_closeouts" USING "btree" ("flock_id");



CREATE INDEX "ix_placement_closeouts_status" ON "public"."placement_closeouts" USING "btree" ("status", "farm_id", "barn_id", "updated_at" DESC);



CREATE INDEX "ix_placements_active_barn" ON "public"."placements" USING "btree" ("barn_id") WHERE (("is_active" = true) AND ("date_removed" IS NULL));



CREATE INDEX "ix_placements_farm" ON "public"."placements" USING "btree" ("farm_id");



CREATE INDEX "ix_placements_flock_barn" ON "public"."placements" USING "btree" ("flock_id", "barn_id");



CREATE INDEX "ix_profiles_email" ON "public"."profiles" USING "btree" ("lower"("email"));



CREATE INDEX "ix_user_roles_user" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "signup_codes_active_idx" ON "public"."signup_codes" USING "btree" ("active");



CREATE INDEX "signup_codes_expires_idx" ON "public"."signup_codes" USING "btree" ("expires_at");



CREATE INDEX "signup_codes_farm_idx" ON "public"."signup_codes" USING "btree" ("farm_id");



CREATE UNIQUE INDEX "uqidx_farm_groups_group_name" ON "public"."farm_groups" USING "btree" ("group_name");



CREATE UNIQUE INDEX "ux_document_archives_storage_path" ON "public"."document_archives" USING "btree" ("storage_bucket", "storage_path");



CREATE UNIQUE INDEX "ux_livehaul_schedule_lhdate_placement_flock_farm_barn" ON "public"."livehaul_schedule" USING "btree" ("lh_date", "placement_id", "flock_id", "farm_id", "barn_id");



CREATE UNIQUE INDEX "ux_placement_closeouts_placement_id" ON "public"."placement_closeouts" USING "btree" ("placement_id");



CREATE INDEX "idx_tuning_findings_run_id" ON "tuning"."findings" USING "btree" ("run_id");



CREATE INDEX "idx_tuning_findings_type" ON "tuning"."findings" USING "btree" ("finding_type");



CREATE RULE "v_placement_daily_delete" AS
    ON DELETE TO "public"."v_placement_daily" DO INSTEAD  DELETE FROM "public"."log_daily" "d"
  WHERE ("d"."id" = "old"."id")
  RETURNING "d"."id",
    "d"."placement_id",
    "d"."log_date",
    "d"."age_days",
    "d"."am_temp",
    "d"."set_temp",
    "d"."rel_humidity" AS "ambient_temp",
    "d"."min_vent",
    "d"."is_oda_open",
    "d"."oda_exception",
    "d"."naoh",
    "d"."comment",
    "d"."is_active",
    "d"."created_at",
    "d"."updated_at",
    "d"."updated_by",
    "d"."created_by";



CREATE RULE "v_placement_daily_insert" AS
    ON INSERT TO "public"."v_placement_daily" DO INSTEAD  INSERT INTO "public"."log_daily" ("id", "placement_id", "log_date", "age_days", "am_temp", "set_temp", "rel_humidity", "min_vent", "is_oda_open", "oda_exception", "naoh", "comment", "is_active", "created_at", "updated_at", "updated_by", "created_by")
  VALUES ("new"."id", "new"."placement_id", "new"."log_date", "new"."age_days", "new"."am_temp", "new"."set_temp", "new"."ambient_temp", "new"."min_vent", COALESCE("new"."is_oda_open", false), "new"."oda_exception", "new"."naoh", "new"."comment", COALESCE("new"."is_active", true), COALESCE("new"."created_at", "now"()), COALESCE("new"."updated_at", "now"()), "new"."updated_by", COALESCE("new"."created_by", "auth"."uid"()))
  RETURNING "log_daily"."id",
    "log_daily"."placement_id",
    "log_daily"."log_date",
    "log_daily"."age_days",
    "log_daily"."am_temp",
    "log_daily"."set_temp",
    "log_daily"."rel_humidity" AS "ambient_temp",
    "log_daily"."min_vent",
    "log_daily"."is_oda_open",
    "log_daily"."oda_exception",
    "log_daily"."naoh",
    "log_daily"."comment",
    "log_daily"."is_active",
    "log_daily"."created_at",
    "log_daily"."updated_at",
    "log_daily"."updated_by",
    "log_daily"."created_by";



CREATE RULE "v_placement_daily_update" AS
    ON UPDATE TO "public"."v_placement_daily" DO INSTEAD  UPDATE "public"."log_daily" "d" SET "placement_id" = "new"."placement_id", "log_date" = "new"."log_date", "age_days" = "new"."age_days", "am_temp" = "new"."am_temp", "set_temp" = "new"."set_temp", "rel_humidity" = "new"."ambient_temp", "min_vent" = "new"."min_vent", "is_oda_open" = "new"."is_oda_open", "oda_exception" = "new"."oda_exception", "naoh" = "new"."naoh", "comment" = "new"."comment", "is_active" = "new"."is_active", "created_at" = "new"."created_at", "updated_at" = COALESCE("new"."updated_at", "now"()), "updated_by" = "new"."updated_by", "created_by" = "new"."created_by"
  WHERE ("d"."id" = "old"."id")
  RETURNING "d"."id",
    "d"."placement_id",
    "d"."log_date",
    "d"."age_days",
    "d"."am_temp",
    "d"."set_temp",
    "d"."rel_humidity" AS "ambient_temp",
    "d"."min_vent",
    "d"."is_oda_open",
    "d"."oda_exception",
    "d"."naoh",
    "d"."comment",
    "d"."is_active",
    "d"."created_at",
    "d"."updated_at",
    "d"."updated_by",
    "d"."created_by";



do $migration$
begin
  execute $rule$
CREATE RULE "v_placement_day_delete" AS
    ON DELETE TO "public"."v_placement_day" DO INSTEAD ( DELETE FROM "public"."log_mortality" "m"
  WHERE (("m"."placement_id" = "old"."placement_id") AND ("m"."log_date" = "old"."log_date"));
 DELETE FROM "public"."log_daily" "d"
  WHERE (("d"."placement_id" = "old"."placement_id") AND ("d"."log_date" = "old"."log_date"));
);
$rule$;
end
$migration$;



do $migration$
begin
  execute $rule$
CREATE RULE "v_placement_day_insert" AS
    ON INSERT TO "public"."v_placement_day" DO INSTEAD ( INSERT INTO "public"."log_daily" ("placement_id", "log_date", "age_days", "am_temp", "set_temp", "rel_humidity", "min_vent", "is_oda_open", "oda_exception", "naoh", "comment", "is_active", "created_at", "updated_at", "updated_by", "created_by")
  VALUES ("new"."placement_id", "new"."log_date", "new"."age_days", "new"."am_temp", "new"."set_temp", "new"."ambient_temp", "new"."min_vent", COALESCE("new"."is_oda_open", false), "new"."oda_exception", "new"."naoh", "new"."comment", COALESCE("new"."is_active_daily", true), COALESCE("new"."created_at_daily", "now"()), COALESCE("new"."updated_at_daily", "now"()), "new"."updated_by_daily", COALESCE("new"."created_by_daily", "auth"."uid"()));
 INSERT INTO "public"."log_mortality" ("placement_id", "log_date", "dead_female", "dead_male", "cull_female", "cull_male", "cull_female_note", "cull_male_note", "dead_reason", "grade_litter", "grade_footpad", "grade_feathers", "grade_lame", "grade_pecking", "is_active", "created_at", "updated_at", "updated_by", "created_by")
  VALUES ("new"."placement_id", "new"."log_date", COALESCE("new"."dead_female", 0), COALESCE("new"."dead_male", 0), COALESCE("new"."cull_female", 0), COALESCE("new"."cull_male", 0), "new"."cull_female_note", "new"."cull_male_note", "new"."dead_reason", "new"."grade_litter", "new"."grade_footpad", "new"."grade_feathers", "new"."grade_lame", "new"."grade_pecking", COALESCE("new"."is_active_mort", true), COALESCE("new"."created_at_mort", "now"()), COALESCE("new"."updated_at_mort", "now"()), "new"."updated_by_mort", COALESCE("new"."created_by_mort", "auth"."uid"()));
);
$rule$;
end
$migration$;



do $migration$
begin
  execute $rule$
CREATE RULE "v_placement_day_update" AS
    ON UPDATE TO "public"."v_placement_day" DO INSTEAD ( UPDATE "public"."log_daily" "d" SET "age_days" = "new"."age_days", "am_temp" = "new"."am_temp", "set_temp" = "new"."set_temp", "rel_humidity" = "new"."ambient_temp", "min_vent" = "new"."min_vent", "is_oda_open" = "new"."is_oda_open", "oda_exception" = "new"."oda_exception", "naoh" = "new"."naoh", "comment" = "new"."comment", "is_active" = COALESCE("new"."is_active_daily", "d"."is_active"), "updated_at" = COALESCE("new"."updated_at_daily", "now"()), "updated_by" = COALESCE("new"."updated_by_daily", "d"."updated_by")
  WHERE (("d"."placement_id" = "old"."placement_id") AND ("d"."log_date" = "old"."log_date"));
 UPDATE "public"."log_mortality" "m" SET "dead_female" = COALESCE("new"."dead_female", "m"."dead_female"), "dead_male" = COALESCE("new"."dead_male", "m"."dead_male"), "cull_female" = COALESCE("new"."cull_female", "m"."cull_female"), "cull_male" = COALESCE("new"."cull_male", "m"."cull_male"), "cull_female_note" = COALESCE("new"."cull_female_note", "m"."cull_female_note"), "cull_male_note" = COALESCE("new"."cull_male_note", "m"."cull_male_note"), "dead_reason" = COALESCE("new"."dead_reason", "m"."dead_reason"), "grade_litter" = COALESCE("new"."grade_litter", "m"."grade_litter"), "grade_footpad" = COALESCE("new"."grade_footpad", "m"."grade_footpad"), "grade_feathers" = COALESCE("new"."grade_feathers", "m"."grade_feathers"), "grade_lame" = COALESCE("new"."grade_lame", "m"."grade_lame"), "grade_pecking" = COALESCE("new"."grade_pecking", "m"."grade_pecking"), "is_active" = COALESCE("new"."is_active_mort", "m"."is_active"), "updated_at" = COALESCE("new"."updated_at_mort", "now"()), "updated_by" = COALESCE("new"."updated_by_mort", "m"."updated_by")
  WHERE (("m"."placement_id" = "old"."placement_id") AND ("m"."log_date" = "old"."log_date"));
);
$rule$;
end
$migration$;



CREATE OR REPLACE TRIGGER "sync_adapters_touch_updated_at" BEFORE UPDATE ON "platform"."sync_adapters" FOR EACH ROW EXECUTE FUNCTION "platform"."sync_touch_updated_at"();



CREATE OR REPLACE TRIGGER "sync_endpoints_touch_updated_at" BEFORE UPDATE ON "platform"."sync_endpoints" FOR EACH ROW EXECUTE FUNCTION "platform"."sync_touch_updated_at"();



CREATE OR REPLACE TRIGGER "sync_googleapis_sheet_columns_touch_updated_at" BEFORE UPDATE ON "platform"."sync_googleapis_sheet_columns" FOR EACH ROW EXECUTE FUNCTION "platform"."sync_touch_updated_at"();



CREATE OR REPLACE TRIGGER "sync_googleapis_sheets_touch_updated_at" BEFORE UPDATE ON "platform"."sync_googleapis_sheets" FOR EACH ROW EXECUTE FUNCTION "platform"."sync_touch_updated_at"();



CREATE OR REPLACE TRIGGER "sync_outbox_touch_updated_at" BEFORE UPDATE ON "platform"."sync_outbox" FOR EACH ROW EXECUTE FUNCTION "platform"."sync_touch_updated_at"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_barns" BEFORE INSERT OR UPDATE ON "public"."barns" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_farms" BEFORE INSERT OR UPDATE ON "public"."farms" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_flocks" BEFORE INSERT OR UPDATE ON "public"."flocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_log_daily" BEFORE INSERT OR UPDATE ON "public"."log_daily" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_log_mortality" BEFORE INSERT OR UPDATE ON "public"."log_mortality" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_log_weight" BEFORE INSERT OR UPDATE ON "public"."log_weight" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_placements" BEFORE INSERT OR UPDATE ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "stdbreedspec_audit_ts" BEFORE INSERT OR UPDATE ON "public"."stdbreedspec" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_timestamps"();



CREATE OR REPLACE TRIGGER "trg_barns_sync_placement_keys" AFTER UPDATE OF "barn_code" ON "public"."barns" FOR EACH ROW EXECUTE FUNCTION "public"."sync_placement_keys_for_barn"();



CREATE OR REPLACE TRIGGER "trg_barns_updated_at" BEFORE UPDATE ON "public"."barns" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_breeds_updated_at" BEFORE UPDATE ON "public"."breeds" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_daily_age_tasks_set_updated_at" BEFORE UPDATE ON "public"."daily_age_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_daily_age_tasks_updated_at"();



CREATE OR REPLACE TRIGGER "trg_farm_memberships_updated_at" BEFORE UPDATE ON "public"."farm_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_farms_updated_at" BEFORE UPDATE ON "public"."farms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_feedbins_updatable_iud" INSTEAD OF INSERT OR DELETE OR UPDATE ON "public"."feedbins_updatable" FOR EACH ROW EXECUTE FUNCTION "public"."feedbins_updatable_iud"();



CREATE OR REPLACE TRIGGER "trg_flocks_sync_barn_state" AFTER UPDATE OF "is_in_barn", "is_active" ON "public"."flocks" FOR EACH ROW EXECUTE FUNCTION "public"."flocks_sync_barn_state"();



CREATE OR REPLACE TRIGGER "trg_flocks_sync_placement_keys" AFTER UPDATE OF "flock_number" ON "public"."flocks" FOR EACH ROW EXECUTE FUNCTION "public"."sync_placement_keys_for_flock"();



CREATE OR REPLACE TRIGGER "trg_flocks_updated_at" BEFORE UPDATE ON "public"."flocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_issue_types_set_updated_at" BEFORE UPDATE ON "public"."issue_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_issue_type_updated_at"();



CREATE OR REPLACE TRIGGER "trg_issue_updates_prevent_edit" BEFORE UPDATE ON "public"."issue_updates" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_issue_update_edit"();



CREATE OR REPLACE TRIGGER "trg_issues_set_updated_at" BEFORE UPDATE ON "public"."issues" FOR EACH ROW EXECUTE FUNCTION "public"."set_issue_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_daily_bump_version" BEFORE UPDATE ON "public"."log_daily" FOR EACH ROW EXECUTE FUNCTION "public"."bump_version_on_update"();



CREATE OR REPLACE TRIGGER "trg_log_daily_updated_at" BEFORE UPDATE ON "public"."log_daily" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_mortality_bump_version" BEFORE UPDATE ON "public"."log_mortality" FOR EACH ROW EXECUTE FUNCTION "public"."bump_version_on_update"();



CREATE OR REPLACE TRIGGER "trg_log_mortality_updated_at" BEFORE UPDATE ON "public"."log_mortality" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_weight_updated_at" BEFORE UPDATE ON "public"."log_weight" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_placements_bump_version" BEFORE UPDATE ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."bump_version_on_update"();



CREATE OR REPLACE TRIGGER "trg_placements_set_active_dates_ins" BEFORE INSERT ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."placements_set_active_dates"();



CREATE OR REPLACE TRIGGER "trg_placements_set_defaults" BEFORE INSERT OR UPDATE OF "barn_id", "flock_id" ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."placements_set_defaults"();



CREATE OR REPLACE TRIGGER "trg_placements_sync_barn_state" AFTER INSERT OR DELETE OR UPDATE ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."placements_sync_barn_state"();



CREATE OR REPLACE TRIGGER "trg_placements_updated_at" BEFORE UPDATE ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_flock_max_date_ins" BEFORE INSERT ON "public"."flocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_flock_max_date"();



CREATE OR REPLACE TRIGGER "trg_set_timestamp_farm_groups" BEFORE UPDATE ON "public"."farm_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_farm_groups"();



CREATE OR REPLACE TRIGGER "trg_sync_enqueue_googleapis_log_daily" AFTER INSERT OR UPDATE ON "public"."log_daily" FOR EACH ROW EXECUTE FUNCTION "platform"."sync_enqueue_googleapis_log_daily"();



CREATE OR REPLACE TRIGGER "trg_sync_enqueue_googleapis_log_mortality" AFTER INSERT OR UPDATE ON "public"."log_mortality" FOR EACH ROW EXECUTE FUNCTION "platform"."sync_enqueue_googleapis_log_mortality"();



CREATE OR REPLACE TRIGGER "trg_sync_enqueue_googleapis_log_weight" AFTER INSERT OR UPDATE ON "public"."log_weight" FOR EACH ROW EXECUTE FUNCTION "platform"."sync_enqueue_googleapis_log_weight"();



CREATE OR REPLACE TRIGGER "trg_user_roles_updated_at" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "gsync"."column_map"
    ADD CONSTRAINT "column_map_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "gsync"."tab"("tab_id") ON DELETE CASCADE;



ALTER TABLE ONLY "gsync"."outbox"
    ADD CONSTRAINT "outbox_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "gsync"."tab"("tab_id") ON DELETE CASCADE;



ALTER TABLE ONLY "gsync"."sync_job"
    ADD CONSTRAINT "sync_job_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "gsync"."tab"("tab_id") ON DELETE CASCADE;



ALTER TABLE ONLY "gsync"."tab"
    ADD CONSTRAINT "tab_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "gsync"."sheet"("sheet_id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."control"
    ADD CONSTRAINT "control_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("user_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."control"
    ADD CONSTRAINT "control_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."app_users"("user_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."license_policy"
    ADD CONSTRAINT "license_policy_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("user_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."license_policy"
    ADD CONSTRAINT "license_policy_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."app_users"("user_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."screen_txt"
    ADD CONSTRAINT "screen_txt_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("user_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."screen_txt"
    ADD CONSTRAINT "screen_txt_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."app_users"("user_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."settings"
    ADD CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "platform"."sync_audit"
    ADD CONSTRAINT "sync_audit_adapter_id_fkey" FOREIGN KEY ("adapter_id") REFERENCES "platform"."sync_adapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."sync_audit"
    ADD CONSTRAINT "sync_audit_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "platform"."sync_endpoints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."sync_audit"
    ADD CONSTRAINT "sync_audit_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "platform"."sync_outbox"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."sync_endpoints"
    ADD CONSTRAINT "sync_endpoints_adapter_id_fkey" FOREIGN KEY ("adapter_id") REFERENCES "platform"."sync_adapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."sync_endpoints"
    ADD CONSTRAINT "sync_endpoints_farm_group_id_fkey" FOREIGN KEY ("farm_group_id") REFERENCES "public"."farm_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."sync_endpoints"
    ADD CONSTRAINT "sync_endpoints_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."sync_googleapis_sheet_columns"
    ADD CONSTRAINT "sync_googleapis_sheet_columns_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "platform"."sync_endpoints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."sync_googleapis_sheets"
    ADD CONSTRAINT "sync_googleapis_sheets_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "platform"."sync_endpoints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."sync_outbox"
    ADD CONSTRAINT "sync_outbox_adapter_id_fkey" FOREIGN KEY ("adapter_id") REFERENCES "platform"."sync_adapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."sync_outbox"
    ADD CONSTRAINT "sync_outbox_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "platform"."sync_endpoints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."sync_outbox"
    ADD CONSTRAINT "sync_outbox_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_barn_id_fkey" FOREIGN KEY ("barn_id") REFERENCES "public"."barns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."app_users"("user_id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."barns"
    ADD CONSTRAINT "barns_active_flock_id_fkey" FOREIGN KEY ("active_flock_id") REFERENCES "public"."flocks"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."barns"
    ADD CONSTRAINT "barns_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."document_archives"
    ADD CONSTRAINT "document_archives_feed_ticket_id_fkey" FOREIGN KEY ("feed_ticket_id") REFERENCES "public"."feed_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_archives"
    ADD CONSTRAINT "document_archives_livehaul_load_id_fkey" FOREIGN KEY ("livehaul_load_id") REFERENCES "public"."livehaul_loads"("load_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_archives"
    ADD CONSTRAINT "document_archives_livehaul_schedule_id_fkey" FOREIGN KEY ("livehaul_schedule_id") REFERENCES "public"."livehaul_schedule"("livehaul_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_archives"
    ADD CONSTRAINT "document_archives_placement_closeout_id_fkey" FOREIGN KEY ("placement_closeout_id") REFERENCES "public"."placement_closeouts"("placement_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_archives"
    ADD CONSTRAINT "document_archives_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."farm_group_memberships"
    ADD CONSTRAINT "farm_group_memberships_farm_group_id_fkey" FOREIGN KEY ("farm_group_id") REFERENCES "public"."farm_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."farm_group_memberships"
    ADD CONSTRAINT "farm_group_memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."farm_group_memberships"
    ADD CONSTRAINT "farm_group_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



COMMENT ON CONSTRAINT "farm_group_memberships_user_id_fkey" ON "public"."farm_group_memberships" IS 'Membership identity follows auth.users.id; app_users is legacy and no longer authoritative.';



ALTER TABLE ONLY "public"."farm_groups"
    ADD CONSTRAINT "farm_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."farm_groups"
    ADD CONSTRAINT "farm_groups_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."farm_memberships"
    ADD CONSTRAINT "farm_memberships_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."farm_memberships"
    ADD CONSTRAINT "farm_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



COMMENT ON CONSTRAINT "farm_memberships_user_id_fkey" ON "public"."farm_memberships" IS 'Membership identity follows auth.users.id; core_users is no longer authoritative for web-admin access.';



ALTER TABLE ONLY "public"."farms"
    ADD CONSTRAINT "farms_farm_group_id_fkey" FOREIGN KEY ("farm_group_id") REFERENCES "public"."farm_groups"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_drops"
    ADD CONSTRAINT "feed_drops_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("user_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."feed_drops"
    ADD CONSTRAINT "feed_drops_feed_bin_id_fkey" FOREIGN KEY ("feed_bin_id") REFERENCES "public"."feedbins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_drops"
    ADD CONSTRAINT "feed_drops_feed_ticket_id_fkey" FOREIGN KEY ("feed_ticket_id") REFERENCES "public"."feed_tickets"("id");



ALTER TABLE ONLY "public"."feed_drops"
    ADD CONSTRAINT "feed_drops_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_drops"
    ADD CONSTRAINT "feed_drops_queued_from_barn_id_fkey" FOREIGN KEY ("queued_from_barn_id") REFERENCES "public"."barns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_drops"
    ADD CONSTRAINT "feed_drops_queued_from_feed_bin_id_fkey" FOREIGN KEY ("queued_from_feed_bin_id") REFERENCES "public"."feedbins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_drops"
    ADD CONSTRAINT "feed_drops_queued_from_placement_id_fkey" FOREIGN KEY ("queued_from_placement_id") REFERENCES "public"."placements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_inventory_snapshots"
    ADD CONSTRAINT "feed_inventory_snapshots_barn_id_fkey" FOREIGN KEY ("barn_id") REFERENCES "public"."barns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_inventory_snapshots"
    ADD CONSTRAINT "feed_inventory_snapshots_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_inventory_snapshots"
    ADD CONSTRAINT "feed_inventory_snapshots_feed_bin_id_fkey" FOREIGN KEY ("feed_bin_id") REFERENCES "public"."feedbins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_inventory_snapshots"
    ADD CONSTRAINT "feed_inventory_snapshots_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_order_commitments"
    ADD CONSTRAINT "feed_order_commitments_barn_id_fkey" FOREIGN KEY ("barn_id") REFERENCES "public"."barns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_order_commitments"
    ADD CONSTRAINT "feed_order_commitments_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_order_commitments"
    ADD CONSTRAINT "feed_order_commitments_feed_bin_id_fkey" FOREIGN KEY ("feed_bin_id") REFERENCES "public"."feedbins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_order_commitments"
    ADD CONSTRAINT "feed_order_commitments_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_order_commitments"
    ADD CONSTRAINT "feed_order_commitments_received_ticket_id_fkey" FOREIGN KEY ("received_ticket_id") REFERENCES "public"."feed_tickets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_order_commitments"
    ADD CONSTRAINT "feed_order_commitments_unassigned_from_placement_id_fkey" FOREIGN KEY ("unassigned_from_placement_id") REFERENCES "public"."placements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_tickets"
    ADD CONSTRAINT "feed_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("user_id");



ALTER TABLE ONLY "public"."feed_tickets"
    ADD CONSTRAINT "feed_tickets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."app_users"("user_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedbins"
    ADD CONSTRAINT "feedbins_barn_id_fkey" FOREIGN KEY ("barn_id") REFERENCES "public"."barns"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."feedbins"
    ADD CONSTRAINT "feedbins_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_breed_females_fkey" FOREIGN KEY ("breed_females") REFERENCES "public"."breeds"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_breed_males_fkey" FOREIGN KEY ("breed_males") REFERENCES "public"."breeds"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."issue_updates"
    ADD CONSTRAINT "issue_updates_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_related_placement_id_fkey" FOREIGN KEY ("related_placement_id") REFERENCES "public"."placements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."livehaul_loads"
    ADD CONSTRAINT "livehaul_loads_livehaul_id_fkey" FOREIGN KEY ("livehaul_id") REFERENCES "public"."livehaul_schedule"("livehaul_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."livehaul_schedule"
    ADD CONSTRAINT "livehaul_schedule_barn_id_fkey" FOREIGN KEY ("barn_id") REFERENCES "public"."barns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."livehaul_schedule"
    ADD CONSTRAINT "livehaul_schedule_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."livehaul_schedule"
    ADD CONSTRAINT "livehaul_schedule_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."livehaul_schedule"
    ADD CONSTRAINT "livehaul_schedule_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."log_daily"
    ADD CONSTRAINT "log_daily_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."log_mortality"
    ADD CONSTRAINT "log_mortality_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."log_weight"
    ADD CONSTRAINT "log_weight_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."placement_closeouts"
    ADD CONSTRAINT "placement_closeouts_barn_id_fkey" FOREIGN KEY ("barn_id") REFERENCES "public"."barns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."placement_closeouts"
    ADD CONSTRAINT "placement_closeouts_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."placement_closeouts"
    ADD CONSTRAINT "placement_closeouts_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."placement_closeouts"
    ADD CONSTRAINT "placement_closeouts_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_barn_id_fkey" FOREIGN KEY ("barn_id") REFERENCES "public"."barns"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles_actions_permissions"
    ADD CONSTRAINT "roles_actions_permissions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."sysactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles_actions_permissions"
    ADD CONSTRAINT "roles_actions_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "tuning"."findings"
    ADD CONSTRAINT "findings_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "tuning"."runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "tuning"."metrics"
    ADD CONSTRAINT "metrics_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "tuning"."runs"("id") ON DELETE CASCADE;



ALTER TABLE "gsync"."sheet" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "gsync"."trax2sheets_map" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "platform"."control" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "platform"."license_policy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_control_read_anon" ON "platform"."control" FOR SELECT TO "anon" USING (true);



CREATE POLICY "platform_control_read_authenticated" ON "platform"."control" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "platform_license_policy_read_anon" ON "platform"."license_policy" FOR SELECT TO "anon" USING (true);



CREATE POLICY "platform_license_policy_read_authenticated" ON "platform"."license_policy" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "platform_screen_txt_read_anon" ON "platform"."screen_txt" FOR SELECT TO "anon" USING (true);



CREATE POLICY "platform_screen_txt_read_authenticated" ON "platform"."screen_txt" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "platform_settings_select_authenticated" ON "platform"."settings" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "platform"."reportoptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "platform"."screen_txt" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "platform"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "platform"."sync_adapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "platform"."sync_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "platform"."sync_endpoints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "platform"."sync_googleapis_sheets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "platform"."sync_outbox" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "User can delete own profile" ON "public"."profiles" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "User can insert own memberships" ON "public"."farm_memberships" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "User can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "User can insert own roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "User can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "User can update own memberships" ON "public"."farm_memberships" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "User can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "User can update own roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "User can view own memberships" ON "public"."farm_memberships" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "User can view own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "admin_all_breeds" ON "public"."breeds" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_all_stdbreedspec" ON "public"."stdbreedspec" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_all_todos" ON "public"."todos" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "anon_read_breeds" ON "public"."breeds" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_stdbreedspec" ON "public"."stdbreedspec" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_sync_control_index" ON "public"."sync_control-index" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_todos" ON "public"."todos" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_settings_delete_authenticated" ON "public"."app_settings" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "app_settings_insert_authenticated" ON "public"."app_settings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "app_settings_select_authenticated" ON "public"."app_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "app_settings_update_authenticated" ON "public"."app_settings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_insert_todos" ON "public"."todos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth_insert_user_roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth_read_breeds" ON "public"."breeds" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth_read_stdbreedspec" ON "public"."stdbreedspec" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth_read_todos" ON "public"."todos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth_read_user_roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth_update_todos" ON "public"."todos" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_update_user_roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."barns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "barns_admin_all" ON "public"."barns" TO "admin" USING (true) WITH CHECK (true);



CREATE POLICY "barns_anon_select" ON "public"."barns" FOR SELECT TO "anon" USING (true);



CREATE POLICY "barns_auth_select" ON "public"."barns" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "barns_auth_write" ON "public"."barns" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "barns_delete" ON "public"."barns" FOR DELETE TO "authenticated" USING ("public"."can_write_farm"("farm_id"));



CREATE POLICY "barns_insert" ON "public"."barns" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_write_farm"("farm_id"));



CREATE POLICY "barns_read" ON "public"."barns" FOR SELECT TO "authenticated" USING ("public"."can_access_farm"("farm_id"));



CREATE POLICY "barns_update" ON "public"."barns" FOR UPDATE TO "authenticated" USING ("public"."can_write_farm"("farm_id")) WITH CHECK ("public"."can_write_farm"("farm_id"));



ALTER TABLE "public"."breeds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_age_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_age_tasks_select_active" ON "public"."daily_age_tasks" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."farm_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "farm_groups_admin_delete" ON "public"."farm_groups" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "farm_groups_admin_insert" ON "public"."farm_groups" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "farm_groups_admin_select" ON "public"."farm_groups" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "farm_groups_admin_update" ON "public"."farm_groups" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."farm_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "farm_memberships_read" ON "public"."farm_memberships" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "farm_memberships_write" ON "public"."farm_memberships" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."farms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "farms_admin_all" ON "public"."farms" TO "admin" USING (true) WITH CHECK (true);



CREATE POLICY "farms_anon_select" ON "public"."farms" FOR SELECT TO "anon" USING (true);



CREATE POLICY "farms_auth_select" ON "public"."farms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "farms_auth_write" ON "public"."farms" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "farms_delete" ON "public"."farms" FOR DELETE TO "authenticated" USING ("public"."can_write_farm"("id"));



CREATE POLICY "farms_insert" ON "public"."farms" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_write_farm"("id"));



CREATE POLICY "farms_read" ON "public"."farms" FOR SELECT TO "authenticated" USING ("public"."can_access_farm"("id"));



CREATE POLICY "farms_update" ON "public"."farms" FOR UPDATE TO "authenticated" USING ("public"."can_write_farm"("id")) WITH CHECK ("public"."can_write_farm"("id"));



ALTER TABLE "public"."feed_drops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feed_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedbins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flocks_admin_all" ON "public"."flocks" TO "admin" USING (true) WITH CHECK (true);



CREATE POLICY "flocks_anon_select" ON "public"."flocks" FOR SELECT TO "anon" USING (true);



CREATE POLICY "flocks_auth_select" ON "public"."flocks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "flocks_auth_write" ON "public"."flocks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "flocks_delete" ON "public"."flocks" FOR DELETE TO "authenticated" USING ("public"."can_write_farm"("farm_id"));



CREATE POLICY "flocks_insert" ON "public"."flocks" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_write_farm"("farm_id"));



CREATE POLICY "flocks_read" ON "public"."flocks" FOR SELECT TO "authenticated" USING ("public"."can_access_farm"("farm_id"));



CREATE POLICY "flocks_update" ON "public"."flocks" FOR UPDATE TO "authenticated" USING ("public"."can_write_farm"("farm_id")) WITH CHECK ("public"."can_write_farm"("farm_id"));



ALTER TABLE "public"."issue_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issue_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."log_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "log_daily_all_delete" ON "public"."log_daily" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "log_daily_all_insert" ON "public"."log_daily" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "log_daily_all_select" ON "public"."log_daily" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "log_daily_all_update" ON "public"."log_daily" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."log_mortality" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "log_mortality_all_delete" ON "public"."log_mortality" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "log_mortality_all_insert" ON "public"."log_mortality" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "log_mortality_all_select" ON "public"."log_mortality" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "log_mortality_all_update" ON "public"."log_mortality" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."log_weight" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "log_weight_all_delete" ON "public"."log_weight" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "log_weight_all_insert" ON "public"."log_weight" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "log_weight_all_select" ON "public"."log_weight" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "log_weight_all_update" ON "public"."log_weight" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "no_modify_signup_codes" ON "public"."signup_codes" TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "no_select_signup_codes" ON "public"."signup_codes" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."placements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "placements_admin_all" ON "public"."placements" TO "admin" USING (true) WITH CHECK (true);



CREATE POLICY "placements_anon_select" ON "public"."placements" FOR SELECT TO "anon" USING (true);



CREATE POLICY "placements_auth_select" ON "public"."placements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "placements_auth_write" ON "public"."placements" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "placements_delete" ON "public"."placements" FOR DELETE TO "authenticated" USING ("public"."can_write_farm"("farm_id"));



CREATE POLICY "placements_insert" ON "public"."placements" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_write_farm"("farm_id"));



CREATE POLICY "placements_read" ON "public"."placements" FOR SELECT TO "authenticated" USING ("public"."can_access_farm"("farm_id"));



CREATE POLICY "placements_update" ON "public"."placements" FOR UPDATE TO "authenticated" USING ("public"."can_write_farm"("farm_id")) WITH CHECK ("public"."can_write_farm"("farm_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_self" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"())) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles_actions_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_actions_permissions_select_authenticated" ON "public"."roles_actions_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "roles_select_authenticated" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."signup_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stdbreedspec" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_control-index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sysactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sysactions_select_authenticated" ON "public"."sysactions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."todos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_insert_own_memberships" ON "public"."farm_memberships" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_read" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "user_roles_write" ON "public"."user_roles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "user_select_own_memberships" ON "public"."farm_memberships" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_update_own_memberships" ON "public"."farm_memberships" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."app_settings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."feed_drops";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."feed_tickets";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."todos";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "admin";






GRANT USAGE ON SCHEMA "platform" TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";
































































































































































































































































































REVOKE ALL ON FUNCTION "platform"."build_googleapis_sync_day_payload"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text", "p_endpoint_id" "uuid", "p_endpoint_name" "text", "p_spreadsheet_id" "text", "p_header_row" integer, "p_date_header_label" "text", "p_placement_key" "text", "p_farm_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."build_googleapis_sync_day_payload"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text", "p_endpoint_id" "uuid", "p_endpoint_name" "text", "p_spreadsheet_id" "text", "p_header_row" integer, "p_date_header_label" "text", "p_placement_key" "text", "p_farm_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "platform"."can_replay"("status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."can_replay"("status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "platform"."claim_googleapis_outbox"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."claim_googleapis_outbox"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "platform"."complete_googleapis_outbox"("p_outbox_id" "uuid", "p_status" "text", "p_last_error" "text", "p_request_summary" "jsonb", "p_response_summary" "jsonb", "p_status_code" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."complete_googleapis_outbox"("p_outbox_id" "uuid", "p_status" "text", "p_last_error" "text", "p_request_summary" "jsonb", "p_response_summary" "jsonb", "p_status_code" integer) TO "service_role";



REVOKE ALL ON FUNCTION "platform"."enqueue_googleapis_sync_day"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."enqueue_googleapis_sync_day"("p_source_table" "text", "p_entity_id" "uuid", "p_placement_id" "uuid", "p_log_date" "date", "p_operation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "platform"."ensure_googleapis_sheet_columns"("p_endpoint_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."ensure_googleapis_sheet_columns"("p_endpoint_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "platform"."sync_enqueue_googleapis_log_daily"() FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."sync_enqueue_googleapis_log_daily"() TO "service_role";



REVOKE ALL ON FUNCTION "platform"."sync_enqueue_googleapis_log_mortality"() FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."sync_enqueue_googleapis_log_mortality"() TO "service_role";



REVOKE ALL ON FUNCTION "platform"."sync_enqueue_googleapis_log_weight"() FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."sync_enqueue_googleapis_log_weight"() TO "service_role";



REVOKE ALL ON FUNCTION "platform"."sync_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "platform"."sync_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."append_issue_memo"("p_issue_id" "uuid", "p_entry_text" "text", "p_effective_date" "date", "p_created_by" "uuid", "p_resolved" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."append_issue_memo"("p_issue_id" "uuid", "p_entry_text" "text", "p_effective_date" "date", "p_created_by" "uuid", "p_resolved" boolean) TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placements" TO "admin";



GRANT ALL ON FUNCTION "public"."archive_flock_closeout"("p_placement_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_flock_closeout"("p_placement_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_flock_closeout"("p_placement_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_version_on_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_version_on_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_version_on_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_farm"("target_farm_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_farm"("target_farm_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_farm"("target_farm_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_write_farm"("target_farm_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_write_farm"("target_farm_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_write_farm"("target_farm_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_scheduled_placement"("p_source_placement_id" "uuid", "p_target_placement_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_scheduled_placement"("p_source_placement_id" "uuid", "p_target_placement_id" "uuid", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_scheduled_placement"("p_source_placement_id" "uuid", "p_target_placement_id" "uuid", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_scheduled_placement"("p_source_placement_id" "uuid", "p_target_placement_id" "uuid", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_placement_key"("p_flock_id" "uuid", "p_barn_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_placement_key"("p_flock_id" "uuid", "p_barn_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_placement_key"("p_flock_id" "uuid", "p_barn_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_closeouts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_closeouts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_closeouts" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placement_closeouts" TO "admin";



GRANT ALL ON FUNCTION "public"."ensure_placement_closeout_row"("p_placement_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_placement_closeout_row"("p_placement_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_placement_closeout_row"("p_placement_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."feedbins_updatable_iud"() TO "anon";
GRANT ALL ON FUNCTION "public"."feedbins_updatable_iud"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."feedbins_updatable_iud"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fix_farms_updated_by_nulls"("target" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_nulls"("target" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_nulls"("target" "text") TO "supabase_admin";



REVOKE ALL ON FUNCTION "public"."fix_farms_updated_by_once"("target" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_once"("target" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_once"("target" "text") TO "supabase_admin";
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_once"("target" "text") TO "pg_database_owner";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."flocks_sync_barn_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."flocks_sync_barn_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."flocks_sync_barn_state"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "supabase_admin";



REVOKE ALL ON FUNCTION "public"."handle_new_user_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."inspect_placement_state"("p_placement_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."inspect_placement_state"("p_placement_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inspect_placement_state"("p_placement_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."make_placement_current"("p_placement_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."make_placement_current"("p_placement_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."make_placement_current"("p_placement_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_barn_empty"("p_barn_id" "uuid", "p_removed_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_barn_empty"("p_barn_id" "uuid", "p_removed_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_barn_empty"("p_barn_id" "uuid", "p_removed_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_chicks_arrived"("p_placement_id" "uuid", "p_arrival_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_chicks_arrived"("p_placement_id" "uuid", "p_arrival_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_chicks_arrived"("p_placement_id" "uuid", "p_arrival_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."placements_set_active_dates"() TO "anon";
GRANT ALL ON FUNCTION "public"."placements_set_active_dates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."placements_set_active_dates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."placements_set_defaults"() TO "anon";
GRANT ALL ON FUNCTION "public"."placements_set_defaults"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."placements_set_defaults"() TO "service_role";



GRANT ALL ON FUNCTION "public"."placements_sync_barn_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."placements_sync_barn_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."placements_sync_barn_state"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_issue_update_edit"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_issue_update_edit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_issue_update_edit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reassign_unassigned_placement"("p_placement_id" "uuid", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_start_date" "date", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reassign_unassigned_placement"("p_placement_id" "uuid", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_start_date" "date", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reassign_unassigned_placement"("p_placement_id" "uuid", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_start_date" "date", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reassign_unassigned_placement"("p_placement_id" "uuid", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_start_date" "date", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_signup_code"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_internal_voucher_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_internal_voucher_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_internal_voucher_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_user"("p_user_id" "uuid") TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_daily" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_daily" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_daily" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."log_daily" TO "admin";



GRANT ALL ON FUNCTION "public"."save_log_daily_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_log_daily_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_log_daily_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb") TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_mortality" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_mortality" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_mortality" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."log_mortality" TO "admin";



GRANT ALL ON FUNCTION "public"."save_log_mortality_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_log_mortality_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_log_mortality_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_payload" "jsonb") TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_weight" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_weight" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_weight" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."log_weight" TO "admin";



GRANT ALL ON FUNCTION "public"."save_log_weight_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_sex" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_log_weight_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_sex" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_log_weight_mobile"("p_placement_id" "uuid", "p_log_date" "date", "p_sex" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."sec_vacate_barn"("p_barn_id" "uuid", "p_vacate_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."sec_vacate_barn"("p_barn_id" "uuid", "p_vacate_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sec_vacate_barn"("p_barn_id" "uuid", "p_vacate_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_audit_timestamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_audit_timestamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_audit_timestamps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_audit_user_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_audit_user_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_audit_user_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_daily_age_tasks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_daily_age_tasks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_daily_age_tasks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_flock_max_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_flock_max_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_flock_max_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_issue_type_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_issue_type_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_issue_type_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_issue_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_issue_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_issue_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_profiles_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "supabase_admin";



GRANT ALL ON FUNCTION "public"."set_timestamp_farm_groups"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_timestamp_farm_groups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_timestamp_farm_groups"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_flock_closeout"("p_placement_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_flock_closeout"("p_placement_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_flock_closeout"("p_placement_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_barn_current_state"("p_barn_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_barn_current_state"("p_barn_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_barn_current_state"("p_barn_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_derived_placement_issues"("p_placement_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_derived_placement_issues"("p_placement_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_derived_placement_issues"("p_placement_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_placement_keys_for_barn"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_placement_keys_for_barn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_placement_keys_for_barn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_placement_keys_for_flock"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_placement_keys_for_flock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_placement_keys_for_flock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."unassign_scheduled_placement"("p_placement_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unassign_scheduled_placement"("p_placement_id" "uuid", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unassign_scheduled_placement"("p_placement_id" "uuid", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unassign_scheduled_placement"("p_placement_id" "uuid", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."v_placement_daily_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."v_placement_daily_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_placement_daily_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."v_placement_insert_daily"("p_placement_id" "uuid", "p_log_date" "date", "p_age_days" integer, "p_am_temp" numeric, "p_set_temp" numeric, "p_ambient_temp" numeric, "p_min_vent" numeric, "p_is_oda_open" boolean, "p_oda_exception" "text", "p_naoh" "text", "p_comment" "text", "p_daily_is_active" boolean, "p_daily_created_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."v_placement_insert_daily"("p_placement_id" "uuid", "p_log_date" "date", "p_age_days" integer, "p_am_temp" numeric, "p_set_temp" numeric, "p_ambient_temp" numeric, "p_min_vent" numeric, "p_is_oda_open" boolean, "p_oda_exception" "text", "p_naoh" "text", "p_comment" "text", "p_daily_is_active" boolean, "p_daily_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."v_placement_insert_daily"("p_placement_id" "uuid", "p_log_date" "date", "p_age_days" integer, "p_am_temp" numeric, "p_set_temp" numeric, "p_ambient_temp" numeric, "p_min_vent" numeric, "p_is_oda_open" boolean, "p_oda_exception" "text", "p_naoh" "text", "p_comment" "text", "p_daily_is_active" boolean, "p_daily_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_placement_insert_daily"("p_placement_id" "uuid", "p_log_date" "date", "p_age_days" integer, "p_am_temp" numeric, "p_set_temp" numeric, "p_ambient_temp" numeric, "p_min_vent" numeric, "p_is_oda_open" boolean, "p_oda_exception" "text", "p_naoh" "text", "p_comment" "text", "p_daily_is_active" boolean, "p_daily_created_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."v_placement_insert_mortality"("p_placement_id" "uuid", "p_log_date" "date", "p_dead_female" integer, "p_dead_male" integer, "p_cull_female" integer, "p_cull_male" integer, "p_cull_female_note" "text", "p_cull_male_note" "text", "p_dead_reason" "text", "p_grade_litter" integer, "p_grade_footpad" integer, "p_grade_feathers" integer, "p_grade_lame" integer, "p_grade_pecking" integer, "p_mortality_is_active" boolean, "p_mortality_created_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."v_placement_insert_mortality"("p_placement_id" "uuid", "p_log_date" "date", "p_dead_female" integer, "p_dead_male" integer, "p_cull_female" integer, "p_cull_male" integer, "p_cull_female_note" "text", "p_cull_male_note" "text", "p_dead_reason" "text", "p_grade_litter" integer, "p_grade_footpad" integer, "p_grade_feathers" integer, "p_grade_lame" integer, "p_grade_pecking" integer, "p_mortality_is_active" boolean, "p_mortality_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."v_placement_insert_mortality"("p_placement_id" "uuid", "p_log_date" "date", "p_dead_female" integer, "p_dead_male" integer, "p_cull_female" integer, "p_cull_male" integer, "p_cull_female_note" "text", "p_cull_male_note" "text", "p_dead_reason" "text", "p_grade_litter" integer, "p_grade_footpad" integer, "p_grade_feathers" integer, "p_grade_lame" integer, "p_grade_pecking" integer, "p_mortality_is_active" boolean, "p_mortality_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_placement_insert_mortality"("p_placement_id" "uuid", "p_log_date" "date", "p_dead_female" integer, "p_dead_male" integer, "p_cull_female" integer, "p_cull_male" integer, "p_cull_female_note" "text", "p_cull_male_note" "text", "p_dead_reason" "text", "p_grade_litter" integer, "p_grade_footpad" integer, "p_grade_feathers" integer, "p_grade_lame" integer, "p_grade_pecking" integer, "p_mortality_is_active" boolean, "p_mortality_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."v_placement_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."v_placement_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_placement_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."vacate_barn"("p_barn_id" "uuid", "p_vacate_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vacate_barn"("p_barn_id" "uuid", "p_vacate_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."write_activity_log"("p_placement_id" "uuid", "p_entry_type" "text", "p_action_key" "text", "p_details" "text", "p_source" "text", "p_actor_user_id" "uuid", "p_actor_name" "text", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_flock_id" "uuid", "p_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."write_activity_log"("p_placement_id" "uuid", "p_entry_type" "text", "p_action_key" "text", "p_details" "text", "p_source" "text", "p_actor_user_id" "uuid", "p_actor_name" "text", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_flock_id" "uuid", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."write_activity_log"("p_placement_id" "uuid", "p_entry_type" "text", "p_action_key" "text", "p_details" "text", "p_source" "text", "p_actor_user_id" "uuid", "p_actor_name" "text", "p_farm_id" "uuid", "p_barn_id" "uuid", "p_flock_id" "uuid", "p_meta" "jsonb") TO "service_role";



























GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."control" TO "service_role";



GRANT UPDATE("group") ON TABLE "platform"."control" TO "service_role";



GRANT UPDATE("version") ON TABLE "platform"."control" TO "service_role";



GRANT UPDATE("build") ON TABLE "platform"."control" TO "service_role";



GRANT UPDATE("released") ON TABLE "platform"."control" TO "service_role";



GRANT ALL ON SEQUENCE "platform"."control_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."license_policy" TO "service_role";



GRANT ALL ON SEQUENCE "platform"."license_policy_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."reportoptions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "platform"."reportoptions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "platform"."reportoptions" TO "authenticated";



GRANT ALL ON SEQUENCE "platform"."reportoptions_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."screen_txt" TO "service_role";



GRANT UPDATE("display") ON TABLE "platform"."screen_txt" TO "service_role";



GRANT UPDATE("note") ON TABLE "platform"."screen_txt" TO "service_role";



GRANT ALL ON SEQUENCE "platform"."screen_txt_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."settings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."sync_adapters" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."sync_audit" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."sync_endpoints" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."sync_googleapis_sheet_columns" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."sync_googleapis_sheets" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "platform"."sync_outbox" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."barns" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."barns" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."barns" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."barns" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farms" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farms" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farms" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farms" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."flocks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."flocks" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."flocks" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flocks" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."active_barns" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."active_barns" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."active_barns" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."active_barns" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."activity_log" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."activity_log" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."activity_log" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_log" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."app_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."app_settings" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."app_settings" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."app_users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."app_users" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."app_users" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."app_users" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."auth_audit_log_readable" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."auth_audit_log_readable" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."auth_audit_log_readable" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."auth_audit_log_readable" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."barn_view_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."barn_view_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."barn_view_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."barn_view_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."breeds" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."breeds" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."breeds" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."breeds" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."core_users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."core_users" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."core_users" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."core_users" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."core_users_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."core_users_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."core_users_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."core_users_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."daily_age_tasks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."daily_age_tasks" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."daily_age_tasks" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."daily_age_tasks" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_archives" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_archives" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."document_archives" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."document_archives" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_group_memberships" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_group_memberships" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_group_memberships" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farm_group_memberships" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_groups" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_groups" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_groups" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farm_groups" TO "admin";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."roles" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_group_memberships_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_group_memberships_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_group_memberships_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farm_group_memberships_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_memberships" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_memberships" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_memberships" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farm_memberships" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_memberships_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_memberships_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farm_memberships_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farm_memberships_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farms_admin_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farms_admin_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farms_admin_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farms_admin_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farms_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farms_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."farms_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farms_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_drops" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_drops" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_drops" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feed_drops" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_inventory_snapshots" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_inventory_snapshots" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_inventory_snapshots" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feed_inventory_snapshots" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_order_commitments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_order_commitments" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_order_commitments" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feed_order_commitments" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_tickets" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_tickets" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feed_tickets" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feed_tickets" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedbins" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedbins" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedbins" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feedbins" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedbins_updatable" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedbins_updatable" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedbins_updatable" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feedbins_updatable" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."issue_types" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."issue_types" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."issue_types" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."issue_types" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."issue_updates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."issue_updates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."issue_updates" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."issue_updates" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."issues" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."issues" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."issues" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."issues" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."livehaul_loads" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."livehaul_loads" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."livehaul_loads" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."livehaul_loads" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."livehaul_schedule" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."livehaul_schedule" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."livehaul_schedule" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."livehaul_schedule" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_mortality_readable" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_mortality_readable" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."log_mortality_readable" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."log_mortality_readable" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_day_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_day_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_day_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placement_day_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_log_daily_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_log_daily_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_log_daily_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placement_log_daily_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_log_daily_ui2" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_log_daily_ui2" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placement_log_daily_ui2" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placement_log_daily_ui2" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements_dashboard_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements_dashboard_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements_dashboard_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placements_dashboard_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements_ui" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements_ui" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placements_ui" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements_ui2" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements_ui2" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."placements_ui2" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placements_ui2" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."role_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."role_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."role_permissions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."role_permissions" TO "admin";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles_actions_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles_actions_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles_actions_permissions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."roles_actions_permissions" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."signup_codes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."signup_codes" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stdbreedspec" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stdbreedspec" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stdbreedspec" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."stdbreedspec" TO "admin";



GRANT ALL ON SEQUENCE "public"."stdbreedspec_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stdbreedspec_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stdbreedspec_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."stdbreedspec_id_seq" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sync_control-index" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sync_control-index" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sync_control-index" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sync_control-index" TO "admin";



GRANT ALL ON SEQUENCE "public"."sync_control-index_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sync_control-index_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sync_control-index_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."sync_control-index_id_seq" TO "admin";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sysactions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sysactions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sysactions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sysactions" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."todos" TO "admin";



GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_roles" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_livehaul_edit_lookup" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_livehaul_edit_lookup" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_livehaul_edit_lookup" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_livehaul_edit_lookup" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_livehaul_schedule_lookup" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_livehaul_schedule_lookup" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_livehaul_schedule_lookup" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_livehaul_schedule_lookup" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_placement" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_placement" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_placement" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_placement" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_placement_daily" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_placement_daily" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_placement_daily" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_placement_daily" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_placement_day" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_placement_day" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_placement_day" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_placement_day" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_records_with_creator" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_records_with_creator" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_records_with_creator" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_records_with_creator" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_role_action_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_role_action_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_role_action_permissions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_role_action_permissions" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_role_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_role_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_role_permissions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_role_permissions" TO "admin";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_user_role_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_user_role_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."v_user_role_permissions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_user_role_permissions" TO "admin";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "platform" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "platform" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "platform" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "admin";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "admin";





























