# FlockTrax Adalo External Collections Checkpoint 2026-03-30

## Current state

- Project root: `C:\dev\FlockTrax`
- We pivoted away from Adalo native collection API writes because Adalo returned HTTP `403` with:

```json
{"message":"You don't have access to this feature"}
```

- Current working direction is:
  - use Adalo **External Collections** for read/display
  - use Supabase Edge Functions for auth and submit
  - avoid paid Adalo API dependency for native collection CRUD

## Confirmed working in Adalo

### 1. Dashboard list

The wrapper response shape from `dashboard-placements-list` did not work well with Adalo External Collections.

An Adalo-friendly adapter was created:

- `supabase/functions/dashboard-placements-list-adalo/index.ts`

This function returns a **top-level array** instead of:

```json
{ "ok": true, "items": [...] }
```

It was deployed and tested successfully through Adalo using:

- URL:
  - `https://frneaccbbrijpolcesjm.supabase.co/functions/v1/dashboard-placements-list-adalo`
- headers:
  - `apikey = live Supabase publishable key`
  - `Authorization = Bearer test-token`
  - `x-adalo-test = true`

Result:

- Adalo External Collection accepted the response
- dashboard list renders cleanly from the External Collection

Conclusion:

- `DashboardCache` is no longer needed for dashboard display
- use the External Collection directly for the dashboard list

## 2. Placement day read

An Adalo-friendly adapter was created:

- `supabase/functions/placement-day-get-adalo/index.ts`

This function also returns a **top-level array** with one record for Adalo compatibility.

It was deployed and the External Collection saved successfully in Adalo.

Result:

- Adalo displays the returned placement-day record cleanly in a list
- but the form/edit screen behaves like **Create New** instead of binding as an editable existing record

Conclusion:

- Adalo External Collections work well for **reading/display**
- they do not appear suitable for the placement-day form as a direct editable record binding

## 3. Placement day submit

`placement-day-submit` on the live hosted project was tested from Adalo.

### With `x-adalo-test = true`

The Adalo custom action succeeded and returned:

```json
{
  "ok": true,
  "daily_saved": true,
  "mortality_saved": true,
  "item": {
    "placement_id": "00000000-0000-0000-0000-000000000000",
    "log_date": "2026-03-13"
  },
  "mode": "adalo_test"
}
```

This proves:

- URL is correct
- method is correct
- payload shape is acceptable
- headers are reaching the function

### Without `x-adalo-test = true`

Live submit failed with:

```json
{
  "ok": false,
  "error": "Daily upsert failed: JWSError JWSInvalidSignature"
}
```

Meaning:

- the Adalo request is sending a JWT signed with the wrong secret for the hosted project
- the submit function itself is not the problem
- the auth token flow is the remaining blocker

## Root issue now

The remaining blocker is **live auth token sourcing**.

Adalo must store and use a token minted by the hosted project:

- `https://frneaccbbrijpolcesjm.supabase.co/functions/v1/session-create`

and not:

- any token from local `127.0.0.1`
- any stale or older dev token

## Architecture recommendation at pause

Use:

- Dashboard:
  - External Collection from `dashboard-placements-list-adalo`
- Placement day display:
  - External Collection from `placement-day-get-adalo`
- Placement day submit:
  - custom action calling `placement-day-submit`
- Auth:
  - hosted `session-create`

Avoid for now:

- Adalo native cache collections as the primary runtime path
- Adalo native collection API integration

## Next resume steps

1. Verify or build the hosted `session-create` custom action in Adalo
   - URL:
     - `https://frneaccbbrijpolcesjm.supabase.co/functions/v1/session-create`
2. Confirm Adalo stores:
   - `ftx_session_token`
   - `ftx_user_id`
   from the hosted response
3. Retry live `placement-day-submit` without `x-adalo-test`
4. If submit succeeds, continue refining the placement-day entry UI

## Resume prompt

Use this in the next chat if needed:

“Resume `C:\dev\FlockTrax` from `output/FlockTrax_Adalo_External_Collections_Checkpoint_2026-03-30.md`. Dashboard and placement-day read paths now work through Adalo External Collections using the deployed adapters `dashboard-placements-list-adalo` and `placement-day-get-adalo`. `placement-day-submit` works in `x-adalo-test` mode, but live submit currently fails with `JWSError JWSInvalidSignature`, so the next task is to verify the hosted `session-create` custom action in Adalo and make sure Adalo is storing a live hosted token before retrying submit.” 
