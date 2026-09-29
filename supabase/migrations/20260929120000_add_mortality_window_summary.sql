-- One row per requested placement; only requested daily details leave Postgres.
-- The existing (placement_id, log_date) unique index supports these reads.
create or replace function public.get_mortality_window(
  p_placement_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_include_first_week boolean default false
)
returns table (
  placement_id uuid,
  opening_female bigint,
  opening_male bigint,
  total_female bigint,
  total_male bigint,
  first_week_female bigint,
  first_week_male bigint,
  period_female bigint,
  period_male bigint,
  days jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'A valid mortality date range is required' using errcode = '22023';
  end if;

  return query
  select p.id,
    coalesce(sum(coalesce(m.dead_female, 0)::bigint + coalesce(m.cull_female, 0)) filter (where m.log_date < p_start_date), 0)::bigint,
    coalesce(sum(coalesce(m.dead_male, 0)::bigint + coalesce(m.cull_male, 0)) filter (where m.log_date < p_start_date), 0)::bigint,
    coalesce(sum(coalesce(m.dead_female, 0)::bigint + coalesce(m.cull_female, 0)), 0)::bigint,
    coalesce(sum(coalesce(m.dead_male, 0)::bigint + coalesce(m.cull_male, 0)), 0)::bigint,
    coalesce(sum(coalesce(m.dead_female, 0)::bigint + coalesce(m.cull_female, 0)) filter (where m.log_date between f.date_placed and f.date_placed + 6), 0)::bigint,
    coalesce(sum(coalesce(m.dead_male, 0)::bigint + coalesce(m.cull_male, 0)) filter (where m.log_date between f.date_placed and f.date_placed + 6), 0)::bigint,
    coalesce(sum(coalesce(m.dead_female, 0)::bigint + coalesce(m.cull_female, 0)) filter (where m.log_date between p_start_date and p_end_date), 0)::bigint,
    coalesce(sum(coalesce(m.dead_male, 0)::bigint + coalesce(m.cull_male, 0)) filter (where m.log_date between p_start_date and p_end_date), 0)::bigint,
    coalesce(jsonb_agg(jsonb_build_object(
      'log_date', m.log_date,
      'dead_female', m.dead_female,
      'dead_male', m.dead_male,
      'cull_female', m.cull_female,
      'cull_male', m.cull_male
    ) order by m.log_date) filter (where
      m.log_date between p_start_date and p_end_date
      or (p_include_first_week and m.log_date between f.date_placed and f.date_placed + 6)
    ), '[]'::jsonb)
  from public.placements p
  left join public.flocks f on f.id = p.flock_id
  left join public.log_mortality m on m.placement_id = p.id
    and m.is_active = true
    -- Reports need history only through their end date. Dashboard mode also
    -- returns lifetime totals and first-week details, matching its other cards.
    and (p_include_first_week or m.log_date <= p_end_date)
  where p.id = any(coalesce(p_placement_ids, '{}'::uuid[]))
  group by p.id
  order by p.id;
end;
$$;

-- Called only by the existing trusted web-admin server client.
revoke all on function public.get_mortality_window(uuid[], date, date, boolean) from public, anon, authenticated;
grant execute on function public.get_mortality_window(uuid[], date, date, boolean) to service_role;
