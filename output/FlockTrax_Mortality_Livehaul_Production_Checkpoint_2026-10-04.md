# Mortality livehaul production checkpoint — 2026-10-04

Source commit: `6e48bd5`, branch `release/admin-2.6.0`, checkout `C:/dev/FlockTrax-Production-Release`.

The detailed mortality report now includes a Combined Livehaul Removed column on screen and a Combined Livehaul column in portrait printing. Daily female/male/combined population, opening balance forward, ending totals, and summary cards subtract recorded livehaul removals separately from mortality. Mortality remains dead plus culls. Counts are effective at the end of each report date.

Recorded non-null load head counts are summed and take precedence over the schedule's actual head count, including an explicit zero. Actual header counts are used when no load head counts were entered. Planned targets and canceled events do not remove birds. Actual date takes precedence over scheduled date. Target-sex removals affect that sex; unspecified/mixed-sex removals are allocated proportionally across the birds present after that day's mortality. Population is clamped at zero while the report preserves the full recorded removal count. Historical days are replayed so pre-range removals and split-sex arrivals carry into opening balances. Schedule/load queries are batched and paginated and fail explicitly on errors.

Validation:

- 12 regression tests passed, including partial ranges, split-sex arrivals, actual versus scheduled dates, mixed-sex allocation, count precedence, cancellation, overflow, pagination, and load failure.
- TypeScript check and optimized local/hosted builds passed.
- Read-only hosted mortality comparison passed against 1,054 production mortality records / 56 placements; existing September 23–27 daily mortality totals were preserved.
- Read-only livehaul comparison passed across 37 flock sections, 280,374 recorded removals, and 49 partial-range checks after removals.
- No flock, mortality, or livehaul records were modified; no database migration was required.

Production deployment `dpl_Ex5pmb3qm4xWAE45f9gcPh1pEnZb` is READY:

- https://web-admin-dsjva7b9c-flock-trax.vercel.app
- Verified aliases https://flocktrax.com and https://admin.flocktrax.com.
- Production login returned HTTP 200; unauthenticated mortality report returned the expected HTTP 307 login redirect.

Authenticated production browser/print inspection was not performed. The demo and historical/mobile checkout were not changed. Pre-existing modified `supabase/.temp/cli-latest` and untracked `tools/` were excluded from commits.

Read-only verification commands, run from `web-admin`:

```powershell
node ../toolkit/Test-MortalityWindowHosted.cjs .env.local frneaccbbrijpolcesjm
node ../toolkit/Test-MortalityLivehaulHosted.cjs .env.local frneaccbbrijpolcesjm
```

Use a local environment file with a valid production admin key; never print its contents. The older `.env.vercel.production.local` in this checkout did not contain a usable admin key during verification.
