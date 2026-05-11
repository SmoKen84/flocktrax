alter table if exists public.feed_tickets
  add column if not exists ticket_type text not null default 'Reg';

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'feed_tickets'
      and constraint_name = 'feed_tickets_ticket_type_check'
  ) then
    alter table public.feed_tickets
      add constraint feed_tickets_ticket_type_check
      check (ticket_type in ('Reg', 'xTran', 'iTran', 'f2f'));
  end if;
end
$$;
