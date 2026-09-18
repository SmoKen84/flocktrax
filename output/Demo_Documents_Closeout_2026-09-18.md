> Release update: deployed to the hosted demo on 2026-09-18 as source fa7588c, deployment dpl_JA4ZUjTz9UxmZBs6bPWpjuGaERNy. Earlier local-only statements below describe the implementation stage and are superseded by the combined release checkpoint.

# Demo repository and closeout showcase - 2026-09-18

## Available in the hosted demo database/storage now

31 fictional PDFs marked DEMO / SAMPLE:
- 11 feed delivery tickets, covering all current demo feed tickets.
- 6 hatch tickets for placed/historical flocks (future scheduled arrivals excluded).
- 3 livehaul bills of lading and 6 load scale tickets.
- 2 closeout worksheet snapshots, 2 service invoices and 1 settlement statement.

Two added historical examples preserve the existing growing flocks:
- 2601-A-1, Cedar Creek Farm: submitted; awaiting settlement.
- 2602-C-2, Pine Hollow Farm: settlement received; awaiting final closeout.

Each has 10,000 placed birds, 300 recorded mortality, 9,700 livehauled birds, 97,000 lb live weight, and 169,000 lb feed. Final closeout remains incomplete. Supporting invoice figures are fictional, not payable.

## Reset and deployment

Database reset now restores the two closeout scenarios, feed allocations, mortality and load details. Local Environment Control additionally regenerates and attaches PDFs after reset, using the restored dates and values. This website change and pdf-lib dependency need deployment before hosted Environment Control regenerates PDFs. Direct SQL reset only restores database rows; run the document seed script afterwards.

From web-admin, run `node --env-file=.env.local scripts/seed-demo-documents.cjs` to restore missing PDFs. It refuses non-demo URLs and checks the guarded demo status RPC. Current user-uploaded documents are preserved. Repeat seeding created zero duplicates.

## Verification

TypeScript and diff checks passed. All 31 stored PDFs downloaded successfully, matched recorded SHA-256/byte size, had one page and extractable DEMO text. Representative documents across all six repository roles were rendered and visually reviewed. Reset was tested in a database transaction and rolled back; baseline checks returned ok=true and both near-complete closeouts were restored. Existing evaluator work was not reset.

Database migrations: 20260919000000 and 20260919001000, applied to demo only. The latter fixes null-description comparison in the settings reset baseline without replacing demo setting values.
