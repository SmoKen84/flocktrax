create table if not exists public.placement_closeouts (
  closeout_id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  flock_id uuid not null references public.flocks(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  barn_id uuid not null references public.barns(id) on delete cascade,
  status text not null default 'draft',
  processed_head_final integer null,
  live_weight_final numeric(12,2) null,
  feed_delivered_total_lbs numeric(12,2) null,
  feed_remaining_credit_lbs numeric(12,2) null,
  feed_consumed_total_lbs numeric(12,2) null,
  starter_consumed_lbs numeric(12,2) null,
  grower_consumed_lbs numeric(12,2) null,
  feed_per_head_lbs numeric(12,4) null,
  starter_per_head_lbs numeric(12,4) null,
  grower_per_head_lbs numeric(12,4) null,
  feed_conversion numeric(12,4) null,
  breed_stat_snapshot jsonb null,
  breed_stat_comparison jsonb null,
  notes text null,
  manual_override_reason text null,
  submitted_at timestamp with time zone null,
  submitted_by uuid null,
  settlement_received_at timestamp with time zone null,
  settlement_received_by uuid null,
  archived_at timestamp with time zone null,
  archived_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid null default auth.uid(),
  updated_by text null
);

comment on table public.placement_closeouts is
  'Placement-level closeout record that stores the authoritative closeout workflow state, frozen final values, and settlement/archive milestones for a flock placement.';

comment on column public.placement_closeouts.status is
  'Closeout workflow state: draft, submitted, settlement_received, or archived.';

comment on column public.placement_closeouts.processed_head_final is
  'Confirmed final processed or delivered-for-processing head count for the placement closeout.';

comment on column public.placement_closeouts.live_weight_final is
  'Confirmed final live bird weight produced across the closeout.';

comment on column public.placement_closeouts.feed_delivered_total_lbs is
  'Total feed delivered to the flock during the placement lifecycle before closeout adjustments.';

comment on column public.placement_closeouts.feed_remaining_credit_lbs is
  'Unused feed remaining at closeout that will be credited forward to the next flock.';

comment on column public.placement_closeouts.feed_consumed_total_lbs is
  'Total feed consumed after subtracting remaining credited feed from delivered feed.';

comment on column public.placement_closeouts.starter_consumed_lbs is
  'Starter feed consumed by the flock during the placement lifecycle.';

comment on column public.placement_closeouts.grower_consumed_lbs is
  'Grower feed consumed by the flock during the placement lifecycle.';

comment on column public.placement_closeouts.feed_conversion is
  'Feed conversion ratio calculated as feed consumed divided by final live weight.';

comment on column public.placement_closeouts.breed_stat_snapshot is
  'Snapshot of the breed-standard values used at closeout time so later reference data changes do not alter historical submissions.';

comment on column public.placement_closeouts.breed_stat_comparison is
  'Structured comparison payload between closeout actuals and the breed-standard snapshot.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'placement_closeouts_status_check'
      and conrelid = 'public.placement_closeouts'::regclass
  ) then
    alter table public.placement_closeouts
      add constraint placement_closeouts_status_check
      check (status in ('draft', 'submitted', 'settlement_received', 'archived'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'placement_closeouts_processed_head_final_check'
      and conrelid = 'public.placement_closeouts'::regclass
  ) then
    alter table public.placement_closeouts
      add constraint placement_closeouts_processed_head_final_check
      check (processed_head_final is null or processed_head_final >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'placement_closeouts_weight_totals_check'
      and conrelid = 'public.placement_closeouts'::regclass
  ) then
    alter table public.placement_closeouts
      add constraint placement_closeouts_weight_totals_check
      check (
        (live_weight_final is null or live_weight_final >= 0)
        and (feed_delivered_total_lbs is null or feed_delivered_total_lbs >= 0)
        and (feed_remaining_credit_lbs is null or feed_remaining_credit_lbs >= 0)
        and (feed_consumed_total_lbs is null or feed_consumed_total_lbs >= 0)
        and (starter_consumed_lbs is null or starter_consumed_lbs >= 0)
        and (grower_consumed_lbs is null or grower_consumed_lbs >= 0)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'placement_closeouts_ratio_totals_check'
      and conrelid = 'public.placement_closeouts'::regclass
  ) then
    alter table public.placement_closeouts
      add constraint placement_closeouts_ratio_totals_check
      check (
        (feed_per_head_lbs is null or feed_per_head_lbs >= 0)
        and (starter_per_head_lbs is null or starter_per_head_lbs >= 0)
        and (grower_per_head_lbs is null or grower_per_head_lbs >= 0)
        and (feed_conversion is null or feed_conversion >= 0)
      );
  end if;
end
$$;

create unique index if not exists ux_placement_closeouts_placement_id
  on public.placement_closeouts (placement_id);

create index if not exists ix_placement_closeouts_status
  on public.placement_closeouts (status, farm_id, barn_id, updated_at desc);

create index if not exists ix_placement_closeouts_flock
  on public.placement_closeouts (flock_id);

insert into public.placement_closeouts (
  placement_id,
  flock_id,
  farm_id,
  barn_id,
  status,
  processed_head_final,
  live_weight_final,
  submitted_at,
  submitted_by,
  archived_at,
  archived_by,
  notes
)
with load_rollups as (
  select
    lhs.placement_id,
    sum(ll.head_count) as processed_head_total,
    sum(ll.live_weight) as live_weight_total
  from public.livehaul_schedule lhs
  join public.livehaul_loads ll
    on ll.livehaul_id = lhs.livehaul_id
  group by lhs.placement_id
),
schedule_rollups as (
  select
    placement_id,
    sum(head_actual) as head_actual_total
  from public.livehaul_schedule
  group by placement_id
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
  end,
  case
    when coalesce(lr.processed_head_total, 0) > 0 then lr.processed_head_total
    when coalesce(sr.head_actual_total, 0) > 0 then sr.head_actual_total
    else null
  end,
  case
    when coalesce(lr.live_weight_total, 0) > 0 then lr.live_weight_total
    else null
  end,
  p.closeout_submitted_at,
  p.closeout_submitted_by,
  p.archived_at,
  p.archived_by,
  'Backfilled during placement closeout table migration.'
from public.placements p
left join load_rollups lr
  on lr.placement_id = p.id
left join schedule_rollups sr
  on sr.placement_id = p.id
where p.lifecycle_stage in ('waiting_closeout', 'closeout_submitted', 'archived')
on conflict (placement_id) do nothing;

create or replace function public.ensure_placement_closeout_row(
  p_placement_id uuid
)
returns public.placement_closeouts
language plpgsql
security definer
set search_path = public
as $$
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
security definer
set search_path = public
as $$
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
    p_details := format('Flock checked out on %s and moved into closeout.', p_removed_date),
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

create or replace function public.submit_flock_closeout(
  p_placement_id uuid,
  p_notes text default null
)
returns public.placements
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.archive_flock_closeout(
  p_placement_id uuid
)
returns public.placements
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.ensure_placement_closeout_row(uuid) to anon, authenticated, service_role;
