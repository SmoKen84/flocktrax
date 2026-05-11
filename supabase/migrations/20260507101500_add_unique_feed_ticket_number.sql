do $$
declare
  duplicate_count integer;
begin
  select count(*)
  into duplicate_count
  from (
    select lower(btrim(ticket_num)) as normalized_ticket_num
    from public.feed_tickets
    where ticket_num is not null
      and btrim(ticket_num) <> ''
    group by lower(btrim(ticket_num))
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception using
      message = 'Cannot add unique feed ticket number index because duplicate ticket numbers already exist.',
      detail = 'Clean existing duplicate values in public.feed_tickets.ticket_num before re-running this migration.';
  end if;
end
$$;

create unique index if not exists feed_tickets_ticket_num_unique_idx
  on public.feed_tickets (lower(btrim(ticket_num)))
  where ticket_num is not null
    and btrim(ticket_num) <> '';
