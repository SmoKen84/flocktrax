# FlockTrax Demo Age-14 Feed Projection Hotfix Checkpoint

Date: `2026-09-14`
Demo branch: `demo-hosted`
Demo source commit: `a0d4fec`
Demo URL: `https://flocktrax-demo.vercel.app`
Vercel deployment: `dpl_FZwcMhH3oRD8mx8HRQ8jabGEDN6f`

## Outcome

The isolated demo now matches production's corrected age-14 feed rule. Once a
flock reaches age 14, any missed Starter target remains visible as historical
information but is no longer an orderable requirement and is not added to
Grower demand. Current Grower recommendations use only projected consumption,
Grower inventory, and open Grower orders.

The correction covers the dashboard recommendation, standard Feed Projection,
custom Feed Projection, report totals, and Starter math popup. Demo-only
BinSentry simulation and environment isolation were preserved unchanged.

## Validation

- Demo Admin typecheck passed.
- Demo Admin optimized build passed all 49 routes.
- `git diff --check` passed before commit.
- Source commit `a0d4fec` was pushed to `origin/demo-hosted`.
- Vercel deployment `dpl_FZwcMhH3oRD8mx8HRQ8jabGEDN6f` is `READY` and aliased
  to `https://flocktrax-demo.vercel.app`.
- Demo homepage returned HTTP `200`, retained the `🔴 FlockTrax Demo` title and
  demo environment messaging, and protected Admin routing remained intact.
- The independently applied production source is `bb96d31`; production
  deployment is `dpl_Es6PHuExie1oYtobsXAmWWVXfqMj`.

## Resume Guidance

Treat `a0d4fec` and `dpl_FZwcMhH3oRD8mx8HRQ8jabGEDN6f` as the current demo
source and hosted baselines. The demo remains connected only to demo Supabase
project `srkgobayrzidytmvoago`; no reset seed, database schema, or outbound
integration behavior changed in this hotfix.
