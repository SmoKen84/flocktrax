-- Reuse existing allocations. No new feed tickets, drops, or transfer-history tables.
create function public.can_manage_placement_lifecycle(p_actor uuid, p_farm uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_actor is not null and exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_actor and regexp_replace(lower(r.code), '[ _-]', '', 'g') in
      ('manager','farmmanager','admin','superadmin','grower','groweradmin','integratormanager')
  ) and (exists(select 1 from public.farm_memberships m
    where m.user_id = p_actor and m.farm_id = p_farm and m.is_active)
    or exists(select 1 from public.farm_group_memberships m join public.farms f on f.farm_group_id = m.farm_group_id
      where m.user_id = p_actor and f.id = p_farm and m.active));
$$;

-- Older generic state RPCs must not bypass cancellation/reinstatement checks.
create function public.guard_placement_cancellation_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare context jsonb;
begin
  if old.lifecycle_stage is distinct from new.lifecycle_stage and
    (old.lifecycle_stage='canceled' or new.lifecycle_stage='canceled') then
    context:=nullif(current_setting('app.placement_lifecycle_context',true),'')::jsonb;
    if context is null or (context->>'placement_id')::uuid is distinct from old.id
      or not public.can_manage_placement_lifecycle((context->>'actor_id')::uuid,old.farm_id)
      or new.farm_id is distinct from old.farm_id or new.barn_id is distinct from old.barn_id then
      raise exception 'Use the authorized Cancel Scheduled Flock or Reinstate Flock action.';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_placement_cancellation_transition before update of lifecycle_stage on public.placements
  for each row execute function public.guard_placement_cancellation_transition();
revoke all on function public.guard_placement_cancellation_transition() from public,anon,authenticated,service_role;

-- Keep existing cancellation mechanics private, enforcing permissions and the immediate next barn placement here.
alter function public.cancel_scheduled_placement(uuid,uuid,uuid) rename to cancel_scheduled_placement_internal;
revoke all on function public.cancel_scheduled_placement_internal(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.cancel_scheduled_placement(p_source_placement_id uuid,p_target_placement_id uuid default null,p_actor_id uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.placements; target uuid; result jsonb;
begin
  if auth.role() is distinct from 'service_role' and p_actor_id is distinct from auth.uid() then raise exception 'Invalid acting user.'; end if;
  -- Serialize scheduling/arrival and allocation changes for this short atomic operation.
  lock table public.placements,public.flocks,public.barns,public.feed_drops,public.feed_order_commitments in share row exclusive mode;
  select * into s from public.placements where id=p_source_placement_id;
  if not found or not public.can_manage_placement_lifecycle(p_actor_id,s.farm_id) then
    raise exception 'Manager or higher and an active membership covering this farm are required.';
  end if;
  select p.id into target from public.placements p join public.flocks f on f.id=p.flock_id
    where p.barn_id=s.barn_id and p.farm_id=s.farm_id and p.id<>s.id and p.active_start>s.active_start
      and p.lifecycle_stage in ('scheduled','awaiting_arrival') and p.date_removed is null and not f.is_in_barn and not f.is_complete
    order by p.active_start,p.id limit 1;
  if p_target_placement_id is not null and p_target_placement_id is distinct from target then
    raise exception 'Feed must go to the next scheduled placement in the same barn. Reload the schedule.';
  end if;
  perform set_config('app.placement_lifecycle_context',jsonb_build_object('placement_id',s.id,'actor_id',p_actor_id)::text,true);
  result:=public.cancel_scheduled_placement_internal(s.id,target,p_actor_id);
  perform set_config('app.placement_lifecycle_context','',true);
  return result;
end;
$$;

-- Date-dependent read-only review; fingerprint prevents submitting a stale allocation/schedule review.
create function public.preview_placement_reinstatement(p_placement_id uuid,p_placement_date date default null,p_actor_id uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.placements; f public.flocks; n public.placements;
  new_date date; new_end date; empty_barn boolean; move_feed boolean; blocker text;
  drops jsonb := '[]'; orders jsonb := '[]'; result jsonb; schedule jsonb;
begin
  if auth.role() is distinct from 'service_role' and p_actor_id is distinct from auth.uid() then raise exception 'Invalid acting user.'; end if;
  select * into s from public.placements where id=p_placement_id;
  if not found or not public.can_manage_placement_lifecycle(p_actor_id,s.farm_id) then
    raise exception 'Manager or higher and an active membership covering this farm are required.';
  end if;
  if s.lifecycle_stage<>'canceled' then raise exception 'Only canceled placements can be reinstated.'; end if;
  select * into f from public.flocks where id=s.flock_id;
  new_date:=coalesce(p_placement_date,f.date_placed);
  new_end:=coalesce(s.active_end,f.max_date)+(new_date-f.date_placed);
  if new_end<=new_date then blocker:='The placement must have a valid projected end date after its start.'; end if;
  if f.is_in_barn or f.is_complete or s.date_removed is not null or
    (select count(*) from public.placements where flock_id=s.flock_id)<>1 or
    exists(select 1 from public.log_daily where placement_id=s.id) or
    exists(select 1 from public.log_mortality where placement_id=s.id) or
    exists(select 1 from public.log_weight where placement_id=s.id) then
    blocker:='This flock has operational records or multiple placements and cannot be reinstated from scheduling.';
  end if;
  select not b.has_flock and b.is_empty and not exists (
    select 1 from public.placements p join public.flocks pf on pf.id=p.flock_id
      where p.barn_id=s.barn_id and p.date_removed is null and p.lifecycle_stage not in ('canceled','unassigned','archived') and pf.is_in_barn
  ) into empty_barn from public.barns b where b.id=s.barn_id and b.farm_id=s.farm_id;
  if empty_barn is null then blocker:='The placement barn or farm is unavailable.'; end if;
  select p.* into n from public.placements p join public.flocks nf on nf.id=p.flock_id
    where p.barn_id=s.barn_id and p.farm_id=s.farm_id and p.id<>s.id and p.lifecycle_stage in ('scheduled','awaiting_arrival')
      and p.date_removed is null and not nf.is_in_barn and not nf.is_complete
    order by p.active_start,p.id limit 1;
  move_feed:=coalesce(empty_barn and n.id is not null and new_date<n.active_start,false);
  if new_end>new_date and exists(select 1 from public.placements p where p.id<>s.id
      and (p.barn_id=s.barn_id or p.flock_id=s.flock_id) and p.lifecycle_stage<>'canceled'
      and daterange(p.active_start,coalesce(p.active_end,'infinity'::date),'[)') && daterange(new_date,new_end,'[)')) then
    blocker:='These dates overlap another placement. Choose an available date window before reinstating.';
  end if;
  if empty_barn and exists(select 1 from public.placements p where p.barn_id=s.barn_id and p.id<>s.id
      and p.lifecycle_stage not in ('canceled','unassigned','scheduled','awaiting_arrival')
      and coalesce(p.date_removed,p.active_end,p.active_start)>new_date) then
    blocker:='The reinstated placement must start after the previous flock has left this barn.';
  end if;
  if move_feed then
    -- Match authoritative IDs, and check codes/location before changing the existing rows.
    drops:=coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.feed_drops d
      where d.placement_id=n.id or d.queued_from_placement_id=n.id),'[]');
    orders:=coalesce((select jsonb_agg(to_jsonb(c) order by c.commitment_id) from public.feed_order_commitments c
      where c.placement_id=n.id and c.status<>'cancelled'),'[]');
    if exists(select 1 from public.feed_drops d where
      (d.placement_id=n.id and (d.placement_code is distinct from n.placement_key or d.barn_id is distinct from s.barn_id or d.farm_id is distinct from s.farm_id)) or
      (d.queued_from_placement_id=n.id and (d.queued_from_placement_code is distinct from n.placement_key or d.queued_from_barn_id is distinct from s.barn_id))) then
      blocker:='A feed allocation has inconsistent placement or barn references. Correct it before reinstating.';
    end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into schedule from public.placements p where p.barn_id=s.barn_id;
  result:=jsonb_build_object('placement',to_jsonb(s),'flock',to_jsonb(f),'date',new_date,'end_date',new_end,
    'empty_barn',empty_barn,'move_feed',move_feed,'next_id',n.id,'next_code',n.placement_key,
    'drops',drops,'orders',orders,'blocker',blocker,'schedule',schedule);
  return (result-'schedule'-'flock') || jsonb_build_object('fingerprint',md5(result::text));
end;
$$;

create function public.reinstate_canceled_placement(p_placement_id uuid,p_placement_date date,p_fingerprint text,p_actor_id uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.placements; f public.flocks; review jsonb; target uuid; delta integer;
begin
  lock table public.placements,public.flocks,public.barns,public.feed_drops,public.feed_order_commitments in share row exclusive mode;
  review:=public.preview_placement_reinstatement(p_placement_id,p_placement_date,p_actor_id);
  if review->>'blocker' is not null then raise exception '%',review->>'blocker'; end if;
  if p_fingerprint is distinct from review->>'fingerprint' then raise exception 'The schedule or feed changed. Review the updated details and confirm again.'; end if;
  if p_placement_date is null then raise exception 'A placement date is required.'; end if;
  select * into s from public.placements where id=p_placement_id;
  select * into f from public.flocks where id=s.flock_id;
  target:=(review->>'next_id')::uuid;
  if (review->>'move_feed')::boolean then
    update public.feed_drops set placement_id=s.id,placement_code=s.placement_key where placement_id=target;
    update public.feed_drops set queued_from_placement_id=s.id,queued_from_placement_code=s.placement_key where queued_from_placement_id=target;
    update public.feed_order_commitments set placement_id=s.id,updated_at=now(),updated_by=p_actor_id::text where placement_id=target and status<>'cancelled';
  end if;
  delta:=p_placement_date-f.date_placed;
  perform set_config('app.placement_lifecycle_context',jsonb_build_object('placement_id',s.id,'actor_id',p_actor_id)::text,true);
  update public.placements set lifecycle_stage='scheduled',is_active=true,canceled_at=null,canceled_by=null,
    active_start=p_placement_date,active_end=(review->>'end_date')::date,
    lh1_date=s.lh1_date+delta,lh2_date=s.lh2_date+delta,lh3_date=s.lh3_date+delta,updated_at=now(),updated_by=p_actor_id::text where id=s.id;
  update public.flocks set date_placed=p_placement_date,max_date=f.max_date+delta,
    female_date_placed=f.female_date_placed+delta,male_date_placed=f.male_date_placed+delta,
    is_active=true,is_in_barn=false,is_complete=false,is_settled=false,updated_at=now(),updated_by=p_actor_id::text where id=f.id;
  perform set_config('app.placement_lifecycle_context','',true);
  insert into public.activity_log(entry_type,action_key,details,source,placement_id,flock_id,farm_id,barn_id,user_id,meta)
    values('state_change','reinstateCanceledPlacement','Reinstated '||s.placement_key||' for '||p_placement_date::text,
      'web-admin.placement_wizard',s.id,f.id,s.farm_id,s.barn_id,p_actor_id,
      jsonb_build_object('previous_date',f.date_placed,'placement_date',p_placement_date,'feed_from_placement_id',case when (review->>'move_feed')::boolean then target end,
        'feed_drop_count',jsonb_array_length(review->'drops'),'feed_order_count',jsonb_array_length(review->'orders')));
  return jsonb_build_object('placement_id',s.id,'placement_key',s.placement_key,'farm_id',s.farm_id,'barn_id',s.barn_id,'flock_id',f.id);
end;
$$;

revoke all on function public.can_manage_placement_lifecycle(uuid,uuid) from public,anon,authenticated;
grant execute on function public.can_manage_placement_lifecycle(uuid,uuid) to service_role;
revoke all on function public.cancel_scheduled_placement(uuid,uuid,uuid) from public,anon;
revoke all on function public.preview_placement_reinstatement(uuid,date,uuid) from public,anon;
revoke all on function public.reinstate_canceled_placement(uuid,date,text,uuid) from public,anon;
grant execute on function public.cancel_scheduled_placement(uuid,uuid,uuid) to authenticated,service_role;
grant execute on function public.preview_placement_reinstatement(uuid,date,uuid) to authenticated,service_role;
grant execute on function public.reinstate_canceled_placement(uuid,date,text,uuid) to authenticated,service_role;
