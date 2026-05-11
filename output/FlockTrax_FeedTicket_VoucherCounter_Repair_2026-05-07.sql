-- FlockTrax feed ticket voucher-counter repair
-- Purpose:
--   1. Ensure voucher settings exist in the correct feed_tickets scope
--   2. Set the next internal voucher counter based on existing xTran/iTran/f2f ticket numbers
--   3. Leave reserve_internal_voucher_number() ready to issue the next safe value
--
-- Assumptions:
--   - Internal transfer ticket numbers follow the pattern <prefix><integer>, e.g. SMO17
--   - Prefix is stored in app_settings.name = 'voucher_prefix'
--   - Counter is stored in app_settings.name = 'internal_voucher_number'

do $$
declare
  v_prefix text;
  v_existing_prefix text;
  v_next_number bigint;
begin
  -- Find the currently configured prefix, preferring the feed_tickets scoped row.
  select nullif(btrim(s.value), '')
    into v_existing_prefix
  from public.app_settings s
  where s.name = 'voucher_prefix'
    and (s."group" = 'feed_tickets' or s."group" is null or s."group" = 'General')
  order by
    case when s."group" = 'feed_tickets' then 0
         when s."group" is null then 1
         when s."group" = 'General' then 2
         else 3
    end,
    s.updated_at desc nulls last,
    s.created_at desc nulls last
  limit 1;

  v_prefix := coalesce(v_existing_prefix, 'SMO');

  -- Ensure feed_tickets-scoped voucher_prefix row exists and is authoritative.
  update public.app_settings
  set value = v_prefix,
      updated_at = now()
  where "group" = 'feed_tickets'
    and name = 'voucher_prefix';

  if not found then
    insert into public.app_settings ("group", name, value, "desc", updated_at)
    values (
      'feed_tickets',
      'voucher_prefix',
      v_prefix,
      'Prefix used for internally generated xTran, iTran, and f2f feed ticket numbers.',
      now()
    );
  end if;

  -- Compute the next safe voucher integer from existing internal-transfer tickets.
  select coalesce(max((regexp_match(btrim(t.ticket_num), ('^' || regexp_replace(v_prefix, '([\\W])', '\\\1', 'g') || '([0-9]+)$')))[1]::bigint), 0) + 1
    into v_next_number
  from public.feed_tickets t
  where coalesce(t.ticket_type, 'Reg') in ('xTran', 'iTran', 'f2f')
    and t.ticket_num is not null
    and btrim(t.ticket_num) <> ''
    and lower(btrim(t.ticket_num)) like lower(v_prefix) || '%';

  if v_next_number < 1 then
    v_next_number := 1;
  end if;

  -- Ensure feed_tickets-scoped counter row exists and points to the next safe number.
  update public.app_settings
  set value = v_next_number::text,
      updated_at = now()
  where "group" = 'feed_tickets'
    and name = 'internal_voucher_number';

  if not found then
    insert into public.app_settings ("group", name, value, "desc", updated_at)
    values (
      'feed_tickets',
      'internal_voucher_number',
      v_next_number::text,
      'Next internal voucher number used for xTran, iTran, and f2f feed tickets.',
      now()
    );
  end if;

  raise notice 'Voucher prefix set to %, next internal voucher number set to %', v_prefix, v_next_number;
end
$$;

-- Verification query
select
  s."group",
  s.name,
  s.value,
  s.updated_at
from public.app_settings s
where s.name in ('voucher_prefix', 'internal_voucher_number', 'internal_voucher_num')
order by
  case when s."group" = 'feed_tickets' then 0
       when s."group" is null then 1
       when s."group" = 'General' then 2
       else 3
  end,
  s.name,
  s.updated_at desc nulls last;
