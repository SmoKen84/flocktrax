-- Disposable local fixtures only. No production records are mutated by this suite.
do $$
declare
  actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid();
  manager_role uuid:=gen_random_uuid(); admin_role uuid:=gen_random_uuid(); worker_role uuid:=gen_random_uuid();
  farm uuid:=gen_random_uuid(); otherfarm uuid:=gen_random_uuid(); grp uuid:=gen_random_uuid();
  barn uuid:=gen_random_uuid(); otherbarn uuid:=gen_random_uuid();
  source_id uuid:=gen_random_uuid(); nextp uuid:=gen_random_uuid(); later uuid:=gen_random_uuid(); prev uuid:=gen_random_uuid();
  sf uuid:=gen_random_uuid(); nf uuid:=gen_random_uuid(); lf uuid:=gen_random_uuid(); pf uuid:=gen_random_uuid();
  d1 uuid:=gen_random_uuid(); d2 uuid:=gen_random_uuid(); queued uuid:=gen_random_uuid(); untouched uuid:=gen_random_uuid();
  ord uuid:=gen_random_uuid(); canceled_ord uuid:=gen_random_uuid(); r jsonb; oldr jsonb; failed boolean;
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  insert into roles(id,code) values(manager_role,'FarmManager'),(admin_role,'super-admin'),(worker_role,'FarmHand');
  insert into user_roles(user_id,role,role_id) values(actor,'FarmManager',manager_role),(outsider,'super-admin',admin_role),(worker,'FarmHand',worker_role);
  insert into farms(id,farm_code,farm_name,updated_by,farm_group_id) values(farm,'TEST','Test farm',actor,grp),(otherfarm,'OTHER','Other farm',actor,null);
  insert into farm_memberships(user_id,farm_id) values(actor,farm),(worker,farm);
  insert into barns(id,farm_id,barn_code) values(barn,farm,'W5'),(otherbarn,otherfarm,'OTHER');
  insert into flocks(id,farm_id,flock_number,date_placed,max_date,is_active,female_date_placed,male_date_placed) values
    (sf,farm,1,'2030-02-01','2030-03-01',false,'2030-02-01','2030-02-02'),
    (nf,farm,2,'2030-06-01','2030-07-01',true,null,null),
    (lf,farm,3,'2030-09-01','2030-10-01',true,null,null),
    (pf,farm,4,'2029-11-01','2030-01-01',false,null,null);
  insert into placements(id,farm_id,barn_id,flock_id,placement_key,active_start,active_end,lifecycle_stage,is_active,canceled_at,lh1_date,date_removed) values
    (source_id,farm,barn,sf,'REINSTATE','2030-02-01','2030-03-01','canceled',false,now(),'2030-02-20',null),
    (nextp,farm,barn,nf,'NEXT','2030-06-01','2030-07-01','awaiting_arrival',true,null,null,null),
    (later,farm,barn,lf,'LATER','2030-09-01','2030-10-01','scheduled',true,null,null,null),
    (prev,farm,barn,pf,'PREVIOUS','2029-11-01','2030-01-01','archived',false,null,null,'2030-01-01');
  insert into feed_drops(id,placement_id,placement_code,farm_id,barn_id,drop_weight,ticket_num,type) values
    (d1,nextp,'NEXT',farm,barn,125,'F2F-1','starter'),(d2,nextp,'NEXT',farm,barn,1000,'DELIVERY-1','grower'),
    (untouched,later,'LATER',farm,barn,2000,'LATER-1','grower');
  insert into feed_drops(id,queued_from_placement_id,queued_from_placement_code,queued_from_barn_id,drop_weight,ticket_num)
    values(queued,nextp,'NEXT',barn,20,'QUEUED-1');
  insert into feed_order_commitments(commitment_id,placement_id,farm_id,barn_id,ordered_lbs,status) values
    (ord,nextp,farm,barn,300,'open'),(canceled_ord,nextp,farm,barn,400,'cancelled');

  assert public.can_manage_placement_lifecycle(actor,farm),'Manager membership allowed';
  assert not public.can_manage_placement_lifecycle(worker,farm),'Worker denied despite membership';
  assert not public.can_manage_placement_lifecycle(outsider,farm),'Super admin without membership denied';
  assert not public.can_manage_placement_lifecycle(actor,otherfarm),'Manager outside farm denied';
  update farm_memberships set is_active=false where user_id=actor;
  assert not public.can_manage_placement_lifecycle(actor,farm),'Inactive membership denied';
  insert into farm_group_memberships(user_id,farm_group_id,role_id) values(actor,grp,manager_role);
  assert public.can_manage_placement_lifecycle(actor,farm),'Active group membership includes farm';
  update farm_memberships set is_active=true where user_id=actor;
  failed:=false;
  begin perform public.preview_placement_reinstatement(source_id,'2030-02-01',worker); exception when others then failed:=true; end;
  assert failed,'Preview cannot leak allocations to unauthorized user';
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',worker::text,true);
  failed:=false;
  begin perform public.preview_placement_reinstatement(source_id,'2030-02-01',actor); exception when others then failed:=true; end;
  assert failed,'Authenticated caller cannot impersonate manager';
  perform set_config('request.jwt.claim.role','service_role',true);

  r:=public.preview_placement_reinstatement(source_id,'2030-03-01',actor);
  assert r->>'blocker' is null,'Available date accepted';
  assert (r->>'move_feed')::boolean,'Empty barn insertion moves feed';
  assert jsonb_array_length(r->'drops')=3,'All next-placement drops included, without later flock feed';
  assert jsonb_array_length(r->'orders')=1,'Canceled orders stay excluded';
  assert (r->>'end_date')::date='2030-03-29','Original duration preserved';
  oldr:=r;
  update feed_drops set drop_weight=126 where id=d1;
  failed:=false;
  begin perform public.reinstate_canceled_placement(source_id,'2030-03-01',oldr->>'fingerprint',actor); exception when others then failed:=true; end;
  assert failed,'Stale feed review rejected';
  assert (select lifecycle_stage='canceled' from placements where id=source_id),'Failure leaves placement canceled';
  assert (select placement_id=nextp from feed_drops where id=d1),'Failure leaves feed unchanged';
  r:=public.preview_placement_reinstatement(source_id,'2030-06-10',actor);
  assert r->>'blocker' is not null,'Overlapping date rejected';
  failed:=false;
  begin perform public.reinstate_canceled_placement(source_id,'2030-06-10',r->>'fingerprint',actor); exception when others then failed:=true; end;
  assert failed,'Overlapping submission rejected atomically';
  r:=public.preview_placement_reinstatement(source_id,'2029-09-01',actor);
  assert r->>'blocker' is not null,'Cannot jump ahead of historical previous flock';
  r:=public.preview_placement_reinstatement(source_id,'2030-07-02',actor);
  assert not (r->>'move_feed')::boolean,'Later insertion never takes next flock feed';
  update barns set is_empty=false,has_flock=true where id=barn;
  r:=public.preview_placement_reinstatement(source_id,'2030-03-01',actor);
  assert not (r->>'move_feed')::boolean,'Occupied barn never transfers feed';
  r:=public.preview_placement_reinstatement(source_id,'2029-09-01',actor);
  assert r->>'blocker' is not null,'Occupied barn also protects prior occupancy chronology';
  update barns set is_empty=true,has_flock=false where id=barn;
  update feed_drops set placement_code='WRONG' where id=d1;
  r:=public.preview_placement_reinstatement(source_id,'2030-03-01',actor);
  assert r->>'blocker' is not null,'Inconsistent placement references block reassignment';
  update feed_drops set placement_code='NEXT' where id=d1;
  r:=public.preview_placement_reinstatement(source_id,'2030-03-01',actor);
  perform public.reinstate_canceled_placement(source_id,'2030-03-01',r->>'fingerprint',actor);
  assert (select count(*)=4 from feed_drops),'No feed drop created';
  assert (select placement_id=source_id and placement_code='REINSTATE' and drop_weight=126 from feed_drops where id=d1),'F2F credit reassigned without changing weight';
  assert (select placement_id=source_id and placement_code='REINSTATE' from feed_drops where id=d2),'Regular delivery reassigned';
  assert (select queued_from_placement_id=source_id and queued_from_placement_code='REINSTATE' from feed_drops where id=queued),'Queue references follow placement';
  assert (select placement_id=later from feed_drops where id=untouched),'Later flock untouched';
  assert (select placement_id=source_id from feed_order_commitments where commitment_id=ord),'Order follows allocation';
  assert (select placement_id=nextp from feed_order_commitments where commitment_id=canceled_ord),'Canceled order untouched';
  assert (select date_placed='2030-03-01' and male_date_placed='2030-03-02' and max_date='2030-03-29' and not is_in_barn from flocks where id=sf),'Date shift retains sex offset and arrival remains separate';
  assert (select lifecycle_stage='scheduled' and canceled_at is null and lh1_date='2030-03-20' from placements where id=source_id),'Reinstated scheduling state and haul dates';
  failed:=false;
  begin perform public.reinstate_canceled_placement(source_id,'2030-03-01',r->>'fingerprint',actor); exception when others then failed:=true; end;
  assert failed,'Double submission cannot move feed twice';
  failed:=false;
  begin perform public.cancel_scheduled_placement(source_id,later,actor); exception when others then failed:=true; end;
  assert failed,'Cancellation cannot skip the immediate next placement';
  failed:=false;
  begin perform public.cancel_scheduled_placement(source_id,null,worker); exception when others then failed:=true; end;
  assert failed,'Worker cannot cancel';
  failed:=false;
  begin perform public.cancel_scheduled_placement(source_id,null,outsider); exception when others then failed:=true; end;
  assert failed,'Admin without farm membership cannot cancel';
  perform public.cancel_scheduled_placement(source_id,null,actor);
  assert (select lifecycle_stage='canceled' from placements where id=source_id),'Cancellation successful';
  assert (select placement_id=nextp and placement_code='NEXT' from feed_drops where id=d1),'Cancellation returns existing feed to next flock';
  assert (select count(*)=4 from feed_drops),'Cancel/reinstate cycle creates no feed drops';
  r:=public.preview_placement_reinstatement(source_id,'2030-07-02',actor);
  perform public.reinstate_canceled_placement(source_id,'2030-07-02',r->>'fingerprint',actor);
  assert (select placement_id=nextp from feed_drops where id=d1),'Later reinstatement preserves next flock allocations';
  perform public.cancel_scheduled_placement(source_id,null,actor);
  update barns set is_empty=false,has_flock=true where id=barn;
  r:=public.preview_placement_reinstatement(source_id,'2030-03-01',actor);
  perform public.reinstate_canceled_placement(source_id,'2030-03-01',r->>'fingerprint',actor);
  assert (select placement_id=nextp from feed_drops where id=d1),'Occupied reinstatement preserves allocations';
  perform public.cancel_scheduled_placement(source_id,null,actor);
  -- Remove the unrelated scheduling fixtures to exercise the no-successor case.
  delete from placements where id in(nextp,later);
  r:=public.preview_placement_reinstatement(source_id,'2030-03-01',actor);
  assert not (r->>'move_feed')::boolean and r->>'next_id' is null,'No next placement needs no feed reassignment';
  perform public.reinstate_canceled_placement(source_id,'2030-03-01',r->>'fingerprint',actor);
  assert (select lifecycle_stage='scheduled' from placements where id=source_id),'No-feed reinstatement succeeds';
  failed:=false;
  begin update placements set lifecycle_stage='canceled' where id=source_id; exception when others then failed:=true; end;
  assert failed,'Generic state updates cannot bypass cancellation checks';
  perform public.cancel_scheduled_placement(source_id,null,actor);
  failed:=false;
  begin update placements set lifecycle_stage='scheduled' where id=source_id; exception when others then failed:=true; end;
  assert failed,'Generic state updates cannot bypass reinstatement checks';
  assert not has_function_privilege('authenticated','public.cancel_scheduled_placement_internal(uuid,uuid,uuid)','execute'),'Private cancellation cannot bypass scope';
  assert not has_function_privilege('anon','public.reinstate_canceled_placement(uuid,date,text,uuid)','execute'),'Anonymous execution denied';
  raise notice 'PASS: permissions, insertion rules, stale review, conflicts, dates, feed preservation, cancellation, repeat submission';
end;
$$;

