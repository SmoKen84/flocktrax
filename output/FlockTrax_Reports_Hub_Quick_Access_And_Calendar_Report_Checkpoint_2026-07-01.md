# FlockTrax Reports Hub Quick Access And Calendar Report Checkpoint

Date: `2026-07-01`
Environment: `localhost:3001`
Workspace: `C:\dev\FlockTrax`
Primary app area: `web-admin`
Checkpoint type: detailed local working-tree checkpoint

## Purpose

Capture the current in-progress state of the reports-hub expansion so work can resume later without losing:

- the new calendar-style report framework
- the new Quick Access and Detailed report entries
- the date-filter/range-filter behavior now wired into the reports hub
- the latest report-layout and printability refinements requested during live UI review

## High-Level Status

The Reports area has moved beyond the original feed reports and now includes a first-pass calendar-report system for:

- `At-a-Glance`
- `Placements Report` under `Quick Access Reports`
- `Livehaul Report` under `Quick Access Reports`
- `Placements Report` under `Detailed Reports`
- `Livehaul Report` under `Detailed Reports`

This work is currently local-only in the working tree and verified with TypeScript typecheck after each major report update.

## What Was Added

### 1. Reports hub expansion

The reports hub now supports multiple categories with matching preview routes:

- `Quick Access Reports`
  - `At-a-Glance`
  - `Placements Report`
  - `Livehaul Report`
- `Detailed Reports`
  - `Placements Report`
  - `Livehaul Report`
- existing `Feed Reports` remain in place

Primary hub files updated:

- `C:\dev\FlockTrax\web-admin\app\admin\reports\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\reports-filter-panel.tsx`

### 2. New shared calendar-report data/rendering foundation

New shared/local report helpers were added so report pages can group results by month and render a month-at-a-glance grid with a lower detail section:

- `C:\dev\FlockTrax\web-admin\lib\report-calendar.ts`
- `C:\dev\FlockTrax\web-admin\lib\livehaul-calendar-report-data.ts`
- `C:\dev\FlockTrax\web-admin\lib\placements-calendar-report-data.ts`

This framework currently handles:

- month collection from date ranges
- calendar-day badge placement
- month-by-month report packaging
- print page breaks between months

### 3. New report pages

New pages created:

- `C:\dev\FlockTrax\web-admin\app\admin\reports\livehaul-quick-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\livehaul-detailed\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\placements-quick-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\placements-detailed\page.tsx`

These pages currently support:

- report preview from the hub
- print/save PDF action
- farm group / farm / barn / flock scope filters
- month-grouped calendar sections
- lower detail sections per month

## Business Rules / UX Decisions Captured Today

### At-a-Glance naming/date behavior

The former `Today At-a-Glance` direction was changed to:

- report name: `At-a-Glance`
- default selected date: today
- user can select any prior date using a date picker

### Quick Access vs Detailed date rules

Quick Access report behavior:

- uses `From Date` and `To Date`
- intended for today-forward / scheduled visibility
- compact lower detail sections

Detailed report behavior:

- uses the same date-range pattern
- intended for past/historical review
- includes deeper detail such as livehaul load rows or closeout-derived placement metrics

### Detailed placements date anchor rule

The `Detailed Placements Report` calendar no longer keys off `placedDate`.

It now uses:

- `final processing date` / `date_removed` as the calendar placement and month grouping date

And still shows:

- `Placed Date` in the detailed lower record section

### Placements calendar badge label rule

Placement calendar badges now show the full placement key such as:

- `123-W1`

instead of only showing a barn code.

### Compact in-block report labeling

To keep the month calendar block from splitting awkwardly across pages, the large page-header block was removed from the four new calendar reports and replaced with compact centered labels inside the report block:

- `Placements - Schedule`
- `Placements - Detail`
- `Livehaul - Schedule`
- `Livehaul - Detail`

The top toolbar is hidden during print so it does not consume vertical space.

### Page-break behavior

All month-based placement/livehaul reports now apply page breaks between months so each month prints as a separate packet section.

### Calendar contrast/readability refinement

Calendar reports were visually strengthened for both screen and print:

- darker month block borders
- darker day-cell outlines
- stronger weekday text
- stronger badge contrast
- print-specific darker borders

The placement badge font was also increased and made bolder for readability.

## Current Detailed Report Content

### Quick Access Placements Report

Calendar date basis:

- scheduled/placed date

Lower detail currently shows compact planning data such as:

- placement date
- barn
- head to place
- estimated first livehaul

### Detailed Placements Report

Calendar date basis:

- final processing date

Lower detail currently shows:

- placed date
- final process date
- total head placed
- processed head
- average weight
- feed consumed
- feed conversion

### Quick Access Livehaul Report

Calendar date basis:

- livehaul scheduled date

Lower detail currently shows compact scheduled data such as:

- placement
- sequence
- target sex
- proposed catch / head target

### Detailed Livehaul Report

Calendar date basis:

- livehaul date

Lower detail currently shows:

- placement
- target vs actual head
- load count / total DOA
- actual date
- nested recorded load-detail table

## Main Files Touched During This Report Cycle

Core hub/filter files:

- `C:\dev\FlockTrax\web-admin\app\admin\reports\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\reports-filter-panel.tsx`

At-a-Glance:

- `C:\dev\FlockTrax\web-admin\app\admin\reports\today-at-a-glance\page.tsx`
- `C:\dev\FlockTrax\web-admin\lib\today-at-a-glance-report-data.ts`

New calendar report pages/data:

- `C:\dev\FlockTrax\web-admin\app\admin\reports\livehaul-quick-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\livehaul-detailed\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\placements-quick-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\placements-detailed\page.tsx`
- `C:\dev\FlockTrax\web-admin\lib\livehaul-calendar-report-data.ts`
- `C:\dev\FlockTrax\web-admin\lib\placements-calendar-report-data.ts`
- `C:\dev\FlockTrax\web-admin\lib\report-calendar.ts`

Styling:

- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Verification Performed

Repeated verification run locally:

```powershell
npm run typecheck
```

Status:

- passed after the report-hub expansion
- passed after the detailed placements date-anchor change
- passed after header removal / compact title insertion
- passed after month page-break standardization
- passed after calendar badge contrast/font refinements

## Known State / Limitations At This Checkpoint

- This is still local working-tree work and has not been cleaned into a commit yet.
- The reports are first-pass implementations and may still need layout tightening once they are used across more real-world date ranges.
- The livehaul and placement reports are intentionally compact, but likely still need a second round of business-rule refinement once actual printed packets are reviewed.
- The broader repo is still a dirty tree containing unrelated ongoing work from closeout/document-archive/feed-ticket/reporting threads.

## Dirty Worktree Snapshot (high-level)

In addition to the new reports work, the repo still contains in-flight local changes related to:

- feed-ticket audit field work
- document archive / closeout work
- feed projection report refinements
- dashboard and session-recovery behavior

Notable report-related uncommitted additions/modifications include:

- `web-admin/app/admin/reports/livehaul-detailed/`
- `web-admin/app/admin/reports/livehaul-quick-access/`
- `web-admin/app/admin/reports/placements-detailed/`
- `web-admin/app/admin/reports/placements-quick-access/`
- `web-admin/app/admin/reports/today-at-a-glance/`
- `web-admin/lib/livehaul-calendar-report-data.ts`
- `web-admin/lib/placements-calendar-report-data.ts`
- `web-admin/lib/report-calendar.ts`
- `web-admin/lib/today-at-a-glance-report-data.ts`
- `web-admin/app/admin/reports/page.tsx`
- `web-admin/app/admin/reports/reports-filter-panel.tsx`
- `web-admin/app/globals.css`

## Recommended Resume Point

When resuming later, start from:

1. `http://localhost:3001/admin/reports`
2. open each of the four new month-based reports
3. inspect print preview for real packet behavior
4. continue tightening:
   - calendar density
   - badge/readability balance
   - detailed-row field ordering
   - any business-rule corrections discovered during real operational use

## Resume Reminder

Active assumption for next session:

- `localhost:3001` remains the active environment unless intentionally changed

Most recent user-visible focus before pausing:

- report packet readability, print page control, and month-by-month placement/livehaul calendar presentation
