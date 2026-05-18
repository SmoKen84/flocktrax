# FlockTrax Master Checkpoint

Date: `2026-05-16 12:06 PM America/Chicago`

Purpose:
- full resume checkpoint before clearing chat
- captures what is live, what was changed today, current release/version conventions, and the most important next steps

## Current Live State

Production web admin:
- URL: [https://flocktrax.com](https://flocktrax.com)
- latest deployment id: `dpl_9NersGo2wbLnRNnWV1mXRYTLQxqp`
- inspector: [https://vercel.com/flock-trax/web-admin/9NersGo2wbLnRNnWV1mXRYTLQxqp](https://vercel.com/flock-trax/web-admin/9NersGo2wbLnRNnWV1mXRYTLQxqp)

Current live Admin published version display:
- `FlockTrax-Admin`
- version: `2.0.0`
- base build: `4`
- build label: `4.1`
- rationale: local/uncommitted production publish under the new decimal build-label convention

Current hosted mobile published version rows:
- `mobile_ios` -> version `1.0.2`, build `13`
- `mobile_droid` -> version `1.0.2`, build `7`

Supabase project:
- ref: `frneaccbbrijpolcesjm`

## What Was Completed

### 1. Derived placement alerts and Action Items

Implemented data-driven placement alerts using the existing issues plumbing so active flocks surface as danger tiles without manual issue entry.

Derived issue types:
- `Severe Early Mortality`
- `Hatchery Quality Incident`

Settings-driven behavior now uses:
- `mortality_autowarn`
- `7day_warning`
- `hatchery_issue_level`

Backend/function wiring already deployed earlier:
- `dashboard-placements-list`
- `placement-day-get`
- `placement-day-submit`

Important SQL already run successfully by user:
- [20260513110000_add_derived_placement_alerts.sql](C:/dev/FlockTrax/supabase/migrations/20260513110000_add_derived_placement_alerts.sql:1)
- [20260513124500_dedupe_derived_placement_issues.sql](C:/dev/FlockTrax/supabase/migrations/20260513124500_dedupe_derived_placement_issues.sql:1)
- [20260513133000_configurable_derived_placement_alerts.sql](C:/dev/FlockTrax/supabase/migrations/20260513133000_configurable_derived_placement_alerts.sql:1)

### 2. Auto-derived issue duplicate/reopen bug fixed

Problem:
- resolving an auto-derived placement issue could cause it to reopen immediately as a new open issue

Root cause:
- `sync_derived_placement_issues(...)` only guarded against existing open derived issues
- a manually resolved derived issue therefore looked eligible for reinsertion on the next sync

Fix:
- SQL patch added and run successfully:
  - [20260516094500_prevent_manual_reopen_of_derived_issues.sql](C:/dev/FlockTrax/supabase/migrations/20260516094500_prevent_manual_reopen_of_derived_issues.sql:1)
- behavior now honors manual resolution of auto-derived placement issues

Live verification completed after patch:
- flock `300` -> placement `69508b1b-79b5-462b-9dd8-6812ae197c4d` -> barn `S2`
- flock `296` -> placement `521809aa-99d1-4a1e-af11-9060beb19c3d` -> barn `W6`
- confirmed there were `0` open placement issues for either after forced re-sync
- forced live RPC call to `sync_derived_placement_issues(...)` did not recreate open issues

### 3. Old resolved duplicate issue history cleaned up

Problem:
- even after the reopen bug was fixed, old resolved duplicates remained in issue history and would be confusing to explain

What was done:
- created reusable cleanup migration:
  - [20260516113000_cleanup_resolved_derived_issue_history.sql](C:/dev/FlockTrax/supabase/migrations/20260516113000_cleanup_resolved_derived_issue_history.sql:1)
- also directly cleaned production history for flocks `300` and `296` using the service-role REST path

Result:
- only one canonical resolved record remains per derived issue type for each of those two placements
- no open issue remains on either placement

### 4. Dashboard placement-editor modal added and deployed

Live dashboard tiles can now open a placement editor popup/modal.

Behavior:
- tile click opens placement editor modal
- permission-based locking is enforced
- if the user lacks view access, the modal informs them
- `Placed Date` stays locked
- modal includes lifecycle/state projection

Key UX additions:
- read-only lifecycle summary
- system flag projection for lifecycle context
- clearer explanation for `Active / Awaiting Arrival`

Important notes:
- this was deployed to production previously
- super-admin access bug in the popup was fixed so super-admin correctly gets access

### 5. User Access improvements

Live on production:
- newly created farm groups like `Joyce` now show in User Access assignment options
- `Resend Setup Link` added for invite-pending users
- hard-delete flow was replaced with safer retire/deactivate behavior rather than destructive deletion
- clearer activity/status information is shown for users

Design direction agreed:
- admin-side cleanup should preserve UUID continuity for audit references
- “delete account” and “retire/disable user” should be treated differently conceptually

### 6. Feed-ticket and placement-form improvements

Live/admin updates already deployed:
- `Source / Feed Mill` filter work was adjusted
- feed-bin ordering now uses `barn.sort_code`
- placement editor layout improvements for starting male/female counts were made
- sidebar logo size/position was restored and improved
- admin shell fonts/visual refinements were deployed

### 7. Admin About page and version display

Live on production:
- bottom sidebar section renamed from `Archives` to `Utilities`
- `About` page added under Utilities
- `Current Published Versions` block added for:
  - `FlockTrax-Admin`
  - `FlockTrax-Mobile iOS`
  - `FlockTrax-Mobile Android`

Version table changes already completed:
- `platform.control.version` changed from numeric to text
- admin/mobiles can now store real semantic versions like `1.0.2`

SQL already run successfully by user:
- [20260515113000_platform_control_version_to_text.sql](C:/dev/FlockTrax/supabase/migrations/20260515113000_platform_control_version_to_text.sql:1)
- [20260515114500_bump_mobile_release_1_0_2_text_versions.sql](C:/dev/FlockTrax/supabase/migrations/20260515114500_bump_mobile_release_1_0_2_text_versions.sql:1)
- [20260516093000_align_admin_platform_version_text.sql](C:/dev/FlockTrax/supabase/migrations/20260516093000_align_admin_platform_version_text.sql:1)
- [20260516095500_add_platform_control_build_label.sql](C:/dev/FlockTrax/supabase/migrations/20260516095500_add_platform_control_build_label.sql:1)

### 8. Admin build-label convention implemented

Agreed release convention:
- repo-backed admin release: integer base build, like `4`
- local/uncommitted production publish: same base build with decimal display label, like `4.1`

Implementation:
- keep numeric `build`
- add text `build_label`
- UI prefers `build_label` when present

Current live admin row:
- version `2.0.0`
- build `4`
- build_label `4.1`
- released `2026-05-16`

### 9. Dashboard pill time-zone bug fixed

Problem:
- admin dashboard status pill badges were effectively using UTC/GMT behavior for the “Done hh:mm” completion label and daily cutoff logic

Fix applied and deployed today:
- `web-admin/lib/admin-data.ts` now uses `America/Chicago` consistently for:
  - the dashboard `today` key
  - the completion badge time formatting

Validation:
- `npm run typecheck` passed
- `npm run build` passed
- deployed live in `dpl_9NersGo2wbLnRNnWV1mXRYTLQxqp`

## Mobile/App Release State

iOS:
- version `1.0.2`
- build `13`
- submitted for App Store review

Android:
- EAS Android store build completed successfully
- build id: `b756d556-4672-4b7a-beac-97c780c9f72e`
- version `1.0.2`
- versionCode `7`
- AAB artifact existed and Play setup/testing was started manually by user

Important production incident:
- “JWT expired” save failure found during Android testing
- actual root cause was shared mobile/backend permission behavior, not true JWT expiry
- temporary field workaround: user given `TECH` role
- live backend hotfix deployed to `placement-day-submit`
- local mobile client also patched so future builds stop misreporting `403` permission errors as expired JWT/session

Checkpoint for that incident:
- [FlockTrax_Production_Incident_Checkpoint_2026-05-15_JWT_Mortality_Save.md](C:/dev/FlockTrax/output/FlockTrax_Production_Incident_Checkpoint_2026-05-15_JWT_Mortality_Save.md:1)

## Lifecycle / Product Direction Agreed

The flock-placement lifecycle needs a fuller operational state model rather than just raw booleans.

Agreed direction:
- `scheduled`
- `awaiting_arrival`
- `in_barn_growing`
- `waiting_closeout`
- `closeout_submitted`
- `archived`

Product boundary agreed:
- live dashboard owns pre-harvest / in-production stages
- a future `Flock Closeout` workspace owns post-checkout operational stages
- archive owns historical records

Blueprint saved at:
- [FlockTrax_Flock_Lifecycle_And_Closeout_Spec_2026-05-14.md](C:/dev/FlockTrax/output/FlockTrax_Flock_Lifecycle_And_Closeout_Spec_2026-05-14.md:1)

## Important Local Code State

There are many local uncommitted changes in the workspace right now. That is expected and includes both already-deployed work and local-only next-build mobile work.

Notable local-only items still important:
- mobile version display plumbing on dashboard
- removal of stale hardcoded mobile login footer release text
- client-side improvement to stop showing permission `403` as fake JWT/session expiry

Key local mobile files:
- [http.ts](C:/dev/FlockTrax/mobile/src/api/http.ts:1)
- [DashboardScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/DashboardScreen.tsx:1)
- [LoginScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/LoginScreen.tsx:1)

Backend side for mobile version display:
- `dashboard-placements-list` was updated and deployed already so the API can return platform release info

Meaning:
- released mobile binaries do not yet show the new published-version line
- the next mobile build should pick that up

## Recommended Next Steps

When resuming work, best next actions are:

1. Confirm the dashboard pill badge times on `flocktrax.com` now read correctly in US Central time after a hard refresh.
2. Continue Play Store / App Store follow-through as needed while `1.0.2` is in review/testing.
3. Roll the next mobile build when ready so it includes:
   - accurate in-app version display
   - clearer `403` vs expired-session handling
4. Decide whether to run the resolved-history cleanup migration more broadly across the whole issues table, not just the two known flocks already cleaned.
5. Continue the flock lifecycle / closeout design into schema and UI planning for `waiting_closeout` and `livehaul_loads`.

## Resume Prompt

Use this to restart quickly in a fresh chat:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Master_Checkpoint_2026-05-16_PM.md first. The live admin site is flocktrax.com on deployment dpl_9NersGo2wbLnRNnWV1mXRYTLQxqp with Admin version 2.0.0 build 4.1. Derived placement alerts are live, the manual-resolve no-reopen bug is fixed, flocks 300 and 296 were cleaned and verified, and the dashboard Central-time badge fix is deployed. Next likely work is mobile 1.0.3 prep, broader issue-history cleanup, or flock closeout lifecycle design.`
