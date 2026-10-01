# Placement reinstatement checkpoint — 2026-10-01

## Business rule and behavior

Reinstate Flock is available from a canceled flock's history/detail page and the placement scheduler. The user chooses a placement date, reviews the resulting allocations, and confirms. Projected end, female/male arrival offsets, and planned live-haul dates shift together. The flock returns to scheduled, without marking chicks arrived.

When the barn is empty and the reinstated placement is inserted before the current next scheduled placement, existing drops assigned to that next placement are reassigned using both placement_id and placement_code. Queued allocation references and non-canceled feed-order commitments follow the same placement. The next placement is determined from the current barn schedule, not old cancellation totals. Occupied barns and later insertions leave existing feed alone. No feed tickets, feed drops, or new movement-history tables are created. W5's remaining feed was not transferred by this work; that remains the user's F2F task.

Cancellation now requires the immediate next eligible scheduled placement in the same barn as its feed destination. Existing cancellation eligibility and no-operational-record checks remain. Both actions require manager-or-higher plus active farm membership or active farm-group membership covering the farm, including for admins. Role IDs resolve through the roles table. The manager role allowlist is MANAGER/FarmManager, ADMIN/super-admin, Grower/GrowerAdmin, and IntegratorManager (normalized). Generic state RPCs cannot bypass transitions into/out of canceled.

All updates run atomically. Review fingerprints reject schedule/feed changes since review. Existing overlap constraints remain, supplemented by checks against previous occupancy and invalid date ranges. Inconsistent feed placement/barn references block transfer for correction.

## Implementation / databases

Production commits edca235 and 1e81a24; demo equivalents 20d3219 and dcb1946. Both branch heads pushed. Production localhost source fast-forwarded.

Applied to production frneaccbbrijpolcesjm and demo srkgobayrzidytmvoago:
- 20261001150000_placement_reinstatement.sql
- 20261001153000_reinstatement_previous_placement_boundary.sql

The original cancel RPC body is retained as a private internal function; PUBLIC/anon/authenticated/service-role execution on that internal entry is revoked. Public wrappers enforce identity, role, farm scope and sequence. Short table locks serialize scheduling/arrival/allocation changes through the transaction. Existing activity_log records reinstatement.

## Verification

Disposable local PostgreSQL tests use baseline tables, barn-state triggers, real cancellation SQL, new migrations, and exclusion constraints. Passed permission boundaries, inactive/group memberships, actor spoofing, existing F2F credit and regular delivery reassignment, queued references/orders, no new drops, untouched later flock allocations, occupied/later/no-successor reinstatement, stale feed review, overlap rejection, previous-occupancy boundaries, shifted dates, double submission, cancel/reinstate cycling, and generic-state bypass rejection.

TypeScript checks passed in production and demo. Hosted read-only RPC review passed for all four production canceled placements. Demo had no canceled placements; permission/RPC checks passed. No actual business flock or feed record was mutated by verification. Authenticated browser interaction has not been performed.

## Deployments

Demo READY: dpl_6E8q2LL5b8rhqhJ7nzd9wdVHA3X9, https://flocktrax-demo-8t733pg3i-flock-trax.vercel.app, alias https://flocktrax-demo.vercel.app. Deployed UI commit 20d3219; dcb1946 adds database-only correction/tests already applied.

Production deployment: dpl_7SKf2nhpJqq9cR9B79Ezigyffziy, https://web-admin-b4rgw8po4-flock-trax.vercel.app, alias https://flocktrax.com. Final readiness recorded below.

## Recovery

Keep both migrations with the application release. Do not reapply the first migration manually (it renames the existing cancellation function). Do not remove the database guard to work around a rejected reinstatement; correct the date window, membership, or inconsistent allocation instead. Preserve unrelated existing dirty files and historical worktrees. Prior Super Admin permission report/printing changes remain production-only. No mobile release.

Final verification: production and demo deployments both READY with aliases updated. Both login URLs returned HTTP 200.

## Active-placement correction — 2026-10-01

346-W5 reinstatement for October 14 hit idx_unique_active_placement_per_barn because 364-W5 already held the awaiting-arrival slot. Migration 20261001160000_fix_reinstatement_active_barn_slot.sql returns the displaced current placement/flock to inactive future scheduling before making the inserted placement awaiting-arrival/current, all in the existing transaction. Occupied barns and later insertions keep the reinstated placement inactive/scheduled. No chicks are marked arrived.

The local suite now includes the actual unique partial index as well as the barn-state triggers and verifies current-pointer handoff, former-next state, and inactive later reinstatement. All checks passed. This is a database-only correction; the sidebar highlight remains held on fix/placement-sidebar-highlight (7512e21), not included here. The failed user attempt rolled back and no live flock was reinstated by the agent.
