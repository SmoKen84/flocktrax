# FlockTrax Proto-Features Document

**Snapshot date:** 2026-07-12  
**Purpose:** living product-development, recovery, release, and roadmap baseline  
**Workspace:** `C:\dev\FlockTrax`  
**Primary evidence index:** [FlockTrax_Checkpoint_Index.md](C:/dev/FlockTrax/output/FlockTrax_Checkpoint_Index.md)

## Executive overview

FlockTrax is now a working poultry-operations platform with three clear layers:

- a worker-focused Expo mobile app for barn care, daily records, weights, feed tickets, and the new Work Orders workspace;
- a Next.js web-admin console for operational oversight, configuration, scheduling, feed management, Action Items, livehaul, closeout, archives, reporting, access, and synchronization;
- a Supabase operational core containing the database, storage, RPCs, scheduled jobs, and Edge Functions used by both clients and external integrations.

The production web-admin surface is materially mature. The explicitly released baseline includes farm structure, the live dashboard, placement lifecycle, livehaul, closeout, log-matrix correction, feed tickets and reports, Action Items and work-order printing, Google Sheets synchronization, BinSentry inventory/density tooling, and feed-projection safeguards. The newest production web fixes were deployed on July 10 for Action List update nesting and authoritative placement-state synchronization.

The immediate product boundary is mobile `1.0.4`. iOS build `1.0.4 (15)` and Android build `1.0.4 (9)` are complete. The iOS build was submitted for TestFlight processing; the Android AAB is complete but has not been uploaded to Google Play because the service-account credential path is still blocked. The new Work Orders experience has passed typecheck and bundle/build checks but has not passed a signed-in farm-worker field test. It is therefore staged, not public-release ready.

Two and only two mobile feature areas are agreed after Work Orders testing:

1. read-only upcoming Placements and Livehaul calendars;
2. a read-only closed-flock performance summary showing final production outcomes.

After those, the agreed path is polish, regression testing, and release. Saved feed-projection lifecycles, truck-load construction, mobile archive capture, richer parent Action Item statuses, and multi-tenant BinSentry credentialing are not part of this mobile release.

The largest operational risk is release provenance. `origin/main` is behind both local commits and the deployed systems, while the local working tree contains another substantial uncommitted product batch. A clean rebuild from GitHub would not reproduce the current production-plus-TestFlight state. Field testing, function verification, and a complete commit/push checkpoint must happen before new feature development.

## Evidence method and status vocabulary

This document applies the following evidence order:

1. a newer explicit checkpoint decision or deployment record;
2. current source or migration evidence when needed to establish whether the feature still exists;
3. an older checkpoint only where it has not been superseded.

All 96 unique Markdown files directly linked by the checkpoint index were processed. They comprise 18,038 lines and 640,952 bytes. No index-linked Markdown file is missing. The index is a navigation aid, not a reliable current-state summary: its chronological section is out of month order, and its `Latest Checkpoint` recommendations stop before the July work.

Statuses used below:

| Status | Meaning in this document |
|---|---|
| **Production/live** | Explicit evidence says the database, function, or web/mobile release was live and usable. |
| **Deployed but staged/testing** | A build or deployment exists, but field acceptance or public release is intentionally incomplete. |
| **Implemented locally, not released** | Current source contains the feature, but no reliable deployment evidence exists. |
| **Partially implemented** | Some required layers or workflow steps exist, but the feature is not end-to-end complete or its release boundary is unresolved. |
| **Planned/agreed** | Product behavior is agreed but no implementation was found. |
| **Deferred** | Deliberately outside the active release sequence. |
| **Obsolete/superseded** | Replaced by a newer model, decision, name, or implementation; not an active commitment. |

## Product-area map

| Product area | Primary users and purpose | Current boundary |
|---|---|---|
| Mobile Barn Care | Farm workers record daily conditions, mortality, grading, weights, feed, and placement concerns. | Core workflow is live; current humidity and several later fixes are in staged `1.0.4`. |
| Mobile Work Orders | Farm workers see, update, and resolve farm-scoped maintenance and placement work. | **Deployed but staged/testing** in `1.0.4`; field acceptance is still required. |
| Web live operations | Managers monitor barns, flock state, daily completion, mortality, weights, feed, and Action Items. | **Production/live**. |
| Scheduling and lifecycle | Managers create placements, promote arrivals, schedule livehaul, capture loads, close out, settle, and archive flocks. | Core is **production/live**; split-sex dates and reusable juggle workflow need explicit production acceptance. |
| Feed operations | Managers enter/audit tickets, redirect or queue drops, reconcile orders, inspect bins, and project demand. | Core is **production/live**; several refinements remain staged or locally uncommitted. |
| Reporting and archive | Managers print feed, history, Action Item, closeout, calendar, and archive packets and preserve audit originals. | Established reports are live; document-archive and new calendar-report release status need confirmation. |
| Google Sheets synchronization | Operations keeps integrator workbooks and FlockTrax records aligned through an outbox, hosted worker, readback, and backfill tooling. | **Production/live**, with operational caveats. |
| BinSentry integration | Managers use live bin quantity and density to improve inventory and ordering decisions. | **Production/live** under a shared server credential model. |
| Security and access | Admins control roles, memberships, invitations, retirement, and farm-scoped access. | Core is **production/live**; role-catalog maintenance and endpoint hardening are partial. |
| Release operations | Maintainers build/deploy web, functions, database changes, iOS, and Android. | Operational, but current provenance is **partially controlled** because deployed state is ahead of GitHub. |

## Status register

### Production/live

- Web authentication, admin shell, platform-driven branding/version text, About, settings entry, and session protection.
- Farm Group → Farm → Barn structure management, breed lookup, feed-bin management, and live dashboard.
- Placement scheduling, operational lifecycle RPCs, dashboard state presentation, and the July 10 editor synchronization fix.
- Livehaul schedule/load model, target-sex handling, closeout queue, worksheet milestones, reports, and archive-summary packet.
- Admin Action Items console, issue types and update threads, filtered Action List, individual work order, and July 10 nested update printing.
- Feed ticket console/editor, `Reg`/`xTran`/`iTran`/`f2f`, historical assignment safeguards, off-farm redirects, ticket reports, and the core queued-drop editor/backend path.
- Placement log matrix editor and log-weight/breed-spec report.
- Established flock history, feed, Action Item, closeout, mortality, and feed-projection reporting.
- Google Sheets outbox, hosted batch worker, read-before-edit, admin queue controls, and reusable historical backfill tooling.
- BinSentry mapping, inventory synchronization, hourly business-window cron, density audit/push-back, and report density preflight.
- Feed inventory snapshots, order commitments, typed bin layers, and starter/grower obligation model.

### Deployed but staged/testing

- Mobile `1.0.4` Work Orders, Action Item history/update/resolve flow, relative-humidity persistence, and the associated iOS/Android binaries.
- Hosted `action-items-list` function; deployed and unauthenticated access was correctly rejected, but no signed-in farm-scoped response has been field-tested from the built app.
- New web calendar reports and some June/July document/archive/report work were present in the workspace used for later whole-workspace Vercel deployments, but no checkpoint records a focused authenticated production acceptance. Treat them as staged until verified.

### Implemented locally, not released

- Current uncommitted feed recommendation correction that lets excess starter supply satisfy later grower demand before recommending more grower.
- Current uncommitted BinSentry delivered/closed-order feed-type inference used ahead of local type/name fallback.
- Any current revisions to `issue-create`, `issue-resolve`, and the new `issue-update` function that are not confirmed in the hosted function dashboard.

### Partially implemented

- Document archive: private Storage and metadata foundation plus feed/hatch/livehaul/summary/misc UI exist and were proven against hosted data from localhost; explicit production UI acceptance is missing.
- Feed-drop reconciliation: schema, hosted functions, and editor are live; the queued-ticket discovery filter was explicitly held for real operational shakeout, and later deployment inclusion is uncertain.
- Cancel-and-juggle: current source includes a guarded UI and server action, but the reusable workflow does not have a recorded production field acceptance after the direct `310-W5 → 311-W5` repair.
- Split male/female placement dates: current migration and scheduler UI exist; hosted migration/application status is not recorded.
- Feed order receipt reconciliation and bin layer inference: implemented and later feed functions were deployed, but a complete set of real receipt-match cases was not recorded as accepted.
- User Access: live role and membership assignment exists; role/permission catalog rows are still presented read-only in the maintenance section.
- Automated quality: builds and typechecks are used, but no unit, integration, or end-to-end test suite was found.

### Planned/agreed

- Read-only mobile Placements calendar.
- Read-only mobile Livehaul calendar.
- Read-only mobile closed-flock performance summary.

### Deferred

- Saved `feed_projections` / `feed_projection_days`, forecast evaluation history, seasonal learning, and correction factors.
- Truck-load builder and practical load-shaping rules.
- Mobile camera capture as an archive-ingest path.
- Separate BinSentry credentials and tenant isolation per farm group.
- Further mobile scope expansion before the `1.0.4` feature boundary is shipped.

### Obsolete/superseded

- Adalo-first mobile architecture and Adalo External Collections as the primary client path.
- `Issues` and `Open Items` as the current product name; admin uses `Action Items`, mobile facilities mode uses `Work Orders`.
- Daily maintenance/feedline/nipple boolean flags as the active work-management model; Action Items replaced them in current workflows.
- Fixed `lh1/lh2/lh3` fields as the future livehaul model; `livehaul_schedule` and `livehaul_loads` are authoritative, while old fields remain only as compatibility/fallback paths.
- The single-date admin log editor; it was backed out and replaced by the placement log matrix.
- The 12,000-lb incoming starter shortcut and age-14 starter cutoff; both were explicitly removed from projection logic.
- Automatic printing on archive-summary page load; current behavior requires an explicit print action.
- Admin hard-delete as the normal user-removal workflow; User Access now retires users and preserves audit identity. Mobile self-service account deletion remains a separate permanent-delete requirement.

## Current release boundary

### Repository and recovery boundary

As inspected on 2026-07-12:

- branch: `main`
- local HEAD: `7932dc6` (`Add BinSentry density tools and report preflight`)
- `origin/main`: `6dd99d5` (`Fix closeout archive resilience and refine feed projection rules`)
- local branch: two commits ahead of GitHub
- committed but not pushed: `35aae38` and `7932dc6`
- pre-document working tree: 21 modified tracked files and four untracked product/checkpoint paths

The two local commits contain thousands of lines across reports, document archive, feed queueing, scheduler changes, closeout, feed projections, and BinSentry. The uncommitted batch contains mobile Work Orders, mobile `1.0.4` metadata, Action Item functions, report fixes, placement state synchronization, and additional feed/BinSentry corrections. Do not reset, clean, or reconstruct from `origin/main`.

### Web-admin production boundary

Last explicitly confirmed release marker:

- Admin `5.6`, commit `05d982b`, deployed 2026-06-12.

Later explicit production deployments did not bump that marker:

- July 8: BinSentry density tools and feed-projection preflight were deployed.
- July 10: Action List nested updates/cache revalidation deployed as `dpl_7gc5DctYFdmQMhrwZ7S85zQ2NQcF`.
- July 10: placement lifecycle/operational-state synchronization deployed as `dpl_5SKkLa7P5vNxoCuaArvKC2SBxhqL`.

Therefore, the live web application is newer than the `5.6` label and newer than `origin/main`. Later Vercel deployments were made from the linked local workspace, which also contained unrelated in-flight work. An authenticated production route audit is required to state exactly which June/July routes are exposed.

### Supabase boundary

Explicitly deployed in the most recent evidence:

- queue-aware `feed-ticket-get` and `feed-ticket-submit`;
- `binsentry-sync-all` with feed-name fallback and density-support changes;
- `action-items-list` with function-level bearer authentication and farm/farm-group scoping.

Deployment is not explicitly recorded for the new untracked `issue-update` function or for the current revisions of `issue-create` and `issue-resolve`. Because the staged mobile app calls all three mutation endpoints, hosted-function verification is a release gate.

Migration history is not a perfect deployment ledger. Several checkpoints record SQL being run directly followed by migration-repair failures or later manual reconciliation. Local migration presence proves intended schema, not remote history consistency.

### Mobile storefront boundary

| Platform | Current staged build | Distribution state | Public-state evidence |
|---|---|---|---|
| iOS | `1.0.4 (15)`, EAS build `1c4fe17e-3e83-4fbb-b69f-ea4f8fbf7e06` | Finished; EAS submission scheduled for TestFlight/App Store Connect processing. Not approved for public release. | The latest indexed checkpoint that explicitly says “live on the App Store” is `1.0.1 (10)` on May 6. Later `1.0.2` and `1.0.3` submissions lack an indexed public-approval confirmation. |
| Android | `1.0.4 (9)`, EAS build `ab3f271d-d5b3-4967-9825-b3cecb423871` | Finished AAB; not uploaded to Play. EAS lacks the Google Play service-account key. | No indexed evidence confirms a public Google Play release. |

The local [eas.json](C:/dev/FlockTrax/mobile/eas.json) uses remote app-version sourcing and automatic build increments. The static `buildNumber`/`versionCode` values in [app.json](C:/dev/FlockTrax/mobile/app.json) are therefore not the authoritative remote build numbers.

## Mobile `1.0.4` Work Orders test-readiness state

Primary checkpoint: [FlockTrax_Mobile_Work_Orders_1_0_4_Test_Readiness_Checkpoint_2026-07-12.md](C:/dev/FlockTrax/output/FlockTrax_Mobile_Work_Orders_1_0_4_Test_Readiness_Checkpoint_2026-07-12.md)

### User purpose and workflow

The mobile dashboard now separates two worker modes:

- **Barn Care:** flock-centered daily operations.
- **Work Orders:** farm-wide maintenance and placement concerns without cluttering Barn Care.

Work Orders can show unresolved items across accessible farms and barns, switch between `By Barn` and `All Barns`, search by operational context, filter by ownership/category/working status, sort by barn or age, open a complete chronological history, post `Progress`, `Parts Ordered`, or `Note`, and resolve with a final note.

The database parent status remains `open` or `resolved`. Mobile working status is derived from the latest state-changing update: no progress update means `Open`, `progress` means `In Progress`, and `parts_ordered` means `Parts Ordered`. A normal note does not change working status.

### Completed evidence

- Mobile typecheck passed.
- Production Expo bundle export passed for iOS and Android.
- Both platform builds finished.
- `action-items-list` bundled and deployed.
- An unauthenticated request to the hosted list endpoint returned `401`.
- iOS submission was scheduled.
- Current source includes the segmented mode, filters, history, update, and resolve UI in [ActionItemsScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/ActionItemsScreen.tsx).

### Acceptance gate before any further mobile feature work

Use a normal farm-worker account and require all of the following:

1. Barn Care behavior and assigned-farm filtering are unchanged.
2. Work Orders returns only permitted farms/barns and matches the admin Action Items queue.
3. `By Barn`, `All Barns`, search, ownership, category, status, and sort controls behave on real data.
4. History renders oldest to newest.
5. `Note` leaves working status unchanged.
6. `Progress` and `Parts Ordered` transition the derived status correctly, including a later return to `Progress`.
7. Resolve removes the item from the unresolved queue and leaves full history visible in web admin.
8. State persists after app/session restart.
9. Hosted `issue-update`, `issue-create`, and `issue-resolve` are verified at the exact endpoints used by the build.
10. A pure barn-owned item without `related_placement_id` is tested. Current update/resolve source requires placement context even though the list endpoint can return such a barn item; either guarantee that every actionable barn item carries placement context or add a barn/farm authorization path before release.

### Humidity in the same build

Relative humidity is included in `1.0.4`. The app requests `relative_humidity_2m` from Open-Meteo, fills only an unsaved current-day value, displays it in Conditions, and persists to `public.log_daily.rel_humidity`. Saved historical humidity must not be replaced with current weather.

### Next action

**Release priority P0:** run the field checklist, correct failures, verify all hosted mutation functions, then commit and push the complete known-good baseline before starting calendars or performance work.

## 1. Mobile product

### M1. Identity, session recovery, password, and account lifecycle

**Purpose and users.** Give farm workers a reliable authenticated mobile session while enforcing per-capability write access. Allow recovery from expired sessions and satisfy storefront account-deletion rules.

**Workflow.** Email/password login establishes a Supabase session; the app loads profile/capability data and the scoped dashboard. Stored sessions can bootstrap on restart. Expired credentials invoke reauthentication. Forgot Password delegates to the hosted auth path. The current app also exposes typed-confirmation account deletion.

**Status.** **Production/live** in the public mobile lineage; later session/reauth refinements are represented in staged builds. The account-delete backend and support/privacy pages were explicitly live for the May 6 iOS approval.

**Implementation surfaces and dependencies.** [mobile/App.tsx](C:/dev/FlockTrax/mobile/App.tsx), [mobile/src/api/http.ts](C:/dev/FlockTrax/mobile/src/api/http.ts), [mobile/src/storage/session.ts](C:/dev/FlockTrax/mobile/src/storage/session.ts), [auth-delete-account](C:/dev/FlockTrax/supabase/functions/auth-delete-account/index.ts), Supabase Auth, and platform capability fields.

**Acceptance criteria.** A valid user can sign in and restore a session; invalid/expired sessions fail clearly or reauthenticate without losing unsafe edits; write-disabled roles cannot submit protected data; password reset returns to a valid session; self-delete removes login and returns to the login screen.

**Limitations and risks.** Store reviewer authentication failed in early releases, so fresh-device login remains a regression case. Mobile self-delete is destructive, while admin User Access intentionally uses retirement; UI and operator documentation must keep those two policies distinct. The latest public iOS version is not confirmed by the index after `1.0.1 (10)`.

**Next action.** Include fresh install, session restore, expired-token save, password reset, lock/reauth, sign-out, and delete-account cases in the final `1.0.4` regression pass.

### M2. Barn Care dashboard and operational placement state

**Purpose and users.** Let workers find the correct farm/barn/flock quickly and see real operational state without exposing planning complexity.

**Workflow.** The dashboard is farm-group/farm scoped, shows location-first barn cards, counts and status, and distinguishes scheduled, awaiting arrival, in-barn, complete/offline states. Arrival actions and placement opens use backend state. A weather popup uses configured farm coordinates.

**Status.** **Production/live**. The July 10 web-editor fix is also live and prevents future lifecycle-stage edits from leaving the mobile operational flags stale.

**Implementation surfaces and dependencies.** [DashboardScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/DashboardScreen.tsx), [dashboard-placements-list](C:/dev/FlockTrax/supabase/functions/dashboard-placements-list/index.ts), [operational state migration](C:/dev/FlockTrax/supabase/migrations/20260417093000_operational_placement_state_functions.sql), and [placement actions](C:/dev/FlockTrax/web-admin/app/admin/placements/new/actions.ts).

**Acceptance criteria.** A worker sees only assigned farms; the current flock agrees across placement, flock, and barn pointers; `awaiting_arrival` and `in_barn_growing` transitions update all operational flags; scheduled siblings never appear as current; historical split-brain records do not silently displace the true flock.

**Limitations and risks.** The `319-S2` incident proved that `placements.lifecycle_stage` alone is insufficient. Existing historical records may still contain mismatches and need audit/repair. Current clients still read compatibility fields in several places.

**Next action.** Add a one-time operational-state consistency audit across all barns and retain the authoritative RPCs as the only normal promotion path.

### M3. Daily logs, conditions, age tasks, and save behavior

**Purpose and users.** Capture the daily barn record once, at the barn, with enough environmental and task context for operations, audit, and closeout.

**Workflow.** The placement-day screen reads or creates the selected date, shows table-driven age tasks, conditions, water/minimum ventilation/ODA, comments, and related tabs. `allow_historical_entry` controls date selection. `after_save_goback` independently controls whether a successful save returns to the dashboard. Current-day weather can prefill outside temperatures and humidity.

**Status.** Core is **production/live**. Relative humidity and the current consolidated screen behavior are **deployed but staged/testing** in `1.0.4`.

**Implementation surfaces and dependencies.** [PlacementDayScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/PlacementDayScreen.tsx), [placement-day-get](C:/dev/FlockTrax/supabase/functions/placement-day-get/index.ts), [placement-day-submit](C:/dev/FlockTrax/supabase/functions/placement-day-submit/index.ts), `log_daily`, `daily_age_tasks`, platform settings, and Open-Meteo.

**Acceptance criteria.** A date loads without overwriting saved values; historical selection is impossible when disabled; a failed save keeps the user and error in context; successful navigation follows `after_save_goback`; current weather fills only missing current-day fields; persisted humidity survives reload.

**Limitations and risks.** Google Sheets read-before-edit may hydrate mapped values, so source-of-truth behavior must remain understandable. Historical/backfilled rows may not have complete conditions. No automated regression test covers setting combinations.

**Next action.** Test all four combinations of the two flags and both new/existing daily records in the staged build.

### M4. Mortality, grading, weights, and benchmarks

**Purpose and users.** Record production quality and loss data accurately and make results meaningful against sex/age breed standards.

**Workflow.** Workers record male/female dead and culls, reasons, litter/footpad/feather/lame/pecking grades, and male/female scale-summary samples. The system stores summary weights rather than individual birds and returns sex-specific benchmark context. Recent and first-seven-day summaries support operational review.

**Status.** **Production/live**.

**Implementation surfaces and dependencies.** [WeightEntryScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/WeightEntryScreen.tsx), [weight-entry-get](C:/dev/FlockTrax/supabase/functions/weight-entry-get/index.ts), [weight-entry-submit](C:/dev/FlockTrax/supabase/functions/weight-entry-submit/index.ts), `log_mortality`, `log_weight`, `stdbreedspec`, and `breeds`.

**Acceptance criteria.** Decimal entry such as `4.54` persists as `4.54`; male/female samples remain separate; benchmark age/sex is correct; unauthorized roles cannot save; first-seven-day metrics mean cumulative day 1 through day 7 and agree with closeout/report calculations.

**Limitations and risks.** Historical Sheets-only values and native rows have caused readback/recovery issues. Weight and mortality definitions changed during April/June, so older screenshots/checkpoints are not acceptance authorities.

**Next action.** Cross-check one current and one closed flock from mobile entry through dashboard, log matrix, flock history, and closeout.

### M5. Mobile feed-ticket entry

**Purpose and users.** Let workers enter a balanced delivery ticket and allocate its drops without later transcription.

**Workflow.** Users start a ticket, add in-memory drops, and persist the ticket and drops together. Supported types are `Reg`, `xTran`, `iTran`, and `f2f`. Historical assignment uses barn/date evidence and permits controlled manual selection. Off-farm redirect requires a note and removes internal bin/flock allocation.

**Status.** Backend and web behavior are **production/live**. Mobile source contains the workflow, but the exact public binary uptake of post-May changes is unconfirmed; treat the current mobile version as part of staged `1.0.4` regression.

**Implementation surfaces and dependencies.** [FeedTicketScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/FeedTicketScreen.tsx), [FeedTicketListScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/FeedTicketListScreen.tsx), `feed-ticket-list/get/submit`, feed-bin/placement lookup, ticket type settings, and balancing rules.

**Acceptance criteria.** A ticket cannot save unbalanced; add/drop/edit language is clear; historical tickets resolve only from evidence or explicit authorized override; all four ticket types preserve accounting meaning; redirected drops carry a required note and do not hit active flock/bin totals; saved tickets reopen faithfully.

**Limitations and risks.** The official reconciliation queue is an admin workflow, not a documented mobile operation. The latest mobile public release is uncertain. Feed ticket audit-field persistence needs a live spot check after later function deployments.

**Next action.** Include create/save/reopen/edit and each ticket type plus an off-farm redirect in the final mobile regression matrix.

### M6. Mobile Work Orders

**Purpose and users.** Give farm workers a focused facilities and operational work queue separate from flock-care data entry.

**Workflow.** See the dedicated `1.0.4` section above.

**Status.** **Deployed but staged/testing**.

**Implementation surfaces and dependencies.** [ActionItemsScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/ActionItemsScreen.tsx), [action-items-list](C:/dev/FlockTrax/supabase/functions/action-items-list/index.ts), [issue-update](C:/dev/FlockTrax/supabase/functions/issue-update/index.ts), `issues`, `issue_types`, and `issue_updates`.

**Acceptance criteria.** Complete the P0 checklist above, including pure barn-item behavior and exact hosted mutation-function verification.

**Limitations and risks.** No signed-in field test is recorded. Parent status is deliberately only open/resolved. Pure barn items can be listed without placement context, while current mutation handlers require placement context. The new mutation function is untracked and its deployment is not explicit.

**Next action.** Field-test before any calendar implementation.

### M7. Read-only operations calendars

**Purpose and users.** Let workers anticipate upcoming placements and removals without granting administrative scheduling authority.

**Workflow.** Two locked views: upcoming Placements and upcoming Livehaul. Tapping a placement badge shows scheduled chick count; tapping a livehaul badge shows scheduled bird count to be taken. No create, edit, delete, reschedule, or lifecycle controls.

**Status.** **Planned/agreed**. No mobile route, API response, or screen implementation was found. Existing date pickers and web calendar reports are not this feature.

**Implementation dependencies.** Accessible farm scope, placement schedule data, `livehaul_schedule`, target/head counts, and a read-only mobile API contract.

**Acceptance criteria.** Only authorized farms appear; dates and counts match web admin; detail is intentionally limited; every attempted mutation is impossible in UI and API; empty/loading/error/month navigation states are usable on phone and tablet.

**Limitations and risks.** Compatibility `lh1/lh2/lh3` fields still exist in source and must not become the primary calendar data source. Time-zone and final date semantics must match admin reports.

**Next action.** **P1 after Work Orders baseline is committed.** Define one read-only scoped endpoint and reuse consistent calendar primitives without importing admin controls.

### M8. Closed-flock performance summary

**Purpose and users.** Show workers how daily care translated into production results and create a future basis for goals or incentives.

**Workflow.** Once closeout data is sufficient, show livehaul loads/live pounds, feed-finished readiness, final live percentage, final mortality, first-seven-day mortality, and feed conversion.

**Status.** **Planned/agreed**. Web closeout already calculates most inputs, but no mobile performance screen or API payload was found.

**Implementation dependencies.** `placement_closeouts`, completed `livehaul_schedule`/`livehaul_loads`, reconciled feed tickets, closeout milestone state, and shared metric definitions.

**Acceptance criteria.** A flock appears only when metric prerequisites are met; every value agrees with the web closeout report; missing/unverified feed or live weight is labeled rather than treated as zero; first-seven-day and FCR definitions are identical across mobile, web, and report.

**Limitations and risks.** Early historical flocks can have incomplete/negative derived feed and must not produce misleading performance cards. Incentive/bonus mechanics are future direction, not current scope.

**Next action.** **P1 after calendars.** Expose a read-only closed-flock summary from the already authoritative closeout calculations.

## 2. Web-admin product

### W1. Admin shell, authentication, platform registry, settings, and live dashboard

**Purpose and users.** Provide managers and administrators a secure operations console and a live all-barns view.

**Workflow.** Supabase login protects `/admin`; the shell reads platform branding/version metadata, exposes role-appropriate navigation, and leads to dashboard cards with counts, completion state, mortality, weights, feed projections, Action Items, placement editing, and report shortcuts.

**Status.** **Production/live**.

**Implementation surfaces and dependencies.** [admin layout](C:/dev/FlockTrax/web-admin/app/admin/layout.tsx), [overview](C:/dev/FlockTrax/web-admin/app/admin/overview/page.tsx), [active placement dashboard](C:/dev/FlockTrax/web-admin/components/active-placement-dashboard.tsx), [admin-data.ts](C:/dev/FlockTrax/web-admin/lib/admin-data.ts), `platform.control`, `platform.screen_txt`, and `app_settings`.

**Acceptance criteria.** Unauthenticated users redirect to login; live data errors do not silently fall back to mock data; dashboard values agree with source tables; filters and card actions retain context; Central-time status labels are correct; permissions lock edits.

**Limitations and risks.** The visible admin marker is older than the actual deployed code. Some settings/configuration concepts span `platform.settings` and `public.app_settings`; ownership must remain documented. Dashboard compatibility reads still include old livehaul fields.

**Next action.** Record the next web release against an exact commit and bump the marker to match the deployed feature set.

### W2. Farm structure, breeds, and feed-bin configuration

**Purpose and users.** Give admins a reliable hierarchy and configuration base for every operational feature.

**Workflow.** Manage farm groups, farms, barns, coordinates, placement ownership, breed lookup values, feed bins, BinSentry refs, layer state, and density tools.

**Status.** Core and density tools are **production/live**.

**Implementation surfaces and dependencies.** [farm structure view](C:/dev/FlockTrax/web-admin/app/admin/farm-structure/structure-view.tsx), [feed bins](C:/dev/FlockTrax/web-admin/app/admin/feed-bins/feed-bins-view.tsx), [feed-bin data](C:/dev/FlockTrax/web-admin/lib/feed-bin-data.ts), `farm_groups`, `farms`, `barns`, `feedbins`, and `breeds`.

**Acceptance criteria.** Hierarchy CRUD preserves parent/child rules; placement keys remain consistent after barn/flock changes; breed selectors write valid IDs; BinSentry refs map every intended bin; density comparison uses `app_settings.BulkDensity`; write actions require appropriate admin authority.

**Limitations and risks.** Farm writes historically interacted with audit triggers differently from service-role writes. BinSentry access is shared server-side. Current density push uses a vendor action marked deprecated.

**Next action.** Keep the current live tools, add vendor-deprecation monitoring, and avoid changing source-of-truth ownership during the mobile release.

### W3. Placement scheduler, split placement dates, lifecycle, and replacement juggle

**Purpose and users.** Let managers reserve barn windows, create linked flock/placement records, record sex-specific arrivals, move flocks through operational state, and recover safely from canceled scheduled flocks.

**Workflow.** Farm/Barn calendar views expose open/blocked dates. Scheduling creates a flock and placement, applies grow-out dates, breeds/counts, and safe inactive state. The editor can promote `awaiting_arrival` or `in_barn_growing` through authoritative RPCs. Current source also accepts male/female placement dates and provides `Cancel And Juggle` to transfer delivered feed to a replacement flock under strict guards.

**Status.** Core scheduling/lifecycle and July 10 state fix are **production/live**. Split-sex dates and reusable juggle are **partially implemented / production acceptance uncertain**.

**Implementation surfaces and dependencies.** [scheduler page](C:/dev/FlockTrax/web-admin/app/admin/placements/new/page.tsx), [scheduler actions](C:/dev/FlockTrax/web-admin/app/admin/placements/new/actions.ts), [split-date migration](C:/dev/FlockTrax/supabase/migrations/20260705101500_add_split_sex_placement_dates.sql), and operational RPC migrations.

**Acceptance criteria.** No overlapping barn windows; selection never mixes records; future placements remain inactive; lifecycle edits synchronize placement/flock/barn state; sex dates cannot predate the primary/possession date; juggle refuses flocks with operational logs, transfers all eligible feed, fixes pointers, and removes only the canceled source.

**Limitations and risks.** The split-date migration has no recorded hosted apply. The reusable juggle flow lacks a recorded field acceptance. Historical direct edits can still contain state mismatch. Several legacy livehaul date inputs remain in the placement editor.

**Next action.** Verify the split-date columns in hosted Supabase and run one controlled non-production juggle acceptance before labeling these production-ready.

### W4. Livehaul scheduler and load capture

**Purpose and users.** Schedule removals and capture actual processing loads with enough detail for production metrics and closeout.

**Workflow.** Managers view all barns or one barn, create ordered livehaul schedule rows, set date/head target/target sex, and later enter nested load rows in closeout. Each schedule can be scheduled, complete, or canceled. Breed comparison uses the haul date and target sex.

**Status.** **Production/live** since Admin `5.4`.

**Implementation surfaces and dependencies.** [livehaul scheduler](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/page.tsx), [livehaul actions](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/actions.ts), [closeout load forms](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx), `livehaul_schedule`, and `livehaul_loads`.

**Acceptance criteria.** Farm-wide calendar shows all relevant barns; a new row retains selected placement context; sequence order is stable; target sex drives the correct benchmark; actual heads/weights aggregate into closeout; cancel/complete status is reflected everywhere.

**Limitations and risks.** Old fixed livehaul fields remain fallback inputs and can drift. Defaults of first=roo, middle=mixed, last=hen are conveniences, not substitutes for explicit review.

**Next action.** Keep `livehaul_schedule` authoritative and include its head target in the new mobile calendar contract.

### W5. Flock closeout, settlement, archive, and performance calculations

**Purpose and users.** Give managers one controlled path from birds leaving the barn through data reconciliation, settlement, production results, and final archive.

**Workflow.** Checkout creates/uses a `placement_closeouts` record and queue entry. The worksheet records processed head/live weight, derives feed and FCR, shows breed/live/mortality/first-seven-day values, tracks `LH Complete`, `Feed Verified`, `Invoice Created`, `Submitted`, `Settlement Received`, and `Closeout Complete`, then permits archive. Reports and the combined Digital Archive Summary support review/filing.

**Status.** Core workflow and reports are **production/live**. Document-original panels are covered separately.

**Implementation surfaces and dependencies.** [closeout queue](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/page.tsx), [worksheet](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx), [actions](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/actions.ts), [closeout-data.ts](C:/dev/FlockTrax/web-admin/lib/closeout-data.ts), and [placement closeout migration](C:/dev/FlockTrax/supabase/migrations/20260602130000_create_placement_closeouts.sql).

**Acceptance criteria.** Derived values reconcile to livehaul/feed/mortality records; `f2f` is not deducted twice; first-seven-day means days 1–7; submitted/settlement/archive milestones retain actors/timestamps; archive is unavailable until all steps are complete; reports agree with the worksheet.

**Limitations and risks.** Early historical flocks with incomplete feed can violate non-negative constraints. Some historic archived rows lack timestamps. Manual overrides need reason and audit discipline.

**Next action.** Use closeout as the sole metric source for the planned mobile performance summary and define an explicit “performance ready” predicate.

### W6. Admin Action Items and work-order reporting

**Purpose and users.** Turn field concerns into a manageable, printable maintenance/operations queue for managers and workers.

**Workflow.** Create barn- or placement-owned Action Items, maintain data-driven types, append chronological updates, resolve with a final note, filter from dashboard/admin, print an Action List, or print one worker handoff. Open-list printing now nests all follow-up updates beneath the original problem.

**Status.** **Production/live**, including July 10 print caching/revalidation fixes.

**Implementation surfaces and dependencies.** [Action Items page](C:/dev/FlockTrax/web-admin/app/admin/issues/page.tsx), [actions](C:/dev/FlockTrax/web-admin/app/admin/issues/actions.ts), [Action List report](C:/dev/FlockTrax/web-admin/app/admin/issues/report/page.tsx), [work order](C:/dev/FlockTrax/web-admin/app/admin/issues/work-order/page.tsx), and issue tables.

**Acceptance criteria.** Multiline text survives; updates stay oldest-to-newest; resolved items are immutable; filtered report equals the console scope; printed open rows contain the original problem plus child updates; report data never remains stale after mutation.

**Limitations and risks.** Rich working status is derived, not stored on the parent. Old checkpoints proposing parent `in_progress` states are not current commitments. Mobile and admin access paths differ and must agree on scope.

**Next action.** Use the field test to validate parity between mobile and web, then freeze the parent-status model for this release.

### W7. Feed ticket console, reporting, redirect, and reconciliation queue

**Purpose and users.** Let managers audit every ticket/drop, correct historical assignment, preserve accounting, print evidence, and isolate unresolved deliveries without corrupting flock/bin totals.

**Workflow.** Filter/sort tickets and drops, edit a dedicated ticket workspace, use settings-driven ticket types, print one ticket or a flock/date report, flag off-farm redirects, or queue a previously assigned drop. Queuing clears live assignment while preserving `queued_from_*` context and keeping the ticket balanced.

**Status.** Core, print, off-farm redirect, queue schema/functions/editor are **production/live**. The queued-ticket discovery filter is **staged/uncertain**.

**Implementation surfaces and dependencies.** [console](C:/dev/FlockTrax/web-admin/app/admin/feed-tickets/feed-ticket-console.tsx), [editor](C:/dev/FlockTrax/web-admin/app/admin/feed-tickets/feed-ticket-editor.tsx), [data loader](C:/dev/FlockTrax/web-admin/lib/feed-ticket-data.ts), queue migration, and `feed-ticket-get/submit`.

**Acceptance criteria.** Ticket remains balanced; queued/off-farm drops do not affect active flock/bin/order reconciliation; queue requires original source and note; unqueue restores remembered assignment; reports expose disposition; historical assignment never guesses without evidence.

**Limitations and risks.** July 3 explicitly held the queue filter for localhost shakeout, but later full-workspace deployments may have carried it live. Audit `updated_by` was added later and needs a live spot check. Real reconciliation edge cases remain the acceptance authority.

**Next action.** Verify the production filter state, complete real queue/unqueue cases, and then label the filter live or keep it hidden.

### W8. Placement log matrix and log-weight report

**Purpose and users.** Let Farm Manager-or-higher users repair missing or incorrect daily, mortality, and weight history during closeout without editing isolated dates one at a time.

**Workflow.** Open the placement matrix, page through merged rows by date, add a missing date, edit daily/mortality/male/female weight values, and save changed tables through established RPCs. A separate print-ready log-weight report compares samples with breed specification.

**Status.** **Production/live** in Admin `5.6`.

**Implementation surfaces and dependencies.** [matrix page](C:/dev/FlockTrax/web-admin/app/admin/placements/[placementId]/logs/page.tsx), [matrix editor](C:/dev/FlockTrax/web-admin/app/admin/placements/[placementId]/logs/placement-log-matrix-editor.tsx), [matrix actions](C:/dev/FlockTrax/web-admin/app/admin/placements/[placementId]/logs/actions.ts), and log tables/RPCs.

**Acceptance criteria.** Only authorized/scoped users edit; archived placements lock; no-change save is harmless; all modified dates/tables persist; pagination does not lose unsaved changes; report values match matrix/source rows.

**Limitations and risks.** Broad matrix correction is powerful and currently lacks automated tests. It replaced the backed-out single-date editor; old editor plans should not be revived without a new requirement.

**Next action.** Add an audit-focused manual test before each closeout/report release and preserve archived locking.

### W9. Document archive and original-paper audit

**Purpose and users.** Preserve original feed, hatch, livehaul, closeout, and supporting documents in a protected, searchable record rather than relying only on paper or local scans.

**Workflow.** Upload an allowed PDF/image to private Supabase Storage, create an immutable metadata row, mark the current original, and retrieve through a protected signed route. Feed tickets show Missing/Filed and document actions. Placement/closeout surfaces cover Hatch Ticket, one placement-level Livehaul Packet, Closeout Summary, and miscellaneous supporting documents.

**Status.** **Partially implemented / deployed-state uncertain**. Hosted storage/data was used successfully from localhost and the source is in local commits used by later deployments, but focused production UI acceptance is not recorded.

**Implementation surfaces and dependencies.** [document archive migration](C:/dev/FlockTrax/supabase/migrations/20260622113000_create_document_archive.sql), [document-archive.ts](C:/dev/FlockTrax/web-admin/lib/document-archive.ts), [protected route](C:/dev/FlockTrax/web-admin/app/api/document-archive/[documentId]/route.ts), and [closeout panels](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-document-panels.tsx).

**Acceptance criteria.** Bucket is private; access requires an authorized session; parent linkage is correct; replacing an original retires the former current row without deleting history; 20 MB and file-type rules agree with server limits; Missing exemptions are correct; hatch/livehaul/summary/misc reopen successfully after upload.

**Limitations and risks.** Large uploads and stale sessions caused earlier crashes. Early closeout summary linkage used the wrong key before correction. Mobile camera capture is deferred. Production route availability needs confirmation.

**Next action.** Run an authenticated production upload/open/replace matrix for every role, then declare the UI live and record the deployment commit.

### W10. Reports hub and printable operational packets

**Purpose and users.** Turn live operational data into practical review, work, inspection, settlement, and archive artifacts.

**Workflow.** Established routes cover feed projection, feed audit/flock reports, individual tickets, flock history and Micro Archive Copy, Action Lists/work orders, closeout, log weight, and Digital Archive Summary. A newer calendar framework adds date-selectable At-a-Glance plus Quick Access/Detailed Placements and Livehaul reports grouped by month.

**Status.** Established reports are **production/live**. The new calendar-report set is **implemented and likely present in later deployments, but production acceptance is uncertain**.

**Implementation surfaces and dependencies.** [reports hub](C:/dev/FlockTrax/web-admin/app/admin/reports/page.tsx), [report calendar helper](C:/dev/FlockTrax/web-admin/lib/report-calendar.ts), [placements data](C:/dev/FlockTrax/web-admin/lib/placements-calendar-report-data.ts), [livehaul data](C:/dev/FlockTrax/web-admin/lib/livehaul-calendar-report-data.ts), and report-specific data loaders.

**Acceptance criteria.** Filters and date anchors match product rules; Detailed Placements groups on final processing date while retaining placed date in detail; every month prints as a coherent packet; no truncation/blank trailing pages; metrics agree with authoritative source reports; titles identify the report and placement.

**Limitations and risks.** Calendar reports were initially local and need real multi-month print review. Later whole-workspace Vercel deployments blur whether they are already visible. Browser/printer behavior is inherently variable.

**Next action.** Audit authenticated production routes and print one sparse, one dense, and one multi-month packet before calling them released.

## 3. Supabase, integrations, synchronization, security, and operations

### D1. Operational data model, RPC state transitions, and activity log

**Purpose and users.** Keep one authoritative operational record shared by mobile, admin, reports, integrations, and recovery work.

**Workflow.** Core entities progress from farm structure to flock/placement, daily logs, feed, issues, livehaul, closeout, and archive. RPCs such as `make_placement_current`, `mark_chicks_arrived`, barn-empty/closeout transitions, and mobile save RPCs coordinate multi-table state. `activity_log` records meaningful narrative/audit events rather than duplicating every field.

**Status.** **Production/live**.

**Implementation surfaces and dependencies.** [migrations](C:/dev/FlockTrax/supabase/migrations), [operational state functions](C:/dev/FlockTrax/supabase/migrations/20260417093000_operational_placement_state_functions.sql), and [Activity Log](C:/dev/FlockTrax/web-admin/app/admin/activity-log/page.tsx).

**Acceptance criteria.** State changes are atomic or fail safely; one barn cannot have two active placements; audit actor/time is retained; archived records are stable; every client reads the same operational truth.

**Limitations and risks.** Direct SQL repairs were sometimes necessary. Migration history contains manual apply/repair episodes. Some server actions use service-role access and must enforce actor/scope in application code.

**Next action.** Reconcile remote migration history, audit barn state, and document RPC ownership before the next schema expansion.

### D2. Google Sheets two-way synchronization and historical backfill

**Purpose and users.** Preserve integrator workbook compatibility while making Supabase/FlockTrax the operational UI and queue origin.

**Workflow.** Writes enqueue `platform.sync_outbox`; a hosted function claims rows and batch-writes Google Sheets on a 15-minute Supabase cron, with manual processing/retry/replay/delete controls. Read-before-edit can hydrate mapped fields from the workbook. A Python importer backfills older flocks, and generated reverse-sync outbox rows are then cleared or suppressed operationally.

**Status.** **Production/live**. Historical backfill is an **operational tool**, not an end-user feature.

**Implementation surfaces and dependencies.** [sync admin](C:/dev/FlockTrax/web-admin/app/admin/sync/googleapis-sheets), [hosted worker](C:/dev/FlockTrax/supabase/functions/googleapis-outbox-process/index.ts), [shared Sheets helper](C:/dev/FlockTrax/supabase/functions/_shared/google-sheets-read.ts), [backfill tool](C:/dev/FlockTrax/toolkit/sync_engine/backfill_from_sheets.py), Google service account, endpoints, and column maps.

**Acceptance criteria.** A changed mapped value queues once, writes to the correct workbook/date/header, marks sent or exposes a useful failure, and reads back before edit when enabled. Unchanged writes do not enqueue. Backfill dry-run is reviewable, does not invent weight rows, and does not leave unwanted outbound work.

**Limitations and risks.** For mapped fields the workbook is still declared source of truth, which can surprise users. Backfill triggers create outbox rows unless controlled. Credentials, sharing, cron, and column maps are external configuration dependencies.

**Next action.** Add a documented backfill runbook with automatic outbox suppression/cleanup and verify the current 15-minute cron from live job history.

### D3. BinSentry live inventory and density integration

**Purpose and users.** Give feed managers live physical inventory and a way to keep density assumptions aligned before trusting projections.

**Workflow.** FlockTrax maps feed bins to BinSentry refs, synchronizes inventory hourly during the configured Central-time window, stores snapshots, infers feed type, displays inventory, checks live density against `BulkDensity`, can push that density to a bin, and blocks projection reports behind an overrideable mismatch warning.

**Status.** **Production/live**. Delivered-order feed-type inference in the current working tree is **implemented locally, not released** unless separately confirmed.

**Implementation surfaces and dependencies.** [binsentry-sync-all](C:/dev/FlockTrax/supabase/functions/binsentry-sync-all/index.ts), [binsentry.ts](C:/dev/FlockTrax/web-admin/lib/binsentry.ts), [feed-bin data](C:/dev/FlockTrax/web-admin/lib/feed-bin-data.ts), [cron migration](C:/dev/FlockTrax/supabase/migrations/20260610110000_schedule_binsentry_sync_business_hours.sql), and BinSentry server credentials.

**Acceptance criteria.** All mapped bins sync with correct kg→lb conversion and timestamps; feed type follows defined precedence; density audit reads the same bin; push-back round-trips; projection gate lists every in-scope mismatch and requires explicit override.

**Limitations and risks.** Shared credentials are acceptable only for the current single operational environment. The bulk-density update action is vendor-deprecated. The Edge Function currently uses service-role writes and does not perform its own caller authentication while gateway JWT verification is disabled; any caller reaching it can trigger synchronization (including `force`). This should be hardened even though the action is constrained to configured bins.

**Next action.** Add a cron secret/internal authorization check, remove credential material from tracked SQL where practical, and monitor vendor API changes after the mobile release gate.

### D4. Feed projection, typed inventory, orders, and receipt reconciliation

**Purpose and users.** Tell managers how much starter/grower feed is required, what is on hand/on order, what must be ordered, and how delivered tickets close open load commitments.

**Workflow.** Projection uses population, mortality trend, breed day-feed, scheduled livehaul, starter target (`birds placed × lbs/chick`), delivered starter, typed accessible/queued bin layers, open commitments, and BinSentry orders. The operational 10-day report recommends orders; custom windows are planning-only. Feed ticket receipts reconcile against compatible open load commitments by scope/type rather than exact planned drop sequence.

**Status.** Foundation, typed schema, live reports, density preflight, and core reconciliation are **production/live**. Real receipt acceptance is **partial**. The current starter-excess allocation correction is **implemented locally, not released**.

**Implementation surfaces and dependencies.** [feed projection data](C:/dev/FlockTrax/web-admin/lib/feed-projection-report-data.ts), [admin data](C:/dev/FlockTrax/web-admin/lib/admin-data.ts), [feed layer migration](C:/dev/FlockTrax/supabase/migrations/20260617120000_add_feed_layer_state_and_feed_type_to_ordering.sql), and `feed-ticket-submit`.

**Acceptance criteria.** Today is day 1; only flocks overlapping the window are included; starter remains starter until its obligation is exhausted; no 12,000/day-14 shortcut is applied; typed on-hand/on-order is consumed in chronological demand order; receipts never match queued/off-farm drops; partial/full order states reconcile exactly.

**Limitations and risks.** The current local algorithm changed after the last explicit production report checkpoint. Untyped legacy orders/bins can force fallback modes. Real receipt sequences and mixed layers are not comprehensively tested. Historical feed gaps block some closeouts.

**Next action.** Validate the local correction against representative barns, commit it with focused tests, and run real partial/full/multi-drop receipt scenarios before promoting.

### D5. Roles, memberships, invitations, retirement, and access enforcement

**Purpose and users.** Let authorized administrators grant what a user may do and where they may do it, while preserving audit identity.

**Workflow.** Roles define capabilities; farm-group/farm memberships define scope. User Access reads live Auth users, normalized/legacy-compatible roles, permissions, and memberships. Admins can invite through custom SMTP, resend setup, assign roles/scope, and retire users with typed confirmation. Mobile functions derive per-capability write access.

**Status.** Core is **production/live**. Role/permission catalog editing and some endpoint hardening are **partially implemented**.

**Implementation surfaces and dependencies.** [access-control.ts](C:/dev/FlockTrax/web-admin/lib/access-control.ts), [User Access](C:/dev/FlockTrax/web-admin/app/admin/user-access/page.tsx), [User Access actions](C:/dev/FlockTrax/web-admin/app/admin/user-access/actions.ts), normalized-role migration, Supabase Auth, SMTP/Vercel configuration, and RLS/application checks.

**Acceptance criteria.** Non-admins cannot reach/administer out-of-scope users; role rank prevents peer/superior modification; memberships constrain data; invite/reset links produce a usable session; retirement bans login and removes live assignments without deleting historical attribution; function endpoints reject missing/invalid bearer tokens.

**Limitations and risks.** The code still supports legacy `user_roles.role` fallback, so live normalization must be confirmed. Role/action catalog maintenance is read-only in the visible UI. Several Edge Functions use `verify_jwt = false` because they self-authenticate; each must actually validate the bearer. `binsentry-sync-all` is a current exception. Server actions using admin clients depend on correct actor/scope checks.

**Next action.** Perform a route/function authorization matrix by role and scope, confirm live `role_id` normalization, and harden scheduled service endpoints.

### D6. Build, deployment, storefront, and recovery operations

**Purpose and users.** Make releases reproducible, attributable, recoverable, and safe across web, database/functions, and both mobile stores.

**Workflow.** Web deploys through Vercel; Supabase functions/migrations deploy separately; Expo/EAS remotely versions and builds mobile; TestFlight/Play handle distribution; `platform.control` presents release markers; checkpoint notes preserve recovery context.

**Status.** Tools are operational, but current release control is **partial**.

**Implementation surfaces and dependencies.** Git/GitHub `main`, [web-admin package](C:/dev/FlockTrax/web-admin/package.json), [mobile package](C:/dev/FlockTrax/mobile/package.json), [eas.json](C:/dev/FlockTrax/mobile/eas.json), Vercel, Supabase CLI/project, EAS, App Store Connect, and Play Console.

**Acceptance criteria.** Every deployment maps to a pushed commit/tag; database/function versions are recorded; marker equals deployed code; build artifacts pass typecheck/build and a release checklist; staged/public states are distinct; rollback/recovery does not depend on one dirty workstation.

**Limitations and risks.** Current production is ahead of GitHub and the marker. Some SQL was applied directly with failed history repair. Android credentials block submission. No automated CI or test suite is evidenced. Checkpoint files have occasionally contained sensitive operational details and should not be treated as a secrets store.

**Next action.** Commit/push the accepted baseline, reconcile migrations/functions, tag releases, update markers, and introduce a minimal CI gate before the public `1.0.4` release.

## Technical and deployment inventory

| Layer | Current inventory | Operational notes |
|---|---|---|
| Mobile | Expo `54`, React Native `0.81.5`, React `19.1`, TypeScript; routes for login, dashboard, feed-ticket list/editor, placement-day, and weight entry; Work Orders is a dashboard mode. | `eas.json` uses remote version source and auto-increment. No mobile automated test script was found. |
| Web admin | Next.js `15.2.8`, React `19`, TypeScript, Supabase SSR/JS, Nodemailer; roughly 40 admin/report route pages. | Hosted on Vercel. Latest live code is newer than Admin marker `5.6`. |
| Database | Supabase Postgres with farms/barns/flocks/placements, daily/mortality/weight, feed, issues, livehaul, closeout, archive, roles/memberships, and platform sync tables. | Migration files span 2026-02 through 2026-07; remote history needs reconciliation. |
| Storage | Private `flocktrax-document-archive` bucket plus `document_archives` metadata. | UI production acceptance is unresolved. |
| Mobile/API functions | Auth/profile, dashboard, placement-day, weight, feed ticket, Action Item create/update/resolve/list. | Most use gateway JWT bypass plus explicit bearer validation. Verify every staged mutation deployment. |
| Scheduled/integration functions | `googleapis-outbox-process`, `binsentry-sync-all`. | Sheets is scheduled every 15 minutes; BinSentry cron fires hourly and code restricts business hours. Harden service-call authorization. |
| Google Sheets | Config, endpoints, column maps, outbox, payload snapshots, retry/replay/delete, read-before-edit, hosted writes, Python backfill. | Workbook remains source of truth for mapped fields. |
| BinSentry | Server-side auth, 22-bin mapping proof, kg/lb conversion, snapshots, typed inventory, density read/write, scheduled orders. | Shared credential model; vendor density write action deprecated. |
| Weather | Open-Meteo with farm coordinates; current temperature/humidity and daily high/low/code/precipitation fields. | Do not overwrite historical saved values. |
| Email | Custom SMTP invitation/setup flow through `no-reply@flocktrax.com`. | Depends on external mailbox/app-password and Vercel configuration. |
| Release | Vercel, Supabase CLI, EAS, App Store Connect, Play Console. | GitHub and release marker do not currently reproduce deployed state. |

## Testing gaps and release gates

No repository unit, integration, or end-to-end test files or `test` scripts were found outside dependencies. Current validation is primarily TypeScript typecheck, Next build, Expo bundle/build, direct database inspection, and manual browser/device testing.

| Priority | Gap | Why it matters | Closure gate |
|---|---|---|---|
| P0 | Signed-in mobile Work Orders field test | The main staged feature has never been proven on real scoped data from build 15/9. | Complete the full checklist with a normal worker account and web-admin parity check. |
| P0 | Hosted `issue-update` and current mutation functions | The app calls a new untracked function whose deployment is not explicitly recorded. | Verify function list/version, then post note/progress/parts/resolve from the build. |
| P0 | Pure barn item without placement context | List can return it; update/resolve currently reject it. | Guarantee context on all actionable rows or implement farm/barn authorization in mutations. |
| P0 | Git/deploy reproducibility | Production/TestFlight state cannot be rebuilt from `origin/main`. | Commit and push the entire accepted baseline; record function/migration/deployment versions. |
| P1 | Barn Care regression in `1.0.4` | Work Orders touched the root app/dashboard and package metadata. | Daily, mortality, grade, weight, feed ticket, weather, reauth, and account tests pass. |
| P1 | New web calendar report production/print acceptance | Deployment inclusion is ambiguous and only local typecheck/visual review is recorded. | Authenticated route audit plus sparse/dense/multi-month print previews. |
| P1 | Document archive production acceptance | Local hosted-data success does not prove production UI/session/size behavior. | Upload/open/replace each document role in production with permission and 20 MB checks. |
| P1 | Feed queue and order receipt reconciliation | Real sensor/ticket discrepancies determine whether the model is safe. | Queue/unqueue, partial/full order receipt, mixed-type, redirected, and delete/re-edit cases pass. |
| P1 | BinSentry/Sheets service endpoint authorization | Scheduled functions use service-role operations; BinSentry sync lacks caller auth. | Add and test internal authorization/cron secret; reject unauthorized calls. |
| P1 | Cross-surface metric parity | Mobile performance work will expose closeout metrics broadly. | Golden closed flock agrees across source rows, web worksheet/report, and new API/mobile view. |
| P2 | Migration history and live schema | Local files do not guarantee remote applied history. | Export/compare remote migration list and verify split dates, audit fields, queue, layers, archive. |
| P2 | Storefront version confirmation | Indexed evidence does not confirm public iOS after `1.0.1 (10)` or any Play release. | Confirm App Store/Play listings and record them in the next release checkpoint. |
| P2 | Role/scope matrix | Access code is broad and partly compatibility-driven. | Test representative super admin, farm manager, worker, read-only, and no-membership users. |

## Agreed roadmap and recommended release sequence

### Active mobile roadmap boundary

The roadmap is intentionally narrow:

1. Work Orders field acceptance.
2. Read-only Placements and Livehaul calendars.
3. Read-only closed-flock performance summary.
4. Polish, regression, and release.

Web calendar reports are a separate manager-facing feature and do not satisfy the mobile calendar requirement. Existing closeout metrics are dependencies for the mobile performance summary, not evidence that the mobile feature is already implemented.

### Recommended sequence

1. **Freeze the baseline.** Do not add mobile scope. Preserve the current tree and take a file-level snapshot if needed.
2. **Verify hosted functions.** Confirm `action-items-list`, `issue-create`, `issue-update`, and `issue-resolve` versions and authentication behavior.
3. **Field-test Work Orders.** Execute the full normal-worker checklist, including a pure barn item and cross-scope negative test.
4. **Fix only release blockers.** Rebuild both platforms if native bundle behavior changes; retest Barn Care and humidity.
5. **Commit and push the known-good baseline.** Include both ahead commits and all accepted Work Orders/report/state fixes. Tag or otherwise identify the exact web/function/mobile source.
6. **Reconcile deployment records.** Verify migrations, functions, Vercel routes, Admin marker, TestFlight state, and the Android AAB. Resolve the Play service-account credential path.
7. **Implement read-only calendars.** One scoped read contract, two locked views, limited badge detail, no mutation controls.
8. **Implement closed-flock performance.** Reuse authoritative closeout calculations and gate incomplete data explicitly.
9. **Run final regression/security gates.** Add at least small deterministic tests around Work Order status derivation, scope, feed recommendation allocation, and closeout metric readiness; repeat device/browser manual matrices.
10. **Release iOS and Android deliberately.** Promote the validated iOS build through App Store review and upload the Android AAB through the now-configured Play path. Record public versions and exact source hashes.
11. **Only after mobile release, return to staged web work.** Formally accept or revise calendar reports, document archive, queue filter, split placement dates, juggle, and local feed/BinSentry corrections.

## Duplicate, abandoned, and superseded concepts

| Earlier concept | Current interpretation | Do not mistake it for |
|---|---|---|
| Adalo External Collections, cache-fill functions, Adalo session/debug paths | Superseded by the Expo mobile app; legacy code/config remains and needs an intentional decommission decision. | An active mobile roadmap or the primary production client. |
| `Issues` / `Open Items` | Historical names for the feature now called Action Items in admin and Work Orders in mobile. | Separate products or duplicate queues. |
| Daily maintenance/feedline/nipple/health booleans | Historical columns/compatibility fields; operational work now belongs in `issues`/Action Items. | Current work-order status. |
| Rich parent issue statuses proposed in May | Current mobile release derives working status from update history while parent stays open/resolved. | A committed schema roadmap item. |
| `lh1_date`, `lh2_date`, `lh3_date` | Compatibility/fallback fields. `livehaul_schedule` and nested loads are the forward model. | The correct source for new calendars or closeout logic. |
| Single-date admin log editor | Explicitly backed out; matrix editor shipped in `5.6`. | A partially finished route to resume. |
| 12,000-lb arrival starter minimum and day-14 cutoff | Explicitly removed from biological projection. | Current feed-order logic. |
| Auto-print Digital Archive Summary | Removed; manual print action is current. | A missing bug to restore. |
| Automatic hard delete from User Access | Replaced with retirement/deactivation to preserve history. | The mobile user’s separate storefront-mandated self-delete function. |
| Temporary direct scheduled-flock SQL juggle | The actual `310-W5 → 311-W5` repair is complete; current source contains a reusable guarded UI/action that still needs acceptance. | An outstanding need to repeat that exact data repair. |
| Transient-only BinSentry forecast popup | The live product now has inventory/order context, but saved projection history/learning remains deferred. | Evidence that `feed_projections` lifecycle tables already exist. |

## Evidence and uncertainty appendix

### A. Primary evidence set

Key current checkpoints:

- [Mobile Work Orders `1.0.4` test readiness, 2026-07-12](C:/dev/FlockTrax/output/FlockTrax_Mobile_Work_Orders_1_0_4_Test_Readiness_Checkpoint_2026-07-12.md)
- [Action Items print and S2 operational state, 2026-07-10](C:/dev/FlockTrax/output/FlockTrax_Action_Items_Print_And_S2_Operational_State_Checkpoint_2026-07-10.md)
- [BinSentry density and feed preflight, 2026-07-08](C:/dev/FlockTrax/output/FlockTrax_BinSentry_Density_Tools_And_Feed_Projection_Preflight_Checkpoint_2026-07-08.md)
- [Feed drop queue and reconciliation filter, 2026-07-03](C:/dev/FlockTrax/output/FlockTrax_Localhost_Feed_Drop_Queue_And_Reconciliation_Filter_Checkpoint_2026-07-03.md)
- [Reports hub and calendar reports, 2026-07-01](C:/dev/FlockTrax/output/FlockTrax_Reports_Hub_Quick_Access_And_Calendar_Report_Checkpoint_2026-07-01.md)
- [Closeout/archive/feed projection localhost baseline, 2026-06-30](C:/dev/FlockTrax/output/FlockTrax_Localhost_Closeout_Document_Archive_And_Feed_Projection_Checkpoint_2026-06-30.md)
- [Admin `5.6` production baseline](C:/dev/FlockTrax/output/FlockTrax_Admin_Release_5_6_Log_Matrix_And_Closeout_Production_Checkpoint_2026-06-12.md)
- [Admin `5.5` production baseline](C:/dev/FlockTrax/output/FlockTrax_Admin_Release_5_5_Feed_Ordering_Reports_And_Scheduler_Production_Checkpoint_2026-06-09.md)
- [Admin `5.4` lifecycle/closeout production baseline](C:/dev/FlockTrax/output/FlockTrax_Admin_Release_5_4_Closeout_And_Lifecycle_Production_Checkpoint_2026-06-04.md)

Current source evidence was used selectively for the Git boundary, routes, current algorithms, mobile roadmap absence, function authentication/scope, split-sex dates, reusable juggle, queue/document/archive presence, and test-suite absence.

### B. Missing references

- Missing index-linked Markdown files: **none** (`0 of 96`).
- The index contains exactly 96 unique Markdown link targets and every target exists.

### C. Conflicts resolved by chronology

1. **Feed starter rules:** June 7’s 12,000-lb/day-14 implementation is superseded by June 24/30 and current source: flock-based obligation continues until exhausted.
2. **Livehaul model:** fixed `lh1/lh2/lh3` planning is superseded by `livehaul_schedule`/`livehaul_loads`, though compatibility reads remain.
3. **Log editor:** the June 11 single-date editor backout is superseded by the June 12 released matrix editor.
4. **Action Item naming/status:** `Issues` → `Open Items` → `Action Items`; mobile uses `Work Orders`. Proposed richer parent statuses are superseded for the current release by update-derived working status.
5. **User removal:** May 11 hard delete was superseded in admin by May 16 retirement; mobile self-delete remains separate.
6. **Archive printing:** auto-print was added briefly and explicitly removed; manual print is current.
7. **Adalo:** the April 1 Expo breakthrough superseded the March Adalo-first architecture.
8. **Index recency:** the `Latest Checkpoint` section is not current and cannot override the July chronological entries.

### D. Conclusions requiring owner or live-environment confirmation

1. Which mobile version is currently public on the iOS App Store after the explicitly confirmed `1.0.1 (10)` release?
2. Has any Android version ever reached a Play testing/public track, or are all Android builds still artifact-only?
3. Did `issue-update` deploy successfully, and do the hosted `issue-create`/`issue-resolve` versions match the staged mobile source?
4. Are the new web calendar report routes, document archive UI, queue discovery filter, split-sex placement dates, and reusable juggle currently visible/usable in production after later whole-workspace deploys?
5. Was `20260705101500_add_split_sex_placement_dates.sql` applied to hosted Supabase?
6. Is the remote migration history reconciled for release-marker, document archive, feed layer, audit-field, queue, and split-date migrations that were sometimes run manually?
7. Does every unresolved barn Action Item intended for mobile mutation have `related_placement_id`, or must mutation authorization support barn-only context?
8. Is the Admin visible build marker still `5.6`, and what marker should represent the July deployments?
9. Is the current shared BinSentry tenant guaranteed to cover every authorized farm group, or is tenant isolation now required?
10. Which June/July local feed-projection correction results have been operationally accepted, and were any deployed after the last checkpoint?

### E. Known evidence limitations

- Source presence does not prove a hosted migration/function or public store release.
- A Vercel deployment from a dirty linked workspace can include more routes than the named checkpoint feature; this is why several web features remain staged/uncertain.
- Typecheck/build success does not prove data correctness, authorization, print layout, or field usability.
- Some checkpoint documents include historical credentials, artifact URLs, and direct data-repair details. This document intentionally does not reproduce secrets and should not be used as a credential inventory.

---

**Living-document rule:** update this file only when a feature crosses a defined status boundary, a product decision supersedes an earlier one, or owner confirmation resolves an appendix item. Record the exact commit, function/migration state, build number, deployment, and acceptance evidence rather than only saying “done.”
