# FlockTrax Admin Report Print and Feed Projection Production Checkpoint

Date: `2026-08-31`
Branch: `main`
Repository: `C:\dev\FlockTrax`
Source baseline: `bec6233`
Production deployment: `dpl_AvZmrMupMEETMbPC8sLokg6NzSgW`
Production alias: `https://flocktrax.com`
Checkpoint type: detailed implementation, production deployment, verification, and stopping-point checkpoint

## Purpose

This checkpoint records the production state after the August 31 Admin report
work. It covers the Closeout Queue portrait-print redesign, correction of the
iOS build-date control record, the custom feed-projection window correction,
the age-based Starter-to-Grower ordering rule, restoration and expansion of the
Pending Orders section, timeframe-based report titles, and the final print/PDF
presentation changes.

For database authorization, credential cutover, and iOS TestFlight context,
load this checkpoint together with:

- `output/FlockTrax_Release1_Permissions_Credential_Cutover_And_iOS_1_0_7_TestFlight_Checkpoint_2026-08-29.md`
- `output/FlockTrax_P0_Database_Authorization_Production_Checkpoint_2026-08-28.md`

No secret values or sensitive credentials are recorded here.

## Current Production Baseline

At the start of this checkpoint documentation:

- `HEAD`: `bec6233` (`Keep projection orders on same print page`)
- `origin/main`: matched local `main`
- final Vercel deployment: `dpl_AvZmrMupMEETMbPC8sLokg6NzSgW`
- deployment state: `READY`
- production alias: `https://flocktrax.com`
- local TypeScript validation: passed
- local optimized Next.js production build: passed
- Vercel optimized production build: passed
- all `49` Next.js routes generated successfully

The checkpoint/index documentation commit will follow this source baseline and
will not alter application behavior.

## Closeout Queue Portrait Report

The Closeout Queue report was redesigned for US Letter portrait printing:

- changed print orientation from landscape to portrait;
- compacted table font size, row padding, status pills, legend spacing, and
  column widths;
- changed the combined `Flock / Placement` heading to `Flock`;
- increased the flock-number size and used a `900` font weight so the primary
  identifier remains easy to scan;
- moved Farm Group out of every table row and into the report metadata/header;
- adjusted the matrix from thirteen to twelve columns after removing the
  repeated Farm Group column.

Commits:

- `bfd4e88` - `Compact closeout queue report for portrait printing`
- `602f8fb` - `Move closeout farm group into report header`

## iOS Build 20 Display-Date Correction

The installed iOS `1.0.7 (20)` build displayed the old release/build date even
though the current build was installed. The compiled client version was already
correct; the displayed date came from the hosted `platform.control` record.

Implemented correction:

- migration: `20260831100000_sync_mobile_ios_1_0_7_build_date.sql`
- commit: `e5ac3c4` (`Correct iOS build 20 release date`)
- target row: `mobile_ios`, version `1.0.7`, build `20`
- corrected `released` value: `2026-08-29`
- migration guard requires exactly one matching row and raises otherwise
- local and remote Supabase migration history both contain `20260831100000`

This was a hosted version-control metadata correction. It did not require a new
iOS compilation or another Apple review submission.

## Feed Projection Window Correction

The Custom Days report incorrectly included flocks outside the requested
projection horizon. The reported example was flock `347-S2`, shown at `-49`
days out but still included in a 14-day report.

The shared placement filter now calculates an inclusive window from today
through `windowDays - 1` and applies that window to both report modes:

- active placements must overlap the selected horizon;
- scheduled placements are included in planning mode only when their placement
  date falls inside the selected horizon;
- inventory-only rows remain available in planning mode;
- selected farm group, farm, barn, and flock filters still apply.

Commit:

- `24698f1` - `Constrain custom feed projections to selected window`

## Starter-to-Grower Ordering Rule

A new business rule prevents late Starter orders that would arrive after the
flock should transition to Grower:

1. Calculate the remaining Starter gap using the established lifecycle target,
   recognized supply, and all open Starter orders.
2. Add the five-day feed-order lead time to the flock's current age.
3. If `age + 5 > 21`, set additional Starter Needed to zero.
4. Add the calculated Starter gap to Grower Needed instead.

The Starter math dialog explicitly explains when and why the shortage was moved
to Grower and shows the converted weight.

Commit:

- `197a8e0` - `Reclassify aged starter shortages as grower`

## Pending Orders Section

Both the standard 10-Day report and the Custom Days report now include a
Pending Orders section below the projection matrix.

The section reports:

- delivery date;
- farm;
- barn;
- bin number;
- associated flock when available;
- feed type/name;
- source;
- status;
- remaining ordered pounds;
- queued/received pounds;
- external order reference.

It combines applicable open/partial FlockTrax commitments with BinSentry
orders, uses canonical bin references, resolves feed and bin metadata, follows
BinSentry pagination, deduplicates results, and lists the orders independently
of the short projection window. The calculation logic retains its separate
feed-type/window rules.

Implementation and repair sequence:

- `c878202` - `List open feed orders on projection reports`
- `c21130f` - `Always list BinSentry feed orders`
- `58147bf` - `Restore BinSentry projection orders`
- `91851bf` - `Show feed bin numbers on projection orders`

The initial section appeared empty because production BinSentry configuration
was unavailable to the report runtime and one normalized status field was
incorrectly assigned. Production variables were restored without recording
their values:

- `BINSENTRY_API_ROOT_URL`
- `BINSENTRY_USERNAME`
- `BINSENTRY_PASSWORD`

The loader now emits a server-side error message when the safe BinSentry order
lookup fails instead of silently returning an empty list.

Production verification of the exact report path found:

- `7` Pending Orders;
- `96,000 lb` total ordered;
- bin numbers resolved for all seven orders.

The last Pending Orders data deployment in this sequence was:

- deployment: `dpl_9kpQtA6LA5YhnrHHpLSaAk7FFfSb`

## Feed Projection Titles

The report masthead now follows the standard FlockTrax report pattern and names
the actual projection timeframe:

- standard report: `10-Day Feed Projection`;
- custom report: dynamic `{days}-Day Feed Projection`;
- browser metadata uses the same timeframe;
- summary labels use hyphenated timeframe wording;
- description: `Future feed prediction analysis adjusted for feed inventory
  and pending orders.`

Commit and deployment:

- commit: `06edc2d` (`Use timeframe titles for feed projections`)
- deployment: `dpl_Ek6xoAHDwcrcwhDoTDsxH4BzvERH`

## Print/PDF Ordering Results

Printing or saving either Feed Projection report as PDF now automatically
enables the detailed feed view before the browser print job is composed.

Behavior:

- the detailed Starter/Grower columns are always present in printed/PDF output;
- the `Order Needed` or `Req'd Feed` Starter and Grower columns use `900` font
  weight and a subtle contrasting background;
- print color adjustment is requested so the emphasis is retained in PDF/print;
- report toolbar controls are excluded from printed output;
- detailed output uses landscape orientation;
- browser-native printing is covered through `beforeprint` in addition to the
  report's `Print / Save PDF` button;
- if Show Detail was collapsed on screen, it is restored to collapsed after
  printing;
- if the user already had Show Detail enabled, it remains enabled afterward.

Commit and deployment:

- commit: `feb1d4c` (`Emphasize feed order results in print`)
- deployment: `dpl_9CENgS7YnJfvTkjUfpMHAX4PPin2`

## Same-Page Pending Orders Print Layout

The earlier forced page break before Pending Orders was removed. Pending Orders
now follows the projection matrix on the same printed side/page whenever space
allows. Its print gap, top margin, and top padding were compacted for the normal
operating case of approximately ten barns.

If a larger result set truly exceeds the physical page, the browser may flow
the excess naturally rather than shrinking the report to unreadable text.

Final commit and deployment:

- commit: `bec6233` (`Keep projection orders on same print page`)
- deployment: `dpl_AvZmrMupMEETMbPC8sLokg6NzSgW`
- deployment state: `READY`
- production alias: `https://flocktrax.com`

## Validation Summary

Completed during this workline:

- repeated `npm run typecheck` passes;
- repeated optimized `npm run build` passes;
- Next.js lint and type validation during production builds;
- successful generation of all `49` application routes;
- repeated `git diff --check` passes;
- Vercel production builds completed successfully;
- final deployment reached `READY` and was aliased to `flocktrax.com`;
- production website availability returned HTTP `200` after the highlighted
  results deployment;
- exact report-path BinSentry verification returned seven orders / 96,000 lb;
- all seven displayed orders resolved bin numbers.

Recommended quick visual acceptance after resuming:

1. Open both 10-Day and 14-Day Custom Feed Projection reports.
2. Keep Show Detail off and select Print / Save PDF.
3. Confirm Starter/Grower detail appears automatically in landscape output.
4. Confirm the two result columns are bold and shaded.
5. Confirm Pending Orders follows the projection on the same page for the
   normal ten-barn scope.
6. Confirm the on-screen detail setting returns to its previous state after the
   dialog closes.
7. Confirm a longer report flows naturally if it cannot fit on one page.

## Security and Mobile Boundary Carried Forward

The August 29 Release 1 checkpoint remains authoritative for security details.
Important unresolved items are unchanged:

- P0 database authorization containment is live;
- Dana's manager-level daily-log RLS regression was repaired and field-confirmed;
- ordinary farmhand/worker mobile acceptance testing is still required;
- the replacement backend secret and publishable client-key paths are live;
- the coupled legacy Supabase JWT `anon` and `service_role` keys remain enabled
  pending sufficient validation/distribution of the replacement mobile build;
- the old service-role JWT must still be treated as exposed while enabled;
- legacy keys must not be disabled until action-time confirmation and the
  Release 1 revoked-stage verification gate are ready.

The next security action remains creation/use of a disposable `test_worker` or
consenting farmhand account to validate farm scoping, daily logs, mortality,
weights, feed tickets, and Work Orders on iOS `1.0.7 (20)`.

## Working Tree Boundary

Before this checkpoint and index entry were created, local `main` matched
`origin/main` at `bec6233`. Two intentionally uncommitted items remained:

- modified `supabase/.temp/cli-latest`
  - generated Supabase CLI metadata changed from `v2.111.0` to `v2.116.0`;
  - do not include it in the checkpoint commit;
- untracked `mobile/screens/errors/RLS-ErrorAfterPermissionsMigration.PNG`
  - diagnostic screenshot from the post-P0 RLS incident;
  - user explicitly chose to leave it untracked without adding a `.gitignore`
    rule.

Nothing was staged before checkpoint creation. Preserve both items unless the
user later gives separate instructions.

## Commit Sequence Since the August 29 Checkpoint

- `bfd4e88` - Compact closeout queue report for portrait printing
- `602f8fb` - Move closeout farm group into report header
- `e5ac3c4` - Correct iOS build 20 release date
- `24698f1` - Constrain custom feed projections to selected window
- `197a8e0` - Reclassify aged starter shortages as grower
- `c878202` - List open feed orders on projection reports
- `c21130f` - Always list BinSentry feed orders
- `58147bf` - Restore BinSentry projection orders
- `91851bf` - Show feed bin numbers on projection orders
- `06edc2d` - Use timeframe titles for feed projections
- `feb1d4c` - Emphasize feed order results in print
- `bec6233` - Keep projection orders on same print page

## Exact Resume Plan

1. Load this checkpoint and the August 29 Release 1 checkpoint.
2. Run the quick visual print/PDF acceptance checklist above using a normal
   ten-barn feed-projection scope.
3. Create or use the planned worker/farmhand test account and execute the
   Release 1 permission matrix on iOS `1.0.7 (20)`.
4. Record any mobile RLS or permission error with the exact operation, role,
   farm membership, build, and error text.
5. Do not revoke legacy Supabase JWT keys until the replacement build has passed
   worker testing and has sufficient active-user adoption.
6. At revocation time, reconfirm the project, disable the coupled legacy keys,
   and immediately run the Release 1 hosted gate in `Revoked` stage.
7. For later feed-report changes, preserve the current separation between the
   short calculation window and the full Pending Orders reference list.

## Suggested Resume Prompt

`Load output/FlockTrax_Admin_Report_Print_And_Feed_Projection_Production_Checkpoint_2026-08-31.md and output/FlockTrax_Release1_Permissions_Credential_Cutover_And_iOS_1_0_7_TestFlight_Checkpoint_2026-08-29.md first. Treat commit bec6233 and Vercel deployment dpl_AvZmrMupMEETMbPC8sLokg6NzSgW as the Admin production baseline. The Closeout Queue is portrait-ready, feed projection windows and Starter-to-Grower ordering are corrected, Pending Orders with bin numbers are restored, and print/PDF automatically expands and emphasizes Starter/Grower order results while keeping normal Pending Orders on the same page. Preserve the generated Supabase CLI metadata change and the untracked RLS screenshot. Next, visually accept the report print layout and complete the iOS 1.0.7 build 20 worker permission matrix before planning legacy-key revocation.`
