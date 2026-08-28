

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


CREATE SCHEMA IF NOT EXISTS "gsync";


ALTER SCHEMA "gsync" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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
        and r.role_key in ('admin','manager')
    );
$$;


ALTER FUNCTION "public"."can_write_farm"("target_farm_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."placements_set_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_farm_id uuid; v_barn_code text; v_flock_num integer; v_flock_farm uuid; v_flock_date date;
begin
  select b.farm_id, b.barn_code into v_farm_id, v_barn_code from public.barns b where b.id = new.barn_id;
  select f.farm_id, f.flock_number, f.date_placed into v_flock_farm, v_flock_num, v_flock_date from public.flocks f where f.id = new.flock_id;
  if v_farm_id is null or v_flock_farm is null then raise exception 'Invalid barn_id or flock_id for placement'; end if;
  if v_farm_id <> v_flock_farm then raise exception 'Farm mismatch: barn.farm_id (%) != flock.farm_id (%)', v_farm_id, v_flock_farm; end if;
  new.farm_id := v_farm_id;
  if new.date_placed is null then new.date_placed := v_flock_date; end if;
  new.placement_key := v_flock_num::text || '-' || v_barn_code;
  return new;
end; $$;


ALTER FUNCTION "public"."placements_set_defaults"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."placements_sync_barn_state"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (new.is_active = true and new.date_removed is null) then
    update public.placements set is_active = false, date_removed = coalesce(date_removed, current_date), updated_at = now()
    where barn_id = new.barn_id and id <> new.id and is_active = true and date_removed is null;
    update public.barns set active_flock_id = new.flock_id, has_flock = true, is_empty = false, updated_at = now() where id = new.barn_id;
  end if;
  if (new.is_active = false or new.date_removed is not null) then
    update public.barns set active_flock_id = null, has_flock = false, is_empty = true, updated_at = now()
    where id = new.barn_id and active_flock_id = new.flock_id;
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."placements_sync_barn_state"() OWNER TO "postgres";


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
    new.updated_by := auth.uid();
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_by := auth.uid();
    return new;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_audit_user_columns"() OWNER TO "postgres";


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

SET default_tablespace = '';

SET default_table_access_method = "heap";


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


ALTER TABLE "gsync"."outbox_id_seq" OWNER TO "postgres";


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
    CONSTRAINT "farms_updated_by_present_ck" CHECK (("updated_by" IS NOT NULL))
);


ALTER TABLE "public"."farms" OWNER TO "postgres";


COMMENT ON TABLE "public"."farms" IS 'Defines locations where grower operates under a Group';



CREATE TABLE IF NOT EXISTS "public"."flocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "flock_number" integer NOT NULL,
    "date_placed" "date",
    "max_date" "date",
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
    "breed_females" "uuid"
);


ALTER TABLE "public"."flocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."flocks" IS 'Base dataset that creats a group of chicks started together and grown in the same location (farm-barn) as a group.';



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


ALTER TABLE "public"."active_barns" OWNER TO "postgres";


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


ALTER TABLE "public"."barn_view_ui" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."core_users" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."core_users" OWNER TO "postgres";


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


ALTER TABLE "public"."farms_ui" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "placement_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "age_days" integer,
    "am_temp" numeric,
    "set_temp" numeric,
    "ambient_temp" numeric,
    "min_vent" "text",
    "is_oda_open" boolean DEFAULT false NOT NULL,
    "oda_exception" "text",
    "naoh" "text",
    "comment" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."log_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."log_daily" IS 'General environmental & conditions data for a flock.  These records maybe 1 per day or multiple rows for each day.';



CREATE TABLE IF NOT EXISTS "public"."log_mortality" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "placement_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "dead_female" integer DEFAULT 0 NOT NULL,
    "dead_male" integer DEFAULT 0 NOT NULL,
    "cull_female" integer DEFAULT 0 NOT NULL,
    "cull_male" integer DEFAULT 0 NOT NULL,
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
    "created_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."log_mortality" OWNER TO "postgres";


COMMENT ON TABLE "public"."log_mortality" IS 'This data records the mortality & other losses during a flock cycle.  There is also field for analysis of health markers during the flock cycle.  There maybe a single entry per day or multiple entries.';



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
    "updated_by" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."log_weight" OWNER TO "postgres";


COMMENT ON TABLE "public"."log_weight" IS 'These records maintain actual scale weighs obtained during the flock cycle.';



CREATE TABLE IF NOT EXISTS "public"."placements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "barn_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "date_placed" "date",
    "date_removed" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "placement_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."placements" OWNER TO "postgres";


COMMENT ON TABLE "public"."placements" IS 'These records create the primary dataset of FlockTRAX.  This dataset brings the Farm.Barn physical location and assigns an integrator''s set of chicks (Flock) together to create the statistical backbone of FlockTRAX.  Using this dataset, the sync_engine backend will automatically maintain the integrator''s database of choice without the individual FlockTRAX users needing access.';



CREATE OR REPLACE VIEW "public"."placement_log_daily_ui" AS
 SELECT "ld"."id" AS "log_daily_id",
    "ld"."placement_id",
    "ld"."log_date",
    "ld"."age_days",
    "ld"."am_temp",
    "ld"."set_temp",
    "ld"."ambient_temp",
    "ld"."is_oda_open",
    "ld"."comment",
    "ld"."created_at",
    "ld"."updated_at",
    "ld"."created_by",
    "p"."placement_key",
    "p"."farm_id",
    "f"."farm_code",
    "f"."farm_name",
    "p"."barn_id",
    "b"."barn_code",
    "p"."flock_id",
    "fl"."flock_number",
    "p"."date_placed",
    "p"."date_removed",
    "p"."is_active",
    "p"."created_at" AS "placement_created_at",
    "p"."updated_at" AS "placement_updated_at"
   FROM (((("public"."log_daily" "ld"
     JOIN "public"."placements" "p" ON (("p"."id" = "ld"."placement_id")))
     JOIN "public"."farms" "f" ON (("f"."id" = "p"."farm_id")))
     JOIN "public"."barns" "b" ON (("b"."id" = "p"."barn_id")))
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "p"."flock_id")));


ALTER TABLE "public"."placement_log_daily_ui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."placement_log_daily_ui2" AS
 SELECT "ld"."id" AS "log_daily_id",
    "ld"."placement_id",
    "ld"."log_date",
    "ld"."age_days",
    "ld"."am_temp",
    "ld"."set_temp",
    "ld"."ambient_temp",
    "ld"."min_vent",
    "ld"."is_active" AS "log_daily_is_active",
    "ld"."is_oda_open",
    "ld"."comment",
    "ld"."created_at",
    "ld"."updated_at",
    "ld"."created_by",
    "p"."placement_key",
    "p"."farm_id",
    "f"."farm_code",
    "f"."farm_name",
    "p"."barn_id",
    "b"."barn_code",
    "p"."flock_id",
    "fl"."flock_number",
    "p"."date_placed",
    "p"."date_removed",
    "p"."is_active",
    "p"."created_at" AS "placement_created_at",
    "p"."updated_at" AS "placement_updated_at"
   FROM (((("public"."log_daily" "ld"
     JOIN "public"."placements" "p" ON (("p"."id" = "ld"."placement_id")))
     JOIN "public"."farms" "f" ON (("f"."id" = "p"."farm_id")))
     JOIN "public"."barns" "b" ON (("b"."id" = "p"."barn_id")))
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "p"."flock_id")));


ALTER TABLE "public"."placement_log_daily_ui2" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."placements_ui" AS
 SELECT "p"."id" AS "placement_id",
    "p"."placement_key",
    "p"."farm_id",
    "f"."farm_code",
    "f"."farm_name",
    "p"."barn_id",
    "b"."barn_code",
    "p"."flock_id",
    "fl"."flock_number",
    "p"."date_placed",
    "p"."date_removed",
    "p"."is_active",
    "p"."created_at",
    "p"."updated_at",
    "b"."sort_code",
    (("p"."date_placed" + '38 days'::interval))::"date" AS "first_catch"
   FROM ((("public"."placements" "p"
     JOIN "public"."farms" "f" ON (("f"."id" = "p"."farm_id")))
     JOIN "public"."barns" "b" ON (("b"."id" = "p"."barn_id")))
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "p"."flock_id")));


ALTER TABLE "public"."placements_ui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."placements_ui2" AS
 SELECT "p"."id" AS "placement_id",
    "p"."placement_key",
    "p"."farm_id",
    "f"."farm_code",
    "f"."farm_name",
    "p"."barn_id",
    "b"."barn_code",
    "p"."flock_id",
    "fl"."flock_number",
    "p"."date_placed",
    "p"."date_removed",
    "p"."is_active",
    "p"."created_at",
    "p"."updated_at",
    "b"."sort_code",
    (("p"."date_placed" + '38 days'::interval))::"date" AS "first_catch",
    ("ceil"((EXTRACT(epoch FROM ("now"() - ("p"."date_placed")::timestamp with time zone)) / 86400.0)))::integer AS "age_today"
   FROM ((("public"."placements" "p"
     JOIN "public"."farms" "f" ON (("f"."id" = "p"."farm_id")))
     JOIN "public"."barns" "b" ON (("b"."id" = "p"."barn_id")))
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "p"."flock_id")));


ALTER TABLE "public"."placements_ui2" OWNER TO "postgres";


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



CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "resource" "text" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


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


ALTER TABLE "public"."stdbreedspec_id_seq" OWNER TO "postgres";


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
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'UI & Supabase Permission Classifications';



CREATE OR REPLACE VIEW "public"."v_placement" AS
 SELECT COALESCE("d"."placement_id", "m"."placement_id") AS "placement_id",
    COALESCE("d"."log_date", "m"."log_date") AS "log_date",
    "d"."age_days",
    "d"."am_temp",
    "d"."set_temp",
    "d"."ambient_temp",
    "d"."min_vent",
    "d"."is_oda_open",
    "d"."oda_exception",
    "d"."naoh",
    "d"."comment",
    "d"."is_active" AS "daily_is_active",
    "d"."created_by" AS "daily_created_by",
    "d"."updated_by" AS "daily_updated_by",
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
    "m"."created_by" AS "mortality_created_by",
    "m"."updated_by" AS "mortality_updated_by"
   FROM ("public"."log_daily" "d"
     FULL JOIN "public"."log_mortality" "m" ON ((("d"."placement_id" = "m"."placement_id") AND ("d"."log_date" = "m"."log_date"))));


ALTER TABLE "public"."v_placement" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_placement_daily" WITH ("security_invoker"='on') AS
 SELECT "d"."placement_id",
    "d"."log_date",
    "d"."age_days",
    "d"."am_temp",
    "d"."set_temp",
    "d"."ambient_temp",
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
    NULL::"uuid" AS "daily_created_by",
    NULL::"uuid" AS "daily_updated_by",
    NULL::"uuid" AS "mortality_created_by",
    NULL::"uuid" AS "mortality_updated_by"
   FROM ("public"."log_daily" "d"
     LEFT JOIN "public"."log_mortality" "m" ON ((("m"."placement_id" = "d"."placement_id") AND ("m"."log_date" = "d"."log_date"))))
UNION ALL
 SELECT "m"."placement_id",
    "m"."log_date",
    NULL::integer AS "age_days",
    NULL::numeric AS "am_temp",
    NULL::numeric AS "set_temp",
    NULL::numeric AS "ambient_temp",
    NULL::"text" AS "min_vent",
    NULL::boolean AS "is_oda_open",
    NULL::"text" AS "oda_exception",
    NULL::"text" AS "naoh",
    NULL::"text" AS "comment",
    NULL::boolean AS "daily_is_active",
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
    NULL::"uuid" AS "daily_created_by",
    NULL::"uuid" AS "daily_updated_by",
    NULL::"uuid" AS "mortality_created_by",
    NULL::"uuid" AS "mortality_updated_by"
   FROM ("public"."log_mortality" "m"
     LEFT JOIN "public"."log_daily" "d" ON ((("d"."placement_id" = "m"."placement_id") AND ("d"."log_date" = "m"."log_date"))))
  WHERE ("d"."placement_id" IS NULL);


ALTER TABLE "public"."v_placement_daily" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_adalo_user_id_key" UNIQUE ("adalo_user_id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE "public"."barns"
    ADD CONSTRAINT "barns_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."barns"
    ADD CONSTRAINT "barns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."core_users"
    ADD CONSTRAINT "core_users_pkey" PRIMARY KEY ("id");



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



ALTER TABLE "public"."flocks"
    ADD CONSTRAINT "flocks_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_farm_id_flock_number_key" UNIQUE ("farm_id", "flock_number");



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."log_mortality"
    ADD CONSTRAINT "log_mortality_placement_id_log_date_key" UNIQUE ("placement_id", "log_date");



ALTER TABLE ONLY "public"."log_mortality"
    ADD CONSTRAINT "log_mortality_unique" UNIQUE ("placement_id", "log_date");



ALTER TABLE "public"."log_weight"
    ADD CONSTRAINT "log_weight_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."log_weight"
    ADD CONSTRAINT "log_weight_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."placements"
    ADD CONSTRAINT "placements_created_by_present_ck" CHECK (("created_by" IS NOT NULL)) NOT VALID;



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_resource_action_key" UNIQUE ("role_id", "resource", "action");



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



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barns"
    ADD CONSTRAINT "uq_barns_farm_code" UNIQUE ("farm_id", "barn_code");



ALTER TABLE ONLY "public"."farm_groups"
    ADD CONSTRAINT "uq_farm_groups_group_name" UNIQUE ("group_name");



ALTER TABLE ONLY "public"."log_daily"
    ADD CONSTRAINT "uq_log_daily" UNIQUE ("placement_id", "log_date");



ALTER TABLE ONLY "public"."log_mortality"
    ADD CONSTRAINT "uq_log_mortality" UNIQUE ("placement_id", "log_date");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role");



CREATE INDEX "outbox_pending_idx" ON "gsync"."outbox" USING "btree" ("status", "created_at");



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



CREATE INDEX "idx_flocks_created_by" ON "public"."flocks" USING "btree" ("created_by");



CREATE INDEX "idx_log_daily_created_by" ON "public"."log_daily" USING "btree" ("created_by");



CREATE INDEX "idx_log_daily_log_date" ON "public"."log_daily" USING "btree" ("log_date");



CREATE INDEX "idx_log_daily_place_date" ON "public"."log_daily" USING "btree" ("placement_id", "log_date");



CREATE INDEX "idx_log_daily_placement" ON "public"."log_daily" USING "btree" ("placement_id");



CREATE INDEX "idx_log_daily_placement_date" ON "public"."log_daily" USING "btree" ("placement_id", "log_date");



CREATE INDEX "idx_log_mortality_created_by" ON "public"."log_mortality" USING "btree" ("created_by");



CREATE INDEX "idx_log_mortality_place_date" ON "public"."log_mortality" USING "btree" ("placement_id", "log_date");



CREATE INDEX "idx_log_mortality_placement_date" ON "public"."log_mortality" USING "btree" ("placement_id", "log_date");



CREATE INDEX "idx_log_weight_created_by" ON "public"."log_weight" USING "btree" ("created_by");



CREATE INDEX "idx_placements_created_by" ON "public"."placements" USING "btree" ("created_by");



CREATE INDEX "idx_profiles_id" ON "public"."profiles" USING "btree" ("id");



CREATE INDEX "idx_role_permissions_resource_action" ON "public"."role_permissions" USING "btree" ("resource", "action");



CREATE INDEX "idx_role_permissions_role_id" ON "public"."role_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_stdbreedspec_breed_age" ON "public"."stdbreedspec" USING "btree" ("breedid", "age");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_user_role" ON "public"."user_roles" USING "btree" ("user_id", "role");



CREATE INDEX "ix_barns_active_flock" ON "public"."barns" USING "btree" ("active_flock_id");



CREATE INDEX "ix_barns_farm" ON "public"."barns" USING "btree" ("farm_id");



CREATE INDEX "ix_farm_memberships_user_farm" ON "public"."farm_memberships" USING "btree" ("user_id", "farm_id");



CREATE INDEX "ix_flocks_active" ON "public"."flocks" USING "btree" ("is_active");



CREATE INDEX "ix_flocks_farm" ON "public"."flocks" USING "btree" ("farm_id");



CREATE INDEX "ix_log_daily_placement_date" ON "public"."log_daily" USING "btree" ("placement_id", "log_date");



CREATE INDEX "ix_log_mortality_placement_date" ON "public"."log_mortality" USING "btree" ("placement_id", "log_date");



CREATE INDEX "ix_log_weight_placement_date" ON "public"."log_weight" USING "btree" ("placement_id", "log_date");



CREATE INDEX "ix_logs_daily_place" ON "public"."log_daily" USING "btree" ("placement_id");



CREATE INDEX "ix_logs_mortality_place" ON "public"."log_mortality" USING "btree" ("placement_id");



CREATE INDEX "ix_logs_weight_place" ON "public"."log_weight" USING "btree" ("placement_id");



CREATE INDEX "ix_placements_active_barn" ON "public"."placements" USING "btree" ("barn_id") WHERE (("is_active" = true) AND ("date_removed" IS NULL));



CREATE INDEX "ix_placements_farm" ON "public"."placements" USING "btree" ("farm_id");



CREATE INDEX "ix_placements_flock_barn" ON "public"."placements" USING "btree" ("flock_id", "barn_id");



CREATE INDEX "ix_profiles_email" ON "public"."profiles" USING "btree" ("lower"("email"));



CREATE INDEX "ix_user_roles_user" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "signup_codes_active_idx" ON "public"."signup_codes" USING "btree" ("active");



CREATE INDEX "signup_codes_expires_idx" ON "public"."signup_codes" USING "btree" ("expires_at");



CREATE INDEX "signup_codes_farm_idx" ON "public"."signup_codes" USING "btree" ("farm_id");



CREATE UNIQUE INDEX "uq_active_placement_per_barn" ON "public"."placements" USING "btree" ("barn_id") WHERE (("is_active" = true) AND ("date_removed" IS NULL));



CREATE UNIQUE INDEX "uqidx_farm_groups_group_name" ON "public"."farm_groups" USING "btree" ("group_name");



CREATE OR REPLACE TRIGGER "set_audit_user_columns_barns" BEFORE INSERT OR UPDATE ON "public"."barns" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_farms" BEFORE INSERT OR UPDATE ON "public"."farms" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_flocks" BEFORE INSERT OR UPDATE ON "public"."flocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_log_daily" BEFORE INSERT OR UPDATE ON "public"."log_daily" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_log_mortality" BEFORE INSERT OR UPDATE ON "public"."log_mortality" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_log_weight" BEFORE INSERT OR UPDATE ON "public"."log_weight" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_audit_user_columns_placements" BEFORE INSERT OR UPDATE ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_user_columns"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "stdbreedspec_audit_ts" BEFORE INSERT OR UPDATE ON "public"."stdbreedspec" FOR EACH ROW EXECUTE FUNCTION "public"."set_audit_timestamps"();



CREATE OR REPLACE TRIGGER "trg_barns_updated_at" BEFORE UPDATE ON "public"."barns" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_farm_memberships_updated_at" BEFORE UPDATE ON "public"."farm_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_farms_updated_at" BEFORE UPDATE ON "public"."farms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_flocks_updated_at" BEFORE UPDATE ON "public"."flocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_daily_updated_at" BEFORE UPDATE ON "public"."log_daily" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_mortality_updated_at" BEFORE UPDATE ON "public"."log_mortality" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_weight_updated_at" BEFORE UPDATE ON "public"."log_weight" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_placements_set_defaults" BEFORE INSERT OR UPDATE OF "barn_id", "flock_id" ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."placements_set_defaults"();



CREATE OR REPLACE TRIGGER "trg_placements_sync_barn_state" AFTER INSERT OR UPDATE OF "is_active", "date_removed", "barn_id", "flock_id" ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."placements_sync_barn_state"();



CREATE OR REPLACE TRIGGER "trg_placements_updated_at" BEFORE UPDATE ON "public"."placements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_timestamp_farm_groups" BEFORE UPDATE ON "public"."farm_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_farm_groups"();



CREATE OR REPLACE TRIGGER "trg_user_roles_updated_at" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "v_placement_daily_write_trg" INSTEAD OF INSERT OR UPDATE ON "public"."v_placement_daily" FOR EACH ROW EXECUTE FUNCTION "public"."v_placement_daily_write"();



CREATE OR REPLACE TRIGGER "v_placement_ins" INSTEAD OF INSERT ON "public"."v_placement" FOR EACH ROW EXECUTE FUNCTION "public"."v_placement_write"();



CREATE OR REPLACE TRIGGER "v_placement_upd" INSTEAD OF UPDATE ON "public"."v_placement" FOR EACH ROW EXECUTE FUNCTION "public"."v_placement_write"();



ALTER TABLE ONLY "gsync"."column_map"
    ADD CONSTRAINT "column_map_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "gsync"."tab"("tab_id") ON DELETE CASCADE;



ALTER TABLE ONLY "gsync"."outbox"
    ADD CONSTRAINT "outbox_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "gsync"."tab"("tab_id") ON DELETE CASCADE;



ALTER TABLE ONLY "gsync"."sync_job"
    ADD CONSTRAINT "sync_job_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "gsync"."tab"("tab_id") ON DELETE CASCADE;



ALTER TABLE ONLY "gsync"."tab"
    ADD CONSTRAINT "tab_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "gsync"."sheet"("sheet_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barns"
    ADD CONSTRAINT "barns_active_flock_id_fkey" FOREIGN KEY ("active_flock_id") REFERENCES "public"."flocks"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."barns"
    ADD CONSTRAINT "barns_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."farm_group_memberships"
    ADD CONSTRAINT "farm_group_memberships_farm_group_id_fkey" FOREIGN KEY ("farm_group_id") REFERENCES "public"."farm_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."farm_group_memberships"
    ADD CONSTRAINT "farm_group_memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."farm_group_memberships"
    ADD CONSTRAINT "farm_group_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."farm_groups"
    ADD CONSTRAINT "farm_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."farm_groups"
    ADD CONSTRAINT "farm_groups_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."farm_memberships"
    ADD CONSTRAINT "farm_memberships_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."farm_memberships"
    ADD CONSTRAINT "farm_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."farms"
    ADD CONSTRAINT "farms_farm_group_id_fkey" FOREIGN KEY ("farm_group_id") REFERENCES "public"."farm_groups"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."log_daily"
    ADD CONSTRAINT "log_daily_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."log_mortality"
    ADD CONSTRAINT "log_mortality_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."log_weight"
    ADD CONSTRAINT "log_weight_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE CASCADE;



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



ALTER TABLE "gsync"."sheet" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "gsync"."trax2sheets_map" ENABLE ROW LEVEL SECURITY;


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



CREATE POLICY "admin_all_stdbreedspec" ON "public"."stdbreedspec" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_all_todos" ON "public"."todos" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "anon_read_stdbreedspec" ON "public"."stdbreedspec" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_sync_control_index" ON "public"."sync_control-index" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_todos" ON "public"."todos" FOR SELECT TO "anon" USING (true);



CREATE POLICY "auth_insert_todos" ON "public"."todos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth_insert_user_roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (true);



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



ALTER TABLE "public"."flocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flocks_admin_all" ON "public"."flocks" TO "admin" USING (true) WITH CHECK (true);



CREATE POLICY "flocks_anon_select" ON "public"."flocks" FOR SELECT TO "anon" USING (true);



CREATE POLICY "flocks_auth_select" ON "public"."flocks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "flocks_auth_write" ON "public"."flocks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "flocks_delete" ON "public"."flocks" FOR DELETE TO "authenticated" USING ("public"."can_write_farm"("farm_id"));



CREATE POLICY "flocks_insert" ON "public"."flocks" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_write_farm"("farm_id"));



CREATE POLICY "flocks_read" ON "public"."flocks" FOR SELECT TO "authenticated" USING ("public"."can_access_farm"("farm_id"));



CREATE POLICY "flocks_update" ON "public"."flocks" FOR UPDATE TO "authenticated" USING ("public"."can_write_farm"("farm_id")) WITH CHECK ("public"."can_write_farm"("farm_id"));



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



ALTER TABLE "public"."signup_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stdbreedspec" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_control-index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_insert_own_memberships" ON "public"."farm_memberships" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_read" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "user_roles_write" ON "public"."user_roles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "user_select_own_memberships" ON "public"."farm_memberships" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_update_own_memberships" ON "public"."farm_memberships" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."todos";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "admin";

























































































































































GRANT ALL ON FUNCTION "public"."can_access_farm"("target_farm_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_farm"("target_farm_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_farm"("target_farm_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_write_farm"("target_farm_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_write_farm"("target_farm_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_write_farm"("target_farm_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fix_farms_updated_by_nulls"("target" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_nulls"("target" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_nulls"("target" "text") TO "supabase_admin";



REVOKE ALL ON FUNCTION "public"."fix_farms_updated_by_once"("target" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_once"("target" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_once"("target" "text") TO "supabase_admin";
GRANT ALL ON FUNCTION "public"."fix_farms_updated_by_once"("target" "text") TO "pg_database_owner";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "supabase_admin";



REVOKE ALL ON FUNCTION "public"."handle_new_user_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."placements_set_defaults"() TO "anon";
GRANT ALL ON FUNCTION "public"."placements_set_defaults"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."placements_set_defaults"() TO "service_role";



GRANT ALL ON FUNCTION "public"."placements_sync_barn_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."placements_sync_barn_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."placements_sync_barn_state"() TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_signup_code"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_audit_timestamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_audit_timestamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_audit_timestamps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_audit_user_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_audit_user_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_audit_user_columns"() TO "service_role";



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


















GRANT ALL ON TABLE "public"."barns" TO "anon";
GRANT ALL ON TABLE "public"."barns" TO "authenticated";
GRANT ALL ON TABLE "public"."barns" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."barns" TO "admin";



GRANT ALL ON TABLE "public"."farms" TO "anon";
GRANT ALL ON TABLE "public"."farms" TO "authenticated";
GRANT ALL ON TABLE "public"."farms" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farms" TO "admin";



GRANT ALL ON TABLE "public"."flocks" TO "anon";
GRANT ALL ON TABLE "public"."flocks" TO "authenticated";
GRANT ALL ON TABLE "public"."flocks" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flocks" TO "admin";



GRANT ALL ON TABLE "public"."active_barns" TO "anon";
GRANT ALL ON TABLE "public"."active_barns" TO "authenticated";
GRANT ALL ON TABLE "public"."active_barns" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."active_barns" TO "admin";



GRANT ALL ON TABLE "public"."app_users" TO "anon";
GRANT ALL ON TABLE "public"."app_users" TO "authenticated";
GRANT ALL ON TABLE "public"."app_users" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."app_users" TO "admin";



GRANT ALL ON TABLE "public"."barn_view_ui" TO "anon";
GRANT ALL ON TABLE "public"."barn_view_ui" TO "authenticated";
GRANT ALL ON TABLE "public"."barn_view_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."barn_view_ui" TO "admin";



GRANT ALL ON TABLE "public"."core_users" TO "anon";
GRANT ALL ON TABLE "public"."core_users" TO "authenticated";
GRANT ALL ON TABLE "public"."core_users" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."core_users" TO "admin";



GRANT ALL ON TABLE "public"."farm_group_memberships" TO "anon";
GRANT ALL ON TABLE "public"."farm_group_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."farm_group_memberships" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farm_group_memberships" TO "admin";



GRANT ALL ON TABLE "public"."farm_groups" TO "anon";
GRANT ALL ON TABLE "public"."farm_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."farm_groups" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farm_groups" TO "admin";



GRANT ALL ON TABLE "public"."farm_memberships" TO "anon";
GRANT ALL ON TABLE "public"."farm_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."farm_memberships" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farm_memberships" TO "admin";



GRANT ALL ON TABLE "public"."farms_ui" TO "anon";
GRANT ALL ON TABLE "public"."farms_ui" TO "authenticated";
GRANT ALL ON TABLE "public"."farms_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."farms_ui" TO "admin";



GRANT ALL ON TABLE "public"."log_daily" TO "anon";
GRANT ALL ON TABLE "public"."log_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."log_daily" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."log_daily" TO "admin";



GRANT ALL ON TABLE "public"."log_mortality" TO "anon";
GRANT ALL ON TABLE "public"."log_mortality" TO "authenticated";
GRANT ALL ON TABLE "public"."log_mortality" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."log_mortality" TO "admin";



GRANT ALL ON TABLE "public"."log_weight" TO "anon";
GRANT ALL ON TABLE "public"."log_weight" TO "authenticated";
GRANT ALL ON TABLE "public"."log_weight" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."log_weight" TO "admin";



GRANT ALL ON TABLE "public"."placements" TO "anon";
GRANT ALL ON TABLE "public"."placements" TO "authenticated";
GRANT ALL ON TABLE "public"."placements" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placements" TO "admin";



GRANT ALL ON TABLE "public"."placement_log_daily_ui" TO "anon";
GRANT ALL ON TABLE "public"."placement_log_daily_ui" TO "authenticated";
GRANT ALL ON TABLE "public"."placement_log_daily_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placement_log_daily_ui" TO "admin";



GRANT ALL ON TABLE "public"."placement_log_daily_ui2" TO "anon";
GRANT ALL ON TABLE "public"."placement_log_daily_ui2" TO "authenticated";
GRANT ALL ON TABLE "public"."placement_log_daily_ui2" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placement_log_daily_ui2" TO "admin";



GRANT ALL ON TABLE "public"."placements_ui" TO "anon";
GRANT ALL ON TABLE "public"."placements_ui" TO "authenticated";
GRANT ALL ON TABLE "public"."placements_ui" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placements_ui" TO "admin";



GRANT ALL ON TABLE "public"."placements_ui2" TO "anon";
GRANT ALL ON TABLE "public"."placements_ui2" TO "authenticated";
GRANT ALL ON TABLE "public"."placements_ui2" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."placements_ui2" TO "admin";



GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "admin";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."role_permissions" TO "admin";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."roles" TO "admin";



GRANT ALL ON TABLE "public"."signup_codes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."signup_codes" TO "admin";



GRANT ALL ON TABLE "public"."stdbreedspec" TO "anon";
GRANT ALL ON TABLE "public"."stdbreedspec" TO "authenticated";
GRANT ALL ON TABLE "public"."stdbreedspec" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."stdbreedspec" TO "admin";



GRANT ALL ON SEQUENCE "public"."stdbreedspec_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stdbreedspec_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stdbreedspec_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."stdbreedspec_id_seq" TO "admin";



GRANT ALL ON TABLE "public"."sync_control-index" TO "anon";
GRANT ALL ON TABLE "public"."sync_control-index" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_control-index" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sync_control-index" TO "admin";



GRANT ALL ON SEQUENCE "public"."sync_control-index_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sync_control-index_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sync_control-index_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."sync_control-index_id_seq" TO "admin";



GRANT ALL ON TABLE "public"."todos" TO "anon";
GRANT ALL ON TABLE "public"."todos" TO "authenticated";
GRANT ALL ON TABLE "public"."todos" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."todos" TO "admin";



GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "admin";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_roles" TO "admin";



GRANT ALL ON TABLE "public"."v_placement" TO "anon";
GRANT ALL ON TABLE "public"."v_placement" TO "authenticated";
GRANT ALL ON TABLE "public"."v_placement" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_placement" TO "admin";



GRANT ALL ON TABLE "public"."v_placement_daily" TO "anon";
GRANT ALL ON TABLE "public"."v_placement_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."v_placement_daily" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_placement_daily" TO "admin";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "admin";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO "admin";






























