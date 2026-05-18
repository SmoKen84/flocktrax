with ranked_resolved_derived as (
  select
    issue.id,
    row_number() over (
      partition by issue.entity_type, issue.entity_id, issue.issue_type, issue.title
      order by
        case
          when issue.resolved_by is not null
           and nullif(btrim(issue.resolution_note), '') is not null
            then 0
          when issue.resolved_by is not null
            then 1
          else 2
        end,
        coalesce(issue.resolved_at, issue.updated_at, issue.opened_at) desc,
        issue.opened_at desc,
        issue.id desc
    ) as keep_rank,
    count(*) over (
      partition by issue.entity_type, issue.entity_id, issue.issue_type, issue.title
    ) as duplicate_count
  from public.issues as issue
  where issue.entity_type = 'placement'
    and issue.status = 'resolved'
    and left(coalesce(issue.description, ''), 13) = 'Auto-derived:'
),
duplicates_to_delete as (
  select id
  from ranked_resolved_derived
  where duplicate_count > 1
    and keep_rank > 1
)
delete from public.issues as issue
using duplicates_to_delete as duplicate_issue
where issue.id = duplicate_issue.id;
