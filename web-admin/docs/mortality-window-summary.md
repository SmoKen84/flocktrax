# Mortality window summary

The detailed mortality report and live dashboard use the server-only
`public.get_mortality_window` RPC. It returns one summary per requested placement
plus daily details for the requested inclusive dates. Pre-period mortality stays
in Postgres and is returned as female/male loss totals for opening populations.
Null daily counts remain null; inactive logs are excluded.

Dashboard mode additionally returns lifetime totals and the flock's first seven
days. Its recent period is today minus six days through today, using the existing
console date key. Recent totals and details now share these same boundaries;
previously the total could include an eighth day or future entries.

Requests are batched by 100 placement IDs and paginated if the API cap is smaller.
No extra empty-page request is needed when every ID has returned a summary.
The existing unique index on `(placement_id, log_date)` supports scoped reads.
The RPC uses invoker security and grants execution only to `service_role`, matching
the web-admin server client. Query errors propagate rather than displaying zero.

## Deployment order

Apply `supabase/migrations/20260929120000_add_mortality_window_summary.sql` before
deploying the web-admin changes. The old application can continue running with
the additive function installed; the new application requires that function.
There is no table rewrite, mortality data change, or sync worker change.

## Verification

From `web-admin`:

```powershell
node --test lib/supabase/fetch-all-rows.test.cjs lib/mortality-window-data.test.cjs
npm run typecheck
```

With the local Supabase Docker stack running, from the repository root:

```powershell
./toolkit/Test-MortalityWindow.ps1
```

The SQL runner creates and removes its own disposable database with minimal
fixture tables. It tests the actual migration against over 1,000 historical rows,
inclusive boundaries, culls, inactive logs, null counts, overlapping windows,
empty scopes, invalid ranges, and function execution privileges.

A read-only snapshot of 1,040 hosted mortality records was also loaded into an
isolated local database for comparison. The September 23–27, 2026 report matched
the paginated full-history implementation in every field. Dashboard lifetime and
first-week totals and both detail windows matched; corrected recent totals
equaled the displayed seven-day details. The report returned 35 daily records,
and the dashboard returned 73, plus placement summaries. These are response-size
observations, not production latency benchmarks.
