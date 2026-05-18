# FlockTrax Derived Placement Alerts Checkpoint

Date: 2026-05-13
Timezone: America/Chicago

## Purpose

Add a data-driven placement alert for severe early mortality and hatchery-quality incidents, using the existing `issues` plumbing so active flocks surface as danger tiles without manual issue entry.

## Completed

### Backend / SQL

The following SQL work has been created and, per user confirmation in this thread, run successfully in the Supabase SQL editor:

- `C:\dev\FlockTrax\supabase\migrations\20260513110000_add_derived_placement_alerts.sql`
  - initial derived placement issue sync function
- `C:\dev\FlockTrax\supabase\migrations\20260513124500_dedupe_derived_placement_issues.sql`
  - dedupe pass for already-open duplicates
  - unique index guard for auto-derived open placement items
  - atomic upsert path for future derived alerts
- `C:\dev\FlockTrax\supabase\migrations\20260513133000_configurable_derived_placement_alerts.sql`
  - makes alert behavior configurable through `public.app_settings`

### Current derived-alert settings behavior

The live SQL function `public.sync_derived_placement_issues(uuid[])` now respects:

- `app_settings.name = 'mortality_autowarn'`
  - master enable/disable switch
- `app_settings.name = '7day_warning'`
  - severe early mortality threshold
- `app_settings.name = 'hatchery_issue_level'`
  - hatchery-quality threshold

Accepted threshold formats:

- decimal form like `0.10`
- percentage form like `10`

If `mortality_autowarn` is off, auto-derived mortality alerts resolve and stop reopening.

### Edge functions updated

The derived issue sync was wired into:

- `C:\dev\FlockTrax\supabase\functions\_shared\issues.ts`
- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`
- `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`

User also confirmed the edge functions were deployed:

- `dashboard-placements-list`
- `placement-day-get`
- `placement-day-submit`

### Web-admin updated locally

Local code was updated so web-admin live dashboard data refreshes the derived issues through the shared issue model:

- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`

Local code was also updated so auto-derived items show:

- `Entry By: FlockTrax`

File:

- `C:\dev\FlockTrax\web-admin\app\admin\issues\page.tsx`

## Verified

- SQL editor runs reported successful by user
- edge function deploy reported complete by user
- `npm run typecheck` in `C:\dev\FlockTrax\web-admin` passed after the web-admin changes

## Known current state

### Live backend

The backend side is live now:

- derived placement issues auto-open from mortality data
- duplicate auto-items are guarded against
- thresholds are settings-driven

### Web-admin deployment status

The `Entry By: FlockTrax` display fix is only in local web-admin code until the web-admin site is deployed.

That means:

- localhost can show the fix if run from this workspace
- `flocktrax.com` will not show the label fix until the next web-admin deploy/build

## Pending / next work

### High-priority web-admin fixes before next build

User wants to include a couple of additional high-priority fixes in a side-chat / sidechat list markup area before doing another web-admin build.

At pause time:

- the exact sidechat file or component path had not yet been located
- search did not find an obvious `sidechat` component in this repo
- user planned to locate whether it lives in the repo or on the local dev system

### Immediate next resume step

1. User provides the sidechat file path, component name, or screenshot
2. Fix the high-priority sidechat list markup issues
3. Include the already-finished `Entry By: FlockTrax` change in the same web-admin build
4. Deploy web-admin once, after those fixes are bundled

## Resume prompt

Resume from `C:\dev\FlockTrax\output\FlockTrax_Derived_Placement_Alerts_Checkpoint_2026-05-13.md`.

Current backend work is complete and live:

- derived placement alerts are data-driven
- duplicate auto-items were deduped and guarded
- alert thresholds are controlled by `mortality_autowarn`, `7day_warning`, and `hatchery_issue_level`
- edge functions are already deployed

Remaining work is frontend/web-admin only:

- `Entry By: FlockTrax` is already coded locally in `web-admin/app/admin/issues/page.tsx`
- do not deploy web-admin yet until the user’s high-priority sidechat list markup fixes are also completed
- first locate the sidechat file/component the user mentioned, then bundle those fixes into the same build
