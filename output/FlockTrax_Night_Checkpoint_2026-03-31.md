# FlockTrax Night Checkpoint 2026-03-31

## Current state

Project root:
- `C:\dev\FlockTrax`

Latest checkpoint already reviewed:
- `C:\dev\FlockTrax\output\FlockTrax_Adalo_External_Collections_Checkpoint_2026-03-30.md`

## Confirmed architecture at pause

Working direction remains:
- Adalo External Collections for read/display
- Supabase Edge Functions for auth and submit
- avoid dependence on Adalo paid native collection API for runtime CRUD

Current practical split:
- dashboard read: External Collection
- placement-day read: External Collection
- placement-day submit: Custom Action
- auth/session token: hosted `session-create`

## What user confirmed tonight

- `session-create` is already integrated into the Adalo login flow
- it appears to work well enough for the Supabase External Collections
- Adalo already supports creating and maintaining base/master entities:
  - farms
  - flocks
  - barns
  - the primary flock/barn/date linking that creates the key `placement_id`
- user has a debug screen in Adalo that shows:
  - user fields
  - session token
  - expiration
  - refresh token field
- debug screen can:
  - clear the session token
  - obtain a new token

Important clarification from user:
- no real refresh-token flow has been implemented yet
- that is intentionally deferred for later polish

## Main working hypothesis at pause

User suspects that some Adalo Custom Actions still contain lingering hardcoded test values from earlier debugging.

Most likely stale areas:
- Authorization header value
- apikey value
- placement_id
- log_date
- `x-adalo-test = true`
- old hosted/local URL
- sample literal body values

This is currently the strongest explanation for odd submit behavior.

## Code changes made tonight in local repo

Temporary `x-adalo-test` debug echo was added locally to:
- `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`
- `C:\dev\FlockTrax\supabase\functions\session-create\index.ts`

Purpose:
- let Adalo inspect what was actually sent to the function
- without doing live writes in `placement-day-submit`
- while redacting the token value for safety

### Current `x-adalo-test` behavior in local code

For `placement-day-submit`, debug response now includes:
- whether Authorization header is present
- redacted token preview
- whether apikey is present
- content-type
- payload keys
- payload body
- parsed values:
  - placement_id
  - log_date
  - placement_id_valid
  - log_date_valid
  - whether daily fields are present
  - whether mortality fields are present

For `session-create`, debug response now includes:
- content-type
- whether apikey is present
- whether Authorization header is present
- redacted token preview
- body keys
- body
- parsed values:
  - adalo_user_id
  - email
  - display_name
  - whether adalo_user_id is present

## Important limitation at pause

These debug changes were added only in the local repo.
They are not useful to Adalo until the hosted functions are redeployed.

Hosted deploy commands to use from `C:\dev\FlockTrax`:

```powershell
supabase functions deploy session-create --project-ref frneaccbbrijpolcesjm
supabase functions deploy placement-day-submit --project-ref frneaccbbrijpolcesjm
```

## Important clarification about `x-adalo-test`

User correctly called out that `x-adalo-test = true` intentionally bails out early.

That means:
- it is useful for auditing what Adalo sends
- it is useful for making Adalo accept/save the Custom Action
- it is not proof that the live business logic/write path succeeds

So `x-adalo-test` only proves transport and payload wiring, not real submit success.

## Latest observed issue

User reported that they are not seeing the passed parameters in the `x-adalo-test` output.

Most likely causes, in order:
1. hosted function has not yet been redeployed with the new debug code
2. Adalo is not sending JSON body the way the function expects
3. action is still pointing at an older or different function definition

## Best next step when resuming

1. From `C:\dev\FlockTrax`, deploy:
   - `session-create`
   - `placement-day-submit`
2. In Adalo, test `x-adalo-test = true` again
3. Confirm whether debug response now shows:
   - payload keys
   - parsed placement_id
   - parsed log_date
   - token preview / auth presence
4. If debug fields still do not appear, inspect Adalo action config for:
   - JSON body formatting
   - Content-Type header
   - stale URL or duplicated action
5. Once request wiring is confirmed, remove/disable `x-adalo-test` and run the true live submit

## Short resume prompt

"Resume `C:\dev\FlockTrax` from `output/FlockTrax_Night_Checkpoint_2026-03-31.md`. `session-create` is already integrated in Adalo login, External Collections are working for read paths, and Adalo already maintains the master/base entities that generate the golden `placement_id`. Tonight we added local `x-adalo-test` debug echo behavior to `session-create` and `placement-day-submit`, but the hosted functions still need to be redeployed. Next step is to deploy those hosted functions, retest `x-adalo-test`, and use the debug response to find stale hardcoded values or bad body formatting in Adalo Custom Actions." 
