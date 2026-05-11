# FlockTrax Action Items Detailed Checkpoint

Date: `2026-05-11`

Purpose:
- preserve the current live state of the `Action Items` feature in detail
- capture both the underlying data model and the current admin-console workflow
- make resume easy without reconstructing recent UI/layout decisions

## Current Live Feature Name

The feature is now presented in the admin UI as:
- `Action Items`
- `Action Items Console`

This replaced earlier `Issues` / `Open Items` wording in the main admin experience.

## Current Live URLs

- Admin console: [https://flocktrax.com/admin/issues](https://flocktrax.com/admin/issues)
- Action type maintenance: [https://flocktrax.com/admin/issues/types](https://flocktrax.com/admin/issues/types)

## Current Product Shape

The feature is now behaving as a lightweight operational task / maintenance tracking system:
- action items can be opened against a live placement context
- barn-owned items can still carry placement context
- items support threaded updates
- items can be resolved and then become read-only
- action types can be maintained from the admin side

This is no longer just a flag replacement. It is now the first real pass at a field-to-resolution work queue.

## Current Data Model

Implemented tables:
- `public.issues`
- `public.issue_types`
- `public.issue_updates`

Current parent-item status model:
- `open`
- `resolved`

Current thread/update entry model in use:
- `opened`
- `note`
- `progress`
- `parts_ordered`
- `resolved`

Important current rule:
- once an action item is resolved, it is treated as closed history
- resolved items are read-only in the admin console
- if the same real-world problem happens again, a new action item should be created

## Current Admin Console Layout

The admin console has moved well beyond the original scaffold and now reflects the current mockup direction:

1. Title / hero block
- `Action Items Console`
- back button in the upper-right
- `Manage Action Types` rendered as an underlined link anchored at the lower-right of the title block

2. Horizontal filter band under the title
- farm
- barn
- flock code
- action type
- date start
- date end
- status checkboxes
- `Apply` / `Clear` buttons positioned in the lower-right of the filter block

3. Dual center panels
- left: `Action Items`
- right: `Update History:`
- both are now held to a steadier fixed footprint instead of flexing unpredictably

4. Lower editor/detail panel
- reused as the working surface for:
  - detail
  - create
  - edit
  - update
  - resolve

This lower block is intentionally the active workspace rather than a passive footer.

## Current Console Behavior

### Action Items list

- list rows are tinted by status:
  - open/active rows use a green-tinted treatment
  - resolved rows use a red-tinted treatment
- selected row behavior is active and tied to the update-history pane
- list rows show a compact preview instead of over-expanding inline content

### Update History list

- thread order is oldest to newest
- long update detail is now read directly in the update row / scrollable list flow rather than a separate readout box
- the extra display textbox under update history was removed

### Date/time handling

- page date formatting was corrected to `America/Chicago`
- this addressed earlier UTC/GMT drift

### Resolved-item protections

Resolved items are now protected both in UI and server actions:
- `Edit`, `Update`, and `Resolve` actions are hidden for resolved items
- resolved items show a read-only note instead
- server actions reject:
  - updates to resolved items
  - edits to resolved items
  - resolving an already resolved item

## Current Action Type Maintenance

Action type maintenance is available at:
- [https://flocktrax.com/admin/issues/types](https://flocktrax.com/admin/issues/types)

Current behavior:
- reads from `public.issue_types`
- supports create/edit/deactivate behavior
- gated to admin-capable roles and super admins
- includes a helper-text pane sourced from:
  - `platform.screen_txt.name = 'action_type_helper'`

Important field meanings:
- `default tone`
  - intended as the default severity / visual emphasis hook for that action type
- `report group`
  - intended as the reporting bucket for future grouped reports, such as repair-only views

## Current Dashboard Integration

The admin live dashboard is now tied into the Action Items console.

When a placement tile has open items:
- the main status pill is clickable
- the issue summary area is clickable
- the inline `Open Items` link is clickable

Current handoff behavior:
- clicking from the tile opens the Action Items console
- the console is preloaded with:
  - `farmId`
  - `barnId`
  - `placementId`
  - `status = open`

This means a dashboard tile now hands the user straight into a filtered action-item work queue for that farm/barn context.

## Important Files

Schema / migrations:
- [C:\dev\FlockTrax\supabase\migrations\20260507143000_create_issues_feature.sql](C:\dev\FlockTrax\supabase\migrations\20260507143000_create_issues_feature.sql)
- [C:\dev\FlockTrax\supabase\migrations\20260507173000_expand_open_items_feature.sql](C:\dev\FlockTrax\supabase\migrations\20260507173000_expand_open_items_feature.sql)

Admin console:
- [C:\dev\FlockTrax\web-admin\app\admin\issues\page.tsx](C:\dev\FlockTrax\web-admin\app\admin\issues\page.tsx)
- [C:\dev\FlockTrax\web-admin\app\admin\issues\actions.ts](C:\dev\FlockTrax\web-admin\app\admin\issues\actions.ts)
- [C:\dev\FlockTrax\web-admin\app\admin\issues\back-button.tsx](C:\dev\FlockTrax\web-admin\app\admin\issues\back-button.tsx)
- [C:\dev\FlockTrax\web-admin\app\admin\issues\types\page.tsx](C:\dev\FlockTrax\web-admin\app\admin\issues\types\page.tsx)
- [C:\dev\FlockTrax\web-admin\app\admin\issues\types\actions.ts](C:\dev\FlockTrax\web-admin\app\admin\issues\types\actions.ts)

Dashboard integration:
- [C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx](C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx)

Supporting styling / definitions:
- [C:\dev\FlockTrax\web-admin\app\globals.css](C:\dev\FlockTrax\web-admin\app\globals.css)
- [C:\dev\FlockTrax\web-admin\lib\issues.ts](C:\dev\FlockTrax\web-admin\lib\issues.ts)
- [C:\dev\FlockTrax\web-admin\lib\admin-data.ts](C:\dev\FlockTrax\web-admin\lib\admin-data.ts)

Earlier direction notes:
- [C:\dev\FlockTrax\output\FlockTrax_Issues_System_Checkpoint_2026-05-07.md](C:\dev\FlockTrax\output\FlockTrax_Issues_System_Checkpoint_2026-05-07.md)
- [C:\dev\FlockTrax\output\FlockTrax_Open_Items_Product_Direction_Checkpoint_2026-05-07.md](C:\dev\FlockTrax\output\FlockTrax_Open_Items_Product_Direction_Checkpoint_2026-05-07.md)
- [C:\dev\FlockTrax\output\FlockTrax_Open_Items_Console_Checkpoint_2026-05-11.md](C:\dev\FlockTrax\output\FlockTrax_Open_Items_Console_Checkpoint_2026-05-11.md)

## What Was Fixed During This Session

Key fixes and refinements completed during this round:
- moved `Manage Action Types` out of button styling and into a lower-right underlined link inside the title block
- made the back button behave like a real back action instead of always routing to dashboard
- corrected filter-band layout problems:
  - date-range overlap
  - status checkbox interaction
- prevented updates from being posted to resolved items
- changed dashboard tile handoff so action-item navigation preloads farm, barn, and open status filters
- refined the list/history/editor layout closer to the supplied mockup

## Known Current Limitations

The feature is functional, but not finished.

Still incomplete or intentionally deferred:
- richer live statuses are not implemented yet:
  - `in_progress`
  - `waiting`
  - `pending_approval`
- status changes are not yet driven from the update-entry flow
- `resolved` is still just the final close state, not the end of a richer lifecycle
- printable maintenance / repair reporting is not built yet
- the full mockup visual polish is not complete yet
- some text in the codebase still contains old encoding artifacts in a few labels/comments, though not enough to break builds

## Confirmed Product Direction

The agreed direction remains:
- use mobile for first-hand field capture
- use admin as the work queue / update / resolve surface
- keep ownership on the real entity where appropriate:
  - barn-owned when it is a barn problem
  - placement-owned when it is a placement/flock-cycle problem
- preserve placement context for barn items that occurred during a specific grow cycle

Longer-term intended outcomes:
- configurable action types
- threaded updates
- richer status progression
- historical placement context
- printable repair/work lists by farm and barn
- eventual evolution toward a lightweight trouble-ticket / maintenance tracking feature

## Best Next Step

When work resumes, the cleanest next move is:
1. implement richer action-item statuses
2. let normal updates carry status transitions among non-final statuses
3. keep `Resolve` as the only final close action
4. continue polishing the console to match the mockup more tightly

## Resume Summary

If resuming cold, the shortest truthful summary is:
- the Action Items feature is live and genuinely usable
- action types are maintainable in admin
- dashboard tiles hand off into a filtered action-item queue
- resolved items are now treated as closed history
- the next phase is workflow/status refinement and UI polish, not rebuilding the feature from scratch
