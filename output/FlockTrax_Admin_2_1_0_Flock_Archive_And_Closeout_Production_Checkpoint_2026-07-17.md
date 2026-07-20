# FlockTrax Admin 2.1.0 Flock Archive And Closeout Production Checkpoint

Date: `2026-07-17`
Branch: `main`
Release commit: `9b1c033eca3b2a11ce0c902e90928be0902c1440`
Production baseline commit: `a4638e56ebb6887440761ac024ae5b55e125316f`

## Current Production Baseline

The admin archive/closeout release and its immediate archive-filter hotfix are
committed, pushed, built, and live in production.

- marketing version: `2.1.0`
- numeric build: `10`
- visible admin build label: `5.7`
- hosted release date: `2026-07-16`
- local `HEAD`: `a4638e56ebb6887440761ac024ae5b55e125316f`
- `origin/main`: `a4638e56ebb6887440761ac024ae5b55e125316f`
- production deployment: `dpl_GbDLveXxx5SHqgesP8GPPi9gn76h`
- production URL: `https://web-admin-2irxrn0l1-flock-trax.vercel.app`
- production aliases include `https://flocktrax.com` and `https://admin.flocktrax.com`
- Vercel target/status: `production / Ready`

Hosted `platform.control` row `id = 4`, group `admin`, was read back as:

- `version = 2.1.0`
- `build = 10`
- `build_label = 5.7`
- `released = 2026-07-16`

Release migration:

- `supabase/migrations/20260716002357_bump_admin_release_2_1_0_build_5_7.sql`

## Release Commits

### Main Release

Commit `9b1c033`:

`Release admin 2.1.0 archive and closeout improvements`

This commit contains the archived-flock retrieval, archive-detail, closeout,
document, report, navigation, and release-control changes described below.

### Immediate Production Hotfix

Commit `a4638e5`:

`Prevent scheduled placements from entering flock archive`

The first production check exposed a release-process mismatch: the hosted release
label had been changed before the local release commit was deployed, so the site
briefly showed the old archive behavior under the new version label. The release
commit was then pushed and deployed.

The archive query was also hardened so it no longer trusts only the parent
`flocks.is_complete` flag. A placement can now appear in Utilities -> Flocks only
when the placement itself is archived or its closeout has been completed/archived.
This prevents a scheduled placement tied to a reused or incorrectly completed
planning flock from leaking into the archive.

## Archived Flock Records

The Utilities -> Flocks screen is now a dedicated historical lookup surface.

Implemented behavior:

- excludes normal scheduled, awaiting-arrival, growing, and closeout-queue records
- includes placement records that are archived or have completed/archived closeouts
- provides filters for Placement/Flock, Farm Group, Farm, Barn, Month Placed, and Month Closed
- derives close date from `archived_at`, then `closeout_completed_at`, then removal date
- removes the repeated `Open the full historical flock record and filed documents` text
- reads the integrator name from `app_settings`, group `INTEGRATOR`, name `company_name`
- keeps completed historical records separate from active scheduling and closeout work

Hosted-data verification at checkpoint time found exactly seven qualifying
placements, all with `lifecycle_stage = archived`:

- `264-W5`
- `272-W2`
- `275-S1`
- `278-W7`
- `282-W5`
- `283-S2`
- `284-W4`

No scheduled placement was present in the verified archive result set.

Primary implementation:

- `web-admin/lib/flock-archive-data.ts`
- `web-admin/app/admin/flocks/page.tsx`
- `web-admin/app/admin/flocks/[flockId]/page.tsx`

## Archived Flock Detail

The archived detail screen now treats the flock as a complete historical record
rather than routing it back through the live planning workflow.

- hero title is `Archived Flock {placement code}`
- hero copy explains the audit lock and permitted notes/documents behavior
- closeout totals and livehaul details are read-only
- comments/notes remain updateable through the notes-only archived action
- documents remain accessible and new reference documents may be attached
- the obsolete Log Matrix Editor action is removed from archived records
- the obsolete Micro Archive Report action is removed
- the hero exposes only Closeout Report, Flock Detail Report, and Go Back...
- Go Back uses browser history with `/admin/flocks` as its safe fallback

New shared navigation component:

- `web-admin/components/go-back-button.tsx`

## Report Consolidation

The former Digital Archive Summary is presented as the Flock Detail Report.

- combines flock history with the Log Weight Report section
- replaces the older History/Micro Archive report overlap
- preserves closeout, livehaul/load, feed, daily-log, mortality, and weight context
- removes redundant report buttons from archived placement surfaces

The Closeout Report now includes all Action Items linked to the placement:

- includes both open and resolved items
- includes placement-linked items and barn items explicitly related to the placement
- prints each Action Item as a ticket
- prints linked updates/memos indented beneath the ticket
- follows the established Work Order report presentation

Primary report files:

- `web-admin/app/admin/flock-closeout/[placementId]/archive-summary/page.tsx`
- `web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx`
- `web-admin/lib/flock-history-report.ts`

## Archive Safety And Document Behavior

Server actions now protect archived data in addition to disabling controls in the
UI. Archived closeout totals and livehaul rows cannot be changed through direct
form/action calls.

Document upload selectors now default to `manual_upload` where applicable. The
original source filename remains unchanged when it is stored; the briefly
considered placement-code file-renaming behavior was intentionally not retained.

Primary files:

- `web-admin/app/admin/flock-closeout/actions.ts`
- `web-admin/app/admin/flock-closeout/closeout-document-panels.tsx`
- `web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx`
- `web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx`
- `web-admin/app/admin/feed-tickets/feed-ticket-document-uploader.tsx`
- `web-admin/app/admin/placements/[placementId]/logs/placement-hatch-ticket-panel.tsx`

## Verification

Successful release gates:

- web-admin TypeScript typecheck
- optimized Next.js production build
- all `44` static pages generated
- Git staged whitespace/error audit
- GitHub push of release and hotfix commits
- Vercel production build and alias promotion
- hosted `platform.control` readback
- hosted archive-candidate lifecycle audit

The production build retains the existing non-blocking Autoprefixer warnings that
recommend `flex-end` instead of `end` at three existing CSS locations.

Local Next.js builds twice encountered stale `.next` page-manifest errors against
untouched routes. Removing only the verified local `web-admin/.next` build cache
and rebuilding completed successfully. Vercel production builds completed normally.

## Git And Working Tree

At checkpoint time:

- local `main` matches `origin/main`
- no uncommitted `web-admin` source changes remain
- product baseline is commit `a4638e5`

Intentionally uncommitted and unrelated to this admin release:

- `supabase/.temp/cli-latest`
- `mobile/ReleaseSupport/AppScreens/1.0.5/`
- `mobile/ReleaseSupport/FlockTrax_Mobile_1_0_5_Release_Changes_2026-07-13.pdf`

The Supabase temp file is local CLI state. The two mobile paths are release-support
assets and were deliberately excluded from the admin release commits.

## Resume Guidance

For any archived-flock, closeout-report, historical-document, or admin `2.1.0`
follow-up, start from this checkpoint and commit `a4638e5`.

Recommended first checks after resuming:

1. Confirm Utilities -> Flocks still lists only completed/archived placements.
2. Open an archived flock and verify documents, notes, and all three hero actions.
3. Confirm closeout totals/livehaul remain locked while notes remain saveable.
4. Print Closeout Report and verify linked Action Item ticket/update history.
5. Print Flock Detail Report and verify the embedded Log Weight section.

Do not reintroduce archive eligibility based only on `flocks.is_complete`; the
placement/closeout qualification added in `a4638e5` is the authoritative guard.
