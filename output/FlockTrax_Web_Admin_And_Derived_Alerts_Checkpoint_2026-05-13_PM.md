# FlockTrax Web Admin And Derived Alerts Checkpoint

Date: 2026-05-13
Workspace: `C:\dev\FlockTrax`
Purpose: preserve the exact state after derived placement alerts, duplicate protection, configurable mortality warning settings, and the bundled high-priority `web-admin` fixes and deploys.

## Executive Summary

This session completed the end-to-end derived placement alert path, connected it to the active dashboard and issues flow, resolved duplicate auto-items, made the mortality thresholds settings-driven, fixed the `Entry By` label for auto-derived items, bundled several high-priority `web-admin` fixes, and pushed both the updated `feed-ticket-get` function and the `web-admin` production site live.

Live production status at this checkpoint:

- Supabase SQL changes were run manually in the Supabase SQL editor by the user
- Supabase edge functions for placement alert behavior are deployed
- Supabase `feed-ticket-get` is deployed
- `web-admin` is deployed live on `https://flocktrax.com`

## What Was Implemented

### 1. Derived placement alerts using existing issues plumbing

Implemented data-driven placement incidents so active flocks surface as danger tiles without manual issue entry.

Primary code touched:

- `supabase/functions/_shared/issues.ts`
- `supabase/functions/dashboard-placements-list/index.ts`
- `supabase/functions/placement-day-get/index.ts`
- `supabase/functions/placement-day-submit/index.ts`
- `web-admin/lib/admin-data.ts`

Behavior added:

- `Severe Early Mortality` derived from mortality data
- `Hatchery Quality Incident` derived from placement/bird health data
- current active flocks can surface as danger tiles through the existing issues model
- placement-day issues flow receives those derived incidents automatically

### 2. SQL migrations added and run

The following migrations were created locally and the user confirmed each was run successfully in the Supabase SQL editor:

1. `supabase/migrations/20260513110000_add_derived_placement_alerts.sql`
   - initial auto-derived placement issue generation

2. `supabase/migrations/20260513124500_dedupe_derived_placement_issues.sql`
   - resolved existing duplicate open auto-derived placement issues
   - added duplicate-prevention guard
   - moved sync behavior to safer upsert-style logic

3. `supabase/migrations/20260513133000_configurable_derived_placement_alerts.sql`
   - added settings-driven thresholds/enablement
   - wired to:
     - `mortality_autowarn`
     - `7day_warning`
     - `hatchery_issue_level`

Resulting backend behavior:

- `mortality_autowarn` can disable auto-derived mortality warnings entirely
- `7day_warning` controls the severe early mortality threshold
- `hatchery_issue_level` controls the hatchery-quality threshold
- threshold values accept either percentages like `10` / `3` or decimals like `0.10` / `0.03`

### 3. Initial function deploys completed by user

The following edge functions were deployed earlier in the session by the user:

- `dashboard-placements-list`
- `placement-day-get`
- `placement-day-submit`

These deployments made the derived placement alerts live for mobile/dashboard and placement-day backend flows.

### 4. Action Items / Issues UI improvements

Implemented and deployed:

- auto-derived issues display `Entry By: FlockTrax` instead of `Unknown`
- action-item updates now use their own effective date instead of silently falling back
- update-thread ordering now respects `effective_date` first, then `created_at`

Primary files:

- `web-admin/app/admin/issues/page.tsx`
- `web-admin/app/admin/issues/actions.ts`

### 5. Feed Tickets high-priority fixes

Implemented:

- added feed/source filtering by typed text instead of selector
- the filter field now sits to the right of `Ticket`
- label is `Feedmill / Source`
- filtering still uses the existing backend text-match behavior
- bin selector / bin list ordering now respects `barn.sort_code`

Files touched:

- `web-admin/app/admin/feed-tickets/feed-ticket-console.tsx`
- `web-admin/lib/feed-ticket-data.ts`
- `supabase/functions/feed-ticket-get/index.ts`

Important note:

- the typed filter replaced the temporary selector version added during this session
- the bottom `Starter` / `Grower` selection remains unchanged

### 6. Placement wizard layout fix

Implemented:

- `Start Females` and `Start Males` are now rendered as a paired row instead of splitting across lines beside `Date Removed`

Files touched:

- `web-admin/app/admin/placements/new/page.tsx`
- `web-admin/app/globals.css`

### 7. Admin font/rendering consistency hardening

Implemented:

- moved the admin shell onto distributed web fonts via Next font loading
- introduced:
  - `Source Sans 3` for sans UI text
  - `Fraunces` for serif-styled headings where used

Files touched:

- `web-admin/app/layout.tsx`
- `web-admin/app/globals.css`

Reason:

- reduce cross-machine layout drift from depending on locally installed fonts

## Production Deploys Completed By Codex In This Session

### Supabase function deploy

Executed successfully:

- `supabase functions deploy feed-ticket-get --project-ref frneaccbbrijpolcesjm`

Result:

- hosted feed-ticket editor/bin list payload now sorts bins by `barn.sort_code`

### Vercel production deploy

Executed successfully from `C:\dev\FlockTrax\web-admin`:

- `vercel deploy --prod --yes`

Production deployment details:

- deployment id: `dpl_45WbgxFXjhhM1thrrUn4sDWDuaeH`
- deployment URL: `https://web-admin-yh5o59c9t-flock-trax.vercel.app`
- inspector: `https://vercel.com/flock-trax/web-admin/45WbgxFXjhhM1thrrUn4sDWDuaeH`
- aliased live URL: `https://flocktrax.com`

Build result:

- production build completed successfully
- Next.js build compiled successfully
- Vercel build reached `READY`
- alias to `https://flocktrax.com` completed

## Validation Completed

- `web-admin` typecheck passed after the high-priority fixes
- deploys for `feed-ticket-get` and `web-admin` completed successfully

## Validation Still Recommended

Recommended quick live checks on `flocktrax.com`:

1. Action Items
   - confirm auto-derived records show `Entry By: FlockTrax`
   - confirm update chronology follows the update entry date

2. Feed Tickets
   - confirm the `Feedmill / Source` text field is to the right of `Ticket`
   - type a partial feedmill/source value and confirm row filtering works
   - confirm `Starter` / `Grower` remains in the lower filter area
   - open ticket editor and confirm bin options are ordered by `barn.sort_code`

3. Placement Wizard
   - confirm `Start Females` and `Start Males` sit together on one horizontal line on desktop
   - confirm responsive collapse still looks acceptable on narrower widths

4. Derived placement alerts
   - confirm a known qualifying flock still shows the danger tile
   - confirm issues/action-items still include the derived placement item

## Repo / Worktree Notes

This repo is not clean. There are unrelated existing modified/untracked files in the workspace. During this session, changes were made without reverting unrelated work.

Known session-relevant modified files include:

- `supabase/functions/feed-ticket-get/index.ts`
- `supabase/functions/_shared/issues.ts`
- `supabase/functions/dashboard-placements-list/index.ts`
- `supabase/functions/placement-day-get/index.ts`
- `supabase/functions/placement-day-submit/index.ts`
- `web-admin/app/admin/feed-tickets/feed-ticket-console.tsx`
- `web-admin/app/admin/issues/actions.ts`
- `web-admin/app/admin/issues/page.tsx`
- `web-admin/app/admin/placements/new/page.tsx`
- `web-admin/app/globals.css`
- `web-admin/app/layout.tsx`
- `web-admin/lib/admin-data.ts`
- `web-admin/lib/feed-ticket-data.ts`

Also present in repo state:

- the checkpoint and testing list files in `output/`
- the SQL migration files listed above

## Related Prior Checkpoints

Useful earlier checkpoint from the same development branch:

- `output/FlockTrax_Derived_Placement_Alerts_Checkpoint_2026-05-13.md`

That file captures the earlier state before the later `web-admin` high-priority fix bundle and live production deploy performed in this continuation.

## Suggested Resume Prompt

When resuming later, use:

`Resume C:\dev\FlockTrax from output/FlockTrax_Web_Admin_And_Derived_Alerts_Checkpoint_2026-05-13_PM.md. Derived placement alerts, duplicate protection, configurable mortality warning settings, feed-ticket sort/filter updates, action-item chronology fix, placement wizard layout fix, and the production web-admin + feed-ticket-get deploys are complete. Next step is live validation and any punch-list follow-up from testing.`
