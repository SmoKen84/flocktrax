with ranked_rows as (
  select
    id,
    row_number() over (
      partition by "group", name
      order by
        case when nullif(btrim(value), '') is null then 0 else 1 end desc,
        updated_at desc nulls last,
        id desc
    ) as duplicate_rank
  from public.app_settings
  where "group" is not null
    and name is not null
)
delete from public.app_settings target
using ranked_rows ranked
where target.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists app_settings_group_name_uidx
on public.app_settings ("group", name)
where "group" is not null
  and name is not null;
