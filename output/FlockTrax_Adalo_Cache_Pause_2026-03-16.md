# FlockTrax Adalo Cache Pause 2026-03-16

## Current state

- Project root: `C:\dev\FlockTrax`
- Local Supabase stack is working again when started from the project root.
- The Adalo-facing Supabase endpoints already validated earlier are:
  - `dashboard-placements-list`
  - `placement-day-get`
  - `placement-day-submit`
- `session-create` was fixed locally so it now mints a usable Supabase-style JWT for the app flow.
- `can_write_farm()` was reconciled with the actual `roles.code` schema and validated locally.

## Adalo cache direction chosen

We are no longer treating the Adalo cache collections as disposable tables that must be bulk-cleared.

The current design is:

- `DashboardCache`
  - multi-row cache
  - scoped by `cache_owner_user_id`
  - refreshed by writing a new `cache_batch_id`
  - UI only shows rows for the current user and current batch
- `PlacementDayCache`
  - one working row per user
  - overwritten/updated on each placement + date selection
  - no hard delete required for the normal workflow

This avoids needing the paid Adalo API just to bulk-delete cache rows.

## Adalo collection changes already made

New no-delete support fields were added:

- `DashboardCache`
  - `cache_batch_id`
  - `cache_loaded_at`
- `PlacementDayCache`
  - `cache_loaded_at`

Also note:

- `updated_at` was intentionally created in Adalo as `Date/Time`, not `Date`

## Files created for Adalo setup

Templates and test data:

- `output/adalo_dashboard_cache_import_template.csv`
- `output/adalo_placement_day_cache_import_template.csv`
- `output/adalo_dashboard_cache_test_data.csv`
- `output/adalo_placement_day_cache_test_data.csv`

Supabase scaffold for possible Adalo API integration:

- `supabase/functions/_shared/adalo-cache.ts`
- `supabase/functions/adalo-cache-clear/index.ts`
- `supabase/functions/adalo-dashboard-cache-fill/index.ts`
- `supabase/functions/adalo-placement-day-cache-fill/index.ts`

## Important blocker discovered

The scaffolded Adalo API functions do reach Adalo, but live calls return:

```json
{"message":"You don't have access to this feature"}
```

This came back as HTTP `403` from Adalo for the native collection endpoints.

Meaning:

- Supabase function routing is working
- local env wiring was fixed
- Adalo endpoint/auth formatting appears correct enough to reach Adalo
- but the Adalo account/plan does not allow this API feature at the current tier

Conclusion:

- do **not** depend on the Adalo native collection API path unless the plan changes
- continue with the no-delete, Adalo-builder-native workflow instead

## Next resume point

Resume with the Adalo builder workflow, not the Adalo API path.

Next steps:

1. Finish the custom action `dashboard_placements_list`
   - method: `GET`
   - URL: local Supabase Edge function for `dashboard-placements-list`
   - headers:
     - `Authorization: Bearer [Logged in User > ftx_session_token]`
     - `apikey: <Supabase publishable key>`
2. Test whether Adalo can consume the returned `items[]` array in a way that allows creating `DashboardCache` rows without the paid Adalo API
3. Store a `current_dashboard_batch_id` on the user record
4. Build the dashboard list filter:
   - `cache_owner_user_id = current user`
   - `cache_type = dashboard`
   - `cache_batch_id = current_dashboard_batch_id`
5. Build the placement-day load flow using overwrite/update of the single user-scoped `PlacementDayCache` row

## Resume prompt

Use this prompt in the next chat if needed:

“Resume `C:\dev\FlockTrax` from `output/FlockTrax_Adalo_Cache_Pause_2026-03-16.md`. We moved to a no-delete Adalo cache model using `cache_batch_id` and `cache_loaded_at`. The Supabase Adalo API scaffolds exist, but live Adalo collection API calls return 403 feature-access errors, so resume in the Adalo builder by finishing the `dashboard-placements-list` custom action and figuring out how to populate `DashboardCache` from returned array items without using the paid Adalo API.” 
