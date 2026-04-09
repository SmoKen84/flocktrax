FlockTrax Dev Toolkit (Windows) - v1.4

Key improvements:
- TEST_FUNCTIONS_LOCAL.bat now auto-adds Authorization/apikey headers by extracting the local sb_publishable key from `supabase status`.
- DEPLOY_FUNCTIONS_LOCAL.bat pins --project-ref to avoid interactive prompts.

Install:
- Unzip into: C:\dev\FlockTrax\
- Run: toolkit\TOOLKIT_MENU.bat

Notes:
- Supabase local Edge Functions require an Authorization header even when --no-verify-jwt is used.
  --no-verify-jwt skips verification, but the gateway still expects the header to be present.
- Update PLACEMENT_ID in TEST_FUNCTIONS_LOCAL.bat to a real UUID once your local placement records exist.
