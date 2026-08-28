# Legacy migration archive

These 95 migrations are the pre-baseline history preserved on 2026-08-27.

They were archived because the chain was not reproducible from a clean Supabase
database: migration `20260407103000_feed_ticket_mobile.sql` expected
`public.feed_tickets` and `public.feed_drops`, but no earlier active migration
created those relations. Many files had also been executed manually against the
hosted database without corresponding rows in `supabase_migrations.schema_migrations`.

The hosted schema was not rebuilt or rewritten during reconciliation. A tested
schema-only snapshot became the new active baseline, and only the hosted
migration ledger was rebased to match it.

Remote migration versions recorded immediately before the rebase:

- `20260216212000`
- `20260216212854`
- `20260313093000`
- `20260422162000`
- `20260518124014`
- `20260519094709`
- `20260526105000`
- `20260712143000`
- `20260713123000`
- `20260720005413`
- `20260720020000`
- `20260810143000`
- `20260822090000`
- `20260827170000`

Do not run these archived files against an existing database or place them back
in the active migrations directory.
