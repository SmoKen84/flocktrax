-- FlockTrax internal voucher duplicate repair
-- Purpose:
--   Re-number duplicate internal transfer ticket numbers (xTran / iTran / f2f)
--   using the live public.reserve_internal_voucher_number() function.
--
-- Notes:
--   1. This intentionally keeps the first row in each duplicate internal-ticket group unchanged.
--   2. Every later duplicate in the same normalized ticket-number group gets a newly reserved voucher number.
--   3. The denormalized ticket_num stored on public.feed_drops is updated to match.
--   4. Run the duplicate audit again afterward, then manually review true Reg duplicates.

do $$
declare
  rec record;
  v_new_ticket_num text;
begin
  for rec in
    with ranked_internal_duplicates as (
      select
        t.id,
        t.ticket_num,
        coalesce(t.ticket_type, 'Reg') as ticket_type,
        lower(btrim(t.ticket_num)) as normalized_ticket_num,
        row_number() over (
          partition by lower(btrim(t.ticket_num))
          order by t.delivery_date nulls last, t.created_at nulls last, t.id
        ) as rn
      from public.feed_tickets t
      where t.ticket_num is not null
        and btrim(t.ticket_num) <> ''
        and coalesce(t.ticket_type, 'Reg') in ('xTran', 'iTran', 'f2f')
        and lower(btrim(t.ticket_num)) in (
          select lower(btrim(ticket_num))
          from public.feed_tickets
          where ticket_num is not null
            and btrim(ticket_num) <> ''
            and coalesce(ticket_type, 'Reg') in ('xTran', 'iTran', 'f2f')
          group by lower(btrim(ticket_num))
          having count(*) > 1
        )
    )
    select id, ticket_num, ticket_type, normalized_ticket_num
    from ranked_internal_duplicates
    where rn > 1
    order by normalized_ticket_num, id
  loop
    v_new_ticket_num := public.reserve_internal_voucher_number();

    update public.feed_tickets
    set ticket_num = v_new_ticket_num,
        updated_at = now()
    where id = rec.id;

    update public.feed_drops
    set ticket_num = v_new_ticket_num
    where feed_ticket_id = rec.id;

    raise notice 'Re-numbered % ticket % from % to %',
      rec.ticket_type,
      rec.id,
      rec.ticket_num,
      v_new_ticket_num;
  end loop;
end
$$;
