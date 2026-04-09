# FlockTrax Live Data Checkpoint

Date: 2026-04-01
Context: afternoon checkpoint before pausing work

## Status

Both application tracks are in a strong state:

- `C:\dev\FlockTrax\mobile` is working for login, placement list, placement open, and save
- `C:\dev\FlockTrax\web-admin` now has the right admin hierarchy and live-data wiring in code

## Mobile App State

The worker app is functioning end-to-end against the hosted Supabase project.

Confirmed working:

- login
- placement list
- placement open
- save daily/mortality packet

Important worker UX decisions now reflected in the app:

- farm and barn are the primary selection language
- placement code is secondary context
- age is read-only

## Backend State

Hosted runtime dependencies on drifted Adalo-era compatibility views were removed from these functions:

- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`
- `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`

These functions now read directly from the real hosted schema tables and current views instead of relying on missing legacy UI views.

## Web Admin State

A separate web-first admin app now exists at:

- `C:\dev\FlockTrax\web-admin`

This app is intentionally separate from the worker mobile app.

Current routes:

- `/`
- `/admin/overview`
- `/admin/farm-groups`
- `/admin/farm-groups/[farmGroupId]`
- `/admin/farms`
- `/admin/farms/[farmId]`
- `/admin/flocks`
- `/admin/flocks/[flockId]`
- `/admin/placements/new`

## Admin Model

The hierarchy now correctly reflects:

- Farm Group -> Farm -> Barn -> Placement

This supports multi-farm operating companies such as:

- `Smotherman Farms Ltd`
  - `Sedberry Farm`
  - `Woape Farm`
  - `Sulak Farm`

This also keeps the product extensible for integrator-scale usage across multiple contract farm groups.

## Live Data Wiring

The web admin data layer has been upgraded from mock-only to live-capable.

Key file:

- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`

It now reads from real hosted schema objects when env vars are present:

- `farm_groups`
- `farms_ui`
- `barns`
- `flocks`
- `placements`
- `v_placement_daily`

Supporting server-only admin client:

- `C:\dev\FlockTrax\web-admin\lib\supabase\server.ts`

Current behavior:

- if live Supabase env vars are present, web admin reads real data
- if env vars are missing, the app gracefully falls back to mock data

## Active Placement Dashboard

The admin overview now includes a filterable active-placement tile dashboard.

Key component:

- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`

Current filters:

- farm group
- farm
- submission status
- free-text search

Intent:

- one tile per active `placement_id`
- location-first scanning by farm and barn
- admin-friendly status visibility

## Environment Needed For Live Web Data

File:

- `C:\dev\FlockTrax\web-admin\.env.local`

Required values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Verification Completed

Web admin verification passed after live wiring:

- `npm run typecheck`
- `npm run build`

## Known Remaining Gaps

These are not blockers, just next-pass items:

- web admin does not yet have a dedicated admin sign-in flow
- some display fields still use placeholder-derived values where the schema does not yet expose the exact business concept cleanly
- placement wizard selectors are not yet cascading/filter-linked
- CRUD create/edit flows are still scaffold-stage
- reports/exports are not yet built

## Recommended Next Step Tonight

Best next step:

1. load real env vars into `web-admin`
2. confirm overview/farm-group/farm/flock pages are reading hosted data in the browser
3. tighten any field mappings revealed by real data
4. then build cascading placement wizard behavior
