# FlockTrax Placement Scheduler Checkpoint

Date: 2026-04-15 19:04:24 -05:00

## Scope

This checkpoint captures the current `web-admin` state after:

- the `Feed Bins` setup screen was implemented, refined, and deployed
- the old placeholder placement wizard was replaced with a first-pass barn calendar scheduler
- the scheduling model was clarified so `placements.is_active` remains the operational truth of who is physically in a barn right now

## Current Live Deployment

Vercel production deployment at checkpoint:

- deployment id: `dpl_DmTEDtSTmnp7sdmCBX9b8SkPwRr8`
- deployment url: `https://web-admin-cv4l8ltgr-flock-trax.vercel.app`

Aliases attached:

- `https://admin.flocktrax.com`
- `https://flocktrax.com`

## Feed Bins Status

Implemented and deployed:

- new admin route:
  - `/admin/feed-bins`
- linked into admin navigation as `Feed Bins`
- uses live `public.feedbins` records tied to `barn_id`
- user can:
  - filter by farm
  - filter by barn
  - add bin
  - save bin number and capacity
  - delete a bin only if it has no `feed_drops` history

Current design notes:

- bin cards were iteratively tuned to fit the narrow selector column
- badge, input controls, and button sizing were adjusted based on live screenshots
- current live layout is acceptable and user-approved as workable

## Placement Scheduler Status

Implemented and deployed as first rough concept:

- route:
  - `/admin/placements/new`
- replaces the original draft placement wizard stub

Current screen behavior:

- choose a farm
- choose a barn
- see a month calendar for that barn
- blocked dates are derived from existing placement windows
- recommended next placement date is highlighted
- user can click an open date
- right-side scheduling panel appears for that target date
- saving creates:
  - a new `public.flocks` row
  - a new linked `public.placements` row

Current defaults in first pass:

- `growOutDays` fallback: `63`
- `nextPlaceOffsetDays` fallback: `14`
- if no flock number is entered, next available flock number for the selected farm is assigned
- projected end date is calculated from selected date + grow-out days

## Key Architecture Decision Reached

This was the major design decision reached during the session:

- `placements.is_active` is the operational truth of who is actually in the barn now
- future scheduled placements may exist, but they must not become active automatically
- there should never be more than one placement for a barn with `is_active = true`
- worker-facing functions such as feed allocation, daily logs, mortality, and weights should continue to resolve from the single active placement only

Agreed direction:

- no normal CRUD flow should be allowed to freely toggle `placements.is_active`
- a dedicated handoff/activation function should eventually be the only writer of that state
- scheduling dates and calendar blocks are planning data
- `is_active` is live operational control data

## Important Current Safety Assumption

The current scheduler implementation uses this interim rule:

- future scheduled placements are created with `is_active = false`
- placements scheduled for today or in the past are currently eligible to be inserted with `is_active = true`

This was done to stay safer against the current trigger behavior, but it is not the final model.

## Known Trigger Constraint

Existing database trigger behavior still matters:

- `public.placements_sync_barn_state()` currently updates:
  - `barns.active_flock_id`
  - `barns.has_flock`
  - `barns.is_empty`
- and it also shuts off any other active placement in the same barn when a placement becomes active

This means the next refinement should move toward:

- one dedicated placement activation / handoff function
- scheduler only creates scheduled rows
- activation of the next placement should happen through one controlled path

## Main Files Relevant To The Scheduler Checkpoint

Placement scheduler:

- `web-admin/app/admin/placements/new/page.tsx`
- `web-admin/app/admin/placements/new/actions.ts`
- `web-admin/lib/placement-scheduler-data.ts`
- `web-admin/app/globals.css`

Feed bins:

- `web-admin/app/admin/feed-bins/page.tsx`
- `web-admin/app/admin/feed-bins/feed-bins-view.tsx`
- `web-admin/app/admin/feed-bins/actions.ts`
- `web-admin/lib/feed-bin-data.ts`
- `web-admin/app/globals.css`

Navigation:

- `web-admin/components/admin-shell.tsx`
- `web-admin/app/page.tsx`

## Verification State At Checkpoint

Verified during this session:

- `npm run typecheck`
- `npm run build`
- repeated successful production deploys through Vercel CLI

## User Direction At Checkpoint

User response on scheduler direction:

- rough scheduler concept is considered workable
- next work should refine:
  - styling into stronger FlockTrax visual language
  - activation / handoff architecture around `placements.is_active`
  - eventual scheduling workflow polish after live review

User also confirmed:

- the scheduler is worth continuing
- they will review it further after returning from live farm work
