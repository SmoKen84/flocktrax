# FlockTrax storm-safety checkpoint — October 1, 2026

Requested because of thunderstorms. This is a recovery checkpoint, not a new release.

## Resume here

- Production checkout: `C:/dev/FlockTrax-Production-Release`, branch `release/admin-2.6.0`; Next app in `web-admin`.
- Production deployed source: `49acde2` (formatted permissions printing), preceded by `80e2707` (Super Admin report-user selector). Both pushed to origin.
- Production deployment: `dpl_5kjZL5HPuA93ypdQFJqZtddMKFjc`, https://web-admin-b0dfob1ih-flock-trax.vercel.app, aliased to https://flocktrax.com. Deployment returned READY.
- Demo checkout: `C:/dev/FlockTrax-Demo-Hosted`, branch `demo-hosted`. Deployed source `963d758`; documentation HEAD before this checkpoint `69d9466`.
- Demo deployment: `dpl_DttpwjhmbqRhN5ds4XqNFMPJFY9Y`, https://flocktrax-demo-ggkdlqa5n-flock-trax.vercel.app, aliased to https://flocktrax-demo.vercel.app. Deployment returned READY.
- Working release checkout: `C:/dev/FlockTrax-Packet-Release`, branch `release/permissions-user-filter`, clean at `49acde2` before this checkpoint.
- Historical/mobile checkout: `C:/dev/FlockTrax`, branch `demo-platform`, HEAD `20fb4df`. Do not deploy its older web app over production.

## Completed changes and deployment boundaries

Both production and demo include:
1. Today's packet completion is capped at 50% without any explicitly entered mortality/cull number for today. Explicit zero counts. Saved blank packets remain pending and withhold the completion timestamp. Awaiting-arrival behavior is unchanged.
2. The dashboard feed icon opens an in-place ten-day popup, using the report's operational calculations and BinSentry inventory/orders. Close/Escape preserves dashboard context; a one-minute client cache and Refresh support repeat checks.
3. Installed desktop apps open `/login`, which redirects an authenticated user to the dashboard; the existing manifest identity remains `/admin/overview`.

Production and localhost production additionally include:
4. My Permissions report allows a Super Admin to select any configured user. Default is self; choices show name, email, role and account status. Server-side selection prevents other users from requesting another account via URL. The report identifies the selected account and assigned memberships.
5. Print / Save PDF on the opened permissions report. US Letter portrait, half-inch margins, report generation time in Central time, selected user/role/status, membership hierarchy, and two-column permission lists. Navigation, filter and action buttons are hidden in print.

The permissions selector and printing changes have NOT been ported to demo. Demo has additional evaluator restrictions in its report page; preserve these when adding parity. In particular, viewing a selected evaluator must accurately reflect evaluator restrictions, not accidentally show unrestricted role capabilities.

## Important user clarification

The user reported the selector missing, then replied 'got it' and 'nevermind', followed by the request for formatted printing. A proposed selector in the Reports menu was discarded before commit. The current selector is inside the OPENED My Permissions report, not in the Reports menu's filter panel. Do not mistake that canceled change for unfinished work.

Read-only live diagnostics confirmed the production Super Admin has assigned roles `ADMIN` and `super-admin`, is not banned or a demo evaluator, and passes the selector check. The access bundle contained 15 configured users at that time. No role, account, membership, or operational data was changed by diagnosis.

## Verification and limits

- Six permissions regression/render tests passed, covering Super Admin selection, secondary roles, non-admin forged targets, missing targets, invalid/disabled actors, and the report selector/print-button rendering.
- TypeScript checks passed; both permissions production deployments completed hosted compilation, checks, and page generation.
- Authentication redirects were verified for the local and hosted report routes.
- Print CSS was implemented and build-checked, but a real browser print preview or exported PDF was NOT visually inspected. Do not claim visual print QA.
- September 30 backlog checks confirmed both databases up to date with linked Supabase dry runs; these dashboard/PWA/permissions changes needed no migrations or Edge Function deployment.
- The previous backlog checkpoint contains prior rollout and rollback IDs: `FlockTrax_Deployment_Backlog_Checkpoint_2026-09-30.md`.

## Local server recovery

Local production runs on http://localhost:3010 using the production checkout and LIVE production data. It was stopped at the user's request, then later restarted for local verification. Do not assume it survives reboot.

Existing launcher: `C:/dev/Start-FlockTraxLocal.cjs`.
Arguments: `production C:/dev/FlockTrax-Production-Release/web-admin 3010`.
Run with Node in a hidden process if restart is needed. It verifies the production project and environment. Do not print environment files or credentials. Logs from the last restart: `C:/dev/flocktrax-production-local.stdout.log` and `.stderr.log`.

## Preserved local work and remaining future work

- Production has pre-existing modified `supabase/.temp/cli-latest` and untracked `tools/marketing-brochure/` files. These are not staged into the release.
- Demo and working release checkout were otherwise clean at checkpoint start.
- Historical checkout retains local mortality loader/report changes, packet-completion helper/tests, recovered September migrations, mortality tests/docs, research notes, screenshots and local tooling. Much duplicates deployed work. It is intentionally not reset or bulk-committed.
- Historical checkpoint index already contained uncommitted prior entries; new safety entries are added without replacing those entries.
- Multi-barn placement and BioWaste work remain research/planning, not implemented features.
- Grower Admin evaluator support remains unfinished as described in the September 28 checkpoint.
- The initial feed popup lookup can still be slow. Inventory is scoped to selected bins; orders are searched organization-wide then filtered. The shared report loader also reloads dashboard data. No per-bin-order optimization has been implemented.
- No mobile binary build/store submission was made in this session.

## Recovery discipline

Read current Git status before edits. Use the production checkout or a clean worktree from its release branch, preserve demo-specific safeguards, and keep credentials out of notes and commits. Documentation-only checkpoint commits require no redeployment. No automatic follow-up or background product work is requested by this safety checkpoint.
