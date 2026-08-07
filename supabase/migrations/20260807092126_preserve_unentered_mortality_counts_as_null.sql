alter table public.log_mortality
  alter column dead_female drop default,
  alter column dead_female drop not null,
  alter column dead_male drop default,
  alter column dead_male drop not null,
  alter column cull_female drop default,
  alter column cull_female drop not null,
  alter column cull_male drop default,
  alter column cull_male drop not null;

comment on column public.log_mortality.dead_female is
  'Female mortality count. NULL means not collected; zero means intentionally recorded as none.';
comment on column public.log_mortality.dead_male is
  'Male mortality count. NULL means not collected; zero means intentionally recorded as none.';
comment on column public.log_mortality.cull_female is
  'Female cull count. NULL means not collected; zero means intentionally recorded as none.';
comment on column public.log_mortality.cull_male is
  'Male cull count. NULL means not collected; zero means intentionally recorded as none.';

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

grant execute on function public.save_log_mortality_mobile(uuid, date, jsonb) to authenticated;
grant execute on function public.save_log_mortality_mobile(uuid, date, jsonb) to service_role;
