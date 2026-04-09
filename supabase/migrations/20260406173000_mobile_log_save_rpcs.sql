create or replace function public.save_log_daily_mobile(
  p_placement_id uuid,
  p_log_date date,
  p_payload jsonb default '{}'::jsonb
)
returns public.log_daily
language plpgsql
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_row public.log_daily;
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
  end if;

  return v_row;
end;
$$;

grant execute on function public.save_log_daily_mobile(uuid, date, jsonb) to authenticated;
grant execute on function public.save_log_daily_mobile(uuid, date, jsonb) to service_role;

create or replace function public.save_log_mortality_mobile(
  p_placement_id uuid,
  p_log_date date,
  p_payload jsonb default '{}'::jsonb
)
returns public.log_mortality
language plpgsql
set search_path = public
as $$
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
      case when p_payload ? 'dead_female' and jsonb_typeof(p_payload->'dead_female') <> 'null' then (p_payload->>'dead_female')::integer else 0 end,
      case when p_payload ? 'dead_male' and jsonb_typeof(p_payload->'dead_male') <> 'null' then (p_payload->>'dead_male')::integer else 0 end,
      case when p_payload ? 'cull_female' and jsonb_typeof(p_payload->'cull_female') <> 'null' then (p_payload->>'cull_female')::integer else 0 end,
      case when p_payload ? 'cull_male' and jsonb_typeof(p_payload->'cull_male') <> 'null' then (p_payload->>'cull_male')::integer else 0 end,
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

grant execute on function public.save_log_mortality_mobile(uuid, date, jsonb) to authenticated;
grant execute on function public.save_log_mortality_mobile(uuid, date, jsonb) to service_role;
