# FlockTrax P0 Database Authorization Production Checkpoint

Date: `2026-08-28`

## Status

The P0 database-authorization findings from the permissions security review are implemented, committed, deployed, and verified against the hosted Supabase project `frneaccbbrijpolcesjm` (`GPC-DailyCollection`). No rollback was required.

## Production Baseline

- Production application: `https://flocktrax.com`
- Vercel deployment: `dpl_569YB7kUqXfxfqnGBavsa2CQJNmi`
- P0 release commit: `10eb392125a4f8a5dba1954ecbceaf6e9b49e922`
- Pre-P0 checkpoint commit: `6ccf6e9`
- Pre-P0 recovery tag: `checkpoint/pre-p0-hosted-deploy-20260828`
- Hosted migration: `20260828110000_p0_database_authorization_containment.sql`
- Local and remote migration ledgers matched after deployment.

## P0 Controls Now Live

- New public objects no longer automatically grant table, sequence, or function access to `anon` or `authenticated`.
- Role and farm-membership assignment is not client-writable.
- Farm access requires an active direct or farm-group membership; farm writes require `farm_manager` or an approved higher role.
- Farm, barn, flock, placement, production-log, closeout, feed-order, and livehaul access is farm-scoped through RLS.
- Previously unprotected identity, audit, document, membership, and operational tables now have RLS or are service-only.
- Sensitive owner-rights views use `security_invoker` and are not client-readable.
- Public `SECURITY DEFINER` functions are service-role-only except the boolean authorization helpers `is_admin`, `can_access_farm`, and `can_write_farm`.
- Placement lifecycle actions now authenticate the actor, require farm-manager-or-above authority, verify target-farm scope, and only then use the server service-role client.

## Validation Completed

- Fresh disposable PostgreSQL/Supabase migration chain: passed.
- Catalog authorization regression assertions: passed.
- Active farm-manager membership access: passed.
- Inactive-membership denial: passed.
- Cross-farm read and update denial: passed.
- Web-admin TypeScript and production builds: passed.
- Vercel production deployment: ready and aliased to `flocktrax.com`.
- Hosted anonymous probes:
  - `user_roles`: `401`
  - `barns`: `401`
  - `auth_audit_log_readable`: `401`
  - privileged `mark_chicks_arrived` RPC: `401`
  - safe `is_admin` helper: `200`, response `false`
- Unauthenticated `/admin/overview`: `307` redirect to `/login`.
- Post-deployment hosted schema dump confirmed the expected RLS policies, secured views, and service-role-only privileged function grants.

## Recovery Materials

Supabase reported a completed managed physical backup from `2026-08-28T10:28:43.711Z`. PITR is not enabled.

Additional pre-P0 logical dumps are stored in the ignored local `C:\dev\FlockTrax\backups` directory:

- `pre_p0_20260828_schema.sql` — SHA-256 `0EA350C3CFECEF9BFC1271C2867D7C55CA2A1C74E1251CFDA7F40779B14DE15B`
- `pre_p0_20260828_data.sql` — SHA-256 `61CF5DAE843BF09024575B05006314B502AFCA8B9DBEBC8291ECF42AAFF05283`
- `pre_p0_20260828_roles.sql` — SHA-256 `B14A16C23D6DBD05B4C913F83E94E7E6019254DE6DC6D58612DE0CD4C6054E8C`
- `post_p0_20260828_schema.sql` — hosted post-deployment schema evidence.

## Remaining Security Work

- P1 and P2 findings from the permissions review remain open.
- Protecting the Supabase `service_role` key and auditing every server-side service-role call remain critical because that role bypasses RLS by design.
- A complete authenticated production smoke matrix was not run because it would require real credentials and could mutate live records. Equivalent denial tests passed against the disposable validation database.
- Supabase schema lint reports pre-existing defects in several legacy functions. P0 did not introduce them, and privileged client execution is now blocked, but they should be repaired in a later maintenance pass.
- PITR is not enabled; recovery depends on managed physical backups and the logical dumps above.

## Resume Guidance

When security work resumes:

1. Start with `output/FlockTrax_Permissions_Security_Review_2026-08-28.docx` and this checkpoint.
2. Confirm hosted migration `20260828110000` remains present before making additional permission changes.
3. Build the prioritized authenticated-role test matrix in a staging clone or disposable environment.
4. Continue with P1 findings, especially service-role server routes and any remaining UI/server/database permission mismatches.
5. Address the legacy function lint failures separately from authorization work so security changes remain reviewable and reversible.

## Preserved Local State

At checkpoint creation, the pre-existing tracked Supabase CLI marker change and the open Word temporary lock file were intentionally left uncommitted.
