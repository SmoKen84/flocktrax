update public.app_settings
set name = 'internal_voucher_number',
    updated_at = now()
where name = 'internal_voucher_num'
  and not exists (
    select 1
    from public.app_settings newer
    where newer.name = 'internal_voucher_number'
      and coalesce(newer."group", '') = coalesce(app_settings."group", '')
  );

create or replace function public.reserve_internal_voucher_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_counter_id uuid;
  v_counter_value text;
  v_next_number bigint;
begin
  select s.value
    into v_prefix
  from public.app_settings s
  where s.name = 'voucher_prefix'
    and (s."group" = 'feed_tickets' or s."group" is null)
  order by
    case when s."group" = 'feed_tickets' then 0 else 1 end,
    s.updated_at desc nulls last,
    s.created_at desc nulls last
  limit 1;

  select s.id, s.value
    into v_counter_id, v_counter_value
  from public.app_settings s
  where s.name in ('internal_voucher_number', 'internal_voucher_num')
    and (s."group" = 'feed_tickets' or s."group" is null)
  order by
    case when s.name = 'internal_voucher_number' then 0 else 1 end,
    case when s."group" = 'feed_tickets' then 0 else 1 end,
    s.updated_at desc nulls last,
    s.created_at desc nulls last
  limit 1
  for update;

  if v_counter_id is null then
    v_next_number := 1;

    insert into public.app_settings ("group", name, value, "desc", updated_at)
    values (
      'feed_tickets',
      'internal_voucher_number',
      '2',
      'Next internal voucher number used for xTran, iTran, and f2f feed tickets.',
      now()
    )
    on conflict ("group", name)
    do update
      set value = excluded.value,
          updated_at = now();
  else
    v_next_number := greatest(coalesce(nullif(btrim(v_counter_value), '')::bigint, 1), 1);

    update public.app_settings
    set name = 'internal_voucher_number',
        value = (v_next_number + 1)::text,
        updated_at = now()
    where id = v_counter_id;
  end if;

  return coalesce(v_prefix, '') || v_next_number::text;
exception
  when invalid_text_representation then
    raise exception 'app_settings.internal_voucher_number must contain a whole number';
end;
$$;

grant execute on function public.reserve_internal_voucher_number() to authenticated;
grant execute on function public.reserve_internal_voucher_number() to service_role;
