-- FlockTrax feed ticket duplicate audit
-- Run this first to review all current duplicate ticket numbers before applying the unique index.

-- 1. Summary of every normalized duplicate ticket number
select
  lower(btrim(ticket_num)) as normalized_ticket_num,
  count(*) as row_count,
  string_agg(distinct coalesce(ticket_type, 'Reg'), ', ' order by coalesce(ticket_type, 'Reg')) as ticket_types,
  min(delivery_date) as earliest_delivery_date,
  max(delivery_date) as latest_delivery_date
from public.feed_tickets
where ticket_num is not null
  and btrim(ticket_num) <> ''
group by lower(btrim(ticket_num))
having count(*) > 1
order by row_count desc, normalized_ticket_num;

-- 2. Detailed rows for every duplicate ticket number
with duplicate_groups as (
  select lower(btrim(ticket_num)) as normalized_ticket_num
  from public.feed_tickets
  where ticket_num is not null
    and btrim(ticket_num) <> ''
  group by lower(btrim(ticket_num))
  having count(*) > 1
)
select
  t.id,
  t.ticket_num,
  lower(btrim(t.ticket_num)) as normalized_ticket_num,
  coalesce(t.ticket_type, 'Reg') as ticket_type,
  t.delivery_date,
  t.feedmill,
  t.feed_weight,
  t.source_type,
  t.feed_name,
  t.created_at,
  t.updated_at
from public.feed_tickets t
join duplicate_groups d
  on d.normalized_ticket_num = lower(btrim(t.ticket_num))
order by lower(btrim(t.ticket_num)), t.delivery_date nulls last, t.created_at nulls last, t.id;

-- 3. Likely true duplicate mill tickets requiring human review
-- These are Reg tickets with the same normalized ticket number and same key header details.
select
  lower(btrim(ticket_num)) as normalized_ticket_num,
  delivery_date,
  coalesce(feedmill, '') as feedmill,
  coalesce(feed_weight, 0) as feed_weight,
  coalesce(source_type, '') as source_type,
  count(*) as row_count,
  array_agg(id order by created_at nulls last, id) as ticket_ids
from public.feed_tickets
where ticket_num is not null
  and btrim(ticket_num) <> ''
  and coalesce(ticket_type, 'Reg') = 'Reg'
group by
  lower(btrim(ticket_num)),
  delivery_date,
  coalesce(feedmill, ''),
  coalesce(feed_weight, 0),
  coalesce(source_type, '')
having count(*) > 1
order by normalized_ticket_num, delivery_date nulls last;
