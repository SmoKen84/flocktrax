# Production inventory reading-time hotfix

Date: 2026-09-18

## Problem and evidence

The production Current Feed Inventory report displayed March 9, 2026 for Reading Time even though BinSentry was returning September 18 inventory measurements. Two live read-only checks established that the bin configuration's updatedAt was 2026-03-09, while each linked latest-valid reading had a createdAt on 2026-09-18 at approximately 09:55 UTC. The pounds were from the latest reading; the incorrect date came from merged bin metadata.

## Correction

The fetch now resolves measurement time directly from the latest-reading entity before merging it with bin properties for other inventory fields. Explicit captured/measured/last-reading timestamps take priority, followed by the reading entity's created/published/updated timestamps. Generic createdAt and updatedAt from the bin configuration are never considered measurement times. Dates are validated and normalized to ISO UTC.

Missing measurement timestamps remain null. The report displays Not supplied; it does not invent freshness by substituting the report request time. Undated readings are not inserted into the dated inventory snapshot history. Inventory values may still be displayed. No historical database timestamps or inventory amounts were rewritten.

The report heading is Reading Time (Central). Its note distinguishes actual measurement time from the report Generated time. This corrects the misleading age impression without hiding truly old measurements.

## Validation

- Regression tests exclude bin configuration dates, prioritize reading timestamps, handle invalid/missing dates and normalize time zones.
- Live read-only verification of two production bins through the corrected readCurrentBinSentryInventory returned their actual September 18 reading timestamps.
- TypeScript and diff checks passed on production and demo.
- The same shared parser was promoted independently to demo; its synthetic inventory branch remains synthetic and is not made artificially current.

## Release identities

Production source: 00ca1d7 on release/admin-2.6.0.
Demo source: 715d031 on demo-hosted.
Production deployment: dpl_GTyCWMDJYyJvF95A1SMSch27U75x, https://web-admin-ladpvsmza-flock-trax.vercel.app.

The preceding combined release checkpoint remains the baseline for the rest of the application. No schema migration is required. For application rollback use the September 18 pre-hotfix production deployment dpl_3xvzw7TytDja1pKmFmHf9x4PhBEB or demo deployment dpl_JA4ZUjTz9UxmZBs6bPWpjuGaERNy.

Both deployments completed READY and were aliased to their live domains. Demo deployment: dpl_7Zi5A1qjoww9HBUdyUPEq63vEvWv, https://flocktrax-demo-oixab8use-flock-trax.vercel.app. Optimized Vercel builds passed in both environments.
