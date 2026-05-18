# FlockTrax Project-Wide Detailed Checkpoint

Date: `2026-05-18 09:17 AM America/Chicago`

Purpose:
- crash-safe full-project checkpoint before possible hard reboot
- capture what is live, what is only local, and the exact current dirty-worktree state
- provide a practical resume note that can be loaded first in a fresh Codex session

## Current Repo Baseline

Repository:
- `C:\dev\FlockTrax`

Git branch:
- `main`

Current HEAD:
- `d68dbbd249ba513615f1f53923688e6c31ecf998`

Working tree:
- dirty
- many tracked modifications and untracked files are present
- no commit was created for this checkpoint

## Current Live Production State

Primary admin URL:
- [https://flocktrax.com](https://flocktrax.com)

Latest known production web-admin deployment:
- deployment id: `dpl_9Dr9gApBKW3JnxK2Rn4DDhuoTwk9`
- inspector: [https://vercel.com/flock-trax/web-admin/9Dr9gApBKW3JnxK2Rn4DDhuoTwk9](https://vercel.com/flock-trax/web-admin/9Dr9gApBKW3JnxK2Rn4DDhuoTwk9)
- deployment URL: [https://web-admin-dybx885h8-flock-trax.vercel.app](https://web-admin-dybx885h8-flock-trax.vercel.app)
- aliased live to: [https://flocktrax.com](https://flocktrax.com)

Current known published version state from earlier checkpoints:
- admin published version: `2.0.0`
- admin build: `4`
- admin build label: `4.1`
- mobile iOS published version: `1.0.2 (13)`
- mobile Android published version: `1.0.2 (7)`

## Most Recent Completed Work

### 1. Web-admin UI polish is live

Live on production:
- placement tiles can now show separate upper-right indicators for:
  - `Done hh:mm`
  - `# Open Issues`
- Action Items console selected-row highlight is cyan for consistency
- placement wizard Barn View shows `LH` on scheduled live-haul dates
- `LH` marker was moved one line lower so it does not share the date-number row

Checkpoint:
- [FlockTrax_Web_Admin_UI_Polish_Checkpoint_2026-05-18.md](C:/dev/FlockTrax/output/FlockTrax_Web_Admin_UI_Polish_Checkpoint_2026-05-18.md)

### 2. Flock history report is now live

Feature summary:
- browser print / Save as PDF report for full flock history
- route: `/admin/flocks/[flockId]/report`
- Page 1: `log_daily` matrix
- Page 2: `log_mortality` matrix
- landscape print layout

Launch points now present:
- flock detail page
- main dashboard placement editor popup
- placement wizard editor panels

Lifecycle rule:
- launch buttons show only for placements that are in-barn or later
- future scheduled placements do not show the report button

Title/settings behavior:
- report title is now a two-line heading such as:
  - `Flock 293-S1`
  - `Historical Summary`
- title/subtitle text comes from `public.app_settings` entries:
  - `flock_history_title`
  - `flock_history_pg1`
  - `flock_history_pg2`
  - `flock_history_pg3`

Recent report refinements already included:
- removed obsolete daily boolean fields formerly used for dashboard alerts
- removed `Active` columns
- mortality page uses grouped `Dead` and `Cull` headers with `Roo / Hen`
- mortality page has rollups for final population, final mortality %, and final live %
- page 1 summary labels now read `Females Placed` and `Males Placed`

Checkpoint:
- [FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md](C:/dev/FlockTrax/output/FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md)

### 3. Earlier May platform/backend/mobile work still matters

Previously completed and important:
- derived placement alerts using Action Items/issues plumbing
- manual-resolve no-reopen fix for derived issues
- cleanup of older duplicate resolved issue history
- dashboard placement editor modal with access control
- user access improvements
- admin About page and version display
- admin build-label convention
- dashboard Central Time badge fix
- mobile-side `403` vs expired-session clarification work remains local for next build prep

Broader baseline checkpoint:
- [FlockTrax_Master_Checkpoint_2026-05-16_PM.md](C:/dev/FlockTrax/output/FlockTrax_Master_Checkpoint_2026-05-16_PM.md)

## Current Local Code State

### Web-admin

Local tracked modifications exist in:
- `web-admin/app/admin/feed-tickets/feed-ticket-console.tsx`
- `web-admin/app/admin/flocks/[flockId]/page.tsx`
- `web-admin/app/admin/issues/actions.ts`
- `web-admin/app/admin/issues/page.tsx`
- `web-admin/app/admin/overview/actions.ts`
- `web-admin/app/admin/overview/page.tsx`
- `web-admin/app/admin/placements/new/page.tsx`
- `web-admin/app/admin/user-access/actions.ts`
- `web-admin/app/admin/user-access/page.tsx`
- `web-admin/app/api/admin-overview-dashboard/route.ts`
- `web-admin/app/globals.css`
- `web-admin/app/layout.tsx`
- `web-admin/app/page.tsx`
- `web-admin/components/active-placement-dashboard.tsx`
- `web-admin/components/admin-shell.tsx`
- `web-admin/components/live-dashboard-panel.tsx`
- `web-admin/lib/access-control.ts`
- `web-admin/lib/admin-data.ts`
- `web-admin/lib/feed-ticket-data.ts`
- `web-admin/lib/placement-scheduler-data.ts`
- `web-admin/lib/platform-content.ts`
- `web-admin/lib/types.ts`

Local untracked web-admin items include:
- `web-admin/app/admin/about/`
- `web-admin/app/admin/flocks/[flockId]/report/`
- `web-admin/app/admin/flocks/flock-history-report-actions.tsx`
- `web-admin/docs/`
- `web-admin/lib/flock-history-report.ts`
- `web-admin/lib/placement-editor-access.ts`
- `web-admin/screens/296-W6_7Day.png`
- `web-admin/screens/compare.png`
- `web-admin/screens/compareB.png`

Notes:
- some of these files are already reflected in production deployments
- others remain local because the repo has not been committed even though production deploys were made

### Mobile

Tracked mobile modifications:
- `mobile/src/api/http.ts`
- `mobile/src/screens/DashboardScreen.tsx`
- `mobile/src/screens/LoginScreen.tsx`
- `mobile/src/types.ts`

Meaning of the local mobile work from prior checkpoints:
- mobile dashboard version display plumbing
- removal of stale hardcoded footer release text on login
- better handling so `403` permission errors are not presented as false expired-session/JWT failures

Untracked mobile support/build artifacts:
- `mobile/ReleaseSupport/AppScreens/ActionItems.png`
- `mobile/ReleaseSupport/AppScreens/Victor.jpg`
- `mobile/ReleaseSupport/AppScreens/Victor512x512.jpg`
- `mobile/ReleaseSupport/FlockClosoutSpec.pdf`
- `mobile/ReleaseSupport/titlesplash.png`
- `mobile/ReleaseSupport/titlesplash2.png`
- `mobile/dist-ios-releasecheck/`
- `mobile/dist-store-releasecheck/`

### Supabase

Tracked function/shared changes:
- `supabase/.temp/cli-latest`
- `supabase/functions/_shared/issues.ts`
- `supabase/functions/dashboard-placements-list/index.ts`
- `supabase/functions/feed-ticket-get/index.ts`
- `supabase/functions/placement-day-get/index.ts`
- `supabase/functions/placement-day-submit/index.ts`

Untracked migration files:
- `supabase/migrations/20260513110000_add_derived_placement_alerts.sql`
- `supabase/migrations/20260513124500_dedupe_derived_placement_issues.sql`
- `supabase/migrations/20260513133000_configurable_derived_placement_alerts.sql`
- `supabase/migrations/20260515113000_platform_control_version_to_text.sql`
- `supabase/migrations/20260515114500_bump_mobile_release_1_0_2_text_versions.sql`
- `supabase/migrations/20260516093000_align_admin_platform_version_text.sql`
- `supabase/migrations/20260516094500_prevent_manual_reopen_of_derived_issues.sql`
- `supabase/migrations/20260516095500_add_platform_control_build_label.sql`
- `supabase/migrations/20260516113000_cleanup_resolved_derived_issue_history.sql`

Important note:
- several of these SQL files reflect changes already run successfully in the live database even though the files are still untracked locally

### Toolkit / Scripts / Misc

Untracked misc items:
- `alphaBU.bat`
- `backups/`
- `deploy-placement-alert-functions.bat`
- `toolkit/sync_engine/__pycache__/`
- `toolkit/sync_engine/flocktrax-sync.ini`

### Output / Documentation

Tracked output file:
- `output/FlockTrax_Checkpoint_Index.md`

Untracked checkpoint/docs files currently present:
- `output/FlockTrax_Dashboard_Placement_Editor_Checkpoint_2026-05-14.md`
- `output/FlockTrax_Derived_Placement_Alerts_Checkpoint_2026-05-13.md`
- `output/FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md`
- `output/FlockTrax_Flock_Lifecycle_And_Closeout_Spec_2026-05-14.md`
- `output/FlockTrax_Master_Checkpoint_2026-05-16_PM.md`
- `output/FlockTrax_Mobile_Version_Display_And_Next_Build_Prep_2026-05-15.md`
- `output/FlockTrax_Production_Checkpoint_2026-05-14_Evening.md`
- `output/FlockTrax_Production_Incident_Checkpoint_2026-05-15_JWT_Mortality_Save.md`
- `output/FlockTrax_Release_Build13_Checkpoint_2026-05-11_PM.md`
- `output/FlockTrax_Testing_Issue_List_2026-05-12.md`
- `output/FlockTrax_User_Access_And_Mobile_Stability_Checkpoint_2026-05-15.md`
- `output/FlockTrax_Web_Admin_And_Derived_Alerts_Checkpoint_2026-05-13_PM.md`
- `output/FlockTrax_Web_Admin_UI_Polish_Checkpoint_2026-05-18.md`

## Exact Git Status Snapshot

This is the exact `git status --short` snapshot taken for this checkpoint:

```text
 M mobile/src/api/http.ts
 M mobile/src/screens/DashboardScreen.tsx
 M mobile/src/screens/LoginScreen.tsx
 M mobile/src/types.ts
 M output/FlockTrax_Checkpoint_Index.md
 M supabase/.temp/cli-latest
 M supabase/functions/_shared/issues.ts
 M supabase/functions/dashboard-placements-list/index.ts
 M supabase/functions/feed-ticket-get/index.ts
 M supabase/functions/placement-day-get/index.ts
 M supabase/functions/placement-day-submit/index.ts
 M web-admin/app/admin/feed-tickets/feed-ticket-console.tsx
 M web-admin/app/admin/flocks/[flockId]/page.tsx
 M web-admin/app/admin/issues/actions.ts
 M web-admin/app/admin/issues/page.tsx
 M web-admin/app/admin/overview/actions.ts
 M web-admin/app/admin/overview/page.tsx
 M web-admin/app/admin/placements/new/page.tsx
 M web-admin/app/admin/user-access/actions.ts
 M web-admin/app/admin/user-access/page.tsx
 M web-admin/app/api/admin-overview-dashboard/route.ts
 M web-admin/app/globals.css
 M web-admin/app/layout.tsx
 M web-admin/app/page.tsx
 M web-admin/components/active-placement-dashboard.tsx
 M web-admin/components/admin-shell.tsx
 M web-admin/components/live-dashboard-panel.tsx
 M web-admin/lib/access-control.ts
 M web-admin/lib/admin-data.ts
 M web-admin/lib/feed-ticket-data.ts
 M web-admin/lib/placement-scheduler-data.ts
 M web-admin/lib/platform-content.ts
 M web-admin/lib/types.ts
?? alphaBU.bat
?? backups/
?? deploy-placement-alert-functions.bat
?? mobile/ReleaseSupport/AppScreens/ActionItems.png
?? mobile/ReleaseSupport/AppScreens/Victor.jpg
?? mobile/ReleaseSupport/AppScreens/Victor512x512.jpg
?? mobile/ReleaseSupport/FlockClosoutSpec.pdf
?? mobile/ReleaseSupport/titlesplash.png
?? mobile/ReleaseSupport/titlesplash2.png
?? mobile/dist-ios-releasecheck/
?? mobile/dist-store-releasecheck/
?? output/FlockTrax_Dashboard_Placement_Editor_Checkpoint_2026-05-14.md
?? output/FlockTrax_Derived_Placement_Alerts_Checkpoint_2026-05-13.md
?? output/FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md
?? output/FlockTrax_Flock_Lifecycle_And_Closeout_Spec_2026-05-14.md
?? output/FlockTrax_Master_Checkpoint_2026-05-16_PM.md
?? output/FlockTrax_Mobile_Version_Display_And_Next_Build_Prep_2026-05-15.md
?? output/FlockTrax_Production_Checkpoint_2026-05-14_Evening.md
?? output/FlockTrax_Production_Incident_Checkpoint_2026-05-15_JWT_Mortality_Save.md
?? output/FlockTrax_Release_Build13_Checkpoint_2026-05-11_PM.md
?? output/FlockTrax_Testing_Issue_List_2026-05-12.md
?? output/FlockTrax_User_Access_And_Mobile_Stability_Checkpoint_2026-05-15.md
?? output/FlockTrax_Web_Admin_And_Derived_Alerts_Checkpoint_2026-05-13_PM.md
?? output/FlockTrax_Web_Admin_UI_Polish_Checkpoint_2026-05-18.md
?? supabase/migrations/20260513110000_add_derived_placement_alerts.sql
?? supabase/migrations/20260513124500_dedupe_derived_placement_issues.sql
?? supabase/migrations/20260513133000_configurable_derived_placement_alerts.sql
?? supabase/migrations/20260515113000_platform_control_version_to_text.sql
?? supabase/migrations/20260515114500_bump_mobile_release_1_0_2_text_versions.sql
?? supabase/migrations/20260516093000_align_admin_platform_version_text.sql
?? supabase/migrations/20260516094500_prevent_manual_reopen_of_derived_issues.sql
?? supabase/migrations/20260516095500_add_platform_control_build_label.sql
?? supabase/migrations/20260516113000_cleanup_resolved_derived_issue_history.sql
?? toolkit/sync_engine/__pycache__/
?? toolkit/sync_engine/flocktrax-sync.ini
?? web-admin/app/admin/about/
?? web-admin/app/admin/flocks/[flockId]/report/
?? web-admin/app/admin/flocks/flock-history-report-actions.tsx
?? web-admin/docs/
?? web-admin/lib/flock-history-report.ts
?? web-admin/lib/placement-editor-access.ts
?? web-admin/screens/296-W6_7Day.png
?? web-admin/screens/compare.png
?? web-admin/screens/compareB.png
```

## Suggested First Files To Load After Reboot

If recovering in a fresh chat, load these in this order:

1. [FlockTrax_Project_Wide_Detailed_Checkpoint_2026-05-18.md](C:/dev/FlockTrax/output/FlockTrax_Project_Wide_Detailed_Checkpoint_2026-05-18.md)
2. [FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md](C:/dev/FlockTrax/output/FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md)
3. [FlockTrax_Master_Checkpoint_2026-05-16_PM.md](C:/dev/FlockTrax/output/FlockTrax_Master_Checkpoint_2026-05-16_PM.md)

## Resume Prompt

Use this in the next Codex chat:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Project_Wide_Detailed_Checkpoint_2026-05-18.md first. The repo is on branch main at HEAD d68dbbd249ba513615f1f53923688e6c31ecf998 with a very dirty worktree. The latest live deployment is dpl_9Dr9gApBKW3JnxK2Rn4DDhuoTwk9 on flocktrax.com, the flock history report is live, and local uncommitted work still includes mobile 403/session handling plus many repo files and untracked migrations/checkpoints that must not be lost or blindly reverted.` 
