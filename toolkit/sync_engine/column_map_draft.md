# FlockTrax Google Sheets Column Map Draft

This is the first-pass worksheet contract for the `googleapis-sheets` adapter.

It is intentionally split into:

- confirmed FlockTrax source fields
- candidate Google Sheets labels
- verification notes

This lets us start building the sync engine without pretending every worksheet
header is already final.

## Fixed rules

- one workbook per farm
- workbook id comes from `platform.sync_googleapis_sheets.spreadsheet_id`
- worksheet/tab name is always `public.placements.placement_key`
- row is resolved from the `DATE` column
- column is resolved from the worksheet header label on the configured header row

## Core datasets

The first sync pass should cover:

1. `public.log_daily`
2. `public.log_mortality`
3. `public.log_weight`

These are the core mobile-write datasets and give the clearest end-to-end proof
that FlockTrax can push live operational data into the integrator workbook.

## Status legend

- `confirmed`
  - field exists in the live FlockTrax schema and save RPC
- `candidate label`
  - old experiment label or best current guess for the worksheet header
- `verify workbook`
  - must be checked against the real farm workbook header text before hard-coding

## Row locator

| Purpose | Sheet label | Status | Notes |
| --- | --- | --- | --- |
| log date row locator | `DATE` | confirmed | Existing experiments and live workbook screenshots both indicate `DATE` on header row 6. |

## public.log_daily

Source fields confirmed from `save_log_daily_mobile(...)`:

- `age_days`
- `am_temp`
- `set_temp`
- `rel_humidity`
- `outside_temp_current`
- `outside_temp_low`
- `outside_temp_high`
- `water_meter_reading`
- `maintenance_flag`
- `feedlines_flag`
- `nipple_lines_flag`
- `bird_health_alert`
- `min_vent`
- `is_oda_open`
- `oda_exception`
- `naoh`
- `comment`

Draft label map:

| DB field | Candidate sheet label | Status | Notes |
| --- | --- | --- | --- |
| `age_days` | `Day` | verify workbook | Could also be `Age` or `Age Day`. |
| `am_temp` | `AM Temp` | candidate label | Came from the earlier Sheets experiment. |
| `set_temp` | `Set Temp` | candidate label | Came from the earlier Sheets experiment. |
| `rel_humidity` | `Humidity` | candidate label | Old experiment used `Humidity`. |
| `outside_temp_current` | `Outside Temp` | verify workbook | Workbook may split current/high/low differently. |
| `outside_temp_low` | `Outside Low` | verify workbook | Need exact worksheet text. |
| `outside_temp_high` | `Outside High` | verify workbook | Need exact worksheet text. |
| `water_meter_reading` | `Water Meter` | verify workbook | Likely present, exact label unknown. |
| `maintenance_flag` | `Maintenance` | verify workbook | Boolean may need `Y/N`, checkmark, or note behavior. |
| `feedlines_flag` | `Feedlines` | verify workbook | Same boolean rendering question. |
| `nipple_lines_flag` | `Nipple Lines` | verify workbook | Same boolean rendering question. |
| `bird_health_alert` | `Health Alert` | verify workbook | Might be indicator-only. |
| `min_vent` | `Min Vent` | verify workbook | Visible in old workbook screenshots, exact spelling may vary. |
| `is_oda_open` | `ODA Open` | verify workbook | Could be boolean or text. |
| `oda_exception` | `ODA Exception` | verify workbook | Free-text note. |
| `naoh` | `NaOH` | verify workbook | Needs exact worksheet capitalization. |
| `comment` | `Comments` | candidate label | Earlier experiment used `Comments`. |

## public.log_mortality

Source fields confirmed from `save_log_mortality_mobile(...)`:

- `dead_female`
- `dead_male`
- `cull_female`
- `cull_male`
- `cull_female_note`
- `cull_male_note`
- `dead_reason`
- `grade_litter`
- `grade_footpad`
- `grade_feathers`
- `grade_lame`
- `grade_pecking`

Draft label map:

| DB field | Candidate sheet label | Status | Notes |
| --- | --- | --- | --- |
| `dead_female` | `Hen Mortality` | verify workbook | Sheet may use sex-specific wording instead of `Female`. |
| `dead_male` | `Rooster Mortality` | verify workbook | Need actual workbook label. |
| `cull_female` | `Hen Culls` | verify workbook | Need actual workbook label. |
| `cull_male` | `Rooster Culls` | verify workbook | Need actual workbook label. |
| `cull_female_note` | `Hen Cull Note` | verify workbook | May not have dedicated column; could stay diary-only. |
| `cull_male_note` | `Rooster Cull Note` | verify workbook | May not have dedicated column; could stay diary-only. |
| `dead_reason` | `Mortality Reason` | verify workbook | Could also stay diary-only if workbook has no note column. |
| `grade_litter` | `Litter` | verify workbook | Likely audit/score column. |
| `grade_footpad` | `Footpad` | verify workbook | Likely audit/score column. |
| `grade_feathers` | `Feathers` | verify workbook | Likely audit/score column. |
| `grade_lame` | `Lame` | verify workbook | Likely audit/score column. |
| `grade_pecking` | `Pecking` | verify workbook | Likely audit/score column. |

## public.log_weight

Source fields confirmed from `save_log_weight_mobile(...)`:

- `sex`
- `age_days`
- `cnt_weighed`
- `avg_weight`
- `stddev_weight`
- `procure`
- `other_note`

Draft label map:

| DB field | Candidate sheet label | Status | Notes |
| --- | --- | --- | --- |
| `avg_weight` + `sex='male'` | `Male Avg` | candidate label | Earlier experiment used `Male Avg`. |
| `avg_weight` + `sex='female'` | `Female Avg` | candidate label | Earlier experiment used `Female Avg`. |
| `cnt_weighed` + `sex='male'` | `Sample M` | candidate label | Earlier experiment used `Sample M`. |
| `cnt_weighed` + `sex='female'` | `Sample F` | candidate label | Earlier experiment used `Sample F`. |
| `stddev_weight` + `sex='male'` | `Male StdDev` | verify workbook | Only if workbook carries deviation columns. |
| `stddev_weight` + `sex='female'` | `Female StdDev` | verify workbook | Only if workbook carries deviation columns. |
| `procure` + `sex='male'` | `Male Procure` | verify workbook | Need business meaning confirmed. |
| `procure` + `sex='female'` | `Female Procure` | verify workbook | Need business meaning confirmed. |
| `other_note` | `Weight Notes` | verify workbook | May remain diary-only if no sheet column exists. |
| `age_days` | `Day` | verify workbook | Usually not needed if row/date already determines it. |

## Sync behaviors still to decide

These are the next design questions after the header inventory:

1. Which note/comment fields belong in worksheet columns versus diary-only?
2. How should boolean flags be represented in cells?
   - blank / `X`
   - `Y` / `N`
   - `TRUE` / `FALSE`
3. Should weight rows update one shared date row or separate sex-specific regions?
4. Which fields are authoritative for overwrite behavior if a user edits the same date twice?
5. Which columns can be left unmapped in phase 1 without hurting alpha sync validation?

## Recommended immediate next move

Use one real farm workbook and make a header inventory from the placement tab row that
contains `DATE`. Then replace the candidate labels in this draft with the exact header
text as it appears in the sheet.
