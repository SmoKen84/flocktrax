# FlockTrax Localhost Document Archive Recovery And Feed Ticket UI Checkpoint

Date: `2026-06-25`
Environment: `C:\dev\FlockTrax`
Primary app surface: `web-admin`
Active runtime target: `http://localhost:3001`
Checkpoint type: local working-tree checkpoint

## Why This Checkpoint Exists

This checkpoint captures the local-only recovery and follow-on UI refinements after the new document-archive work hit a series of localhost closeout issues:

- livehaul packet upload was crashing into a JWT/session/runtime failure path on localhost
- closeout summary upload was failing because the app used the wrong closeout identifier for the archive foreign key
- the closeout worksheet contained nested forms that could corrupt server-action responses
- the local Next dev server on port `3001` was still running with stale config and silently rolling new starts to `3002`
- feed ticket archive actions were later refined with user-supplied `Document IN` / `Document OUT` icons plus business-rule exemptions for tickets that should never have hardcopy originals

This is the best resume point for the current localhost stabilization branch.

## User-Verified Outcomes

The following flows were tested by the user on `localhost:3001` and confirmed working:

- hatch ticket upload from flock closeout
- livehaul packet upload from flock closeout
- closeout summary snapshot upload from flock closeout

The following feed-ticket UI refinements were also implemented locally:

- `Document IN` and `Document OUT` icon buttons now use the provided PNG assets
- action-button slots stay aligned even when a row only has one of the document icons
- `Missing` badge is suppressed for ticket types `xTran`, `iTran`, and `f2f`
- `Missing` badge is also suppressed for tickets whose number contains `OpenBal`

## Root Causes Resolved

### 1. Local livehaul upload was failing before app code could respond normally

The livehaul document upload path on localhost was being interrupted by a stale local Next dev instance and by a request-size limit below the app’s own `20 MB` archive allowance.

Fixes:

- restarted the actual `localhost:3001` process instead of starting a second server on `3002`
- raised Next server-action body size limit to `25mb`
- wrapped livehaul actor lookup and upload action flow in defensive `try/catch`
- kept session recovery from turning likely auth/fetch failures into a full crash overlay

### 2. Closeout worksheet had nested forms

The closeout worksheet form contained nested child forms for:

- `Move To Archive`
- `Recalculate Totals`

Those nested forms were replaced with `button` controls using `formAction`, leaving a single outer worksheet form intact.

### 3. Closeout summary archive linkage used the wrong key

The summary snapshot upload action was trying to store `placement_closeout_id = closeout_id`, but the actual archive foreign key points at:

- `document_archives.placement_closeout_id -> placement_closeouts.placement_id`

Fixes:

- summary upload now stores and retires by `placement_id`
- closeout page summary lookup now also reads summary archive records back by `placement_id`

## Remaining Business Edge Case Identified

While testing another historical closeout (`262-W1` / placement `e6195b2a-e038-4591-99a2-5f728ea7c631`), `Save Closeout Draft` failed with:

`new row for relation "placement_closeouts" violates check constraint "placement_closeouts_ratio_totals_check"`

What that means:

- this flock is an early historical/backfill flock
- not all feed used by the flock appears to have been entered into FlockTrax
- the derived closeout feed math shows negative grower values
- the database correctly rejects negative ratio/totals fields

Observed page state at the time:

- `Feed Delivered: 22,950 lb`
- `24,000 lb starter`
- `-1,050 lb grower`
- closeout save blocked because ratio/consumed fields are constrained to non-negative values

User assessment:

- this is not expected to happen in normal forward-looking operations
- it is a historical early-flock artifact from incomplete feed entry during initial FlockTrax adoption

Operational implication:

- this flock cannot be processed through closeouts until feed history is corrected or otherwise balanced into a non-negative state

## Local Files Changed In This Work Stretch

### Document archive / closeout / upload stability

- `C:\dev\FlockTrax\web-admin\next.config.ts`
- `C:\dev\FlockTrax\web-admin\components\session-recovery-layer.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\livehaul\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\closeout-worksheet-form.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\[placementId]\page.tsx`

### Feed ticket document action UI

- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`
- `C:\dev\FlockTrax\web-admin\public\icons\doc-in.png`
- `C:\dev\FlockTrax\web-admin\public\icons\doc-out.png`

## Local Verification Notes

- `npm run typecheck` passed after each major patch set
- `localhost:3001` was explicitly restarted so `next.config.ts` changes took effect
- in-app browser inspection confirmed the document archive section exists on closeout pages and now shows:
  - Hatch Ticket `Filed`
  - Livehaul Packet `Filed`
  - Summary Snapshot `Filed`

## Important Working-Tree Context

At checkpoint time, the repo contains local uncommitted changes related to this stabilization and UI refinement work. The user explicitly asked for a checkpoint and index entry rather than a commit at this moment.

Notable modified app files include:

- `web-admin/app/admin/feed-tickets/feed-ticket-console.tsx`
- `web-admin/app/admin/flock-closeout/[placementId]/page.tsx`
- `web-admin/app/admin/flock-closeout/actions.ts`
- `web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx`
- `web-admin/app/admin/placements/livehaul/actions.ts`
- `web-admin/app/globals.css`
- `web-admin/components/session-recovery-layer.tsx`
- `web-admin/next.config.ts`

Notable untracked/local assets or notes include:

- `web-admin/public/icons/doc-in.png`
- `web-admin/public/icons/doc-out.png`
- this checkpoint file

## Best Resume Point

When resuming, assume:

- `localhost:3001` is the active environment unless the user explicitly says otherwise
- closeout archive uploads are working locally
- feed ticket document action icons and missing-badge business rules are already in place locally
- the next unresolved functional decision is how to handle historical closeout rows whose incomplete early feed history creates negative closeout feed ratios

## Recommended Next Steps

1. Decide whether to commit the localhost document-archive and feed-ticket UI fixes as one grouped commit.
2. Decide how historical backfill flocks with negative derived feed values should be handled:
   - data cleanup only
   - one-off balancing correction entries
   - or a dedicated historical override/backfill safety path
3. Keep working from `localhost:3001` until the user explicitly requests deployment.
