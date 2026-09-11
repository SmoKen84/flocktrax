# FlockTrax Demo-to-Production Promotion Ledger

Updated: `2026-09-11`

Purpose: track shared bug fixes proven on `demo-hosted` that must later be reapplied to a clean production branch. This is a promotion ledger, not permission to merge the demo branch or deploy production.

## Safety rule

- Never merge `demo-hosted` wholesale into production.
- Reapply or extract each shared fix independently against the then-current production baseline.
- Exclude demo Supabase data, reset helpers, simulated integrations, demo credentials, red demo identity, and other demo-only behavior.
- Typecheck, build, test the boundary cases, create a rollback checkpoint, and verify the production Supabase/Vercel targets before deployment.

## Pending production promotion

### Livehaul actual-head precedence

- Demo source commit: `9d1f622` (`Simulate BinSentry feed reports in demo`)
- Shared fix: feed projections prefer a recorded `actualHead` over the planned `targetHead`, retaining target only as fallback.
- Production status: `PENDING`
- Promotion note: extract only the four actual-over-target changes from `web-admin/lib/admin-data.ts` and `web-admin/lib/feed-projection-report-data.ts`; do not promote the simulated BinSentry portions of the commit.

### Starter-to-Grower ordering at age 14

- Demo source commits:
  - `53d42c3` (`Transition feed requirements to grower at day 14`)
  - `25f1e90` (`Preserve lifetime starter math after day 14`)
- Shared fix: at age 14 or later, retain accurate lifetime Starter requirement, delivery, inventory, order, and shortfall facts, but recommend zero new Starter and add any unfulfilled Starter shortfall to Grower ordering.
- Production status: `PENDING`
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
- Demo deployment: `operations-calendar-list` deployed to Supabase project `srkgobayrzidytmvoago` on `2026-09-11`.
- Mobile source validation: `npm run typecheck` passed.
- Production status: `PENDING`
- Promotion note: the production Edge Function and a future mobile build/update both need this change. Deploying the demo Edge Function alone does not update an already-installed mobile binary's month-navigation UI.

## Already present in production

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
