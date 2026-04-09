# FlockTrax Web Admin Checkpoint

Date: 2026-04-01

## What Was Built

A new separate web-first admin application was scaffolded at `C:\dev\FlockTrax\web-admin`.

The app is intentionally separate from the Expo worker app so the product can split cleanly:

- `mobile` stays worker-focused and location-first
- `web-admin` becomes the desktop admin, setup, reporting, and placement planning surface

## Stack

- Next.js App Router
- React 19
- TypeScript
- Supabase SSR client support

## Milestone 1 Routes

- `/`
- `/admin/overview`
- `/admin/farms`
- `/admin/farms/[farmId]`
- `/admin/flocks`
- `/admin/flocks/[flockId]`
- `/admin/placements/new`

## UX Direction

The admin app uses a desktop-first operations-console layout with:

- persistent sidebar navigation
- warm agricultural visual language
- dense cards and tables
- clear separation between planning data and worker-facing execution

## Data Layer

Milestone 1 uses a resilient mock-backed admin data layer so the admin shell can be opened immediately while the exact hosted admin schema is still being reconciled.

Key files:

- `C:\dev\FlockTrax\web-admin\lib\types.ts`
- `C:\dev\FlockTrax\web-admin\lib\mock-data.ts`
- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`
- `C:\dev\FlockTrax\web-admin\lib\supabase\server.ts`

The code already includes a Supabase server-client entry point, but currently falls back to mock data by design.

## Key Files Added

- `C:\dev\FlockTrax\web-admin\package.json`
- `C:\dev\FlockTrax\web-admin\tsconfig.json`
- `C:\dev\FlockTrax\web-admin\next.config.ts`
- `C:\dev\FlockTrax\web-admin\app\globals.css`
- `C:\dev\FlockTrax\web-admin\app\layout.tsx`
- `C:\dev\FlockTrax\web-admin\app\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\layout.tsx`
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`
- `C:\dev\FlockTrax\web-admin\components\page-header.tsx`

## Verification

Executed successfully:

- `npm install`
- `npm run typecheck`
- `npm run build`

The web admin app currently builds successfully.

## Important Product Alignment

This app reflects the already agreed product split:

- workers should not see or manage flock/planning complexity
- admins should create and manage farms, barns, flocks, placements, reporting, and access on the web
- the placement wizard is the bridge from planning records to worker-visible placement availability

## Next Recommended Build Steps

1. Add Supabase-authenticated admin sign-in and role gating
2. Replace mock farm reads with real hosted reads
3. Implement create/edit flows for farms, barns, and flocks
4. Build the real placement allocation workflow with overlap validation
5. Add exports and reporting views after master-data flows are stable
