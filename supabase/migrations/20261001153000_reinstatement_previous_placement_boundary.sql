-- Preserve chronological barn occupancy for both empty and currently occupied barns.
create or replace function public.preview_placement_reinstatement(p_placement_id uuid,p_placement_date date default null,p_actor_id uuid default auth.uid())
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
  if exists(select 1 from public.placements p where p.barn_id=s.barn_id and p.id<>s.id
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
