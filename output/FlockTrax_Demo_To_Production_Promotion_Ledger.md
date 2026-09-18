# FlockTrax Demo-to-Production Promotion Ledger

Updated: `2026-09-18`

Purpose: track shared bug fixes proven on `demo-hosted` that must later be reapplied to a clean production branch. This is a promotion ledger, not permission to merge the demo branch or deploy production.

## Safety rule

- Never merge `demo-hosted` wholesale into production.
- Reapply or extract each shared fix independently against the then-current production baseline.
- Exclude demo Supabase data, reset helpers, simulated integrations, demo credentials, red demo identity, and other demo-only behavior.
- Typecheck, build, test the boundary cases, create a rollback checkpoint, and verify the production Supabase/Vercel targets before deployment.

## September 18 release update

Shared density verification, barn sorting, feed-filter help and placement-issue closeout rules are deployed independently: production source 805d3e9 and demo source fa7588c. Demo evaluator access, contacts, simulated data, documents and reset functionality remain demo-only. See [the combined release checkpoint](FlockTrax_Production_And_Showcase_Demo_Release_Checkpoint_2026-09-18.md) for exact deployment and rollback identities.

## Earlier promotion history

### Dashboard population accounts for completed livehaul

- Demo source commit: `a28c0c1` (`Account for past livehaul in dashboard population`)
- Shared fix:
  - add a separate `Hauled` component to the Admin dashboard population matrix so the calculation reads `Started - Dead - Hauled = Now`;
  - deduct only non-cancelled livehaul events whose scheduled date is strictly before the current operational date—today's events do not reduce `Now` until tomorrow;
  - use `actual_head` when it is greater than zero, otherwise fall back to `target_head`;
  - apply sex-targeted removals to that sex and distribute unsexed removals proportionally without allowing either population to become negative;
  - return the same livehaul-adjusted counts from the mobile dashboard Edge Function;
  - avoid double-counting historical removals in feed projection calculations, while still applying today's event inside projections.
- Demo deployments:
  - Vercel production target for the isolated demo project: `dpl_28yRB6CpWg9pzr5xGNkd9f2qBnJ1`, aliased to `https://flocktrax-demo.vercel.app` on `2026-09-11`;
  - `dashboard-placements-list` is `ACTIVE` at version `2` in demo Supabase project `srkgobayrzidytmvoago` (bundle SHA-256 `136ade4b6f1f6baec7d1537990a4a256c1e724b713f742a9d605cbfa2db0f2d3`).
- Validation: Admin and mobile typechecks passed; the local and hosted Admin production builds passed; `git diff --check` passed before the source commit.
- Production candidate commit: `fde65c9` on `release/admin-2.6.0`
- Production deployment: Admin Vercel `dpl_917dzUiUswkHXUoiZrc3nP6dozEX`; `dashboard-placements-list` ACTIVE at production version `33`.
- Production status: `COMPLETE — DEPLOYED 2026-09-14`
- Promotion note: reapply the shared Admin, mobile type, and `dashboard-placements-list` changes to the then-current production baseline. Do not copy demo environment configuration or deploy to production without a separate production checkpoint and target verification.

### Livehaul actual-head precedence

- Demo source commit: `9d1f622` (`Simulate BinSentry feed reports in demo`)
- Shared fix: feed projections prefer a recorded `actualHead` over the planned `targetHead`, retaining target only as fallback.
- Production candidate commit: `f083734` on `release/admin-2.6.0`
- Production deployment: Admin Vercel `dpl_917dzUiUswkHXUoiZrc3nP6dozEX`.
- Production status: `COMPLETE — DEPLOYED 2026-09-14`
- Promotion note: extract only the four actual-over-target changes from `web-admin/lib/admin-data.ts` and `web-admin/lib/feed-projection-report-data.ts`; do not promote the simulated BinSentry portions of the commit.

### Starter-to-Grower ordering at age 14

- Demo source commits:
  - `53d42c3` (`Transition feed requirements to grower at day 14`)
  - `25f1e90` (`Preserve lifetime starter math after day 14`)
- Corrected shared rule: at age 14 or later, retain accurate lifetime Starter requirement, delivery, inventory, order, and shortfall facts, but recommend zero new Starter and allow any unfulfilled Starter shortfall to expire. It must not be added to Grower demand. Grower ordering is based only on projected consumption, accessible Grower inventory, and open Grower orders.
- Production candidate commits: `01b0c3f` and `393dbd8` on `release/admin-2.6.0`
- Corrective demo source/deployment: `a0d4fec`; Admin Vercel `dpl_FZwcMhH3oRD8mx8HRQ8jabGEDN6f`.
- Corrective production source/deployment: `bb96d31`; Admin Vercel `dpl_Es6PHuExie1oYtobsXAmWWVXfqMj`.
- Production status: `COMPLETE — CORRECTED AND DEPLOYED 2026-09-14`
- Promotion note: reapply the business-rule changes to the shared dashboard/report calculations and Starter math popup without bringing across demo-provider logic.

### Mobile Operations Calendar rolling history

- Demo source commit: `bb3feba` (`Include rolling calendar history in mobile`)
- Shared fix:
  - include events beginning on the exact date 12 calendar months before today;
  - include today and every future matching event without a fixed one-year future cap;
  - include historical completed livehaul rows while excluding cancelled rows;
  - include historical placement events while excluding unassigned/canceled placements;
  - allow mobile navigation back through the rolling 12-month window and forward through the latest returned future event;
  - use the America/Chicago operational date on the Edge Function and the device-local month in the mobile UI.
- Demo deployment: `operations-calendar-list` is `ACTIVE` at version `2` in Supabase project `srkgobayrzidytmvoago` as of `2026-09-11` (bundle SHA-256 `4c2acab16429bace54a6125a005e029fdce4cf1797eab8d505ba57a7b5dc2f12`).
- Mobile source validation: `npm run typecheck` passed.
- Production candidate commit: `d0cc4b9` on `release/admin-2.6.0`
- Production deployment: `operations-calendar-list` ACTIVE at production version `9`; mobile UI source is in `main`, with a future mobile binary still required.
- Production status: `COMPLETE — API DEPLOYED 2026-09-14; MOBILE BINARY PENDING`
- Promotion note: the production Edge Function and a future mobile build/update both need this change. Deploying the demo Edge Function alone does not update an already-installed mobile binary's month-navigation UI.

## Already present in production

### BinSentry density diagnostics

- Demo source commit: `840d54d`
- Production source commit: `63a4eb9`
- Shared feature: read-only bulk-density and weight-source visibility on Feed Bins, BinSentry Current Feed Inventory, pending orders, and standard/custom Feed Projection reports, including mixed/consistent/unknown density status.
- Database migration: `20260914190000_cache_binsentry_density_diagnostics.sql`, applied independently to production and demo.
- Edge deployment: `binsentry-sync-all` production version `10`; demo version `2`.
- Hosted deployments: production `dpl_5CeLW52t88VfBP4fjXgJhEDYyXLM`; demo `dpl_EtPT4kJuy6uaFrkP7vuPrFgfwJNp`.
- Production status: `COMPLETE — DEPLOYED 2026-09-14`.
- Safety boundary: no automatic or manual FlockTrax write-back to BinSentry was added.

### Google Sheets outbox scheduler and responsive mortality summary

- Source commit: `a160f56`
- Production checkpoint commit: `4b494db`
- Production status: `COMPLETE`
- Includes the Sheets outbox scheduling correction and the narrow/iPhone mortality-summary layout fix.

## Demo-only work — do not promote as bug fixes

The following remain intentionally demo-only unless a later production design explicitly requires them:

- isolated demo Supabase bootstrap, owner creation, and guarded reset functions;
- seeded farm groups, placements, transactions, documents, feed curves, inventory, and orders;
- database-backed simulated BinSentry provider and synthetic BinSentry records;
- disabled outbound integrations and demo environment safeguards;
- red demo sidebar and demo-specific explanatory/splash copy;
- environment-gated `🔴 FlockTrax Demo` browser-tab/PWA identity (`a5b318f`), deployed as Vercel `dpl_7yJGWFS9L3xu6DdUfRUQEqes6anM` on `2026-09-14`;
- 20 editable `public.app_settings` showcase records spanning integrator identity, placements, feed planning, alerts, feed-ticket vouchers, mobile display, and report labels; commits `dc2bfcd` and `13fd002`, migrations `20260914120000` and `20260914121500`, with a protected canonical seed, pre/post operational-reset restoration, and health-check verification; the reset count display was deployed as Vercel `dpl_6xtTwnFPnFDPsmEnqV1bVgq6MoWz` on `2026-09-14`;
- rolling future scheduling and mobile-task seed (`ef1dc11`, migration `20260914133000`): every one of the six demo barns has at least two future placements and one future livehaul, producing 13 future placements and seven future livehauls in the current baseline; `public.daily_age_tasks` resets to 10 age-targeted checklist items for the future demo-mobile build; reset health checks enforce both per-barn minimums and the task count; reset-count UI deployed as Vercel `dpl_B5NTa5h8f6BMPEnYiQaKee5b8Pfi` on `2026-09-14`;
- demo Vercel project configuration and demo credentials.

## Completion fields for each future promotion

When an item is promoted, record:

- production source commit;
- production rollback tag/checkpoint;
- affected production files/functions;
- validation performed;
- Supabase function/migration version, when applicable;
- Vercel or mobile build identifier, when applicable;
- live verification result and date;
- final status changed from `PENDING` to `COMPLETE`.
