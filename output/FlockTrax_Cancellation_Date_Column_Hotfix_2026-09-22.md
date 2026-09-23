# Scheduled flock cancellation hotfix

The production cancellation RPC failed with `record "v_target" has no field
"date_placed"` when a feed destination was selected. Both source and target
variables use `placements%rowtype`; placement scheduling uses `active_start`,
while `date_placed` belongs to the related flock.

Migration `20260922120000_fix_cancel_scheduled_placement_date.sql` replaces
the invalid comparison with the scheduler's date precedence:
`coalesce(flock.date_placed, placement.active_start)` for each side. The
function signature, grants, status guards, same-barn delivered-feed rule,
updates and return payload are preserved.

The migration was deployed with `supabase db push --linked --yes` from the
production checkout `C:/dev/FlockTrax-Production-Release` on branch
`release/admin-2.6.0`. A preceding dry run listed only this migration.
The separate `C:/dev/FlockTrax` workspace is on `demo-platform` and was not
modified by this hotfix.

## Verification

- A disposable PostgreSQL database reproduced the exact reported error with
  the original function, then passed all ten scenarios with the migration.
- Covered delivered/queued feed, open and cancelled orders, retained bin
  references, unchanged destination, no-feed cancellation, fallback dates,
  scheduler date precedence, and rejected earlier/same-day/cross-barn/active/
  missing destinations and existing daily records.
- The focused test harness models the columns used by the RPC; it does not
  claim coverage of every production trigger or constraint.
- Production readback confirmed the corrected function and migration ledger.
- No live cancellation or flock/feed data modification was performed.

## Reported operating case

Ken confirmed that feed remains at W8 and should go to its next scheduled
flock. At diagnosis, 340-W8 was scheduled for September 23, 2026 with two
linked feed drops. Its next eligible W8 flock is 358-W8 on November 25, 2026.
337-S1 was already in barn and must retain its own records. Retry cancellation
of 340-W8 with 358-W8 selected for feed reassignment. Combining hatch counts
into 337-S1 is a separate user-managed operation.

## Follow-up: feed_drops timestamp mismatch

Deployed 20260922130000_fix_cancel_feed_drop_columns.sql after the next cancellation attempt exposed two invalid feed_drops.updated_at assignments. Removed both assignments, preserving delivery metadata. The earlier minimal test schema incorrectly supplied this nonexistent column; corrected the fixture so the date-only fix reproduces the reported timestamp error. All ten regression scenarios pass with the new migration.

Also executed the complete 340-W8 to 358-W8 cancellation against production inside an explicit BEGIN/ROLLBACK transaction. Assertions verified two delivered feed records reassigned, source canceled, and all delivery fields except placement_id/placement_code identical. Rollback completed; subsequent query confirmed 340-W8 remains scheduled with its two deliveries, 358-W8 has zero deliveries, and 337-S1 remains in_barn_growing with two deliveries. No business changes were committed. User should retry cancellation in Admin.

## Production and hosted demo rollout

Both migrations are applied to production (frneaccbbrijpolcesjm) and hosted demo (srkgobayrzidytmvoago). Live pg_get_functiondef MD5 matches in both environments: 40caf95537118f4ceee7caab8444a3f6. Both migration ledgers record 20260922120000 and 20260922130000. This database-only fix is immediately used by flocktrax.com and flocktrax-demo.vercel.app; no website build is required. Demo evaluator data was not canceled or reset during rollout.
