# Barn Vacancy Calendar — production checkpoint, October 12, 2026

## Delivered

Reports → Quick Access Reports → Barn Vacancy Calendar → Preview.

Live route: https://flocktrax.com/admin/reports/barn-vacancy

Each monthly calendar has one row per active barn and a solid, consistently colored line across its projected vacant dates. Farm group, farm, barn, and date-range filters are available. The report includes empty barns, expandable date lists, and landscape Print / Save PDF styling.

Occupancy begins on placement start and ends immediately before placement start + 43 calendar days. That 43rd-day date is the first projected vacant date. The next placement ends vacancy on the previous date. Overlapping and adjacent occupancy windows are combined. No cleanup days are added; after the last known placement, vacancy continues to the report boundary. Recorded removals on or before the range start retire earlier placements. Canceled and unassigned placements do not occupy barns. Missing or invalid start dates produce an explicit unknown state, not vacant dates.

Uses placement `active_start`, falling back to flock `date_placed` only when absent. It does not use `max_date`, projected livehaul, or `active_end` to override the requested 43-day rule. Future dates are explicitly estimates. Access is checked against the signed-in actor's dashboard access and farm memberships. Queries are paginated, and failed schedule reads show an error rather than vacancy.

## Source and deployment

- Production branch: `release/admin-2.6.0`, checkout `C:/dev/FlockTrax-Production-Release`.
- Feature commit: `cc1a4b7`; full-width report layout: `c572a8f`. Both pushed to origin.
- Deployment: `dpl_Eaf57U3MvFKqhcBVLaJ5o5TGLEny`, READY.
- Deployment URL: https://web-admin-dt2bh5855-flock-trax.vercel.app
- Production alias confirmed by deployment: https://flocktrax.com
- Previous production deployment: `dpl_Ex5pmb3qm4xWAE45f9gcPh1pEnZb`, https://web-admin-dsjva7b9c-flock-trax.vercel.app.
- Isolated build/deploy checkout: `C:/dev/FlockTrax-Vacancy-Release`, detached at `c572a8f`. Its ignored node_modules junction points to the production checkout's dependencies. Local environment and Vercel project linkage are ignored and were not committed.

## Verification

- Ten unit, data-loader, and render tests pass: 43-day boundary, DST/year rollover, next-placement cutoff, overlapping/adjacent placements, empty barns, cancellations, recorded removals, missing dates, date normalization, scope restrictions, pagination beyond 1,000 rows, query errors, and rendered spans.
- TypeScript check passed. An initial local build collided with a concurrently running development server's `.next` files. The isolated optimized build then passed; final hosted compilation, type checks, and route generation passed.
- Read-only production comparison passed: 10 barns, 56 placement records, 910 barn-days over October 12, 2026–January 10, 2027, zero unknown barns. No database records were changed and no migration was needed.
- Authenticated local browser inspection confirmed full-width colored calendar lines and live data.
- Authenticated production browser verification confirmed the Quick Access menu entry, filter form, generated Preview URL, and eight Woape barns on the filtered October calendar.
- Native print preview could not be inspected through the browser automation; print styling was build-checked only. Do not claim exported-PDF visual verification.

Commands from web-admin:

```powershell
node --test lib/barn-vacancy.test.cjs
node ../toolkit/Test-BarnVacancyHosted.cjs .env.local frneaccbbrijpolcesjm
npm run build
```

The production checkout's pre-existing `supabase/.temp/cli-latest` modification and untracked `tools/` were excluded. Demo and historical/mobile source were not modified. The existing development server was not stopped.
