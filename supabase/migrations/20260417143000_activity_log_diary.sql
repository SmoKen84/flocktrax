create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamp with time zone not null default now(),
  entry_type text not null,
  action_key text not null,
  details text not null default '',
  source text,
  placement_id uuid references public.placements(id) on delete set null,
  flock_id uuid references public.flocks(id) on delete set null,
  farm_id uuid references public.farms(id) on delete set null,
  barn_id uuid references public.barns(id) on delete set null,
  user_id uuid,
  user_name text,
  placement_code text,
  farm_name text,
  barn_code text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

comment on table public.activity_log is
  'Thin chronological diary of meaningful flock-management events. Stores the who/when/where/what narrative without duplicating operational detail rows.';

comment on column public.activity_log.entry_type is
  'Broad category such as functCall, comment, task_check, or state_change.';

comment on column public.activity_log.action_key is
  'Specific save or workflow key, for example save_log_daily_mobile or mark_chicks_arrived.';

create index if not exists ix_activity_log_occurred_at
  on public.activity_log (occurred_at desc);

create index if not exists ix_activity_log_placement
  on public.activity_log (placement_id, occurred_at desc);

create index if not exists ix_activity_log_barn
  on public.activity_log (barn_id, occurred_at desc);

create index if not exists ix_activity_log_farm
  on public.activity_log (farm_id, occurred_at desc);

create or replace function public.write_activity_log(
  p_placement_id uuid default null,
  p_entry_type text default 'event',
  p_action_key text default 'activity',
  p_details text default '',
  p_source text default null,
  p_actor_user_id uuid default null,
  p_actor_name text default null,
  p_farm_id uuid default null,
  p_barn_id uuid default null,
  p_flock_id uuid default null,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on public.activity_log from public;
grant select on public.activity_log to authenticated, service_role;
grant execute on function public.write_activity_log(uuid, text, text, text, text, uuid, text, uuid, uuid, uuid, jsonb) to authenticated, service_role;

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
  v_mode text;
  v_note_details text;
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
    v_mode := 'insert';
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
    v_mode := 'update';
  end if;

  perform public.write_activity_log(
    p_placement_id := p_placement_id,
    p_entry_type := 'functCall',
    p_action_key := 'save_log_mortality_mobile',
    p_details := format('log_mortality() saved for %s', p_log_date),
    p_source := 'mobile.log_mortality',
    p_meta := jsonb_build_object('log_date', p_log_date, 'record_id', v_row.id, 'mode', v_mode)
  );

  v_note_details := concat_ws(
    ' | ',
    case when nullif(trim(coalesce(v_row.dead_reason, '')), '') is not null then 'Dead reason: ' || trim(v_row.dead_reason) end,
    case when nullif(trim(coalesce(v_row.cull_female_note, '')), '') is not null then 'Cull females: ' || trim(v_row.cull_female_note) end,
    case when nullif(trim(coalesce(v_row.cull_male_note, '')), '') is not null then 'Cull males: ' || trim(v_row.cull_male_note) end
  );

  if nullif(trim(coalesce(v_note_details, '')), '') is not null then
    perform public.write_activity_log(
      p_placement_id := p_placement_id,
      p_entry_type := 'comment',
      p_action_key := 'log_mortality.note',
      p_details := v_note_details,
      p_source := 'mobile.log_mortality',
      p_meta := jsonb_build_object('log_date', p_log_date, 'record_id', v_row.id)
    );
  end if;

  return v_row;
end;
$$;

create or replace function public.save_log_weight_mobile(
  p_placement_id uuid,
  p_log_date date,
  p_sex text,
  p_payload jsonb default '{}'::jsonb
)
returns public.log_weight
language plpgsql
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_row public.log_weight;
  v_mode text;
begin
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

create or replace function public.mark_chicks_arrived(
  p_placement_id uuid,
  p_arrival_date date default current_date
)
returns table (
  placement_id uuid,
  barn_id uuid,
  flock_id uuid,
  placement_is_active boolean,
  flock_is_in_barn boolean,
  barn_is_empty boolean
)
language plpgsql
as $$
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
    p_meta := jsonb_build_object('arrival_date', p_arrival_date)
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

create or replace function public.mark_barn_empty(
  p_barn_id uuid,
  p_removed_date date default current_date
)
returns table (
  placement_id uuid,
  barn_id uuid,
  flock_id uuid,
  placement_is_active boolean,
  flock_is_in_barn boolean,
  barn_is_empty boolean
)
language plpgsql
as $$
declare
  v_current record;
  v_next record;
  v_actor text;
begin
  v_actor := auth.uid()::text;

  select p.id, p.flock_id
    into v_current
  from public.placements p
  where p.barn_id = p_barn_id
    and p.is_active = true
    and p.date_removed is null
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_current.id is null then
    raise exception 'Barn % does not have an active placement to empty.', p_barn_id;
  end if;

  update public.placements
    set is_active = false,
        date_removed = coalesce(date_removed, p_removed_date),
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = v_current.id;

  update public.flocks
    set is_active = false,
        is_in_barn = false,
        updated_at = now(),
        updated_by = coalesce(v_actor, updated_by)
  where id = v_current.flock_id;

  perform public.write_activity_log(
    p_placement_id := v_current.id,
    p_entry_type := 'state_change',
    p_action_key := 'mark_barn_empty',
    p_details := format('Barn marked empty for %s.', p_removed_date),
    p_source := 'dashboard.state',
    p_meta := jsonb_build_object('removed_date', p_removed_date)
  );

  select p.id, p.flock_id
    into v_next
  from public.placements p
  where p.barn_id = p_barn_id
    and p.id <> v_current.id
    and p.date_removed is null
  order by p.active_start asc nulls last, p.created_at asc
  limit 1;

  if v_next.id is not null then
    update public.placements
      set is_active = true,
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
      p_details := 'Next scheduled placement promoted to current operational placement while barn remains empty.',
      p_source := 'dashboard.state',
      p_meta := jsonb_build_object('removed_date', p_removed_date)
    );
  end if;

  perform public.sync_barn_current_state(p_barn_id);

  if v_next.id is not null then
    return query
    select p.id, p.barn_id, p.flock_id, p.is_active, f.is_in_barn, b.is_empty
    from public.placements p
    join public.flocks f
      on f.id = p.flock_id
    join public.barns b
      on b.id = p.barn_id
    where p.id = v_next.id;
  else
    return query
    select null::uuid, b.id, null::uuid, false, false, b.is_empty
    from public.barns b
    where b.id = p_barn_id;
  end if;
end;
$$;
