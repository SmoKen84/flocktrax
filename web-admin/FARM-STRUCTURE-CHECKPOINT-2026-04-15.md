# Farm Structure Checkpoint

Date: 2026-04-15

## Scope

This checkpoint captures the live `Groups, Farms & Barns` admin screen state in `web-admin` after the hierarchy consolidation, in-context editors, add/delete controls, and hero/diagram refinements.

The runtime source of truth is the hosted Supabase project, not local seed/mock data.

## Current Screen Shape

Routes:

- `/admin/farm-groups`
- `/admin/farms`

Both routes render the same shared hierarchy screen:

- `app/admin/farm-structure/structure-view.tsx`

Navigation label:

- `Groups, Farms & Barns`

## Data Sources

Primary bundle:

- `lib/admin-data.ts`

Tables/views used by the hierarchy screen:

- `public.farm_groups`
- `public.farms_ui` for list/display hydration
- `public.barns`
- `public.flocks`
- `public.placements`

Editor detail bundle:

- `lib/farm-structure-data.ts`

Detail editor reads directly from:

- `public.farm_groups`
- `public.farms`
- `public.barns`

Hero text sources:

- `platform.screen_txt`
- keys:
  - `farm_barn_title`
  - `farm_barn_desc`

## Important Schema Behavior

The `public.farms` table has a trigger:

- `set_audit_user_columns_farms`

That trigger calls:

- `public.set_audit_user_columns()`

And on `INSERT`/`UPDATE` it sets:

- `updated_by := auth.uid()`

This means farm writes are sensitive to the authenticated user context.

## Critical Implementation Rule

Do not use the admin/service-role client for `farms` create/update writes unless the trigger behavior is changed.

Current safe split:

- `farm_groups` create/update/delete: admin client
- `barns` create/update/delete: admin client
- `farms` create/update: authenticated server client

Reason:

- `public.farms` requires a non-null `updated_by`
- its trigger overwrites `updated_by` from `auth.uid()`
- service-role actions can still end up with null `auth.uid()`

## Current Add/Delete Rules

Create:

- `New Group` creates a placeholder farm group
- `New Farm` requires a selected farm group
- `New Barn` requires a selected farm

Delete protection:

- Farm Group delete blocked if linked farms or farm-group memberships exist
- Farm delete blocked if linked barns, flocks, placements, or farm memberships exist
- Barn delete blocked if linked placements or flock activity exist

## Current UX Behavior

Selectors:

- Farm Groups, Farms, and Barns each use fixed-height internal scrolling
- lower editor region remounts on selection change so forms refresh correctly

Hero diagram:

- prioritizes currently selected farm
- prioritizes currently selected barn within that farm
- shows `...` cues when additional farms or barns exist beyond the displayed subset

## Files Most Relevant

- `app/admin/farm-structure/structure-view.tsx`
- `app/admin/farm-structure/actions.ts`
- `lib/farm-structure-data.ts`
- `lib/admin-data.ts`
- `lib/platform-content.ts`
- `app/globals.css`
- `components/admin-shell.tsx`
- `app/page.tsx`

## Verification State At Checkpoint

Verified before checkpoint:

- `npm run typecheck`
- `npm run build`

Production target:

- `https://flocktrax.com`

## Known Good User-Observed State

Confirmed working:

- group add/delete
- barn add/delete
- farm add path after moving writes to authenticated client path
- lower editors tracking selector changes

Most recent UI polish added:

- hidden internal hero note removed
- hierarchy diagram shows `...` when more farms/barns exist than are displayed

