# FlockTrax Feed Order And Sheets Backfill Consolidated Checkpoint

Date: `2026-06-08`

## Purpose

Provide one combined resume point for:

- the recent feed prediction / starter-grower ordering work
- the BinSentry-backed inventory/order foundation
- the reusable historical Sheets -> FlockTrax backfill importer

This is the best single file to load first for the next session.

## Current Feed Ordering State

First-pass feed ordering logic is in place and was checkpointed in:

- `C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Projection_First_Pass_Checkpoint_2026-06-07.md`

Key implemented behaviors:

- 10-day feed requirement is calculated day-by-day, then summed
- requirement is split into `starter` and `grower`
- `starter_lbs_per_chick` is read as a setting/fallback concept for target starter need
- starter is only considered orderable through `day 14`
- incoming flocks inside the 10-day window are included from arrival day forward
- incoming flocks use the `12,000 lb` starter minimum concept for ordering practicality
- dashboard/report surfaces now show starter/grower split for validation

Important limitation:

- this is still first-pass logic
- it is not yet the full FIFO layered-bin ordering engine

## Feed Ordering / Bin Logic Spec

The current design/spec for the deeper ordering model is here:

- `C:\dev\FlockTrax\output\FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.md`

Important direction captured there:

- FlockTrax should remain source of truth for feed phase/business rules
- BinSentry should remain source of truth for live quantity
- starter vs grower ordering needs to become type-aware
- FIFO realities mean future planning likely needs layered/bin-access logic
- projected starter-bin readiness at current placement end is an important future rule

## BinSentry / Inventory Foundation

The live BinSentry inventory sync and feed-bin mapping baseline is captured in:

- `C:\dev\FlockTrax\output\FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md`
- `C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md`

Known good state from that work:

- BinSentry credential login works
- bin refs were discovered and mapped
- live inventory sync is working
- dashboard popup inventory was verified against BinSentry
- kg -> lb conversion issue was corrected

## Historical Sheets Backfill State

The reusable reverse-sync/backfill importer is now in place and was applied successfully.

Primary detailed checkpoint:

- `C:\dev\FlockTrax\output\FlockTrax_Sheets_Historical_Backfill_And_Outbox_Cleanup_Checkpoint_2026-06-08.md`

Reusable importer:

- `C:\dev\FlockTrax\toolkit\sync_engine\backfill_from_sheets.py`

Supporting docs/helpers:

- `C:\dev\FlockTrax\toolkit\sync_engine\README.md`
- `C:\dev\FlockTrax\toolkit\sync_engine\sheets_client.py`

Current importer behavior:

- default mode is `fill_missing_or_blank`
- preserves populated FlockTrax values
- fills only missing/null/blank fields from Sheets
- creates missing date rows when Sheets has the date and FlockTrax does not
- single non-sex-specific worksheet weight is imported as `male`

The importer now uses:

- audited direct table upserts with explicit actor ids
- placement-level `activity_log` entries

This replaced the original service-role RPC attempt, which failed because `created_by`
constraints depended on `auth.uid()` semantics not present in that backfill path.

## Flocks Already Backfilled

Applied on June 8, 2026 for:

- `274-W6`
- `286-W8`
- `280-W1`
- `278-W7`
- `272-W2`

Imported counts:

- `274-W6`: `70` daily, `38` mortality, `3` weight
- `286-W8`: `66` daily, `36` mortality, `4` weight
- `280-W1`: `70` daily, `42` mortality, `3` weight
- `278-W7`: `70` daily, `46` mortality, `2` weight
- `272-W2`: `70` daily, `24` mortality, `3` weight

Totals:

- `346` daily rows/field fills
- `186` mortality rows/field fills
- `15` weight rows/field fills

## Outbox Side Effect

Because log tables have Google Sheets enqueue triggers, the historical backfill generated
`platform.sync_outbox` rows automatically.

For reverse-sync/import work that is not desirable, because it attempts to replay the newly
backfilled FlockTrax history back into Sheets.

For the five-flock run above:

- all generated `pending` outbox rows were deleted
- one leftover `rejected` row from a temporary validation insert/delete test was also deleted

Operational rule for future imports:

1. run dry import
2. apply import
3. remove the generated pending outbox rows for the imported placements

## Recommended Next Steps

Depending on the next session priority:

1. continue running historical Sheets backfill for additional older flocks
2. improve the importer further so historical imports can suppress Google Sheets outbox enqueue automatically
3. resume feed ordering refinement, especially:
   - starter/grower type-aware inventory and commitments
   - fuller FIFO/bin-layer handling
   - future load suggestion logic after requirement math is trusted

## Best Restart Prompt

```text
Load C:\dev\FlockTrax\output\FlockTrax_Feed_Order_And_Sheets_Backfill_Consolidated_Checkpoint_2026-06-08.md first.
```
