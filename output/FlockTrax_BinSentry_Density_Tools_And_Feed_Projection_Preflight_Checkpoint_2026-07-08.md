# FlockTrax BinSentry Density Tools And Feed Projection Preflight Checkpoint

Date: `2026-07-08`
Environment: `production + localhost`
Workspace: `C:\dev\FlockTrax`
Primary app area: `web-admin`
Checkpoint type: detailed implementation + production-deploy checkpoint

## Purpose

Capture the July 8 work that tightened BinSentry-backed feed reliability across three connected areas:

- live fallback feed-type inference when BinSentry inventory knows the feed name but local bin type is blank
- feed-bin admin tooling to audit and repair live BinSentry bulk density from inside FlockTrax
- a new feed-projection preflight gate that warns before reports run on bins whose live BinSentry density diverges from the configured operational bulk-density setting

## High-Level Status

Today ended with the production `web-admin` app and hosted Supabase function path updated so operators can:

- read current live BinSentry bulk density per mapped bin
- compare it against `app_settings.name = "BulkDensity"`
- push the configured density back to an individual BinSentry bin from the feed-bin editor
- block feed projection reports with a warning overlay when in-scope bins do not match the configured density

The current shared-server BinSentry authentication model was also reviewed and intentionally left unchanged for now.

## Business Context Captured

The user confirmed the operational reality is:

- FlockTrax inventory is trustworthy only when the live BinSentry bin density is set back to the practical operating value
- BinSentry order receipt can temporarily leave a bin at a lower starter/grower density
- feed projection reports should not quietly calculate through that mismatch because the resulting assumptions can be wrong

That led to two practical operator tools:

- a feed-bin density audit/repair workflow
- a report preflight warning gate

## What Was Implemented

### 1. BinSentry inventory feed-type fallback

Files updated:

- `C:\dev\FlockTrax\web-admin\lib\binsentry.ts`
- `C:\dev\FlockTrax\supabase\functions\binsentry-sync-all\index.ts`

Behavior now supported:

- if local `accessible_feed_type` is already set, it still wins
- if local `accessible_feed_type` is blank, sync can infer `starter` / `grower` from BinSentry inventory `feedName`
- inferred values can persist into feed-bin state without overwriting an already known local type

This keeps on-hand type splits from staying blank when BinSentry is already exposing a useful feed name.

### 2. Feed-bin density audit in admin

Files updated:

- `C:\dev\FlockTrax\web-admin\lib\feed-bin-data.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-bins\feed-bins-view.tsx`

Behavior now supported:

- `Feed Bins` now has a `Check Density` action
- the selected barn can fetch live BinSentry `bulkDensity` for each mapped bin
- the live density is converted from `kg/m³` to `lb/ft³`
- comparison is made against `app_settings.name = "BulkDensity"` rather than a hardcoded `47.6`
- the result shows whether each mapped bin matches or diverges from the configured target

### 3. Feed-bin density push-back to BinSentry

Files updated:

- `C:\dev\FlockTrax\web-admin\lib\binsentry-http.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-bins\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-bins\feed-bins-view.tsx`

Behavior now supported:

- the selected feed-bin editor now includes `Push App Density To BinSentry`
- the action reads `app_settings.name = "BulkDensity"`
- the app converts that value from `lb/ft³` into the metric BinSentry `bulkDensity` value
- the app then calls BinSentry's `update-bulk-density` action for the selected live bin ref

Important note:

- the BinSentry API still exposes `update-bulk-density`, but the action is marked deprecated in the live Siren entity

### 4. Feed projection density preflight warning gate

Files updated:

- `C:\dev\FlockTrax\web-admin\lib\feed-projection-report-data.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection-custom\page.tsx`

Behavior now supported:

- before either feed projection report renders, FlockTrax checks mapped BinSentry bins in scope
- live BinSentry density is compared against `app_settings.name = "BulkDensity"`
- if any in-scope mapped bin diverges, the report pauses behind a warning overlay
- the operator can either:
  - go back to reports
  - continue anyway with an explicit override in the URL

This is active for:

- `10 Day Feed Projection`
- `Custom Feed Projection`

## Live Verification Captured

### Direct BinSentry API verification

One live mismatch was confirmed and corrected during this cycle:

- `Woape / W6 / Bin 62`
  - before: `640 kg/m³` (`39.95 lb/ft³`)
  - after API update: `762.478 kg/m³` (`47.6 lb/ft³`)

That verified both:

- the BinSentry read path
- the BinSentry `update-bulk-density` write path

### Production deploys completed today

Hosted Supabase function deployed:

- project: `frneaccbbrijpolcesjm`
- function: `binsentry-sync-all`

Production `web-admin` deploys completed during the density/report cycle:

- `dpl_4ifPEKN8DUcyFSSsKp5RC2i9Cj6p`
- `dpl_BMRbkMnr32mXvq4kvdbg6V9V1nN7`
- `dpl_3jrBPcomd4gXkZApnPGs1xcw7PCe`
- `dpl_7oUmc3JfxDEfBrPpwqp5XS5UyvHr`

Live alias remained:

- `https://flocktrax.com`

## Validation Captured

Validation completed during this work cycle:

- `npm run typecheck` passed after feed-type fallback sync changes
- `npm run typecheck` passed after feed-bin density audit / push-back tools
- `npm run typecheck` passed after feed-projection density preflight warning gate

## BinSentry Auth Model Note

Current BinSentry access remains server-side and shared:

- `web-admin` users do not provide their own BinSentry credentials
- the hosted app authenticates to BinSentry with the configured shared server credentials
- this is acceptable for the current environment

Future scaling note:

- if multiple isolated farm groups eventually require separate BinSentry visibility, the current shared credential model will need redesign

## Main Files Touched In This July 8 Cycle

Backend / hosted sync:

- `C:\dev\FlockTrax\supabase\functions\binsentry-sync-all\index.ts`

BinSentry helpers and feed-bin admin tooling:

- `C:\dev\FlockTrax\web-admin\lib\binsentry-http.ts`
- `C:\dev\FlockTrax\web-admin\lib\binsentry.ts`
- `C:\dev\FlockTrax\web-admin\lib\feed-bin-data.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-bins\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-bins\feed-bins-view.tsx`

Feed projection preflight:

- `C:\dev\FlockTrax\web-admin\lib\feed-projection-report-data.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection-custom\page.tsx`

## Working Tree Note

One generated temp file was intentionally left out of the code commit:

- `C:\dev\FlockTrax\supabase\.temp\cli-latest`

## Recommended Next Step

Use the new feed-bin density tools operationally as needed, and let the feed-projection warning gate surface any future drift before the report is trusted.
