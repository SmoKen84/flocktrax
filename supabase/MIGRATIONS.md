# Migration baseline

The active migration history was rebased on 2026-08-27 because the legacy
migration chain could not build a fresh database. It referenced tables such as
`feed_tickets` and `feed_drops` that had originally been created outside the
tracked migration sequence.

Active migrations:

1. `20260827180000_create_admin_role.sql` creates the custom `admin` database
   role required by the schema grants.
2. `20260827181000_hosted_schema_baseline.sql` is a schema-only snapshot of the
   hosted database after the flock unassignment correction was applied.

The baseline was tested by applying it to an isolated Supabase shadow database.
It contains no production table rows.

All future database changes must be added as new timestamped migrations after
the baseline and applied with the Supabase migration tooling so local and hosted
migration ledgers remain synchronized.

The legacy SQL files are retained in
`supabase/migration_archive/legacy_pre_baseline_20260827` for audit history only.
They must not be copied back into the active `supabase/migrations` directory.

Operational data maintained outside schema migrations—including storage bucket
rows, cron job rows, and application configuration rows—is not recreated by the
schema-only baseline. Those records remain unchanged in the hosted database and
should be managed separately from schema migrations.
