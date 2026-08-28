alter table public.issues
  add column if not exists updated_by uuid null;

update public.issues
set updated_by = coalesce(
  (
    select iu.created_by
    from public.issue_updates iu
    where iu.issue_id = issues.id
      and iu.created_by is not null
    order by iu.created_at desc, iu.id desc
    limit 1
  ),
  opened_by
)
where updated_by is null;

create or replace function public.append_issue_memo(
  p_issue_id uuid,
  p_entry_text text,
  p_effective_date date,
  p_created_by uuid,
  p_resolved boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_update_id uuid;
  v_now timestamptz := now();
begin
  if nullif(btrim(coalesce(p_entry_text, '')), '') is null then
    raise exception 'Memo text is required.';
  end if;

  select status
  into v_status
  from public.issues
  where id = p_issue_id
  for update;

  if not found then
    raise exception 'Action Item was not found.';
  end if;

  if v_status <> 'open' then
    raise exception 'Resolved Action Items cannot be updated.';
  end if;

  insert into public.issue_updates (
    issue_id,
    entry_type,
    entry_text,
    effective_date,
    created_by
  )
  values (
    p_issue_id,
    case when p_resolved then 'resolved' else 'note' end,
    btrim(p_entry_text),
    coalesce(p_effective_date, v_now::date),
    p_created_by
  )
  returning id into v_update_id;

  update public.issues
  set
    updated_by = p_created_by,
    updated_at = v_now,
    status = case when p_resolved then 'resolved' else status end,
    resolved_at = case when p_resolved then v_now else resolved_at end,
    resolved_by = case when p_resolved then p_created_by else resolved_by end,
    resolution_note = case when p_resolved then btrim(p_entry_text) else resolution_note end
  where id = p_issue_id;

  return v_update_id;
end;
$$;

revoke all on function public.append_issue_memo(uuid, text, date, uuid, boolean) from public;
revoke all on function public.append_issue_memo(uuid, text, date, uuid, boolean) from anon;
revoke all on function public.append_issue_memo(uuid, text, date, uuid, boolean) from authenticated;
grant execute on function public.append_issue_memo(uuid, text, date, uuid, boolean) to service_role;

create or replace function public.prevent_issue_update_edit()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Saved Action Item memos are append-only and cannot be edited.';
end;
$$;

drop trigger if exists trg_issue_updates_prevent_edit on public.issue_updates;

create trigger trg_issue_updates_prevent_edit
before update on public.issue_updates
for each row
execute function public.prevent_issue_update_edit();

comment on column public.issues.updated_by is
  'User who created the most recent immutable memo linked to the Action Item.';

comment on function public.append_issue_memo(uuid, text, date, uuid, boolean) is
  'Atomically appends an immutable Action Item memo, updates parent audit fields, and optionally resolves the parent.';
