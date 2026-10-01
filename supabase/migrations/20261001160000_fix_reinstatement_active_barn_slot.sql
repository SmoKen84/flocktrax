-- Respect the unique current-placement slot when inserting a reinstated flock.
create or replace function public.reinstate_canceled_placement(p_placement_id uuid,p_placement_date date,p_fingerprint text,p_actor_id uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.placements; f public.flocks; review jsonb; target uuid; delta integer; make_current boolean;
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
  make_current:=coalesce((review->>'empty_barn')::boolean and
    (target is null or (review->>'move_feed')::boolean),false);
  if make_current then
    -- Release the one-current-placement slot BEFORE activating its new successor.
    -- The review and table locks establish that there are no birds in this barn.
    update public.flocks set is_active=false,updated_at=now(),updated_by=p_actor_id::text
      where id in (select flock_id from public.placements where barn_id=s.barn_id and id<>s.id
        and is_active and date_removed is null);
    update public.placements set is_active=false,lifecycle_stage='scheduled',updated_at=now(),updated_by=p_actor_id::text
      where barn_id=s.barn_id and id<>s.id and is_active and date_removed is null;
  end if;
  delta:=p_placement_date-f.date_placed;
  perform set_config('app.placement_lifecycle_context',jsonb_build_object('placement_id',s.id,'actor_id',p_actor_id)::text,true);
  update public.placements set lifecycle_stage=case when make_current then 'awaiting_arrival' else 'scheduled' end,is_active=make_current,canceled_at=null,canceled_by=null,
    active_start=p_placement_date,active_end=(review->>'end_date')::date,
    lh1_date=s.lh1_date+delta,lh2_date=s.lh2_date+delta,lh3_date=s.lh3_date+delta,updated_at=now(),updated_by=p_actor_id::text where id=s.id;
  update public.flocks set date_placed=p_placement_date,max_date=f.max_date+delta,
    female_date_placed=f.female_date_placed+delta,male_date_placed=f.male_date_placed+delta,
    is_active=make_current,is_in_barn=false,is_complete=false,is_settled=false,updated_at=now(),updated_by=p_actor_id::text where id=f.id;
  perform set_config('app.placement_lifecycle_context','',true);
  insert into public.activity_log(entry_type,action_key,details,source,placement_id,flock_id,farm_id,barn_id,user_id,meta)
    values('state_change','reinstateCanceledPlacement','Reinstated '||s.placement_key||' for '||p_placement_date::text,
      'web-admin.placement_wizard',s.id,f.id,s.farm_id,s.barn_id,p_actor_id,
      jsonb_build_object('previous_date',f.date_placed,'placement_date',p_placement_date,'feed_from_placement_id',case when (review->>'move_feed')::boolean then target end,
        'feed_drop_count',jsonb_array_length(review->'drops'),'feed_order_count',jsonb_array_length(review->'orders')));
  return jsonb_build_object('placement_id',s.id,'placement_key',s.placement_key,'farm_id',s.farm_id,'barn_id',s.barn_id,'flock_id',f.id);
end;
$$;
