# FlockTrax Demo BinSentry Density Diagnostics Checkpoint

Date: `2026-09-14`

## Outcome

The isolated demo now mirrors production's read-only BinSentry density diagnostics while continuing to use its simulated provider data. Reviewers can see how bulk density and the inventory weight basis influence reports without any connection to production data or live BinSentry mutations.

## Demo behavior

- Feed Bin configuration displays simulated live density and weight basis.
- BinSentry Current Feed Inventory displays density per bin and flags mixed feed-type densities.
- Standard and Custom Feed Projection reports include the `BinSentry Density Inputs` audit table.
- Coming orders disclose their density/weight basis.
- Demo reset preserves and recreates the synthetic diagnostic inputs through `demo_control.ensure_binsentry_density_diagnostics()`.
- Canonical simulated values remain `610 kg/m³` for Starter and `580 kg/m³` for Grower unless the demo seed is deliberately revised.

## Isolation and safety

- The feature performs no BinSentry write-back.
- Demo integration guards and simulated provider behavior remain intact.
- Demo reset does not read, copy, or modify production data.
- The demo Supabase project remains `srkgobayrzidytmvoago`, separate from production.

## Database, source, and deployment

- Migration: `20260914190000_cache_binsentry_density_diagnostics.sql`
- `binsentry-sync-all` is active at demo version `2`.
- Source commit: `840d54d` (`Expose BinSentry density diagnostics`)
- Branch: `demo-hosted`
- Vercel deployment: `dpl_EtPT4kJuy6uaFrkP7vuPrFgfwJNp`
- Permanent alias: `https://flocktrax-demo.vercel.app`

## Validation

- Fresh Admin TypeScript check passed.
- Optimized Admin build passed with 49 routes.
- Vercel deployment status is `READY`.
- Demo home returned HTTP `200` with title `🔴 FlockTrax Demo`.
- Protected Feed Bins route returned HTTP `307` to `/login` while unauthenticated.
- No HTTP 500 logs were found during the deployment verification window.

## Parity status

This shared feature has already been independently applied to production at source `63a4eb9`, Supabase migration `20260914190000`, and Vercel deployment `dpl_5CeLW52t88VfBP4fjXgJhEDYyXLM`. No later promotion is pending.

## Restore point

The preceding demo application deployment was `dpl_FZwcMhH3oRD8mx8HRQ8jabGEDN6f` at source `a0d4fec`. The migration is additive and nullable, allowing that application revision to run against the migrated demo schema if an application rollback is necessary.
