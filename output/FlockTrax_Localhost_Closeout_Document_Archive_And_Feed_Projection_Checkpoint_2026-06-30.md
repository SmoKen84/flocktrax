# FlockTrax Localhost Closeout Document Archive And Feed Projection Checkpoint

Date: `2026-06-30`
Captured: `2026-06-30 09:04:11 -05:00`
Repo: `C:\dev\FlockTrax`
Branch: `main`
HEAD: `6dd99d5`
Mode: local working-tree checkpoint
Primary runtime target: `http://localhost:3001`

## Purpose

This checkpoint preserves the current localhost-only execution state after a long stretch of archive, closeout, feed-ticket, and feed-projection work.

It is the best resume point for:

- closeout document-archive uploads on `localhost:3001`
- feed-ticket original-document actions and business-rule display cleanup
- feed-ticket audit-field repair work
- feed projection report rule corrections
- the new click-to-explain `Starter Oblg` math popup on the `10 Day Feed Projection`

## Current Functional Baseline

The user is actively working on `localhost:3001`, not `flocktrax.com`, and that distinction matters.

Confirmed/accepted current localhost state:

- closeout document archive section is present and usable on flock closeout pages
- hatch ticket upload works
- livehaul packet upload works after the localhost upload/session recovery fixes
- closeout summary upload works after the foreign-key correction
- feed-ticket list has document input/output icon buttons instead of the old text button treatment
- feed-ticket original-missing rules now suppress false positives for internal/non-paper ticket classes
- the `10-day` feed projection now counts today as day `1`
- the `10-day` feed projection excludes barns that will not have an `in-barn` flock during the report window
- the `10-day` feed projection now exposes a click-through starter-obligation math popup

## Major Work Captured Here

### 1. Closeout document archive stabilization on localhost

The local closeout archive path hit multiple issues during testing and has been hardened:

- stale dev-server confusion between `3001` and `3002`
- oversized livehaul PDF upload behavior
- session/JWT fetch failures turning into a black runtime crash overlay
- closeout summary upload using the wrong closeout-side key
- attach modal rendering issues

Result:

- localhost closeout uploads can now be exercised without collapsing into the old black runtime failure screen
- the attach/archive UI is usable again from the closeout screen

Primary files in this area:

- `C:\dev\FlockTrax\web-admin\next.config.ts`
- `C:\dev\FlockTrax\web-admin\components\session-recovery-layer.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\livehaul\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\closeout-document-panels.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\closeout-worksheet-form.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\[placementId]\page.tsx`

### 2. Feed-ticket original document workflow refinements

Feed-ticket document handling was cleaned up so the list behaves more like an audit tool and less like a text-heavy admin grid.

Implemented locally:

- `Document IN` / `Document OUT` icon actions
- reserved icon-column space so rows stay aligned whether one or both actions are present
- missing-original suppression for:
  - `xTran`
  - `iTran`
  - `f2f`
  - ticket numbers containing `OpenBal`
- tighter feed-drop row layout with smaller redirect checkbox and narrower bin field
- flock-assignment override presentation shifted away from noisy labels toward a field-state approach

Current icon assets in use:

- `C:\dev\FlockTrax\web-admin\public\icons\doc-inA.png`
- `C:\dev\FlockTrax\web-admin\public\icons\doc-outA.png`

Primary files in this area:

- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

### 3. Feed-ticket audit fields and schema follow-up

The user noticed that `created by` and `updated by` were not being populated consistently on feed tickets.

Important discovered reality:

- `feed_tickets.created_by` points to `public.app_users(user_id)`, not directly to `auth.users(id)`
- the live database initially lacked `feed_tickets.updated_by`

What happened:

- the user ran SQL successfully to backfill `created_by` to the current valid `app_users.user_id`
- the user also ran SQL successfully to add/backfill `updated_by`
- a new local migration was created so the repo captures the `updated_by` change going forward
- the local Supabase feed-ticket submit function was patched to resolve the signed-in user by email against `app_users` before writing audit fields

Important boundary:

- the migration and function patch exist locally in the repo
- this checkpoint does **not** assert that the Supabase function has already been deployed live

Primary files in this area:

- `C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts`
- `C:\dev\FlockTrax\supabase\migrations\20260630120000_add_feed_tickets_updated_by.sql`

### 4. Feed projection rule reset and operational/planning split

The feed projection logic was corrected after the user surfaced several muddy business-rule collisions.

Locked-in rules:

- starter obligation is flock-based, not window-based
- starter target is `birds placed × lbs per chick`
- starter remains starter until the obligation is exhausted
- the old `12,000 lb` shortcut did not belong in the biological projection layer
- longer-range custom-day reports are planning references, not the actual operational order worksheet

Additional report fixes now in place locally:

- `10-day` and custom reports count the current date as day `1`
- blank query params no longer crash UUID filtering
- the `10-day` report excludes barns whose flock will not overlap the operational window
- collapsed custom report layout was tightened to fit the screen better

Primary files in this area:

- `C:\dev\FlockTrax\web-admin\lib\feed-projection-report-data.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection-custom\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection\feed-projection-report-table.tsx`

### 5. New starter-obligation explainer modal

As of this checkpoint, the `Starter Oblg` value on the `10 Day Feed Projection` report is clickable.

Behavior:

- click the displayed starter-obligation number
- a modal opens
- the modal shows:
  - target starter
  - starter delivered
  - remaining obligation
  - the explicit formula line

This was added so the user can audit the exact math behind rows like `311-W5` without leaving the report or guessing which hidden values were involved.

Files:

- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection\feed-projection-report-table.tsx`
- `C:\dev\FlockTrax\web-admin\lib\feed-projection-report-data.ts`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Known Historical Edge Case Still Relevant

The old closeout save failure on very early historical flocks remains conceptually unresolved as a data-quality edge case, not a current UI defect.

Example discussed during this work stretch:

- placement `e6195b2a-e038-4591-99a2-5f728ea7c631`

Meaning:

- incomplete early feed history can produce negative derived grower values
- `placement_closeouts` correctly rejects impossible negative totals
- that flock cannot close normally until its historical feed picture is balanced

User assessment:

- this should not recur in normal forward operations
- it was mainly an early-adoption/backfill artifact

## Dirty Worktree Snapshot

Current `git status --short` at checkpoint time includes:

- modified:
  - `output/FlockTrax_Checkpoint_Index.md`
  - `supabase/.temp/cli-latest`
  - `supabase/functions/feed-ticket-submit/index.ts`
  - `web-admin/app/admin/error.tsx`
  - `web-admin/app/admin/feed-tickets/feed-ticket-console.tsx`
  - `web-admin/app/admin/feed-tickets/feed-ticket-editor.tsx`
  - `web-admin/app/admin/flock-closeout/[placementId]/page.tsx`
  - `web-admin/app/admin/flock-closeout/actions.ts`
  - `web-admin/app/admin/flock-closeout/closeout-document-panels.tsx`
  - `web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx`
  - `web-admin/app/admin/placements/livehaul/actions.ts`
  - `web-admin/app/admin/reports/feed-projection-custom/page.tsx`
  - `web-admin/app/admin/reports/feed-projection/feed-projection-report-table.tsx`
  - `web-admin/app/admin/reports/feed-projection/page.tsx`
  - `web-admin/app/globals.css`
  - `web-admin/components/session-recovery-layer.tsx`
  - `web-admin/lib/feed-projection-report-data.ts`
  - `web-admin/next.config.ts`
- untracked:
  - several earlier checkpoint `.md` files in `output\`
  - `output/feed-ticket-backfill-summary-2026-06-23.json`
  - `supabase/migrations/20260630120000_add_feed_tickets_updated_by.sql`
  - `web-admin/public/icons/`

## Validation State

Validated locally during this work arc:

- `npm run typecheck` passed after the major archive/report stabilization changes
- `npm run typecheck` also passed after adding the new starter-obligation math modal

User-verified browser outcomes on localhost included:

- hatch ticket archive upload worked
- livehaul packet archive upload worked
- closeout summary archive upload worked
- closeout hatch attach modal reopened correctly after the rendering fix

## Best Resume Point

When resuming from this checkpoint, assume:

- `http://localhost:3001` is the active working environment unless the user explicitly says otherwise
- closeout document archive hooks are in place and usable locally
- feed-ticket document icon actions and missing-original exemptions are already implemented locally
- feed projection business rules have already been reset to the newer starter-obligation model
- the `Starter Oblg` cell on the `10 Day Feed Projection` now opens a math explainer modal

## Recommended Next Steps

1. Continue testing closeout document archive flows on real flocks from `localhost:3001`.
2. Decide whether to commit this localhost stabilization/reporting batch as one grouped checkpoint commit or split it into:
   - archive/closeout/feed-ticket UI
   - feed projection/report logic
   - Supabase feed-ticket audit-field follow-up
3. If audit-field persistence matters immediately in live use, confirm and deploy the local Supabase function patch after sanity-checking it against the current hosted environment.
4. If more report transparency is desired later, consider similar click-to-explain treatment for:
   - `Req'd Feed`
   - `On Hand`
   - `On Order`

## Recommended Restart Prompt

If a new chat needs to resume this exact state, begin with:

`Load C:\dev\FlockTrax\output\FlockTrax_Localhost_Closeout_Document_Archive_And_Feed_Projection_Checkpoint_2026-06-30.md and assume localhost:3001 is the active environment. Resume from the current closeout/document-archive/feed-projection local working tree without discarding uncommitted changes.`
