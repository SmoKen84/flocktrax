# FlockTrax Issues System Checkpoint
Date: 2026-05-07

## Purpose
Forward-only replacement for the old placement-day alert checkboxes with a real live `issues` model.

## What Changed
- Added schema migration:
  - `C:\dev\FlockTrax\supabase\migrations\20260507143000_create_issues_feature.sql`
- Added shared issue helpers:
  - `C:\dev\FlockTrax\supabase\functions\_shared\issues.ts`
- Added edge functions:
  - `C:\dev\FlockTrax\supabase\functions\issue-create\index.ts`
  - `C:\dev\FlockTrax\supabase\functions\issue-resolve\index.ts`
- Updated mobile dashboard live status to read open issue counts instead of daily-log checkbox rollups:
  - `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`
  - `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- Updated placement-day load/save responses to include:
  - `barn_id`
  - `barn_issues`
  - `placement_issues`
  - files:
    - `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`
    - `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`
- Updated mobile API/types and placement-day UI:
  - `C:\dev\FlockTrax\mobile\src\types.ts`
  - `C:\dev\FlockTrax\mobile\src\api\http.ts`
  - `C:\dev\FlockTrax\mobile\App.tsx`
  - `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`

## New Behavior
- Daily comments remain historical.
- Live operational problems are now managed as open issues.
- Issue ownership model:
  - barn issues: `maintenance`, `feedlines`, `nipple_lines`, `equipment`, `water`, `ventilation`
  - placement issues: `bird_health`, `performance`, `mortality_review`
- Dashboard badges now show count-based live status like `1 Open Issue`, `3 Open Issues`.
- Placement-day screen now shows:
  - `Barn Issues`
  - `Placement Issues`
  - `Add`
  - `Resolve`

## Important UX Guardrail
Issue create/resolve does **not** overwrite the user’s unsaved placement-day draft. The screen only merges the refreshed issue bundle locally and separately refreshes dashboard counts.

## Verification
- Mobile typecheck passed:
  - `npm run typecheck` in `C:\dev\FlockTrax\mobile`
- `deno` is not installed in this local shell, so edge functions were not `deno check`-verified here.

## Next Steps
1. Apply migration `20260507143000_create_issues_feature.sql` to Supabase.
2. Deploy edge functions:
   - `dashboard-placements-list`
   - `placement-day-get`
   - `placement-day-submit`
   - `issue-create`
   - `issue-resolve`
3. Build and test mobile:
   - open placement day
   - add barn issue
   - add placement issue
   - resolve issue
   - confirm dashboard badge counts change
4. Optional follow-up:
   - open issue list directly from dashboard badge
   - web-admin issue views / global issue board

## Notes
- Historical checkbox data is intentionally not migrated.
- Repo already had many unrelated in-flight changes; this checkpoint describes only the issues-system work above.
