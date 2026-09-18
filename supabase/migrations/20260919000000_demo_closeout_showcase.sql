begin;
create or replace function demo_control.ensure_closeout_documents_showcase()
returns void language plpgsql security definer set search_path=pg_catalog,public,demo_control as $$
declare
 owner_id constant uuid := 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a';
 n integer; j integer; f uuid; p uuid; farm uuid; barn uuid; bin uuid; lh uuid; ticket uuid; code text; placed date; removed date; qty numeric; feed text;
begin
 if not exists(select 1 from demo_control.environment where singleton and project_ref='srkgobayrzidytmvoago' and owner_user_id=owner_id) then raise exception 'Demo project required'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 for n in 1..2 loop
  f := md5('demo-closeout-flock-'||n)::uuid; p := md5('demo-closeout-placement-'||n)::uuid; lh := md5('demo-closeout-livehaul-'||n)::uuid;
  farm := case n when 1 then 'de200000-0000-4000-8000-000000000001'::uuid else 'de200000-0000-4000-8000-000000000003'::uuid end;
  barn := case n when 1 then 'de300000-0000-4000-8000-000000000001'::uuid else 'de300000-0000-4000-8000-000000000006'::uuid end;
  bin := case n when 1 then 'de700000-0000-4000-8000-000000000001'::uuid else md5('demo-closeout-bin-2')::uuid end;
  placed := current_date-90; removed := placed+63;
  -- Preserve any evaluator edits on repeat runs. A full reset removes these rows first.
  if exists(select 1 from public.placements where id=p) then continue; end if;
  insert into public.flocks(id,farm_id,flock_number,date_placed,max_date,start_cnt_females,start_cnt_males,is_active,is_complete,is_in_barn,is_settled,created_by,female_date_placed,male_date_placed,flock_removed,breed_females,breed_males)
  values(f,farm,2600+n,placed,removed,9000,1000,false,false,false,n=2,owner_id,placed,placed,removed,'dee00000-0000-4000-8000-000000000001','dee00000-0000-4000-8000-000000000002');
  insert into public.placements(id,farm_id,barn_id,flock_id,date_removed,is_active,placement_key,created_by,active_start,active_end,lifecycle_stage,closeout_submitted_at,closeout_submitted_by,lh1_date)
  values(p,farm,barn,f,removed,false,'DEMO-CLOSEOUT-'||n,owner_id,placed,removed,'closeout_submitted',removed+2,owner_id,removed);
  select placement_key into code from public.placements where id=p;
  insert into public.feedbins(id,farm_id,barn_id,bin_num,capacity) values(bin,farm,barn,1,24000) on conflict(id) do nothing;
  for j in 1..4 loop
   ticket := md5('demo-closeout-ticket-'||n||'-'||j)::uuid;
   qty := case j when 1 then 25000 else 48000 end; feed := case j when 1 then 'starter' else 'grower' end;
   insert into public.feed_tickets(id,delivery_date,feedmill,ticket_num,feed_name,feed_weight,comment,source_type,ticket_type,created_by,updated_by)
   values(ticket,placed+case j when 1 then 0 when 2 then 17 when 3 then 35 else 49 end,'Evergreen Feed Mill','DEMO-CO-'||n||'-'||j,initcap(feed),qty,'Fictional closeout supporting delivery','mill','Reg',owner_id,owner_id);
   insert into public.feed_drops(id,feed_ticket_id,ticket_num,drop_order,drop_weight,type,farm_id,barn_id,feed_bin_id,bin_code,placement_id,placement_code,comment,created_by)
   values(md5('demo-closeout-drop-'||n||'-'||j)::uuid,ticket,'DEMO-CO-'||n||'-'||j,1,qty,feed,farm,barn,bin,case n when 1 then 'A-1 / 1' else 'C-2 / 1' end,p,code,'Fictional historical allocation',owner_id);
  end loop;
  insert into public.log_mortality(id,placement_id,log_date,dead_female,dead_male,cull_female,cull_male,dead_reason,created_by)
  select md5('demo-closeout-mortality-'||n||'-'||day)::uuid,p,placed+day,case when day<=60 then 4 else 0 end,case when day<=60 then 1 else 0 end,0,0,'Synthetic daily mortality for closeout demonstration',owner_id from generate_series(1,63) day;
  insert into public.livehaul_schedule(livehaul_id,placement_id,flock_id,farm_id,barn_id,sequence_num,lh_date,actual_date,actual_at,head_target,head_actual,status,comment,created_by,updated_by)
  values(lh,p,f,farm,barn,1,removed,removed,removed+time '18:00',9700,9700,'completed','Fictional completed livehaul',owner_id,owner_id);
  for j in 1..2 loop
   insert into public.livehaul_loads(load_id,livehaul_id,truck_num,trailer_num,head_count,live_weight,scale_loaded,scale_empty,doa_count,scale_location,comment,created_by,updated_by)
   values(md5('demo-closeout-load-'||n||'-'||j)::uuid,lh,'DEMO-T'||j,'DEMO-L'||j,4850,48500,80500,32000,0,'Evergreen Demo Processing Scale','Fictional scale record',owner_id,owner_id);
  end loop;
  insert into public.placement_closeouts(placement_id,flock_id,farm_id,barn_id,status,processed_head_final,live_weight_final,feed_delivered_total_lbs,feed_remaining_credit_lbs,feed_consumed_total_lbs,starter_consumed_lbs,grower_consumed_lbs,feed_per_head_lbs,starter_per_head_lbs,grower_per_head_lbs,feed_conversion,notes,livehaul_complete_at,livehaul_complete_by,feed_verified_at,feed_verified_by,invoice_created_at,invoice_created_by,submitted_at,submitted_by,settlement_received_at,settlement_received_by,created_by)
  values(p,f,farm,barn,case n when 1 then 'submitted' else 'settlement_received' end,9700,97000,169000,0,169000,25000,144000,169000.0/9700,25000.0/9700,144000.0/9700,169000.0/97000,
   case n when 1 then 'DEMO: Submitted with supporting documents. Awaiting settlement.' else 'DEMO: Settlement received. Review the documents and complete final closeout.' end,
   removed,owner_id,removed+1,owner_id,removed+1,owner_id,removed+2,owner_id,case when n=2 then removed+5 end,case when n=2 then owner_id end,owner_id);
 end loop;
 -- Restore current barn occupancy; historical inserts must not replace the growing flock.
 update public.barns b set active_flock_id=(select p.flock_id from public.placements p where p.barn_id=b.id and p.lifecycle_stage='in_barn_growing' order by p.active_start desc limit 1),
 has_flock=exists(select 1 from public.placements p where p.barn_id=b.id and p.lifecycle_stage='in_barn_growing')
 where b.id in ('de300000-0000-4000-8000-000000000001','de300000-0000-4000-8000-000000000006');
 delete from gsync.outbox where true;
 delete from platform.sync_outbox where true;
end $$;
revoke all on function demo_control.ensure_closeout_documents_showcase() from public,anon,authenticated;
grant execute on function demo_control.ensure_closeout_documents_showcase() to service_role;
CREATE OR REPLACE FUNCTION public.reset_demo_showcase_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'demo_control'
AS $function$
begin
  perform demo_control.ensure_app_settings_showcase();
  perform demo_control.ensure_daily_age_tasks_showcase();
  perform demo_control.reset_showcase_data();
  perform demo_control.ensure_multi_group_showcase();
  perform demo_control.ensure_binsentry_feed_showcase();
  perform demo_control.ensure_binsentry_density_diagnostics();
  perform demo_control.ensure_feed_prediction_curves();
  perform demo_control.ensure_future_schedule_showcase();
  perform demo_control.ensure_binsentry_inventory_snapshots();
  perform demo_control.ensure_app_settings_showcase();
  perform demo_control.ensure_daily_age_tasks_showcase();
  perform demo_control.ensure_closeout_documents_showcase();
  return demo_control.full_showcase_status();
end
$function$
;
CREATE OR REPLACE FUNCTION demo_control.showcase_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'demo_control'
AS $function$
declare
  v_expected_project_ref constant text := 'srkgobayrzidytmvoago';
  v_status jsonb;
  v_future_schedule_ok boolean;
begin
  if not exists (
    select 1
    from demo_control.environment
    where singleton = true
      and project_ref = v_expected_project_ref
      and owner_user_id = 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a'::uuid
  ) then
    raise exception 'Demo environment marker mismatch; status check refused';
  end if;

  v_future_schedule_ok := not exists (
    select 1
    from public.barns barn
    where barn.is_active is distinct from false
      and (
        (select count(*)
         from public.placements placement
         join public.flocks flock on flock.id = placement.flock_id
         where placement.barn_id = barn.id
           and placement.lifecycle_stage = 'scheduled'
           and flock.date_placed > current_date) < 2
        or
        (select count(*)
         from public.livehaul_schedule livehaul
         where livehaul.barn_id = barn.id
           and livehaul.status = 'scheduled'
           and livehaul.lh_date > current_date) < 1
      )
  );

  select jsonb_build_object(
    'ok',
      (select count(*) = 2 from public.farm_groups)
      and (select count(*) = 3 from public.farms)
      and (select count(*) = 6 from public.barns)
      and (select count(*) = 19 from public.placements)
      and (select count(*) = 19 from public.flocks)
      and (select count(*) = 91 from public.log_daily)
      and (select count(*) = 217 from public.log_mortality)
      and (select count(*) = 22 from public.log_weight)
      and (select count(*) = 11 from public.feed_tickets)
      and (select count(*) = 12 from public.feed_drops)
      and (select count(*) = 10 from public.livehaul_schedule)
      and (select count(*) = 6 from public.livehaul_loads)
      and (select count(*) = 3 from public.issues)
      and (select count(*) = 10 from public.daily_age_tasks)
      and (select count(*) = 0 from gsync.outbox)
      and (select count(*) = 0 from platform.sync_outbox)
      and v_future_schedule_ok
      and exists (
        select 1
        from public.farms farm
        join public.farm_groups farm_group on farm_group.id = farm.farm_group_id
        where farm.id = 'de200000-0000-4000-8000-000000000003'::uuid
          and farm_group.id = 'de100000-0000-4000-8000-000000000002'::uuid
      ),
    'project_ref', v_expected_project_ref,
    'farm_groups', (select count(*) from public.farm_groups),
    'farms', (select count(*) from public.farms),
    'barns', (select count(*) from public.barns),
    'flocks', (select count(*) from public.flocks),
    'placements', (select count(*) from public.placements),
    'future_placements', (select count(*) from public.placements placement join public.flocks flock on flock.id = placement.flock_id where placement.lifecycle_stage = 'scheduled' and flock.date_placed > current_date),
    'daily_logs', (select count(*) from public.log_daily),
    'mortality_logs', (select count(*) from public.log_mortality),
    'weight_samples', (select count(*) from public.log_weight),
    'feed_tickets', (select count(*) from public.feed_tickets),
    'feed_drops', (select count(*) from public.feed_drops),
    'livehaul_events', (select count(*) from public.livehaul_schedule),
    'future_livehaul_events', (select count(*) from public.livehaul_schedule where status = 'scheduled' and lh_date > current_date),
    'livehaul_loads', (select count(*) from public.livehaul_loads),
    'issues', (select count(*) from public.issues),
    'daily_age_tasks', (select count(*) from public.daily_age_tasks),
    'future_schedule_verified', v_future_schedule_ok,
    'google_outbox_pending', (select count(*) from gsync.outbox),
    'platform_outbox_pending', (select count(*) from platform.sync_outbox),
    'seeded_at', (select seeded_at from demo_control.environment where singleton = true)
  ) into v_status;

  return v_status;
end
$function$
;
select demo_control.ensure_closeout_documents_showcase();
commit;
