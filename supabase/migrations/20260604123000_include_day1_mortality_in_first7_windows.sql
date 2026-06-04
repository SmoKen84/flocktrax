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

comment on function public.sync_derived_placement_issues(uuid[]) is
  'Auto-manages placement issues for severe early mortality and hatchery-quality incidents using app_settings thresholds and a master mortality_autowarn switch, with first-7 and day-1 windows now including placement day.';
