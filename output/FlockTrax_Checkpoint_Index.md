# FlockTrax Checkpoint Index

Updated: `2026-08-10`

Purpose:
- one chronological list of the known FlockTrax checkpoint notes
- quick lookup for resume/recovery work
- flag which notes were recovered from Codex local session history instead of already existing as repo files

## Chronological Index

### August 2026

- `2026-08-10`
  - [FlockTrax_Admin_Closeout_Selectors_And_At_A_Glance_Print_Production_Checkpoint_2026-08-10.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Closeout_Selectors_And_At_A_Glance_Print_Production_Checkpoint_2026-08-10.md)
  - latest Admin production checkpoint covering the `294-W2` stale closeout Live Weight diagnosis and invoice-stage discrepancy guard, removal of all seven archived placements from remaining operational Feed Ticket and Mortality selectors while preserving Archive access, Quick Access At-a-Glance US Letter landscape printing, removal of its inherited `1360px` width/scaling problem, compact full-width columns with larger/heavier print type, commits `491f940`, `3ec8670`, `640074d`, and `31ec578`, final Vercel deployment `dpl_47RB9zZw2PBUtMhuBy3rHruAxSTr`, validation gates, and exact resume guidance

- `2026-08-10`
  - [FlockTrax_Livehaul_Dashboard_Admin_Production_And_Mobile_1_0_6_Build_Checkpoint_2026-08-10.md](C:\dev\FlockTrax\output\FlockTrax_Livehaul_Dashboard_Admin_Production_And_Mobile_1_0_6_Build_Checkpoint_2026-08-10.md)
  - production checkpoint for the authoritative livehaul dashboard display, Supabase dashboard API deployment, Admin deployment `dpl_J63zCDD3CsKQgNseWtJ8rRbCu3rN` on `flocktrax.com`, mobile `1.0.6` preparation, finished iOS build `18`, queued Android build `13`, and the store-release stopping point

- `2026-08-10`
  - [FlockTrax_Supabase_Performance_Review_And_Index_Maintenance_Checkpoint_2026-08-10.md](C:\dev\FlockTrax\output\FlockTrax_Supabase_Performance_Review_And_Index_Maintenance_Checkpoint_2026-08-10.md)
  - detailed hosted-database checkpoint covering Weekly DB Performance Report run `10`, live confirmation that the `74` findings did not represent an emergency, connection/cache/bloat assessment, targeted consolidation of six duplicate `log_mortality` indexes and constraints, new workload-backed `activity_log(flock_id)` and `feed_drops(queued_from_placement_id)` indexes, safely isolated hosted migration `20260810143000`, post-deployment verification, deferred `log_daily` cleanup, the agreed recurring report-review method, and exact uncommitted stopping state

- `2026-08-07`
  - [FlockTrax_Admin_BinSentry_Polling_Rollups_And_Feed_Drop_Usability_Production_Checkpoint_2026-08-07.md](C:\dev\FlockTrax\output\FlockTrax_Admin_BinSentry_Polling_Rollups_And_Feed_Drop_Usability_Production_Checkpoint_2026-08-07.md)
  - authoritative production checkpoint covering intentional-null mortality and cull semantics, the BinSentry polling Barn filter, the optional summary page with feed-type/barn/bin/overall rollups, the wider and darker feed-ticket drop Bin selector, release commits `84c78c6`, `a5f69de`, and `e504e6e`, Vercel deployment `dpl_F4vLg9p7B5JwDw5bbaPiKFwr2wUX`, validation gates, operational boundaries, and exact resume guidance

- `2026-08-06`
  - [FlockTrax_Admin_2_1_0_Build_5_9_Feed_Reconciliation_Production_Checkpoint_2026-08-06.md](C:\dev\FlockTrax\output\FlockTrax_Admin_2_1_0_Build_5_9_Feed_Reconciliation_Production_Checkpoint_2026-08-06.md)
  - authoritative Admin `2.1.0` build `12` / label `5.9` production checkpoint covering release commit `9d4ffbe`, Vercel deployment `dpl_FcN5R68z2YRrfvWpq4NVVYL4sLyd`, BinSentry-owned density conversion and Edge Function version `5`, revised lifetime starter ordering, corrected refill delta calculations, the BinSentry API feed-received polling report, the Queued Feed Deliveries Not Received report, queued-only drop filtering, employee reactivation, captured mobile 1.0.5 release-support assets, validation gates, operational boundaries, and exact resume guidance

### July 2026

- `2026-07-28`
  - [FlockTrax_Placement_Cancellation_And_Detailed_Mortality_Report_Production_Checkpoint_2026-07-28.md](C:\dev\FlockTrax\output\FlockTrax_Placement_Cancellation_And_Detailed_Mortality_Report_Production_Checkpoint_2026-07-28.md)
  - authoritative production checkpoint covering scheduled-placement cancellation and feed reassignment from commit `41f1fcb`, canceled-flock archive handling, the new Detailed Reports -> Mortality population ledger from commits `3780f46`, `ccb22f2`, and `73ed866`, dead-plus-culls calculation rules, partial-range Day 1 balance forward, split-sex arrival dates, legacy missing-removal-date inference, compact portrait printing, page-filling placement-safe pagination, weekday dates, successful hosted-data verification, and final Vercel deployment `dpl_DGzjyELY2uoj7aviYS7vxzxsCzM8`

- `2026-07-17`
  - [FlockTrax_Admin_2_1_0_Flock_Archive_And_Closeout_Production_Checkpoint_2026-07-17.md](C:\dev\FlockTrax\output\FlockTrax_Admin_2_1_0_Flock_Archive_And_Closeout_Production_Checkpoint_2026-07-17.md)
  - authoritative admin `2.1.0` production checkpoint covering release commit `9b1c033`, archive-filter hotfix/baseline `a4638e5`, hosted build `10` / label `5.7`, Vercel deployment `dpl_GbDLveXxx5SHqgesP8GPPi9gn76h`, archived-flock filters and read-only detail rules, consolidated Flock Detail and Closeout reports, linked Action Item histories, document behavior, the resolved release-label/code deployment mismatch, verified seven-record hosted archive set, validation gates, and exact resume guidance

- `2026-07-13`
  - [FlockTrax_Mobile_1_0_5_Production_Release_Checkpoint_2026-07-13.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_1_0_5_Production_Release_Checkpoint_2026-07-13.md)
  - production release checkpoint covering mobile `1.0.5`, commit `5e545eb`, the complete change list since the last confirmed store releases, successful local typecheck/export/admin build gates, live hosted release markers, completed iOS build `17` and scheduled App Store submission, queued Android build `11`, active mobile Edge Functions, and exact continuation steps for Android Play submission

- `2026-07-12`
  - [FlockTrax_Action_Items_Admin_Rules_And_Report_Polish_Checkpoint_2026-07-12.md](C:\dev\FlockTrax\output\FlockTrax_Action_Items_Admin_Rules_And_Report_Polish_Checkpoint_2026-07-12.md)
  - detailed admin-synchronization checkpoint covering the settled Open/Resolved append-only memo lifecycle, Barn Item vs Placement Item terminology, hosted audit-trail migration/functions, safe blank create/list state, Action Items Console hero/filter/list polish, corrected Clear Filters behavior, aligned and emphasized report locations, darker item/update blocks, landscape printing with larger type, the exact production-versus-local boundary, and the handoff to mobile Work Orders field testing

- `2026-07-12`
  - [FlockTrax_Mobile_Work_Orders_1_0_4_Test_Readiness_Checkpoint_2026-07-12.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_Work_Orders_1_0_4_Test_Readiness_Checkpoint_2026-07-12.md)
  - detailed pre-field-test checkpoint covering the two-mode Barn Care/Work Orders mobile design, farm-scoped Action Item queue and history workflow, hosted `action-items-list` function, completed iOS `1.0.4 (15)` and Android `1.0.4 (9)` builds, iOS TestFlight submission, Android Play credential blocker, verification and test checklist, humidity persistence confirmation, Git/GitHub backlog, and the agreed read-only calendars plus closed-flock performance scope before polish and release

- `2026-07-10`
  - [FlockTrax_Action_Items_Print_And_S2_Operational_State_Checkpoint_2026-07-10.md](C:\dev\FlockTrax\output\FlockTrax_Action_Items_Print_And_S2_Operational_State_Checkpoint_2026-07-10.md)
  - detailed implementation + production-deploy checkpoint covering the Action List print nesting fix for open-item update threads, report-route cache/revalidation hardening, the live `319-S2` vs `337-S2` mobile-state mismatch root cause, direct S2 operational-state repair, and the placement-editor lifecycle fix that now reuses authoritative operational RPCs

- `2026-07-08`
  - [FlockTrax_BinSentry_Density_Tools_And_Feed_Projection_Preflight_Checkpoint_2026-07-08.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_Density_Tools_And_Feed_Projection_Preflight_Checkpoint_2026-07-08.md)
  - detailed implementation + production-deploy checkpoint covering BinSentry feed-name fallback typing, feed-bin live density audit and push-back actions driven by `app_settings.BulkDensity`, the feed projection preflight warning gate, and the current shared server-side BinSentry auth model note for future multi-farm-group scaling

- `2026-07-03`
  - [FlockTrax_Localhost_Feed_Drop_Queue_And_Reconciliation_Filter_Checkpoint_2026-07-03.md](C:\dev\FlockTrax\output\FlockTrax_Localhost_Feed_Drop_Queue_And_Reconciliation_Filter_Checkpoint_2026-07-03.md)
  - detailed local working-tree checkpoint covering the official orphaned feed-drop queue model, preserved queued-source flock/bin/barn memory, the applied `queued_for_reconciliation` schema migration, hosted queue-aware feed-ticket function deploys, the production queue editor release already shipped earlier, and the still-local queued-drop console filter being held on localhost for real reconciliation shakeout

- `2026-07-01`
  - [FlockTrax_Reports_Hub_Quick_Access_And_Calendar_Report_Checkpoint_2026-07-01.md](C:\dev\FlockTrax\output\FlockTrax_Reports_Hub_Quick_Access_And_Calendar_Report_Checkpoint_2026-07-01.md)
  - detailed local working-tree checkpoint covering the reports-hub expansion into Quick Access and Detailed calendar reports, the renamed date-selectable `At-a-Glance` report, new month-grouped placement/livehaul packet layouts, detailed placements switching to final-processing-date calendar placement, month-by-month page breaks, and the latest calendar contrast/badge-readability refinements on localhost

### June 2026

- `2026-06-30`
  - [FlockTrax_Localhost_Closeout_Document_Archive_And_Feed_Projection_Checkpoint_2026-06-30.md](C:\dev\FlockTrax\output\FlockTrax_Localhost_Closeout_Document_Archive_And_Feed_Projection_Checkpoint_2026-06-30.md)
  - detailed local working-tree checkpoint covering localhost closeout document-archive stabilization, feed-ticket document icon/original-rule cleanup, feed-ticket audit-field follow-up, corrected 10-day/custom feed-projection rules, and the new clickable `Starter Oblg` math popup on the 10-day report

- `2026-06-25`
  - [FlockTrax_Localhost_Document_Archive_Recovery_And_Feed_Ticket_UI_Checkpoint_2026-06-25.md](C:\dev\FlockTrax\output\FlockTrax_Localhost_Document_Archive_Recovery_And_Feed_Ticket_UI_Checkpoint_2026-06-25.md)
  - detailed local working-tree checkpoint covering the localhost recovery of closeout document-archive uploads, the Next server-action upload-limit fix, livehaul/session crash hardening, closeout summary foreign-key correction, feed-ticket `Document IN` / `Document OUT` icon actions plus missing-badge exemptions, and the newly identified historical closeout negative-feed edge case that blocks `Save Closeout Draft` for incomplete early backfill flocks

- `2026-06-24`
  - [FlockTrax_Feed_Projection_Rule_Reset_And_Custom_Report_Planning_Checkpoint_2026-06-24.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Projection_Rule_Reset_And_Custom_Report_Planning_Checkpoint_2026-06-24.md)
  - local working-tree checkpoint covering the feed projection rule reset that removed the mistaken 12,000 lb arrival shortcut and the age-14 starter cutoff, split operational 10-day ordering logic from custom planning-only reports, tightened the collapsed projection matrix to fit on screen, and recorded the user decision to return to flock closeouts before any future truck-load builder work

- `2026-06-23`
  - [FlockTrax_Document_Archive_Placement_Closeout_And_Backfill_Checkpoint_2026-06-23.md](C:\dev\FlockTrax\output\FlockTrax_Document_Archive_Placement_Closeout_And_Backfill_Checkpoint_2026-06-23.md)
  - local working-tree checkpoint covering the document-archive expansion beyond feed tickets, including feed-ticket original backfill context, hatch/livehaul/summary/misc record-link decisions, compact closeout checklist consolidation, and the corrected placement-level livehaul packet model

- `2026-06-22`
  - [FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md](C:\dev\FlockTrax\output\FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md)
  - local working-tree checkpoint covering the new private Supabase Storage + `document_archives` metadata foundation, the first live feed-ticket archive workflow, protected signed-URL retrieval, and the compact `Missing` / `Filed` ticket-list status model for audit-original visibility

- `2026-06-20`
  - [FlockTrax_PC_Stability_Precaution_Checkpoint_2026-06-20.md](C:\dev\FlockTrax\output\FlockTrax_PC_Stability_Precaution_Checkpoint_2026-06-20.md)
  - precautionary local working-tree checkpoint captured because of severe PC/display instability, preserving the exact dirty tree and pointing back to the active June 17 feed-ordering, bin-layer-state, and load-reconciliation work path

- `2026-06-17`
  - [FlockTrax_Feed_Order_Reconciliation_And_Bin_Layer_State_Checkpoint_2026-06-17.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Reconciliation_And_Bin_Layer_State_Checkpoint_2026-06-17.md)
  - detailed local working-tree checkpoint covering the new layered feed-bin state schema, live-safe forward-only bin-layer inference from real feed-ticket drops, BinSentry quantity refresh for single-layer bins, and the new load-level feed-order receipt reconciliation model that matches actual delivered drops against compatible open loads without requiring the original planned drop sequence

- `2026-06-16`
  - [FlockTrax_Log_Weight_Report_And_Feed_Ticket_Scan_Storage_Checkpoint_2026-06-16.md](C:\dev\FlockTrax\output\FlockTrax_Log_Weight_Report_And_Feed_Ticket_Scan_Storage_Checkpoint_2026-06-16.md)
  - detailed local working-tree checkpoint covering the new placement `log_weight` vs `stdbreedspec` report flow across closeout/log-matrix/dashboard surfaces, plus the agreed private Supabase Storage + metadata-table direction for preserving original scanned feed-ticket audit documents

- `2026-06-12`
  - [FlockTrax_Admin_Release_5_6_Log_Matrix_And_Closeout_Production_Checkpoint_2026-06-12.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Release_5_6_Log_Matrix_And_Closeout_Production_Checkpoint_2026-06-12.md)
  - production release checkpoint covering deployed commit `05d982b`, hosted admin build marker `5.6`, Vercel deployment `dpl_DrihoboLnJmJxK2SXzWaEC2zoFP7`, the new placement log matrix editor, matrix usability refinements, legacy daily-boolean cleanup, closeout reporting refinements, and the feed audit report date-range fix

- `2026-06-11`
  - [FlockTrax_Web_Admin_Closeout_Report_And_Log_Editor_Backout_Checkpoint_2026-06-11.md](C:\dev\FlockTrax\output\FlockTrax_Web_Admin_Closeout_Report_And_Log_Editor_Backout_Checkpoint_2026-06-11.md)
  - detailed local working-tree checkpoint covering the full backout of the single-date admin `log_*` editor, preservation of the log-editor icon assets for future reuse, and the remaining in-flight closeout report/archive-summary processed-head variance plus feed-report page-break tweaks

- `2026-06-10`
  - [FlockTrax_Web_Admin_Closeout_Livehaul_Bird_Age_Checkpoint_2026-06-10.md](C:\dev\FlockTrax\output\FlockTrax_Web_Admin_Closeout_Livehaul_Bird_Age_Checkpoint_2026-06-10.md)
  - clean-state recovery checkpoint covering pushed `main` commit `3188df6`, the local tag `checkpoint-web-admin-2026-06-10-3188df6`, and the current closeout livehaul detail baseline that now shows bird age on the scheduled livehaul date

- `2026-06-09`
  - [FlockTrax_Admin_Release_5_5_Feed_Ordering_Reports_And_Scheduler_Production_Checkpoint_2026-06-09.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Release_5_5_Feed_Ordering_Reports_And_Scheduler_Production_Checkpoint_2026-06-09.md)
  - production release checkpoint covering commit `536ce94`, hosted admin build marker `5.5`, Vercel deployment `dpl_7LyMJxUEgT84SYTG18x5gvbotqtJ`, the feed-ordering/BinSentry database foundation, reports hub, scheduler fixes, closeout/feed-report corrections, and the reusable Sheets historical backfill baseline

- `2026-06-08`
  - [FlockTrax_Feed_Order_And_Sheets_Backfill_Consolidated_Checkpoint_2026-06-08.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Order_And_Sheets_Backfill_Consolidated_Checkpoint_2026-06-08.md)
  - consolidated resume checkpoint covering the current feed prediction / starter-grower ordering baseline, BinSentry inventory foundation, reusable Sheets historical backfill importer, five-flock reverse-sync import, and the required outbox cleanup rule for future historical imports

- `2026-06-08`
  - [FlockTrax_Sheets_Historical_Backfill_And_Outbox_Cleanup_Checkpoint_2026-06-08.md](C:\dev\FlockTrax\output\FlockTrax_Sheets_Historical_Backfill_And_Outbox_Cleanup_Checkpoint_2026-06-08.md)
  - operational checkpoint covering the reusable Google Sheets historical backfill importer, applied reverse-sync for `274-W6`, `286-W8`, `280-W1`, `278-W7`, and `272-W2`, the audited direct-write fallback for `created_by` constraints, and cleanup of all generated pending/rejected Sheets outbox rows

- `2026-06-07`
  - [FlockTrax_Scheduled_Flock_Juggle_And_Replacement_Transfer_Checkpoint_2026-06-07.md](C:\dev\FlockTrax\output\FlockTrax_Scheduled_Flock_Juggle_And_Replacement_Transfer_Checkpoint_2026-06-07.md)
  - operational checkpoint covering the direct `310-W5 -> 311-W5` replacement transfer, transferred delivered feed, corrected barn pointers, removed canceled flock `310`, and the still-unfinished scheduler-side reusable juggle UI

- `2026-06-07`
  - [FlockTrax_Feed_Order_Projection_First_Pass_Checkpoint_2026-06-07.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Projection_First_Pass_Checkpoint_2026-06-07.md)
  - implementation checkpoint covering the first-pass starter/grower projection split, day-14 starter cutoff, incoming-flock 12,000 lb minimum, scheduled-flock arrival handling, and the current report/dashboard surface area for feed-order validation

- `2026-06-07`
  - [FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.md)
  - design/spec checkpoint covering starter vs grower ordering rules, bin-level current feed type, type-aware inventory and order commitments, and the recommended FlockTrax-first architecture for BinSentry-backed feed ordering

- `2026-06-06`
  - [FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md)
  - detailed checkpoint covering live BinSentry credential login, paginated bin-ref discovery for all 22 bins, corrected kg-to-lb inventory sync, verified dashboard popup inventory, and the current feed-bin editor restructuring state

- `2026-06-06`
  - [FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md)
  - implementation checkpoint covering the feed-ordering foundation tables, placement-level inventory/on-order/recommended-order popup fields, feed-bin BinSentry mapping columns, and the first local BinSentry sync baseline

- `2026-06-04`
  - [FlockTrax_Admin_Dashboard_And_Placement_Scheduler_Polish_Checkpoint_2026-06-04.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Dashboard_And_Placement_Scheduler_Polish_Checkpoint_2026-06-04.md)
  - detailed checkpoint covering the placement scheduler farm-group selector and `All Farms` scope, the admin dashboard iPad/tile overflow fix, and the first-7 mortality popup summary layout cleanup with production deploys `GGtSdEqLi9VQdKDUrdQXpo4vDchZ`, `5v7D9oxfQW7jyvkgACvMDZ1f5bwT`, and `FPiYNBvdR6qRCKwazp1uT5n3oHp4`

- `2026-06-04`
  - [FlockTrax_Admin_Release_5_4_Closeout_And_Lifecycle_Production_Checkpoint_2026-06-04.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Release_5_4_Closeout_And_Lifecycle_Production_Checkpoint_2026-06-04.md)
  - production release checkpoint covering commit `14af6b8`, hosted admin build marker `5.4`, Vercel deployment `dpl_FWFfcY4LiEUWiioTZJ1ZghRL6s19`, the live closeout/livehaul/lifecycle baseline, the day-1 mortality rule correction, and the deployed legacy mortality-upsert compatibility cleanup

- `2026-06-03`
  - [FlockTrax_Digital_Archive_Summary_And_Report_Flow_Checkpoint_2026-06-03.md](C:\dev\FlockTrax\output\FlockTrax_Digital_Archive_Summary_And_Report_Flow_Checkpoint_2026-06-03.md)
  - detailed checkpoint covering the new `Save Digital Archive Summary` packet, manual-print archive flow, embedded first-7-day/livehaul/feed/flock-history sections, and the fix for flock-history matrix truncation inside the combined document

- `2026-06-03`
  - [FlockTrax_Closeout_Queue_Report_And_Placement_Scheduler_Checkpoint_2026-06-03.md](C:\dev\FlockTrax\output\FlockTrax_Closeout_Queue_Report_And_Placement_Scheduler_Checkpoint_2026-06-03.md)
  - detailed checkpoint covering the closeout queue matrix, worksheet sub-state checkboxes, closeout report livehaul/load ordering, placement scheduler fill-date fix, dashboard badge regression recovery, and the remaining `283-S2` livehaul discrepancy plus `75%` print-scale follow-up

### March 2026

- `2026-03-13`
  - [FlockTrax_Build_Checkpoint_2026-03-13.md](C:\dev\FlockTrax\output\FlockTrax_Build_Checkpoint_2026-03-13.md)
  - early build/setup checkpoint

- `2026-03-14`
  - [FlockTrax_Checkpoint_2026-03-14_Pause.md](C:\dev\FlockTrax\output\FlockTrax_Checkpoint_2026-03-14_Pause.md)
  - pause/resume checkpoint

- `2026-03-16`
  - [FlockTrax_Checkpoint_2026-03-16.md](C:\dev\FlockTrax\output\FlockTrax_Checkpoint_2026-03-16.md)
  - early project recovery checkpoint

- `2026-03-30`
  - [FlockTrax_Adalo_External_Collections_Checkpoint_2026-03-30.md](C:\dev\FlockTrax\output\FlockTrax_Adalo_External_Collections_Checkpoint_2026-03-30.md)
  - Adalo/external collections checkpoint

- `2026-03-31`
  - [FlockTrax_Night_Checkpoint_2026-03-31.md](C:\dev\FlockTrax\output\FlockTrax_Night_Checkpoint_2026-03-31.md)
  - night-stop checkpoint

### April 2026

- `2026-04-01`
  - [FlockTrax_Breakthrough_Checkpoint_2026-04-01.md](C:\dev\FlockTrax\output\FlockTrax_Breakthrough_Checkpoint_2026-04-01.md)
  - mobile/auth breakthrough checkpoint

- `2026-04-01`
  - [FlockTrax_Live_Data_Checkpoint_2026-04-01_PM.md](C:\dev\FlockTrax\output\FlockTrax_Live_Data_Checkpoint_2026-04-01_PM.md)
  - live-data wiring checkpoint

- `2026-04-01`
  - [FlockTrax_Web_Admin_Checkpoint_2026-04-01.md](C:\dev\FlockTrax\output\FlockTrax_Web_Admin_Checkpoint_2026-04-01.md)
  - web-admin checkpoint

- `2026-04-01`
  - [FlockTrax_Web_Admin_Branding_Checkpoint_2026-04-01_PM.md](C:\dev\FlockTrax\output\FlockTrax_Web_Admin_Branding_Checkpoint_2026-04-01_PM.md)
  - branding / app-registry checkpoint

- `2026-04-03`
  - [FlockTrax_Admin_Live_Dashboard_Checkpoint_2026-04-03.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Live_Dashboard_Checkpoint_2026-04-03.md)
  - admin live dashboard checkpoint

- `2026-04-04`
  - [FlockTrax_Mobile_Dashboard_Checkpoint_2026-04-04_Night.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_Dashboard_Checkpoint_2026-04-04_Night.md)
  - mobile dashboard checkpoint

- `2026-04-06`
  - [FlockTrax_Mobile_Checkpoint_2026-04-06_Evening.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_Checkpoint_2026-04-06_Evening.md)
  - mobile evening checkpoint

- `2026-04-06`
  - [FlockTrax_Mobile_Checkpoint_2026-04-06_LateNight.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_Checkpoint_2026-04-06_LateNight.md)
  - mobile late-night checkpoint

- `2026-04-11`
  - [FlockTrax_Web_Admin_Security_Checkpoint_2026-04-11.md](C:\dev\FlockTrax\output\FlockTrax_Web_Admin_Security_Checkpoint_2026-04-11.md)
  - web-admin security checkpoint

- `2026-04-13`
  - [FlockTrax_Web_Admin_Chat_Checkpoint_2026-04-13.md](C:\dev\FlockTrax\output\FlockTrax_Web_Admin_Chat_Checkpoint_2026-04-13.md)
  - web-admin chat checkpoint

- `2026-04-15`
  - [FlockTrax_Placement_Scheduler_Checkpoint_2026-04-15_PM.md](C:\dev\FlockTrax\output\FlockTrax_Placement_Scheduler_Checkpoint_2026-04-15_PM.md)
  - placement scheduler checkpoint

- `2026-04-15`
  - [FARM-STRUCTURE-CHECKPOINT-2026-04-15.md](C:\dev\FlockTrax\web-admin\FARM-STRUCTURE-CHECKPOINT-2026-04-15.md)
  - farm structure checkpoint
  - location: outside `output`

- `2026-04-16`
  - [FlockTrax_Placement_Wizard_Checkpoint_2026-04-16_PM.md](C:\dev\FlockTrax\output\FlockTrax_Placement_Wizard_Checkpoint_2026-04-16_PM.md)
  - placement wizard checkpoint

- `2026-04-17`
  - [FlockTrax_Alpha_Reset_And_Mobile_Checkpoint_2026-04-17_PM.md](C:\dev\FlockTrax\output\FlockTrax_Alpha_Reset_And_Mobile_Checkpoint_2026-04-17_PM.md)
  - alpha reset / mobile checkpoint

- `2026-04-17`
  - [FlockTrax_Dashboard_State_Checkpoint_2026-04-17_PM.md](C:\dev\FlockTrax\output\FlockTrax_Dashboard_State_Checkpoint_2026-04-17_PM.md)
  - dashboard state checkpoint

- `2026-04-20`
  - [FlockTrax_Sync_Engine_Checkpoint_2026-04-20_PM.md](C:\dev\FlockTrax\output\FlockTrax_Sync_Engine_Checkpoint_2026-04-20_PM.md)
  - sync engine checkpoint

- `2026-04-20`
  - [FlockTrax_Sync_Worker_Checkpoint_2026-04-20_PM.md](C:\dev\FlockTrax\output\FlockTrax_Sync_Worker_Checkpoint_2026-04-20_PM.md)
  - sync worker checkpoint

- `2026-04-20`
  - [FlockTrax_Sync_Readback_Checkpoint_2026-04-20_PM.md](C:\dev\FlockTrax\output\FlockTrax_Sync_Readback_Checkpoint_2026-04-20_PM.md)
  - sync readback checkpoint

- `2026-04-20`
  - [FlockTrax_Full_System_Compile_Deploy_Checkpoint_2026-04-20_PM.md](C:\dev\FlockTrax\output\FlockTrax_Full_System_Compile_Deploy_Checkpoint_2026-04-20_PM.md)
  - full system compile/deploy checkpoint

- `2026-04-20`
  - [FlockTrax_Dashboard_Weight_And_Sync_Checkpoint_2026-04-20_PM.md](C:\dev\FlockTrax\output\FlockTrax_Dashboard_Weight_And_Sync_Checkpoint_2026-04-20_PM.md)
  - dashboard/weight/sync checkpoint

- `2026-04-21`
  - [FlockTrax_Admin_Sync_Historical_Entry_Checkpoint_2026-04-21_PM.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Sync_Historical_Entry_Checkpoint_2026-04-21_PM.md)
  - admin sync / historical entry checkpoint

- `2026-04-22`
  - [FlockTrax_Admin_Placement_Dashboard_AppStore_Checkpoint_2026-04-22_PM.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Placement_Dashboard_AppStore_Checkpoint_2026-04-22_PM.md)
  - admin placement dashboard / App Store checkpoint

- `2026-04-23`
  - [FlockTrax_Rollout_FeedTicket_Checkpoint_2026-04-23_AM.md](C:\dev\FlockTrax\output\FlockTrax_Rollout_FeedTicket_Checkpoint_2026-04-23_AM.md)
  - feed-ticket rollout checkpoint

- `2026-04-23`
  - [FlockTrax_Release_AppStore_Play_Checkpoint_2026-04-23_PM.md](C:\dev\FlockTrax\output\FlockTrax_Release_AppStore_Play_Checkpoint_2026-04-23_PM.md)
  - App Store / Play release checkpoint

- `2026-04-24`
  - [FlockTrax_Release_Submission_Checkpoint_2026-04-24_AM.md](C:\dev\FlockTrax\output\FlockTrax_Release_Submission_Checkpoint_2026-04-24_AM.md)
  - release submission checkpoint

- `2026-04-25`
  - [FlockTrax_Release_Recovery_Checkpoint_2026-04-25_AM.md](C:\dev\FlockTrax\output\FlockTrax_Release_Recovery_Checkpoint_2026-04-25_AM.md)
  - release recovery checkpoint

- `2026-04-25`
  - [FlockTrax_App_Store_Submitted_Checkpoint_2026-04-25_PM.md](C:\dev\FlockTrax\output\FlockTrax_App_Store_Submitted_Checkpoint_2026-04-25_PM.md)
  - App Store submitted checkpoint

- `2026-04-28`
  - [FlockTrax_Apple_Review_Login_Investigation_Checkpoint_2026-04-28_PM.md](C:\dev\FlockTrax\output\FlockTrax_Apple_Review_Login_Investigation_Checkpoint_2026-04-28_PM.md)
  - Apple review login investigation checkpoint

- `2026-04-28`
  - [FlockTrax_Android_And_Mortality_Popup_Checkpoint_2026-04-28_PM.md](C:\dev\FlockTrax\output\FlockTrax_Android_And_Mortality_Popup_Checkpoint_2026-04-28_PM.md)
  - Android + mortality popup checkpoint

- `2026-04-30`
  - [FlockTrax_FeedTicket_Editor_Checkpoint_2026-04-30_PM.md](C:\dev\FlockTrax\output\FlockTrax_FeedTicket_Editor_Checkpoint_2026-04-30_PM.md)
  - feed-ticket editor checkpoint

### May 2026

- `2026-05-01`
  - [FlockTrax_Weekend_Checkpoint_2026-05-01_PM.md](C:\dev\FlockTrax\output\FlockTrax_Weekend_Checkpoint_2026-05-01_PM.md)
  - weekend checkpoint: iOS build 8, Android first-store path, feed-ticket historical resolution, outbox cleanup, flicker investigation
  - source: recovered from Codex local session history

- `2026-05-02`
  - [FlockTrax_Weekend_Checkpoint_2026-05-02_AM.md](C:\dev\FlockTrax\output\FlockTrax_Weekend_Checkpoint_2026-05-02_AM.md)
  - weekend checkpoint: iOS waiting for review, Android next steps, live web-admin fix status
  - source: recovered from Codex local session history

- `2026-05-03`
  - [FlockTrax_Recovery_Checkpoint_2026-05-03_AM.md](C:\dev\FlockTrax\output\FlockTrax_Recovery_Checkpoint_2026-05-03_AM.md)
  - reconstructed recovery checkpoint from current repo state

- `2026-05-03`
  - [FlockTrax_Weekend_Checkpoint_2026-05-03_Build9.md](C:\dev\FlockTrax\output\FlockTrax_Weekend_Checkpoint_2026-05-03_Build9.md)
  - weekend checkpoint: build 9 fix, Supabase anon-key fallback, successful TestFlight verification
  - source: recovered from Codex local session history

- `2026-05-04`
  - [FlockTrax_Release_Track_Checkpoint_2026-05-04.md](C:\dev\FlockTrax\output\FlockTrax_Release_Track_Checkpoint_2026-05-04.md)
  - release-only checkpoint before Apple review result

- `2026-05-05`
  - [FlockTrax_Release_Lightweight_Checkpoint_2026-05-05.md](C:\dev\FlockTrax\output\FlockTrax_Release_Lightweight_Checkpoint_2026-05-05.md)
  - lightweight release checkpoint while iOS build 10 was waiting for review

- `2026-05-06`
  - [FlockTrax_Play_Release_Readiness_2026-05-06.md](C:\dev\FlockTrax\output\FlockTrax_Play_Release_Readiness_2026-05-06.md)
  - Play release readiness audit and remaining blockers

- `2026-05-06`
  - [FlockTrax_Play_Submission_Pack_2026-05-06.md](C:\dev\FlockTrax\output\FlockTrax_Play_Submission_Pack_2026-05-06.md)
  - Play Console submission pack draft, store copy, app access, and data safety guidance

- `2026-05-06`
  - [FlockTrax_Release_Lightweight_Checkpoint_2026-05-06.md](C:\dev\FlockTrax\output\FlockTrax_Release_Lightweight_Checkpoint_2026-05-06.md)
  - lightweight release checkpoint after Apple approval and App Store go-live

- `2026-05-07`
  - [FlockTrax_Issues_System_Checkpoint_2026-05-07.md](C:\dev\FlockTrax\output\FlockTrax_Issues_System_Checkpoint_2026-05-07.md)
  - first forward-only issues/open-items implementation checkpoint

- `2026-05-07`
  - [FlockTrax_Open_Items_Product_Direction_Checkpoint_2026-05-07.md](C:\dev\FlockTrax\output\FlockTrax_Open_Items_Product_Direction_Checkpoint_2026-05-07.md)
  - product-direction checkpoint for evolving open items into a maintenance / operational tracking system with threaded updates and printable repair reporting

- `2026-05-11`
  - [FlockTrax_Open_Items_Console_Checkpoint_2026-05-11.md](C:\dev\FlockTrax\output\FlockTrax_Open_Items_Console_Checkpoint_2026-05-11.md)
  - storm-safe checkpoint for the live `Open Items` console, current layout progress, and next-step mockup refinement

- `2026-05-11`
  - [FlockTrax_Action_Items_Detailed_Checkpoint_2026-05-11.md](C:\dev\FlockTrax\output\FlockTrax_Action_Items_Detailed_Checkpoint_2026-05-11.md)
  - detailed Action Items checkpoint covering live URLs, data model, admin-console layout, resolved-item rules, action-type maintenance, dashboard handoff behavior, and the next status/workflow step

- `2026-05-11`
  - [FlockTrax_Release_And_Auth_Detailed_Checkpoint_2026-05-11.md](C:\dev\FlockTrax\output\FlockTrax_Release_And_Auth_Detailed_Checkpoint_2026-05-11.md)
  - detailed release/auth checkpoint covering the live Action Items state, custom SMTP invite flow, existing-user password setup fix, super-admin user deletion, current mobile hardening status, and the next iOS/Android release steps

- `2026-05-11 PM`
  - [FlockTrax_Release_Build13_Checkpoint_2026-05-11_PM.md](C:\dev\FlockTrax\output\FlockTrax_Release_Build13_Checkpoint_2026-05-11_PM.md)
  - short release baseline after repo snapshot commit, fresh repo-backed admin deploy, and iOS `1.0.2 (13)` submission to TestFlight

- `2026-05-12`
  - [FlockTrax_Testing_Issue_List_2026-05-12.md](C:\dev\FlockTrax\output\FlockTrax_Testing_Issue_List_2026-05-12.md)
  - active testing punch list for issues discovered during validation before the next coding pass

- `2026-05-18`
  - [FlockTrax_Web_Admin_UI_Polish_Checkpoint_2026-05-18.md](C:\dev\FlockTrax\output\FlockTrax_Web_Admin_UI_Polish_Checkpoint_2026-05-18.md)
  - web-admin UI polish checkpoint covering split placement-tile badges, cyan Action Items selected-row styling, Barn View `LH` calendar markers, and the production deployment ids for those releases

- `2026-05-18`
  - [FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md](C:\dev\FlockTrax\output\FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md)
  - flock history report checkpoint covering the new print/PDF matrix report, report launch points, app_settings-driven titles, mortality rollups, and local verification state

- `2026-05-18`
  - [FlockTrax_Project_Wide_Detailed_Checkpoint_2026-05-18.md](C:\dev\FlockTrax\output\FlockTrax_Project_Wide_Detailed_Checkpoint_2026-05-18.md)
  - crash-safe full-project checkpoint covering live deployment state, repo branch/HEAD, exact dirty-worktree file list, local-only mobile/web-admin/supabase changes, and reboot recovery guidance

- `2026-05-18`
  - [FlockTrax_Release_5_0_Git_Baseline_Checkpoint_2026-05-18.md](C:\dev\FlockTrax\output\FlockTrax_Release_5_0_Git_Baseline_Checkpoint_2026-05-18.md)
  - release baseline checkpoint covering commit `df64dfd`, production deployment `dpl_9DiCtGz39vTGyRhzTG7z2pCAcsFD`, hosted admin build marker `5.0`, and the now-filed git-backed clean-start state

- `2026-05-19`
  - [FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md](C:\dev\FlockTrax\output\FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md)
  - detailed sync checkpoint covering the live web deploy and Supabase function deploys, hosted build marker `5.1`, the live feed/ODA changes, and the still-local invite-flow plus `Micro Archive Copy` work

- `2026-05-25`
  - [FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md)
  - planning-only checkpoint covering the BinSentry 10-day forecast popup concept, projection lifecycle/storage direction, the `forecast + verification + correction` workflow, and the local-only live-haul feed-projection bug fix

- `2026-05-25`
  - [FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md)
  - implementation-plan-only mini spec for the popup, BinSentry data needs, feed balance logic, projection persistence, and phased development lifecycle

- `2026-05-26`
  - [FlockTrax_Mobile_Historical_Entry_And_After_Save_Flags_Checkpoint_2026-05-26.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_Historical_Entry_And_After_Save_Flags_Checkpoint_2026-05-26.md)
  - mobile execution checkpoint covering the new `after_save_goback` setting, the separation from `allow_historical_entry`, disabled date-picking when historical entry is off, and successful mobile typecheck validation

- `2026-05-26`
  - [FlockTrax_Mobile_1_0_3_Build14_Submission_Checkpoint_2026-05-26.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_1_0_3_Build14_Submission_Checkpoint_2026-05-26.md)
  - mobile release checkpoint covering iOS version `1.0.3`, EAS build `14`, the hosted `mobile_ios` platform-control bump, and the scheduled App Store Connect submission

- `2026-05-27`
  - [FlockTrax_Feed_Ticket_Print_Report_Production_Checkpoint_2026-05-27.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Ticket_Print_Report_Production_Checkpoint_2026-05-27.md)
  - production checkpoint covering the new feed ticket print report, ticket-type metadata wiring, Vercel deployment `dpl_2tmNf8TVhpo4Z433Gcrr5RuMy2BZ`, and hosted admin build marker `5.2`

- `2026-05-28`
  - [FlockTrax_Action_Items_Work_Order_Production_Checkpoint_2026-05-28.md](C:\dev\FlockTrax\output\FlockTrax_Action_Items_Work_Order_Production_Checkpoint_2026-05-28.md)
  - production checkpoint covering action-item list/work-order reporting, flock-history action-item print expansion, Vercel deployment `dpl_6Dq8Zrp1XbadeP43ZiktbE3S6uht`, and hosted admin build marker `5.3`

# Latest Checkpoint

- `2026-06-23`
  - [FlockTrax_Document_Archive_Placement_Closeout_And_Backfill_Checkpoint_2026-06-23.md](C:\dev\FlockTrax\output\FlockTrax_Document_Archive_Placement_Closeout_And_Backfill_Checkpoint_2026-06-23.md)
  - current best resume point for the document-archive expansion path, including feed-ticket backfill context, placement/dashboard/closeout archive hooks, the single-checklist closeout archive UI, and the corrected one-per-placement livehaul packet model

- `2026-06-22`
  - [FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md](C:\dev\FlockTrax\output\FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md)
  - current best resume point for the new document-archive work, including the private Storage bucket, `document_archives` metadata table, first feed-ticket upload/open flow, and the next-step path for extending archive coverage to placements, livehaul, and closeout records

- `2026-06-20`
  - [FlockTrax_PC_Stability_Precaution_Checkpoint_2026-06-20.md](C:\dev\FlockTrax\output\FlockTrax_PC_Stability_Precaution_Checkpoint_2026-06-20.md)
  - current best crash-safe resume point when the local machine is unstable, with explicit restart guidance back into the June 17 feed-ordering and receipt-reconciliation path

- `2026-06-17`
  - [FlockTrax_Feed_Order_Reconciliation_And_Bin_Layer_State_Checkpoint_2026-06-17.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Reconciliation_And_Bin_Layer_State_Checkpoint_2026-06-17.md)
  - current best resume point for the feed project and ordering recommendations path, including layered feed-bin state, live BinSentry quantity refresh, forward-only feed-ticket layer inference, and load-level receipt reconciliation against compatible open feed orders

- `2026-06-16`
  - [FlockTrax_Log_Weight_Report_And_Feed_Ticket_Scan_Storage_Checkpoint_2026-06-16.md](C:\dev\FlockTrax\output\FlockTrax_Log_Weight_Report_And_Feed_Ticket_Scan_Storage_Checkpoint_2026-06-16.md)
  - current best resume point for the new placement `log_weight` report flow and the agreed original scanned-ticket archive direction using private Supabase Storage plus immutable metadata rows

- `2026-06-09`
  - [FlockTrax_Admin_Release_5_5_Feed_Ordering_Reports_And_Scheduler_Production_Checkpoint_2026-06-09.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Release_5_5_Feed_Ordering_Reports_And_Scheduler_Production_Checkpoint_2026-06-09.md)
  - current best single resume point for the live `5.5` admin baseline, production deployment, feed-ordering/BinSentry foundation, reports hub, scheduler/juggle fixes, closeout/report corrections, and Sheets historical backfill tooling

- `2026-06-07`
  - [FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.md)
  - current best design reference for starter/grower-aware feed ordering, explicit bin feed type, and the next schema/business-rule phase on top of the live BinSentry inventory foundation

- `2026-06-06`
  - [FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md)
  - current best resume point for the live BinSentry sync proof, all-bin ref mapping, corrected inventory conversion, verified dashboard popup inventory, and the current feed-bin editor layout work

- `2026-06-06`
  - [FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md)
  - current best resume point for the first feed-ordering foundation, new inventory/on-order/recommended-order popup logic, and the local BinSentry mapping/sync baseline

- `2026-06-02`
  - [FlockTrax_Closeout_Report_Livehaul_Target_Sex_And_Archive_Recovery_Checkpoint_2026-06-02.md](C:\dev\FlockTrax\output\FlockTrax_Closeout_Report_Livehaul_Target_Sex_And_Archive_Recovery_Checkpoint_2026-06-02.md)
  - current best resume point for the new printable closeout report, `All Barns` scheduler behavior, `282-W5` archive recovery, and sex-targeted livehaul breed comparison

- `2026-06-02`
  - [FlockTrax_Closeout_Worksheet_And_Report_Links_Detailed_Checkpoint_2026-06-02.md](C:\dev\FlockTrax\output\FlockTrax_Closeout_Worksheet_And_Report_Links_Detailed_Checkpoint_2026-06-02.md)
  - current best resume point for the live `placement_closeouts` table, saveable closeout worksheet, livehaul-date breed comparison, first-7-day mortality correction, and closeout report/popup links

- `2026-05-31`
  - [FlockTrax_Lifecycle_Livehaul_Closeout_Detailed_Checkpoint_2026-05-31.md](C:\dev\FlockTrax\output\FlockTrax_Lifecycle_Livehaul_Closeout_Detailed_Checkpoint_2026-05-31.md)
  - current best resume point for the live lifecycle-stage migration, two-table livehaul model, local scheduler/closeout UI, and corrected feed-estimator behavior

- `2026-05-30`
  - [FlockTrax_Admin_Hotfixes_And_Android_Build_Checkpoint_2026-05-30.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Hotfixes_And_Android_Build_Checkpoint_2026-05-30.md)
  - current best resume point for the admin hotfix deploys, Android build `8`, and Google Play submission readiness blocker

- `2026-05-29`
  - [FlockTrax_Off_Farm_Feed_Redirect_Production_Checkpoint_2026-05-29.md](C:\dev\FlockTrax\output\FlockTrax_Off_Farm_Feed_Redirect_Production_Checkpoint_2026-05-29.md)
  - current best resume point for the off-farm feed redirect production rollout and feed-ticket handling baseline

- `2026-05-28`
  - [FlockTrax_Action_Items_Work_Order_Production_Checkpoint_2026-05-28.md](C:\dev\FlockTrax\output\FlockTrax_Action_Items_Work_Order_Production_Checkpoint_2026-05-28.md)
  - current best resume point for the action-item report/work-order production release and hosted admin build marker `5.3`

## Notes

- The recovered May 1 to May 3 weekend checkpoints were not originally present as `.md` files in the repo output folder.
- They were recovered from Codex local history under:
  - `C:\Users\Ken\.codex\sessions\...`
- This index is a navigation aid, not a source-of-truth changelog. For exact state, use the checkpoint file itself plus `git status`.

## Recommended Active Baseline

If the topic is the mobile daily-log save flow or historical-entry behavior, load first:

- [FlockTrax_Mobile_Historical_Entry_And_After_Save_Flags_Checkpoint_2026-05-26.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_Historical_Entry_And_After_Save_Flags_Checkpoint_2026-05-26.md)

Reason:
- it is the most current execution checkpoint
- it documents the exact mobile behavior split now implemented locally
- it points directly to the touched mobile and Supabase function files

If the topic is the iOS mobile release that was just cut, load first:

- [FlockTrax_Mobile_1_0_3_Build14_Submission_Checkpoint_2026-05-26.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_1_0_3_Build14_Submission_Checkpoint_2026-05-26.md)

Reason:
- it captures the actual EAS build id, artifact link, submission link, and hosted `mobile_ios` release marker
- it records the exact repo commit used for the build
- it documents the remaining manual confirmation point in App Store Connect

If the topic is the current Android mobile build, Play Store submission readiness, or the newest admin hotfix baseline, load first:

- [FlockTrax_Admin_Hotfixes_And_Android_Build_Checkpoint_2026-05-30.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Hotfixes_And_Android_Build_Checkpoint_2026-05-30.md)

Reason:
- it is the newest checkpoint
- it captures the current production admin console state after the feed-ticket recovery, live clock, and sync-outbox error-detail deploys
- it records the exact Android EAS build id and the remaining Google Play service-account blocker preventing submission

If the topic is BinSentry forecasting or feed-projection planning, load first:

- [FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.md)

Reason:
- it is the current design reference for turning the total-feed model into starter/grower-aware ordering
- it defines the schema additions, backfill strategy, source-of-truth split, and phased implementation plan
- it should be paired with the June 6 live BinSentry execution checkpoint before implementation work continues

- [FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md)

Reason:
- it is now the best resume point for this branch
- it captures the live BinSentry proof, corrected inventory conversion, all 22 mapped refs, and the current feed-bin editor/UI state
- it records that the dashboard popup appears to reflect correct live inventory after sync

- [FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md)

Reason:
- use this one second for the earlier same-day implementation baseline
- it captures the first implemented feed-ordering foundation, the new inventory/on-order/recommended-order popup logic, and the initial local BinSentry mapping/sync path
- it explicitly records the Supabase migration baseline that the later live-sync checkpoint builds on

- [FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md)

Reason:
- it is the most current checkpoint
- it captures the agreed planning direction without prematurely moving into implementation
- it links the planning spec to the broader May 19 execution baseline

If the topic is feed ticket reporting, ticket printing, or the admin production release that just went live, load first:

- [FlockTrax_Feed_Ticket_Print_Report_Production_Checkpoint_2026-05-27.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Ticket_Print_Report_Production_Checkpoint_2026-05-27.md)

Reason:
- it captures the exact deployed commit, Vercel deployment id, and live `flocktrax.com` alias state
- it records the hosted admin build marker bump to `5.2`
- it documents the remaining Supabase migration-repair auth issue so it does not get rediscovered the hard way

If the topic is feed-ticket drop redirection, emergency off-farm feed handling, or the newest feed-ticket production baseline, load first:

- [FlockTrax_Off_Farm_Feed_Redirect_Production_Checkpoint_2026-05-29.md](C:\dev\FlockTrax\output\FlockTrax_Off_Farm_Feed_Redirect_Production_Checkpoint_2026-05-29.md)

Reason:
- it is the newest checkpoint
- it captures the committed and deployed off-farm redirect rollout for shared feed-ticket handling
- it clearly records the release boundary that web-admin and Supabase are live while mobile source is updated but not yet built for users

If the topic is action items, work-order printing, flock-history action-item pages, or the current admin production baseline, load first:

- [FlockTrax_Action_Items_Work_Order_Production_Checkpoint_2026-05-28.md](C:\dev\FlockTrax\output\FlockTrax_Action_Items_Work_Order_Production_Checkpoint_2026-05-28.md)

Reason:
- it is the newest production checkpoint
- it captures the exact deployed commit, Vercel deployment id, and hosted admin build marker `5.3`
- it records both the action-list/work-order print flows and the current unresolved Supabase migration-repair caveat

If only one execution-state checkpoint should be loaded first right now, use:

- [FlockTrax_Admin_Release_5_5_Feed_Ordering_Reports_And_Scheduler_Production_Checkpoint_2026-06-09.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Release_5_5_Feed_Ordering_Reports_And_Scheduler_Production_Checkpoint_2026-06-09.md)

Reason:
- it is the newest checkpoint
- it captures the exact pushed commit, Vercel deployment id, live `flocktrax.com` alias state, and hosted admin build marker `5.5`
- it ties together the feed-ordering/BinSentry baseline, reports hub, scheduler fixes, closeout/report corrections, and historical Sheets backfill tooling in one production checkpoint

- [FlockTrax_Admin_Release_5_4_Closeout_And_Lifecycle_Production_Checkpoint_2026-06-04.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Release_5_4_Closeout_And_Lifecycle_Production_Checkpoint_2026-06-04.md)

Reason:
- use this one second for the earlier `5.4` closeout/lifecycle production baseline
- it records the original live closeout, livehaul, lifecycle, archive-summary, and day-1 mortality-rule release before the later June 9 feed-ordering/reporting expansion

- [FlockTrax_Closeout_Worksheet_And_Report_Links_Detailed_Checkpoint_2026-06-02.md](C:\dev\FlockTrax\output\FlockTrax_Closeout_Worksheet_And_Report_Links_Detailed_Checkpoint_2026-06-02.md)

Reason:
- use this one second for the earlier June 2 closeout worksheet baseline
- it captures the live `placement_closeouts` database step plus the current closeout-screen execution model
- it records the corrected feed-accounting rule, livehaul-date breed comparison rule, first-7-day mortality meaning, and the report-launch shortcuts

- [FlockTrax_Lifecycle_Livehaul_Closeout_Detailed_Checkpoint_2026-05-31.md](C:\dev\FlockTrax\output\FlockTrax_Lifecycle_Livehaul_Closeout_Detailed_Checkpoint_2026-05-31.md)

Reason:
- use this one second for the earlier lifecycle/livehaul baseline
- it captures the current flock-lifecycle execution state across live schema changes, local admin UI work, and corrected feed-estimator behavior
- it makes the local-versus-live boundary explicit so the next chat does not rediscover it the hard way

- [FlockTrax_Admin_Hotfixes_And_Android_Build_Checkpoint_2026-05-30.md](C:\dev\FlockTrax\output\FlockTrax_Admin_Hotfixes_And_Android_Build_Checkpoint_2026-05-30.md)

Reason:
- use this one instead only if the resumed topic is specifically the Android build / Google Play submission blocker

For broader system state beyond the report feature, also use:

- [FlockTrax_Web_Admin_UI_Polish_Checkpoint_2026-05-18.md](C:\dev\FlockTrax\output\FlockTrax_Web_Admin_UI_Polish_Checkpoint_2026-05-18.md)

- [FlockTrax_Master_Checkpoint_2026-05-16_PM.md](C:\dev\FlockTrax\output\FlockTrax_Master_Checkpoint_2026-05-16_PM.md)

For the shorter build-cut baseline specifically, also use:

- [FlockTrax_Release_Build13_Checkpoint_2026-05-11_PM.md](C:\dev\FlockTrax\output\FlockTrax_Release_Build13_Checkpoint_2026-05-11_PM.md)
