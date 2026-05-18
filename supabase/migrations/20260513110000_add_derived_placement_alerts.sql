create or replace function public.sync_derived_placement_issues(
  p_placement_ids uuid[] default null
)
returns table (
  placement_id uuid,
  severe_early_mortality_open boolean,
  hatchery_quality_open boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_severe_threshold numeric := 0.10;
  v_hatchery_threshold numeric := 0.03;
  v_auto_prefix text := 'Auto-derived:';
  v_now timestamptz := now();
  v_row record;
  v_started_total integer;
  v_first7_total integer;
  v_day1_total integer;
  v_first7_pct numeric;
  v_day1_pct numeric;
  v_severe_desc text;
  v_hatchery_desc text;
begin
  update public.issues as issue
     set status = 'resolved',
         resolved_at = coalesce(issue.resolved_at, v_now),
         resolution_note = coalesce(
           issue.resolution_note,
           'Auto-resolved after the placement left the active flock cycle.'
         ),
         updated_at = v_now
    from public.placements as placement
   where issue.entity_type = 'placement'
     and issue.status = 'open'
     and issue.entity_id = placement.id
     and issue.description like v_auto_prefix || '%'
     and (
       placement.is_active is distinct from true
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
      where p_placement_ids is null or placement.id = any(p_placement_ids)
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
            when mortality.log_date > scoped.date_placed
             and mortality.log_date <= scoped.date_placed + 7
            then coalesce(mortality.dead_female, 0) + coalesce(mortality.cull_female, 0)
            else 0
          end
        ), 0) as female_first7_total,
        coalesce(sum(
          case
            when mortality.log_date > scoped.date_placed
             and mortality.log_date <= scoped.date_placed + 7
            then coalesce(mortality.dead_male, 0) + coalesce(mortality.cull_male, 0)
            else 0
          end
        ), 0) as male_first7_total,
        coalesce(sum(
          case
            when mortality.log_date = scoped.date_placed + 1
            then coalesce(mortality.dead_female, 0) + coalesce(mortality.cull_female, 0)
            else 0
          end
        ), 0) as female_day1_total,
        coalesce(sum(
          case
            when mortality.log_date = scoped.date_placed + 1
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
      v_row.is_active = true
      and v_row.date_removed is null
      and v_row.date_placed is not null
      and v_started_total > 0
      and v_first7_total > 0
      and v_first7_pct >= v_severe_threshold;

    hatchery_quality_open :=
      v_row.is_active = true
      and v_row.date_removed is null
      and v_row.date_placed is not null
      and v_started_total > 0
      and v_day1_total > 0
      and v_day1_pct >= v_hatchery_threshold;

    if severe_early_mortality_open then
      v_severe_desc := format(
        '%s First 7-day mortality reached %s%% (%s birds out of %s started) for the %s through %s early-placement window.',
        v_auto_prefix,
        trim(to_char(v_first7_pct * 100, '990D0')),
        v_first7_total,
        v_started_total,
        to_char(v_row.date_placed + 1, 'YYYY-MM-DD'),
        to_char(v_row.date_placed + 7, 'YYYY-MM-DD')
      );

      if exists (
        select 1
        from public.issues as issue
        where issue.entity_type = 'placement'
          and issue.entity_id = v_row.placement_id
          and issue.issue_type = 'mortality_review'
          and issue.title = 'Severe Early Mortality'
          and issue.status = 'open'
          and issue.description like v_auto_prefix || '%'
      ) then
        update public.issues as issue
           set description = v_severe_desc,
               related_placement_id = v_row.placement_id,
               reported_log_date = least(current_date, v_row.date_placed + 7),
               updated_at = v_now
         where issue.entity_type = 'placement'
           and issue.entity_id = v_row.placement_id
           and issue.issue_type = 'mortality_review'
           and issue.title = 'Severe Early Mortality'
           and issue.status = 'open'
           and issue.description like v_auto_prefix || '%';
      else
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
          least(current_date, v_row.date_placed + 7),
          v_now
        );
      end if;
    else
      update public.issues as issue
         set status = 'resolved',
             resolved_at = coalesce(issue.resolved_at, v_now),
             resolution_note = coalesce(
               issue.resolution_note,
               'Auto-resolved after the severe early mortality signal returned below threshold.'
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
      v_hatchery_desc := format(
        '%s Day 1 losses reached %s%% (%s birds out of %s started), matching the hatchery-quality incident pattern.',
        v_auto_prefix,
        trim(to_char(v_day1_pct * 100, '990D0')),
        v_day1_total,
        v_started_total
      );

      if exists (
        select 1
        from public.issues as issue
        where issue.entity_type = 'placement'
          and issue.entity_id = v_row.placement_id
          and issue.issue_type = 'bird_health'
          and issue.title = 'Hatchery Quality Incident'
          and issue.status = 'open'
          and issue.description like v_auto_prefix || '%'
      ) then
        update public.issues as issue
           set description = v_hatchery_desc,
               related_placement_id = v_row.placement_id,
               reported_log_date = v_row.date_placed + 1,
               updated_at = v_now
         where issue.entity_type = 'placement'
           and issue.entity_id = v_row.placement_id
           and issue.issue_type = 'bird_health'
           and issue.title = 'Hatchery Quality Incident'
           and issue.status = 'open'
           and issue.description like v_auto_prefix || '%';
      else
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
          v_row.date_placed + 1,
          v_now
        );
      end if;
    else
      update public.issues as issue
         set status = 'resolved',
             resolved_at = coalesce(issue.resolved_at, v_now),
             resolution_note = coalesce(
               issue.resolution_note,
               'Auto-resolved after the hatchery-quality signal returned below threshold.'
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

comment on function public.sync_derived_placement_issues(uuid[]) is
  'Auto-manages placement issues for severe early mortality and hatchery-quality incidents using first-7-day and day-1 mortality rollups.';

grant execute on function public.sync_derived_placement_issues(uuid[]) to anon, authenticated, service_role;
