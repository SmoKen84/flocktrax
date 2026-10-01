# Feed projection arrival and breed standards checkpoint — 2026-10-01

## Fix

344-W1 is awaiting arrival on October 7, 2026. The October 1 ten-day projection incorrectly required feed standards for pre-arrival ages (including day zero). Adding ages 57–70 could not resolve that error.

Production commit e745b03 and demo commit e17e41f make pre-arrival demand and bird counts zero without consuming mortality or requiring standards. Arrival remains report age 1. Genuine missing standards now identify sex and exact age days. The shared loader serves the report and dashboard popup.

## Data sync

Copied and verified all 284 production stdbreedspec reference rows into demo, including ages 57–70. Preserved all 182 existing demo-only Cobb rows; demo total is 466. A second preview found zero inserts or updates outstanding. Production data was read only. No flock assignments or breed lookup records were changed.

Reference-data recovery snapshots: breed-standards-sync-2026-10-01T19-15-39-888Z/production-standards.json, demo-before.json, demo-after.json. These contain standards only, no credentials. Sync tool: toolkit/Sync-BreedStandardsToDemo.cjs (preview by default, --apply to write).

## Verification

Five regression tests and TypeScript checks passed in both release environments. Read-only hosted-data probe of the actual shared report loader for 344-W1 returned no problems, zero feed October 1–6, and 2,970 lb total October 1–10 using current production standards. No authenticated browser interaction was claimed.

## Release

Production deployment: dpl_FwH55fPNN6enPbmXRomp312Nb4Tm, https://web-admin-vycoaya0e-flock-trax.vercel.app.
Demo deployment: dpl_2Bi4CTrfUfkSGc25NY6M4pC5g8nr, https://flocktrax-demo-mv7rn81pz-flock-trax.vercel.app.

Production checkout was fast-forwarded, updating localhost source. Demo received only the feed fix; existing demo restrictions remain. Prior permissions selector/print changes remain production-only. No schema migration or mobile release required. Preserve unrelated historical working-tree changes.

Both deployments reported READY and aliases were updated successfully.
