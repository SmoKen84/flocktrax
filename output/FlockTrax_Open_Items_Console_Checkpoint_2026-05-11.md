# FlockTrax Open Items Console Checkpoint

Date: `2026-05-11`

Purpose:
- capture the current state of the `Open Items` / action-items work in case of interruption
- preserve what is already live versus what is still only directionally planned
- make resume simple after a power failure or forced shutdown

## Current Live State

The admin-side `Open Items` feature is live on:
- [https://flocktrax.com/admin/issues](https://flocktrax.com/admin/issues)

What is currently live:
- `Open Items` naming is in the admin console
- sidebar access exists in both:
  - signed-in admin shell
  - splash/home sidebar
- a first-pass console layout is live:
  - left filter panel
  - upper-right selectable list/table
  - bottom detail/work panel
- the bottom panel supports mode switching for:
  - `detail`
  - `update`
  - `resolve`
- thread/update history in the bottom panel now reads oldest to newest
- timestamps on the `Open Items` page were corrected to `America/Chicago`

## Current Data Model

Implemented tables:
- `public.issues`
- `public.issue_types`
- `public.issue_updates`

Current behavior:
- open-item types can now come from `issue_types`
- creating an item writes an initial `opened` update
- posting updates writes threaded entries into `issue_updates`
- resolving an item writes a `resolved` update entry
- barn-owned items can still carry placement context through `related_placement_id`

## Important Files

Schema / migrations:
- [C:\dev\FlockTrax\supabase\migrations\20260507143000_create_issues_feature.sql](C:\dev\FlockTrax\supabase\migrations\20260507143000_create_issues_feature.sql)
- [C:\dev\FlockTrax\supabase\migrations\20260507173000_expand_open_items_feature.sql](C:\dev\FlockTrax\supabase\migrations\20260507173000_expand_open_items_feature.sql)

Admin UI / actions:
- [C:\dev\FlockTrax\web-admin\app\admin\issues\page.tsx](C:\dev\FlockTrax\web-admin\app\admin\issues\page.tsx)
- [C:\dev\FlockTrax\web-admin\app\admin\issues\actions.ts](C:\dev\FlockTrax\web-admin\app\admin\issues\actions.ts)
- [C:\dev\FlockTrax\web-admin\app\globals.css](C:\dev\FlockTrax\web-admin\app\globals.css)
- [C:\dev\FlockTrax\web-admin\lib\issues.ts](C:\dev\FlockTrax\web-admin\lib\issues.ts)
- [C:\dev\FlockTrax\web-admin\components\admin-shell.tsx](C:\dev\FlockTrax\web-admin\components\admin-shell.tsx)
- [C:\dev\FlockTrax\web-admin\app\page.tsx](C:\dev\FlockTrax\web-admin\app\page.tsx)

Related direction notes:
- [C:\dev\FlockTrax\output\FlockTrax_Issues_System_Checkpoint_2026-05-07.md](C:\dev\FlockTrax\output\FlockTrax_Issues_System_Checkpoint_2026-05-07.md)
- [C:\dev\FlockTrax\output\FlockTrax_Open_Items_Product_Direction_Checkpoint_2026-05-07.md](C:\dev\FlockTrax\output\FlockTrax_Open_Items_Product_Direction_Checkpoint_2026-05-07.md)

## What The Current Screen Is

The current screen is no longer just the original scaffold.

It is now the first real move toward the user’s mockup:
- filter block on the left
- selectable work list on the upper right
- detail/work panel across the bottom

However, it is still a first pass, not the final mockup.

## What Is Not Done Yet

The mockup is not fully implemented yet.

Still missing or incomplete:
- the exact visual treatment of the mockup
- richer item lifecycle statuses beyond:
  - `open`
  - `resolved`
- an explicit `edit` mode in the bottom panel
- more polished selected-row behavior and denser list presentation
- printable repair/work-list reporting
- item updates carrying richer workflow meaning such as:
  - waiting on parts
  - in progress
  - pending approval

## Design Direction Confirmed

The agreed direction is:
- treat `Open Items` as the start of a lightweight maintenance / operational ticketing system
- use mobile for first-hand field capture
- use admin as the work queue / tracking / completion surface
- keep barn ownership when appropriate
- still link barn items to the live placement context when the placement may have been affected

The long-term destination includes:
- configurable item types
- threaded updates
- status progression
- historical context for placements
- printable “what needs repaired” reporting by farm and barn

## Most Recent Important Fixes

Recent functional fixes included:
- `Open Items` visible in both admin and splash sidebars
- `Open Items` thread order changed to oldest → newest
- `Open Items` timestamps corrected to US Central instead of UTC/GMT drift

## Recommended Next Step

When work resumes, the best next move is:
1. continue refining the `/admin/issues` console toward the mockup
2. add richer parent-item status values
3. add bottom-panel `edit` mode
4. continue tightening the list/detail interaction

## Resume Summary

If resuming cold, the best statement of current truth is:
- the data model is in place
- the first real console layout is live
- the feature works
- the next phase is UI/workflow refinement toward the mockup, not starting over
