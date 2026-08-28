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
  end if;

  return v_row;
end;
$$;

grant execute on function public.save_log_weight_mobile(uuid, date, text, jsonb) to authenticated;
grant execute on function public.save_log_weight_mobile(uuid, date, text, jsonb) to service_role;
