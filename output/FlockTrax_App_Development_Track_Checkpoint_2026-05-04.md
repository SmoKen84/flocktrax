# FlockTrax App Development Track Checkpoint

Date: 2026-05-04
Purpose: Resume feature work, admin-console refinement, sync/outbox workflow, and bug corrections without centering the release track.

## Current Development Themes

- feed-ticket admin entry/edit workflow is actively being built and refined in `web-admin`
- sync engine outbox usability is being improved for split-screen / normal browser widths
- mobile and backend ticket-type rules are now in place for richer feed-ticket workflows
- first-7-day mortality popup and related admin workflows were improved earlier in the cycle

## Feed Ticket Work Completed

### Ticket Type Foundation

Backend and schema support now exist for:
- `Reg`
- `xTran`
- `iTran`
- `f2f`

Relevant files:
- `C:\dev\FlockTrax\supabase\functions\feed-ticket-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\feed-ticket-list\index.ts`
- `C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts`
- `C:\dev\FlockTrax\supabase\migrations\20260429121500_feed_ticket_type_rules.sql`

Behavior:
- `Reg` normal positive receipt/allocation.
- `xTran` negative ticket and negative drops for off-farm removal.
- `iTran` zero-header balanced transfer within farm.
- `f2f` zero-header balanced flock-to-flock transfer with looser state rules.

Historical-entry gate:
- live restrictions may be bypassed only when historical-entry mode is allowed and the user has admin-like authority.

### Voucher / Internal Ticket Number Fix

Bug fixed:
- code was incorrectly using `internal_voucher_num`
- live settings correctly used `internal_voucher_number`

Corrective files:
- `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`
- `C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts`
- `C:\dev\FlockTrax\supabase\migrations\20260503154500_fix_internal_voucher_setting_name.sql`

Live action already taken:
- corrective SQL was applied to the linked live Supabase project.

## Feed Ticket Admin Console / Editor

Main files:
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`
- `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`
- `C:\dev\FlockTrax\web-admin\lib\feed-ticket-data.ts`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

Current state:
- editor exists in admin console
- create/edit/delete path exists
- load-type uses compact choice controls
- ticket number is treated as fixed display, not editable
- row remove uses compact `X`
- editor now occupies the workspace more like a dedicated editing surface

## Listing / Action Standardization

Latest deployed web-admin commit:
- `e898a3b` `web-admin: improve sidebar badge and list actions`

Included there:
- larger `Sync Engine` pending badge in sidebar
- sticky action columns on active list screens
- icon-button pattern started:
  - `X` delete/remove
  - `✎` edit
  - `↻` replay/retry
  - `...` detail/multi-value reader

Touched files:
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\outbox\outbox-table.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Sync / Outbox Notes

- user wanted the sidebar pending badge readable in split-screen.
- action buttons in listings are being standardized so changing column widths do not push actions off-screen.
- target standard for listing controls:
  - `X` delete/remove
  - `pencil` edit
  - rounded right-arrow / replay style for repeat/replay
  - `...` for detail readers

## Repository / Safety Notes

- repo worktree remains dirty.
- this is intentional for now because cleanup is deferred until a clearly good compiled working app exists.
- weekend checkpoint files have been recovered and indexed.

Key meta files:
- `C:\dev\FlockTrax\output\FlockTrax_Checkpoint_Index.md`
- `C:\dev\FlockTrax\output\FlockTrax_Recovery_Checkpoint_2026-05-03_AM.md`

## Good Resume Topics For This Track

Use this checkpoint when the goal is:
- admin UI refinement
- feed-ticket editor behavior
- sync outbox usability
- business-rule enforcement
- non-release bug corrections

## Suggested Next Development Steps

1. Continue propagating icon-only sticky action columns to other list-heavy admin screens.
2. Keep testing `xTran`, `iTran`, and `f2f` in admin.
3. Refine feed-ticket editor layout only after real usage reveals pain points.
4. Defer repository cleanup until good compiled/app states are confirmed.
