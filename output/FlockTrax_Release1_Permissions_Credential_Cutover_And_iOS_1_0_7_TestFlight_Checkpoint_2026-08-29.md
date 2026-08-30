# FlockTrax Release 1 Permissions, Credential Cutover, and iOS 1.0.7 TestFlight Checkpoint

Date: `2026-08-29`
Branch: `main`
Repository: `C:\dev\FlockTrax`
Supabase project: `frneaccbbrijpolcesjm` (`GPC-DailyCollection`)

## Purpose

This checkpoint records the current production state after the permissions
security review, P0 database containment, mobile RLS compatibility repairs,
Supabase secret-key cutover preparation, publishable-key migration, production
web and Edge deployments, automated Release 1 verification, and creation and
TestFlight submission of iOS `1.0.7 (20)`.

It is the authoritative resume point for completing mobile validation and then
revoking the exposed legacy Supabase JWT-based API keys.

No secret values, service-role JWTs, App Store reviewer passwords, or other
sensitive credentials are recorded in this checkpoint.

## Security Review and P0 Baseline

The detailed security review is stored in:

- `output/FlockTrax_Permissions_Security_Review_2026-08-28.docx`

The initial P0 production deployment is documented in:

- `output/FlockTrax_P0_Database_Authorization_Production_Checkpoint_2026-08-28.md`

P0 baseline:

- commit: `10eb392` (`Contain P0 database authorization exposure`)
- rollback tag: `checkpoint/pre-p0-hosted-deploy-20260828`
- hosted migration: `20260828110000_p0_database_authorization_containment.sql`
- the migration tightened farm scoping, active-membership enforcement, and
  privileged RPC/database operations
- the original P0 database authorization test suite was added under
  `supabase/tests/database/p0_database_authorization.sql`

## Mobile RLS Compatibility Incident and Resolution

After P0 deployment, mobile users encountered a `new row violates row-level
security policy for table "log_daily"` error.

Important diagnostic evidence:

- Dana Smotherman was affected even though her active memberships were Woape
  and Sedberry and her role was `farm_manager` for both
- Admin use continued without reported failures
- the failure was therefore not limited to ordinary farmhands and required a
  database action/RLS compatibility repair

Implemented repairs:

- commit `17a3931` (`Restore authorized mobile log saves after P0 RLS`)
- migration `20260829100000_restore_mobile_log_action_permissions.sql`
- database regression suite
  `supabase/tests/database/mobile_log_action_permissions.sql`
- commit `f96f7e6` (`Normalize hosted manager role authorization`)
- migration `20260829113000_normalize_database_role_codes.sql`

Observed result:

- Dana confirmed that the repair resolved her affected workflow
- a separate ordinary-worker/farmhand smoke test remains required

## Supabase Credential Cutover

A replacement Supabase secret key was created for production backend use. Its
value is deliberately not stored in source control or in this checkpoint.

Backend cutover state:

- Vercel production has sensitive environment variable
  `SUPABASE_SECRET_KEY`
- Edge Functions can resolve the named secret through the managed Supabase
  secret collection
- the sync worker and admin/tooling paths prefer the new secret-key variable
- legacy service-role support remains only as a temporary compatibility fallback
- privileged `googleapis-outbox-process` now validates the server secret and
  rejects public-key callers
- new Supabase secret keys are sent as `apikey`, not as a bearer user token

Credential-compatibility commit:

- `e3d2e74` (`Prepare safe Supabase secret key rotation`)

The commit also added:

- `toolkit/Test-FlockTraxRelease1.ps1`
- `toolkit/RELEASE1-VERIFICATION.md`
- dual new-secret/legacy compatibility in the web backend, Edge Functions,
  sync worker, and administrative scripts

## Publishable-Key Migration

Supabase's legacy `anon` and `service_role` JWT keys are disabled together by
the hosted dashboard control. Existing mobile `1.0.6` installations embed the
legacy anon key, so immediately disabling the pair would break those clients.

To remove that blocker, web, mobile, and affected Edge Functions were migrated
to the new Supabase publishable-key path:

- commit `13f25f4` (`Migrate clients to Supabase publishable keys`)
- mobile source version: `1.0.7`
- local iOS manifest build: `19` (not authoritative for production)
- local Android version code: `14` (no new Android production artifact built)
- EAS uses remote app versioning and automatic build increments
- actual iOS production artifact: `1.0.7 (20)`

Compatibility behavior:

- web prefers `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- mobile prefers `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Edge Functions prefer the managed publishable-key variables
- legacy anon environment variables remain temporary fallbacks during rollout
- no secret/service environment variable is referenced from a public client
  prefix

The hosted-test wrapper is:

- `toolkit/Invoke-FlockTraxRelease1HostedGate.ps1`
- use `-PromptForSecret` because sensitive Vercel variables cannot be exported
- the prompt is masked and the secret is retained only in process memory

## Production Web Deployment

The publishable-key web release was deployed successfully:

- source commit: `13f25f4`
- deployment id: `dpl_bvKwdZJVbcFGuGk62kKdmiNBkHwt`
- deployment URL: `https://web-admin-1qhh9xdg6-flock-trax.vercel.app`
- production alias: `https://flocktrax.com`
- state: `READY`
- Next.js optimized production build completed successfully
- production website returned HTTP `200`

The earlier new-secret production deployment was:

- deployment id: `dpl_AzishySuHbwzwt8z6wKrGeCSxSDJ`

## Edge Function Deployment

Twenty-nine hosted functions affected by publishable-key resolution were
redeployed successfully. Their existing gateway JWT-verification settings were
preserved.

Functions retaining `verify_jwt=true`:

- `export-adalo`
- `signup_proxy`
- `auth_logout`
- `auth_me`
- `auth_verify_refresh`
- `redeem-signup-code`
- `auth-signup`
- `auth-login`
- `login`
- `log-daily-get`
- `weight-entry-submit`
- `feed-ticket-get`
- `feed-ticket-submit`
- `feed-ticket-list`
- `auth-forgot-password`
- `auth-delete-account`

Functions retaining `verify_jwt=false` with their own in-function authorization
and/or established public gateway behavior:

- `log-mortality-upsert`
- `dashboard-placements-list`
- `dashboard-placements-list-adalo`
- `placement-day-get-adalo`
- `placement-day-submit`
- `placement-day-get`
- `weight-entry-get`
- `issue-create`
- `issue-resolve`
- `action-items-list`
- `issue-update`
- `operations-calendar-list`
- `adalo-placement-day-cache-fill`

Hosted metadata readback confirmed all 29 functions were active with the
expected `verify_jwt` settings.

## Verification Evidence

User-run Release 1 cutover gate:

- `PASS=9`
- `FAIL=0`
- `SKIP=1`

Passed checks:

- tracked repository secret scan
- client secret-reference scan
- new Supabase key compatibility
- production website availability
- public API health
- privileged worker rejection of public callers
- new secret-key backend access
- new secret-key Edge authorization
- legacy-key overlap access

Skipped check:

- authenticated user session because a disposable test-user access token was
  not supplied to the automated gate

Additional local cutover gate after publishable-key changes:

- `PASS=7`
- `FAIL=0`
- `SKIP=0`
- web typecheck passed
- optimized web production build passed
- mobile typecheck passed
- Git diff/PowerShell parser checks passed

Post-deployment hosted checks:

- production website: HTTP `200`
- Supabase Auth health with publishable key: HTTP `200`
- privileged worker with publishable key: HTTP `401` as required
- all affected Edge Function gateway settings matched their expected values

## iOS 1.0.7 Build and TestFlight

EAS build:

- marketing version: `1.0.7`
- authoritative remote build number: `20`
- platform: iOS
- build id: `abb465df-31bf-4e0e-a685-afbad94bfe21`
- source commit: `13f25f49cf7c2540a2a4b3b52819d35acd19a23b`
- status: `FINISHED`
- distribution: App Store
- build page:
  `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/abb465df-31bf-4e0e-a685-afbad94bfe21`

App Store Connect upload:

- upload completed successfully through EAS Submit
- submission id: `b8d06fd2-f2b3-443b-ad13-ead5d7d1be48`
- App Store Connect app id: `6763434225`
- TestFlight currently shows build `20` under version `1.0.7`
- current status at checkpoint: `Waiting for Review`
- assigned TestFlight groups shown in App Store Connect:
  - `Farms`
  - `Team (Expo)`
  - `Integrators`
  - `SmoFarmers`

The build is uploaded to TestFlight but has not been submitted as a public App
Store version and has not been publicly released. External testers must wait
for TestFlight Beta App Review. Internal App Store Connect testers may be able
to test without that external-review wait.

Recommended public release note:

> Bug fixes and security improvements.

Recommended TestFlight focus:

> This release includes bug fixes and backend database-security improvements.
> Please verify sign-in, farm access, daily-log saves, mortality entries, weight
> entries, feed tickets, and work orders.

## Hosted Mobile Version Control

The actual compiled iOS version/build was synchronized to `platform.control`:

- commit `db627ca` (`Sync iOS release control with build 20`)
- migration `20260829214000_sync_mobile_ios_1_0_7_build_20.sql`
- hosted `mobile_ios`: version `1.0.7`, build `20`
- hosted `mobile_droid`: unchanged at version `1.0.5`, build `11`
- the iOS `released` date was intentionally preserved until distribution
- the migration requires exactly one `mobile_ios` row and fails otherwise
- remote migration history confirms `20260829214000` applied

Android was not advanced because no Android `1.0.7` production artifact has
been compiled. The local `versionCode` is not authoritative while EAS remote
versioning is enabled.

## Current Exposure and Safety Boundary

Improved state:

- P0 database authorization containment is live
- active membership and farm scoping are enforced at the database layer for the
  reviewed P0 paths
- manager role codes are normalized
- authorized mobile log saves were restored without removing P0 containment
- production backend traffic uses the replacement secret-key path
- public clients have publishable-key compatibility
- the privileged worker rejects the public key
- no active Supabase secret/service-role value was found in tracked files by the
  Release 1 scan

Remaining exposure:

- legacy Supabase JWT-based API keys are still enabled
- the old service-role JWT must therefore still be treated as usable by anyone
  who previously obtained it
- disabling legacy keys also disables the legacy anon JWT used by installed
  mobile `1.0.6` clients
- old Git history may still contain the formerly exposed credential even though
  the tracked working tree no longer does

Do not disable the legacy JWT keys until the new mobile build is validated and
distributed sufficiently for active users. Do not rotate/rewrite shared Git
history as part of the operational cutover without a separate, explicit plan.

## Required Permission Test Before Revocation

Use a disposable `test_worker` or a real consenting farmhand account on iOS
`1.0.7 (20)` and verify:

1. sign-in and session restoration
2. only assigned active farms and barns are visible
3. daily log read and save
4. mortality read and save
5. weight read and save
6. feed-ticket list/get/submit as permitted
7. Work Orders list/create/update/resolve according to role
8. cross-farm records remain inaccessible
9. inactive membership loses access
10. farm manager retains authorized manager-level operations

Capture the account role, farm memberships, build number, successful workflows,
and any exact error messages. Do not use a production administrator as the only
mobile acceptance test.

## Exact Resume Plan

1. Wait for TestFlight Beta App Review to approve iOS `1.0.7 (20)`.
2. Install build `20` through TestFlight on the intended worker/farmhand device.
3. Run the authenticated permission test matrix above, starting with daily log,
   mortality, and weights.
4. Investigate and repair any regression before public submission.
5. When the mobile tests pass, submit version `1.0.7` for public App Store Review
   using manual release unless a deliberate automatic-release decision is made.
6. Distribute the approved version and confirm active-worker adoption.
7. Immediately before disabling legacy JWT-based API keys, obtain explicit
   action-time confirmation and verify the exact Supabase project.
8. Disable the coupled legacy `anon` and `service_role` keys in Supabase.
9. Run the Release 1 hosted gate with `-Stage Revoked -PromptForSecret` and the
   authenticated probe enabled when a disposable test token is available.
10. Confirm the new secret still works, the legacy service-role JWT is rejected,
    the publishable key still supports public/Auth traffic, and privileged
    workers still reject public callers.
11. Decide separately whether to rewrite Git history to remove the revoked
    credential from historical commits.
12. Build and validate Android `1.0.7` before changing the hosted Android version
    marker.

## Working Tree Boundary

At checkpoint creation, the only intentionally preserved dirty items were:

- modified `supabase/.temp/cli-latest`
- untracked `mobile/screens/errors/`

They predated this checkpoint work and were not added to the security, release,
or version-control commits.

## Commit Sequence

- `10eb392` — Contain P0 database authorization exposure
- `17a3931` — Restore authorized mobile log saves after P0 RLS
- `f96f7e6` — Normalize hosted manager role authorization
- `e3d2e74` — Prepare safe Supabase secret key rotation
- `13f25f4` — Migrate clients to Supabase publishable keys
- `db627ca` — Sync iOS release control with build 20

The next checkpoint commit should contain only this checkpoint file and its index
entry, leaving the two pre-existing dirty items untouched.
