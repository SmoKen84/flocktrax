begin;
create or replace function public.enforce_placement_issue_closeout()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_completed_at timestamptz; v_completed_by uuid;
begin
  if TG_OP = 'UPDATE' and old.entity_type = 'placement'
     and (new.entity_type is distinct from old.entity_type or new.entity_id is distinct from old.entity_id) then
    raise exception 'Placement issues must remain with their original flock.';
  end if;
  if new.entity_type <> 'placement' then return new; end if;
  new.related_placement_id := new.entity_id;
  select closeout_completed_at, closeout_completed_by into v_completed_at, v_completed_by
    from public.placement_closeouts where placement_id = new.entity_id;
  if v_completed_at is not null and new.status = 'open' then
    new.status := 'resolved';
    new.resolved_at := v_completed_at;
    new.resolved_by := v_completed_by;
    new.resolution_note := 'Automatically resolved when the flock completed closeout.';
    new.updated_by := v_completed_by;
  end if;
  return new;
end;
$$;
create trigger trg_placement_issue_closeout_guard
before insert or update on public.issues
for each row execute function public.enforce_placement_issue_closeout();

create or replace function public.resolve_completed_closeout_issues()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.closeout_completed_at is not null then
    update public.issues
       set status = 'resolved', resolved_at = new.closeout_completed_at,
           resolved_by = new.closeout_completed_by, updated_by = new.closeout_completed_by,
           resolution_note = 'Automatically resolved when the flock completed closeout.'
     where entity_type = 'placement' and entity_id = new.placement_id and status = 'open';
  end if;
  return new;
end;
$$;
create trigger trg_closeout_resolve_placement_issues
after insert or update of closeout_completed_at on public.placement_closeouts
for each row execute function public.resolve_completed_closeout_issues();

create or replace function public.record_closeout_issue_resolution()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.entity_type = 'placement' and new.status = 'resolved'
     and new.resolution_note = 'Automatically resolved when the flock completed closeout.' then
    if TG_OP = 'INSERT' or old.status = 'open' then
      insert into public.issue_updates(issue_id, entry_type, entry_text, effective_date, created_by)
      values (new.id, 'resolved', new.resolution_note, new.resolved_at::date, new.resolved_by);
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_closeout_issue_resolution_audit
after insert or update on public.issues
for each row execute function public.record_closeout_issue_resolution();

-- Repair existing issues for placements whose closeout is already completed.
update public.issues i
   set status = 'resolved', resolved_at = c.closeout_completed_at,
       resolved_by = c.closeout_completed_by, updated_by = c.closeout_completed_by,
       resolution_note = 'Automatically resolved when the flock completed closeout.'
  from public.placement_closeouts c
 where i.entity_type = 'placement' and i.entity_id = c.placement_id
   and i.status = 'open' and c.closeout_completed_at is not null;
revoke all on function public.enforce_placement_issue_closeout() from public;
revoke all on function public.resolve_completed_closeout_issues() from public;
revoke all on function public.record_closeout_issue_resolution() from public;
commit;
