# FlockTrax Supabase Performance Review and Index Maintenance Checkpoint

Date: `2026-08-10`
Branch: `main`
Repository baseline commit: `fdc3d7d402b787f2f3a81e00b31f42200394ec11`
Checkpoint type: hosted database performance review, targeted index maintenance, verification, and stopping-point checkpoint

## Purpose

This checkpoint records the review of the Supabase Weekly DB Performance Report
run `10`, the live read-only database inspection used to separate genuine concerns
from generic scanner findings, and the narrowly scoped hosted index migration that
was approved and applied afterward.

This was database maintenance only. No Admin or mobile application source was
changed, no Vercel deployment or mobile build was issued, and no release-control
version or build counter was incremented.

## Performance Report Assessment

The submitted report contained `74` findings:

- `35` duplicate-index findings
- `39` missing foreign-key-index findings

The headline count overstated the operational risk because it combined:

- true duplicate application indexes
- indexes backing duplicate legacy unique constraints
- harmless missing indexes on tiny or empty tables
- Supabase-managed `storage` objects that FlockTrax should not alter
- high sequential-scan counts on very small lookup tables where PostgreSQL is
  correctly choosing a sequential scan

The report was useful as a discovery source, but its recommendations were not
applied automatically.

## Live Database Condition

Read-only inspection of the linked hosted Supabase project found:

- database size approximately `79 MB`
- table cache hit rate `100%`
- index cache hit rate `100%`
- dead tuples low and declining, with `808` reported in the weekly comparison
- no blocked queries
- no long-running queries
- no meaningful capacity or table-bloat emergency
- duplicate-index storage approximately `1.4 MB`

The weekly connection count increased from `10` to `21`, but live role inspection
showed normal pooled and administrative usage rather than connection pressure:

- `authenticator`: `16 / 60`
- `supabase_admin`: `6 / 60`
- `pgbouncer`: `1`
- one temporary CLI inspection connection

No connection-limit change or emergency maintenance was recommended.

Table bloat was small in absolute terms. `VACUUM FULL` was specifically rejected
because its table locks and operational risk would outweigh the limited space
recovery. Normal PostgreSQL autovacuum remains appropriate.

## Approved Maintenance Scope

The user approved a targeted migration for:

- duplicate `log_mortality` placement/date indexes
- missing `activity_log(flock_id)` index
- missing `feed_drops(queued_from_placement_id)` index

Source migration:

- `supabase/migrations/20260810143000_optimize_mortality_activity_and_feed_drop_indexes.sql`

The migration was applied to the linked hosted Supabase project and recorded in
the remote migration ledger as:

- `20260810143000`

## Mortality Index Consolidation

The application mortality upsert uses the column conflict target:

- `placement_id,log_date`

It does not reference a unique-constraint name. The migration therefore retained
the established unique constraint:

- `log_mortality_placement_date_uk`

It removed three redundant unique constraints:

- `log_mortality_placement_id_log_date_key`
- `log_mortality_unique`
- `uq_log_mortality`

It removed three redundant nonunique composite indexes:

- `idx_log_mortality_place_date`
- `idx_log_mortality_placement_date`
- `ix_log_mortality_placement_date`

Important retained indexes include:

- `log_mortality_pkey`
- `log_mortality_placement_date_uk`
- `ix_logs_mortality_place`
- `idx_log_mortality_created_by`

This preserves mortality upsert uniqueness and the heavily used placement-only
lookup while reducing repeated index maintenance on mortality writes.

## Added Lookup Indexes

The migration added:

- `idx_activity_log_flock_id` on `public.activity_log(flock_id)`
- `idx_feed_drops_queued_from_placement_id` on
  `public.feed_drops(queued_from_placement_id)`

These were selected because the FlockTrax application has actual workload paths
that query or clean up records using these foreign-key columns. The remaining
generic missing-FK recommendations were intentionally deferred.

The migration ran `ANALYZE` on:

- `public.log_mortality`
- `public.activity_log`
- `public.feed_drops`

## Hosted Deployment Method

The repository has an intentionally mixed historical Supabase migration ledger
because many earlier changes were applied directly during hosted development. A
blanket `supabase db push --include-all` would have attempted to replay numerous
already-live historical migrations and was not used.

To deploy safely:

- an isolated temporary Supabase work directory was created
- only migrations already present in the hosted ledger were copied into it
- the new `20260810143000` migration was added
- a linked dry run confirmed that exactly one migration would be applied
- that one migration was pushed successfully
- the temporary deployment files were removed afterward

Dry-run result:

- only `20260810143000_optimize_mortality_activity_and_feed_drop_indexes.sql`
  would be pushed

Deployment result:

- migration applied successfully
- remote migration ledger contains local/remote version `20260810143000`

## Verification

Live index inspection after deployment confirmed:

- `log_mortality_placement_date_uk` remains present on
  `(placement_id, log_date)`
- the six approved duplicate mortality indexes/constraints are absent
- `idx_activity_log_flock_id` is present on `flock_id`
- `idx_feed_drops_queued_from_placement_id` is present on
  `queued_from_placement_id`
- the mortality primary key, created-by index, and placement-only index remain
  available

The two new indexes initially show zero scans, which is expected immediately after
creation. Their use should be evaluated over future reporting periods rather than
judged from the creation-day statistic.

Repository validation:

- `git diff --check` passed
- the temporary deployment workspace no longer contributes untracked files
- the new migration and this checkpoint/index update are not yet committed

## Deferred Findings

No action was taken on:

- the duplicate `log_daily(placement_id, log_date)` constraint/index cluster
- remaining generic missing foreign-key indexes without workload evidence
- Supabase-managed `storage` indexes
- empty `gsync` table recommendations
- small platform and lookup tables where an added index would not currently help
- sequential scans on tiny tables

The `log_daily` duplicate cluster remains the clearest optional follow-up. It should
be handled through a separate reviewed migration that preserves one unique
placement/date constraint and the independently useful placement/date lookup
indexes.

## Recurring Review Method

The agreed method for future Supabase performance reviews is:

- submit the raw report as searchable `.txt`, `.json`, or `.csv`
- identify the report period and environment
- retain prior-run comparisons when available
- use the report for discovery, not automatic remediation
- verify material findings against the linked hosted database with read-only CLI
  inspection before approving changes

This approach avoids exposing credentials or exporting production data while still
allowing meaningful workload, table-size, index-use, bloat, blocking, and connection
verification.

## Exact Stopping Point

Hosted Supabase is already running the approved maintenance migration. The local
working tree contains the migration plus this checkpoint and index update, but they
have not been committed or pushed to Git.

Expected pending files after this checkpoint:

- `supabase/migrations/20260810143000_optimize_mortality_activity_and_feed_drop_indexes.sql`
- `output/FlockTrax_Supabase_Performance_Review_And_Index_Maintenance_Checkpoint_2026-08-10.md`
- `output/FlockTrax_Checkpoint_Index.md`

## Resume Guidance

On the next workline:

1. Read this checkpoint and the August 7 production checkpoint.
2. Treat hosted migration `20260810143000` as already applied and verified.
3. Do not replay the repository's missing historical migrations with
   `supabase db push --include-all`.
4. Commit the migration and checkpoint/index files when a repository commit is
   requested.
5. Review a future weekly report for whether the total duplicate count dropped and
   whether the two new indexes have accumulated scans.
6. Consider a separate `log_daily` duplicate-index cleanup only after explicit
   approval.

