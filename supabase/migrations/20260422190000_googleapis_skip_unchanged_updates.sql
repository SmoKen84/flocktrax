create or replace function platform.sync_enqueue_googleapis_log_daily()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
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

create or replace function platform.sync_enqueue_googleapis_log_mortality()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
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

create or replace function platform.sync_enqueue_googleapis_log_weight()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
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
