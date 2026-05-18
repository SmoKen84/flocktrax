# FlockTrax Flock History Report Checkpoint

Date: `2026-05-18 America/Chicago`

Purpose:
- checkpoint for the first print/PDF-ready flock history report added to web-admin
- captures where the report can be launched, what data it includes, the title/settings behavior, and the final local state before production deployment

## Feature Summary

A new flock history report is now available in web-admin as a print-friendly browser page that can also be saved as PDF.

Current route:
- `/admin/flocks/[flockId]/report`

Primary behavior:
- landscape print layout
- Page 1 is a `log_daily` matrix
- Page 2 is a `log_mortality` matrix
- dates run down the page and data points run across the page
- the report is intended for browser print / Save as PDF rather than a separate server-side PDF renderer

## Launch Points

The report can now be launched from:
- flock detail page
- main dashboard placement editor popup
- placement wizard editor panels

Lifecycle rule:
- launch buttons only show for placements that are at least in-barn or later
- future scheduled placements do not show the report launch button

## Report Content

### Page 1

Daily matrix keeps:
- date
- age
- AM temp
- set temp
- RH
- outside current
- outside low
- outside high
- min vent
- ODA
- ODA exception
- NaOH
- comment

Daily matrix removed:
- water
- maintenance
- feedlines
- nipple lines
- health alert
- active flag

### Page 2

Mortality matrix includes:
- date
- age
- dead Roo / Hen
- cull Roo / Hen
- hen cull note
- roo cull note
- dead reason
- litter
- footpad
- feathers
- lame
- pecking

Header format refinement:
- mortality columns now use a two-line grouped header:
  - `Dead` over `Roo / Hen`
  - `Cull` over `Roo / Hen`

### Mortality Rollups

Page 2 header now includes rollup cards for:
- final population
- final mortality %
- final live %
- total losses
- dead split Roo / Hen
- cull split Roo / Hen

## Title / Settings Behavior

The report now reads title/subtitle settings from `public.app_settings` using:
- `flock_history_title`
- `flock_history_pg1`
- `flock_history_pg2`
- `flock_history_pg3`

Current title behavior:
- printed title is now two lines:
  - `Flock 293-S1`
  - `Historical Summary`
- implementation uses the first placement-style code when available so the barn/grow-out identifier is visible in the heading

Button text behavior:
- text launch buttons now use the `flock_history_title` value instead of a hardcoded `History Report`
- this leaves room to switch some entry points later to an icon-only report button if desired

## Verification

Local verification completed:
- `npm run build` passed after the final report-title update

Note:
- there were intermittent Next page-collection hiccups during a few builds on unrelated admin pages, but immediate reruns succeeded cleanly
- the final local verification build completed successfully

## Resume Prompt

Use this to restart quickly in a fresh chat:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md first. A new local flock history report exists at /admin/flocks/[flockId]/report with Page 1 daily matrix and Page 2 mortality matrix, report launch buttons now appear on the dashboard and placement wizard only for in-barn-or-later placements, and the title/settings are driven by flock_history_title / flock_history_pg1 / flock_history_pg2 / flock_history_pg3 in public.app_settings.` 
