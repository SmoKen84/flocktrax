# FlockTrax Sheets Historical Backfill And Outbox Cleanup Checkpoint

Date: `2026-06-08`

## Purpose

Capture the reusable reverse-sync/backfill path from Google Sheets into FlockTrax for older flocks that need more complete auditable history before the upcoming organic inspection.

## What Was Built

A reusable toolkit importer now exists at:

- `C:\dev\FlockTrax\toolkit\sync_engine\backfill_from_sheets.py`

Supporting updates:

- `C:\dev\FlockTrax\toolkit\sync_engine\README.md`
- `C:\dev\FlockTrax\toolkit\sync_engine\sheets_client.py`

## Import Behavior

Default mode:

- `fill_missing_or_blank`

Meaning:

- preserve populated FlockTrax values
- fill only null/blank FlockTrax fields from Sheets
- create missing FlockTrax date rows when the date exists in Sheets

Weight rule:

- worksheet single actual-weight values are imported as `male`
- no synthetic female weight row is created unless female-specific sheet data exists

Audit approach:

- importer now writes rows with explicit `created_by` / `updated_by` values derived from the placement
- importer also writes placement-level `activity_log` entries so the history remains inspectable inside FlockTrax
- this replaced the original attempt to call the mobile save RPCs directly, which failed under service-role execution because `auth.uid()` was not present for the `created_by` constraints

## Flocks Backfilled

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

## Weight Parsing Cleanup

The importer was tightened after dry-run review so that:

- unrelated worksheet comments like weather notes do not become fake weight rows
- fallback weight parsing prefers real numeric weight clues
- comments such as `Males 3.247 females 2.871` can still yield a usable male weight

## Outbox Side Effect And Cleanup

Because `log_daily`, `log_mortality`, and `log_weight` have Google Sheets sync triggers, the backfill created `platform.sync_outbox` rows automatically.

For this reverse-sync job, those queued rows were not desired because they would have attempted to push the imported FlockTrax data back out to Sheets.

Cleanup performed:

- deleted all `pending` outbox rows for:
  - `274-W6`
  - `286-W8`
  - `280-W1`
  - `278-W7`
  - `272-W2`
- verified each of those placements had `0` pending rows afterward
- removed one `rejected` outbox row from a temporary validation insert/delete test on `274-W6`

## Important Operational Note

If this importer is used again in the current architecture, expect new Sheets outbox rows to appear unless one of these is done:

1. run the import and then clear the generated outbox rows again
2. temporarily disable the Google Sheets enqueue triggers during future historical imports
3. enhance the importer/foundation later so historical backfills can mark themselves as no-sync

For now, the safe repeatable procedure is:

1. dry run importer
2. apply importer
3. delete newly created pending outbox rows for the imported placements

## Useful Commands

Dry run:

```powershell
cd C:\dev\FlockTrax\toolkit\sync_engine
python backfill_from_sheets.py --placements 274-W6,286-W8,280-W1,278-W7,272-W2
```

Apply:

```powershell
cd C:\dev\FlockTrax\toolkit\sync_engine
python backfill_from_sheets.py --placements 274-W6,286-W8,280-W1,278-W7,272-W2 --apply --write-placement-note
```

## Best Restart Prompt

```text
Load C:\dev\FlockTrax\output\FlockTrax_Sheets_Historical_Backfill_And_Outbox_Cleanup_Checkpoint_2026-06-08.md first.
```
