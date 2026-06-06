# FlockTrax Admin Dashboard And Placement Scheduler Polish Checkpoint

Date: `2026-06-04`
Repo: `C:\dev\FlockTrax`
Branch: `main`
HEAD: `f518cfe`
Mode: detailed crash-safe checkpoint

## Purpose

This checkpoint captures the post-release admin polish work that happened after the broader `5.4` lifecycle/closeout release was already live:

- placement scheduler `Farm View` was corrected to support explicit farm-group scoping
- `All Farms` behavior was made visible and usable with an explicit `Farm Group` selector
- the calendar title/context was cleaned up so `All Farms` sits on its own line beneath the group name
- the admin overview/dashboard tiles were retuned for iPad/tablet widths so the inner matrix content no longer bleeds outside the cards
- the `First 7-Days Mortality` popup summary block was reformatted after the DOA-removal business-rule change

This is the best restart point if the next work item is:

- placement scheduler `Farm View` behavior
- farm-group scope polish
- admin dashboard responsive layout issues
- mortality popup formatting

## Production State

These changes are live on production:

- production URL: [https://flocktrax.com](https://flocktrax.com)
- HTTP verification: `200`

Relevant production deploys from this checkpoint:

1. placement scheduler farm-group controls
   - commit: `ff320df`
   - message: `Add farm-group placement scheduler scope controls`
   - Vercel deployment: `GGtSdEqLi9VQdKDUrdQXpo4vDchZ`

2. dashboard iPad/tablet tile layout
   - commit: `8b0e8c2`
   - message: `Tighten admin dashboard tablet tile layout`
   - Vercel deployment: `5v7D9oxfQW7jyvkgACvMDZ1f5bwT`

3. first-7 mortality popup summary cleanup
   - commit: `f518cfe`
   - message: `Polish first-7 mortality popup summary layout`
   - Vercel deployment: `FPiYNBvdR6qRCKwazp1uT5n3oHp4`

## Placement Scheduler Changes

Main files:

- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\scheduler-filters.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\placement-month-picker.tsx`

What changed:

- `Farm View` now exposes an explicit `Farm Group` selector
- farm choices in `Farm View` are now scoped by the selected farm group
- `All Farms` works within the selected farm group instead of relying on invisible inferred state
- the calendar context/title for `All Farms` now renders as:
  - farm group name on the first line
  - `All Farms` on the next line

Operational result:

- users can intentionally scope placement planning at the farm-group level
- users no longer get stuck in the “No farm selected” blank state when trying to use `Farm View`
- the scope is visible in the UI instead of being hidden in URL/state inference

## Admin Dashboard iPad Fix

Main file:

- `C:\dev\FlockTrax\web-admin\app\globals.css`

Problem that was fixed:

- on iPad/tablet widths, the admin dashboard tiles were still trying to behave like full desktop 3-column cards
- the inner mortality matrix and lower detail blocks were bleeding outside the tile boundaries

What changed:

- dashboard tile grid now steps down to `2` columns sooner at tablet widths
- tile header badges wrap more naturally
- mortality matrix no longer uses the left offset at that size
- issue cards and lower subpanels were tightened so they remain inside the tile

Result:

- the admin console/dashboard now fits on iPad without the matrix text bleeding off the cards

## First 7-Days Mortality Popup Cleanup

Main files:

- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

Context:

- after the DOA policy change, the first-7 popup no longer displayed DOAs as a separate bucket
- removing that bucket left the right-hand `Mortality` block formatted too tightly

What changed:

- the first-7 mortality summary on the right now renders as a clearer stack:
  - header row
  - `Roos`
  - `Hens`
  - `Totals:`
- the totals row is visually separated again

Important note:

- the user reported that the popup still worked on the actual local route, even though reproducing the “single module” concept was confusing at first
- the final conclusion was that the route-level local app check was valid, and the production push proceeded

## Build / Verification Notes

Successful verification during this checkpoint:

- `npm run build` passed
- Vercel production deploys succeeded for all three updates above

Known recurring non-blocking issue:

- `npm run typecheck` can fail intermittently in this repo because `tsconfig.json` includes `.next/types/**/*.ts`
- after some build cycles, Next’s generated `.next/types` files are not all present when `tsc --noEmit` runs directly
- this is an existing repo/tooling quirk, not a new code regression in this checkpoint

Known recurring warnings:

- autoprefixer still warns in `app/globals.css` that `end` has mixed support and suggests `flex-end`

## Best Resume Paths

If the next session is about placement scheduler behavior:

- start with:
  - `C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx`
  - `C:\dev\FlockTrax\web-admin\app\admin\placements\new\scheduler-filters.tsx`

If the next session is about dashboard responsive behavior:

- start with:
  - `C:\dev\FlockTrax\web-admin\app\globals.css`
  - search for:
    - `.tile-grid`
    - `.placement-tile`
    - `.tile-mortality-table`

If the next session is about the first-7 mortality popup:

- start with:
  - `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
  - search for:
    - `function MortalityPopup`
    - `mortality-popup-metric-stack`

## Recommended Restart Prompt

```text
Load C:\dev\FlockTrax\output\FlockTrax_Admin_Dashboard_And_Placement_Scheduler_Polish_Checkpoint_2026-06-04.md first.
```
