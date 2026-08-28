alter table if exists public.feed_tickets
  add column if not exists updated_by uuid;

update public.feed_tickets
set updated_by = created_by
where updated_by is null
  and created_by is not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'feed_tickets'
      and constraint_name = 'feed_tickets_updated_by_fkey'
  ) then
    alter table public.feed_tickets
      add constraint feed_tickets_updated_by_fkey
      foreign key (updated_by)
      references public.app_users(user_id)
      on update cascade
      on delete set null;
  end if;
end
$$;

create index if not exists feed_tickets_updated_by_idx
  on public.feed_tickets (updated_by);
