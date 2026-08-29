# Release 1 credential-rotation verification

`Test-FlockTraxRelease1.ps1` is a non-mutating deployment gate for the
Supabase backend credential replacement. It never creates, updates, disables,
or prints a credential and all hosted probes are read-only.

Run the script from PowerShell 7. Supply credentials through temporary process
environment variables rather than command-line arguments so they are not
captured in command history or process listings.

## Stages

- `Preflight`: scans tracked source for committed privileged keys, checks for
  client-exposed secret references, typechecks both applications, and builds
  web-admin.
- `Cutover`: additionally verifies that the code contains the new secret-key
  compatibility paths. With `-RunProductionProbes`, it proves both the new key
  and the temporarily retained legacy key can perform a one-row, read-only REST
  query.
- `Revoked`: performs the same checks but requires the legacy key to receive
  HTTP 401 or 403 while the new key continues to work.

The hosted probes also verify that the privileged Google Sheets worker rejects
the public key. A new-key Edge Function probe intentionally omits required
parameters and expects HTTP 400, proving authentication succeeded without
performing a database query or write.

## Environment variables

```powershell
$env:FLOCKTRAX_SUPABASE_URL = "https://PROJECT.supabase.co"
$env:FLOCKTRAX_PUBLIC_KEY = "sb_publishable_..."
$env:FLOCKTRAX_NEW_SECRET_KEY = "sb_secret_..."
$env:FLOCKTRAX_LEGACY_SERVICE_ROLE_KEY = "legacy value held only for the revocation check"
$env:FLOCKTRAX_TEST_ACCESS_TOKEN = "short-lived access token for test_worker"
```

The authenticated access token is optional unless
`-RequireAuthenticatedProbe` is used. It should be short-lived and obtained for
the dedicated test account immediately before the test.

## Commands

```powershell
# Before implementation or credential changes
pwsh -File .\toolkit\Test-FlockTraxRelease1.ps1 -Stage Preflight

# After new-key-compatible code is deployed and both keys are active
pwsh -File .\toolkit\Test-FlockTraxRelease1.ps1 `
  -Stage Cutover -RunProductionProbes -RequireAuthenticatedProbe

# Immediately after disabling the compromised legacy key
pwsh -File .\toolkit\Test-FlockTraxRelease1.ps1 `
  -Stage Revoked -RunProductionProbes -RequireAuthenticatedProbe
```

After testing, clear the temporary values from the current shell:

```powershell
Remove-Item Env:FLOCKTRAX_NEW_SECRET_KEY -ErrorAction SilentlyContinue
Remove-Item Env:FLOCKTRAX_LEGACY_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
Remove-Item Env:FLOCKTRAX_TEST_ACCESS_TOKEN -ErrorAction SilentlyContinue
```

The gate exits `0` only when every required check passes. Skipped checks are
shown explicitly and do not fail the run unless the corresponding probe was
made mandatory.
