# FlockTrax Rollout + Feed Ticket Checkpoint

Date: April 23, 2026  
Time: 2:40 AM Central

## Current Goal

Primary objective is to get the whole system rolled out quickly:

- finalize web-admin behavior
- finish mobile feed-ticket workflow enough for field use
- recompile the repo
- cut release builds
- proceed with iOS App Store submission

This checkpoint captures the system state at pause so work can resume cleanly.

## Web Admin State

### Feed Tickets Console

New admin screen now exists at:

- [C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\page.tsx](C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\page.tsx)

Supporting loader:

- [C:\dev\FlockTrax\web-admin\lib\feed-ticket-data.ts](C:\dev\FlockTrax\web-admin\lib\feed-ticket-data.ts)

Behavior:

- `Feed Tickets` moved from `Archives` to `Console`
- present in sidebar nav:
  - [C:\dev\FlockTrax\web-admin\components\admin-shell.tsx](C:\dev\FlockTrax\web-admin\components\admin-shell.tsx)
- present on splash nav:
  - [C:\dev\FlockTrax\web-admin\app\page.tsx](C:\dev\FlockTrax\web-admin\app\page.tsx)
- screen uses mobile-inspired ticket cards, but with admin filters and rollups

Current filters on admin Feed Tickets screen:

- `Ticket #`
- `Flock`
- `Farm`
- `Barn`
- `Source`
- `From`
- `To`

Current rollups:

- ticket count
- total ticket weight
- allocated weight
- remaining weight
- total drop count

Styling added in:

- [C:\dev\FlockTrax\web-admin\app\globals.css](C:\dev\FlockTrax\web-admin\app\globals.css)

### Feed Tickets Hero Registry Wiring

Feed Tickets hero now pulls from `platform.screen_txt`:

- `admin_feed_title`
- `admin_feed_desc`

Fallback text remains hardcoded if the registry keys are missing.

Updated file:

- [C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\page.tsx](C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\page.tsx)

### Splash Screen

The stray brown hero button on the main splash screen was removed from:

- [C:\dev\FlockTrax\web-admin\app\page.tsx](C:\dev\FlockTrax\web-admin\app\page.tsx)

### Build Status

Web-admin verification at pause:

- `npm run build` passed
- `npm run typecheck` passed after `.next` regeneration

One local runtime note:

- starting `npm run dev` manually from this session hit `127.0.0.1:3000` permission/listen conflict because a server was already effectively occupying the port

## Mobile Feed Ticket State

Main screen:

- [C:\dev\FlockTrax\mobile\src\screens\FeedTicketScreen.tsx](C:\dev\FlockTrax\mobile\src\screens\FeedTicketScreen.tsx)

### Important Behavioral Clarification

The mobile feed-ticket flow does **not** save each drop to the backend individually.

Current backend contract:

- `Add Drop` / drop editing operates on the in-memory ticket draft
- actual persistence happens when a ticket save call is made through:
  - [C:\dev\FlockTrax\mobile\App.tsx](C:\dev\FlockTrax\mobile\App.tsx)
  - `saveFeedTicket()`
  - [C:\dev\FlockTrax\mobile\src\api\http.ts](C:\dev\FlockTrax\mobile\src\api\http.ts)
  - [C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts](C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts)

### Fixes Made Tonight

#### 1. Add-Drop Clarity

To reduce the “nothing happened” confusion:

- `Save Drop` was renamed to `Add Drop` in the new-ticket workflow
- inline helper text added
- local success/error feedback added near the drop-entry area

#### 2. End-of-Chain Problem

Problem found:

- after adding a drop, an unfinished pending drop could block final ticket save
- `Delete Drop` existed but still left farm/barn context, and the validation guard wrongly treated those as unfinished drop content

Fixes:

- added a `Delete Drop` action beside `Add Drop`
- changed pending-drop blocking logic so only real unfinished drop data counts:
  - `feed_bin_id`
  - `drop_weight_lbs`
  - `feed_type`
  - `note`

This allowed:

- add last real drop
- clear the extra pending line
- finish the ticket save

#### 3. Drop Table Layout

Adjusted the drop list layout so:

- `Type` moved left
- `Amount` got more width
- then rebalanced slightly so the `Type` header itself no longer wraps

#### 4. Existing-Ticket Edit Flow Rework

This was the last major mobile change tonight.

Requested behavior:

- once a saved ticket is reopened, screen should not behave like the create workflow
- no open drop-entry editor by default
- user should tap a drop to edit it
- selected drop should expose only save/delete controls
- delete should confirm
- after save/delete, return to feed-ticket list
- allow `+ Drop` for adding another drop if needed

Implemented in:

- [C:\dev\FlockTrax\mobile\src\screens\FeedTicketScreen.tsx](C:\dev\FlockTrax\mobile\src\screens\FeedTicketScreen.tsx)

What changed:

- existing saved tickets now open into review mode
- drop list rows are tappable
- `+ Drop` button appears in top bar for existing saved tickets
- no drop editor shown by default for saved tickets
- selecting a row opens the drop editor
- drop editor in saved-ticket mode exposes:
  - `Save Drop`
  - `Delete Drop`
- delete confirmation modal added
- after save/delete on an existing ticket, screen routes back to the `Feed Tickets` list
- new-ticket flow still remains a multi-drop builder

### Mobile Typecheck Status

At pause:

- `npx tsc --noEmit` passed in [C:\dev\FlockTrax\mobile](C:\dev\FlockTrax\mobile)

### Likely First Retest After Resume

Need to verify in Expo that the existing-ticket flow behaves as intended:

1. Create a new ticket
2. Add several drops
3. Clear the trailing blank pending line if necessary
4. Save ticket
5. Confirm it returns to feed-ticket list
6. Reopen saved ticket
7. Confirm no drop editor is visible by default
8. Tap an existing drop
9. Edit and save it
10. Confirm return to ticket list
11. Reopen again and delete a drop
12. Confirm delete dialog and return behavior
13. Test `+ Drop` on an existing ticket

## Feed Ticket Backend State

Current functions involved:

- [C:\dev\FlockTrax\supabase\functions\feed-ticket-get\index.ts](C:\dev\FlockTrax\supabase\functions\feed-ticket-get\index.ts)
- [C:\dev\FlockTrax\supabase\functions\feed-ticket-list\index.ts](C:\dev\FlockTrax\supabase\functions\feed-ticket-list\index.ts)
- [C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts](C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts)

Important behavior still true:

- `feed-ticket-submit` rewrites the ticket’s drop set on save:
  - updates or inserts ticket
  - deletes all existing drops for that ticket
  - reinserts the current provided drop set

That means the mobile saved-ticket edit flow is really “edit full ticket draft and resubmit”, not row-patch APIs.

That is acceptable for now, but worth remembering if later concurrency or audit behavior becomes important.

## Sync / Outbox State

### Batch + Schedule

Google Sheets sync was moved toward grouped processing:

- settings added and recorded in `platform.settings`
- worker intended to batch writes
- schedule intended to run every 15 minutes

Key settings:

- `googleapis_outbox_batch_writes`
- `googleapis_outbox_batch_limit`
- `googleapis_outbox_schedule_minutes`

User manually updated migration SQL to add case-insensitive uniqueness on settings names and the migration ran successfully.

### Payload Snapshots + Replay

Outbox improvements already in place:

- payload snapshots stored with outbox rows
- payload viewer present in Outbox UI
- replay logic added locally for eligible statuses

Files involved:

- [C:\dev\FlockTrax\supabase\migrations\20260422220000_googleapis_outbox_payload_snapshots.sql](C:\dev\FlockTrax\supabase\migrations\20260422220000_googleapis_outbox_payload_snapshots.sql)
- [C:\dev\FlockTrax\web-admin\lib\sync-data.ts](C:\dev\FlockTrax\web-admin\lib\sync-data.ts)
- [C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\outbox\outbox-table.tsx](C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\outbox\outbox-table.tsx)
- [C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\actions.ts](C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\actions.ts)
- [C:\dev\FlockTrax\supabase\functions\googleapis-outbox-process\index.ts](C:\dev\FlockTrax\supabase\functions\googleapis-outbox-process\index.ts)

### Pending Scheduler Concern

During this session there was a scheduler concern:

- queue rows sat `pending`
- attempts remained `0`
- manual hosted-worker call processed them immediately

Conclusion:

- worker path itself is okay
- schedule/cron path was the suspect

Repo-only repair migration created:

- [C:\dev\FlockTrax\supabase\migrations\20260422223000_repair_googleapis_outbox_cron_schedule.sql](C:\dev\FlockTrax\supabase\migrations\20260422223000_repair_googleapis_outbox_cron_schedule.sql)

Also updated badge logic locally so stale pending rows can light the Sync Engine badge:

- [C:\dev\FlockTrax\web-admin\app\api\sync-engine-badge\route.ts](C:\dev\FlockTrax\web-admin\app\api\sync-engine-badge\route.ts)

Need to confirm after resume whether the repaired cron migration was actually run against the hosted database.

## Placement Wizard State

Placement wizard was heavily exercised and is currently in a much better place.

Important completed fixes from prior session context:

- live create form now updates blocked-date projection immediately as `Grow-out Days` changes
- form no longer silently behaves like hardcoded `63`
- `Grow-out Days` fallback uses configured scheduler value rather than fixed 63 when no explicit grow-out setting exists
- barn-view calendar flock labels enlarged for readability

Key files:

- [C:\dev\FlockTrax\web-admin\app\admin\placements\new\schedule-placement-form.tsx](C:\dev\FlockTrax\web-admin\app\admin\placements\new\schedule-placement-form.tsx)
- [C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx](C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx)
- [C:\dev\FlockTrax\web-admin\app\admin\placements\new\actions.ts](C:\dev\FlockTrax\web-admin\app\admin\placements\new\actions.ts)
- [C:\dev\FlockTrax\web-admin\lib\placement-scheduler-data.ts](C:\dev\FlockTrax\web-admin\lib\placement-scheduler-data.ts)
- [C:\dev\FlockTrax\web-admin\app\globals.css](C:\dev\FlockTrax\web-admin\app\globals.css)

User confirmed:

- live blocked-date projection updates correctly while spinning grow-out days
- barn-view readability is much better

## Release / Store State

### iOS / Android Prep

Earlier work already set mobile release metadata and store-prep files:

- [C:\dev\FlockTrax\mobile\app.json](C:\dev\FlockTrax\mobile\app.json)
- [C:\dev\FlockTrax\mobile\eas.json](C:\dev\FlockTrax\mobile\eas.json)

Known mobile release candidate before tonight:

- version `1.0.1`
- iOS build `2`

Store checklists and reviewer-note text were previously drafted in chat.

### Before Submission, Best Next Step

Do not submit mobile yet until the feed-ticket flow is retested in Expo after the latest saved-ticket edit-mode changes.

Recommended immediate next steps after sleep:

1. Reload Expo
2. Retest feed-ticket create/save/reopen/edit/delete flows
3. Quick sanity check dashboard, daily log, mortality, weights
4. Rebuild mobile release candidate if feed-ticket flow is acceptable
5. Rebuild web-admin if any final Feed Tickets console polish is needed
6. Then proceed with store submission/deploy actions

## Most Important Files Touched In This Session

Web admin:

- [C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\page.tsx](C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\page.tsx)
- [C:\dev\FlockTrax\web-admin\lib\feed-ticket-data.ts](C:\dev\FlockTrax\web-admin\lib\feed-ticket-data.ts)
- [C:\dev\FlockTrax\web-admin\components\admin-shell.tsx](C:\dev\FlockTrax\web-admin\components\admin-shell.tsx)
- [C:\dev\FlockTrax\web-admin\app\page.tsx](C:\dev\FlockTrax\web-admin\app\page.tsx)
- [C:\dev\FlockTrax\web-admin\app\globals.css](C:\dev\FlockTrax\web-admin\app\globals.css)

Mobile:

- [C:\dev\FlockTrax\mobile\src\screens\FeedTicketScreen.tsx](C:\dev\FlockTrax\mobile\src\screens\FeedTicketScreen.tsx)
- [C:\dev\FlockTrax\mobile\App.tsx](C:\dev\FlockTrax\mobile\App.tsx)

Supabase:

- [C:\dev\FlockTrax\supabase\functions\feed-ticket-get\index.ts](C:\dev\FlockTrax\supabase\functions\feed-ticket-get\index.ts)
- [C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts](C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts)
- [C:\dev\FlockTrax\supabase\migrations\20260422223000_repair_googleapis_outbox_cron_schedule.sql](C:\dev\FlockTrax\supabase\migrations\20260422223000_repair_googleapis_outbox_cron_schedule.sql)

## Resume Suggestion

When resuming, start with:

- mobile Expo retest of feed-ticket flows

That is the most important unresolved behavior before pushing for full rollout and app-store submission.
