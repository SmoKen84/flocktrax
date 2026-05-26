# FlockTrax BinSentry 10-Day Forecast Popup Mini Spec

Date: `2026-05-25`

## Purpose

Add a first BinSentry integration to the existing 10-day feed forecast popup on the live dashboard placement tiles.

Goal:
- keep the current FlockTrax feed projection as the baseline forecast
- add live inventory context from BinSentry
- optionally add inbound feed-order visibility
- help the user answer the practical question:
  - `Will this barn have enough feed over the next 10 days, and is the projection tracking reality?`

## Existing FlockTrax Baseline

Current projection already exists in:

- [admin-data.ts](C:/dev/FlockTrax/web-admin/lib/admin-data.ts)
- [active-placement-dashboard.tsx](C:/dev/FlockTrax/web-admin/components/active-placement-dashboard.tsx)

Current model uses:

- `stdbreedspec.dayfeedperbird`
- current live population
- projected mortality trend
- live-haul reductions

Current popup already shows:

- 10-day projected total feed
- projected daily feed values
- live-haul notes

## Product Intent

BinSentry should not replace the FlockTrax forecast.

Instead, BinSentry should act as a live reality-check layer:

- `FlockTrax` estimates feed demand
- `BinSentry` estimates feed currently on hand
- optionally `BinSentry orders` estimate inbound replenishment
- the popup combines them into a projected day-by-day balance

## 10-Day Window Intent

The 10-day forecast is intentionally longer than the normal feed-order lead time.

Purpose of the 10-day window:

- provide a practical ordering forecast
- preserve roughly a 3-day safety buffer
- allow the first 2 to 3 days of the forecast to be checked against reality
- create enough time to adjust feed orders if the initial projection proves inaccurate

This means the forecast is not just a static estimate.

It is a short lifecycle:

1. create the projection
2. observe real inventory behavior over the next few days
3. compare actual depletion against expected depletion
4. adjust the ordering outlook before feed risk becomes critical

Operationally, this is a `forecast + verification + correction` workflow.

## Core Question The Popup Should Answer

For a selected placement/barn:

1. How much feed do we expect the flock to consume over the next 10 days?
2. How much feed is currently in the assigned bin or bins?
3. What feed is already scheduled to arrive during that same window?
4. On which day, if any, does projected inventory become critically low or negative?
5. Is actual consumption generally tracking with the current projection?

## Projection Lifecycle Concept

The popup should eventually represent an active forecast lifecycle, not just a one-time calculation.

Each forecast instance should be:

- created on a specific date/time
- tied to a placement and barn
- evaluated over the next 2 to 3 days
- revised if needed
- preserved for historical review

This allows FlockTrax to answer:

- what we originally projected
- what actually happened
- whether the forecast was directionally correct
- how much correction was needed
- whether repeatable seasonal or environmental patterns exist

## Why Projection History Matters

Projection history creates long-term value beyond the popup itself.

Benefits:

- creates an auditable trail of forecast decisions
- lets users compare projected use vs actual use
- supports future tuning of breed-spec assumptions
- supports future seasonal correction logic
- supports discovery of repeatable temperature-driven patterns

Over time, this data may show:

- predictable seasonal consumption shifts
- temperature-band effects
- barn-specific or farm-specific variance patterns
- live-haul-period adjustments that should be standardized

## Minimum External Data Needed From BinSentry

### Required for V1

- bin identity
- current measured inventory per bin
- reading timestamp per bin

### Strongly Recommended for V1.5

- scheduled feed orders / expected inbound deliveries
- delivery date
- delivery quantity
- destination bin or barn

### Needed Later for Forecast Refinement

- historical inventory readings by timestamp
- enough history to compare expected depletion vs actual depletion

## FlockTrax Data Inputs

FlockTrax already provides:

- placement
- flock
- barn
- farm
- feed bin assignment
- 10-day projected daily consumption

Needed local mapping:

- each FlockTrax `feedbins.id` should map to one BinSentry external bin/device id

Recommended new local fields:

- `feedbins.external_source`
- `feedbins.external_bin_id`
- `feedbins.external_bin_label`

## Proposed Popup V1

### Summary Row

Add a small summary block above the daily cards:

- `Current on hand`
- `Projected 10-day use`
- `Scheduled inbound`
- `Projected ending balance`
- `Coverage status`

### Coverage Status Values

Suggested labels:

- `On Track`
- `Watch Closely`
- `Short Before Next Delivery`
- `No Live Inventory Data`

### Day Cards

Extend each daily card to show:

- date
- projected use for the day
- scheduled inbound for the day
- projected end-of-day balance
- live-haul note if applicable

## V1 Calculation Model

For each placement:

### Step 1: Determine starting inventory

`starting_inventory = sum(latest measured inventory across mapped bin(s))`

If there are multiple bins in the same barn:

- sum them for the barn-level forecast

### Step 2: Determine projected daily use

Use existing FlockTrax 10-day projection logic:

- one daily projected feed-use value per day

### Step 3: Determine inbound scheduled feed

For each day in the 10-day window:

`scheduled_inbound_for_day = sum(all feed orders due on that day for mapped bin(s)/barn)`

If no order source is available:

- treat inbound as `0`

### Step 4: Calculate rolling daily balance

For each day:

`ending_balance(day) = starting_balance(day) + inbound(day) - projected_use(day)`

Then:

`starting_balance(next day) = ending_balance(current day)`

### Step 5: Determine status

Suggested first-pass status rules:

- `On Track`
  - projected ending balance stays above reserve threshold through day 10
- `Watch Closely`
  - projected ending balance stays positive but drops below reserve threshold
- `Short Before Next Delivery`
  - any day falls below `0`
- `No Live Inventory Data`
  - no usable BinSentry reading found

## Reserve Threshold

Keep this simple at first.

Suggested options:

- fixed pounds threshold per barn
- or `1 day of projected use`

Recommended V1 rule:

- `reserve_threshold = projected_use_for_next_day`

That keeps the warning logic operationally understandable.

## V1.5 Projection Verification Layer

Once starting inventory and inbound orders are visible, add a simple variance check:

### Goal

Compare expected recent depletion against actual depletion from BinSentry readings.

### Simple formula

For a recent 1- to 3-day window:

`expected_use = sum(projected daily use in window)`

`actual_use = prior_measured_inventory + inbound_deliveries_in_window - current_measured_inventory`

`variance = actual_use - expected_use`

`variance_percent = variance / expected_use`

### Suggested labels

- `Tracking forecast`
- `Running higher than forecast`
- `Running lower than forecast`

### Suggested tolerance

- within `+/- 5%` = tracking
- above `+5%` = running high
- below `-5%` = running low

## Projection Storage Recommendation

Add projection storage so each forecast can be saved, revisited, and evaluated over its lifecycle.

### Proposed Table: `feed_projections`

Purpose:

- one record per forecast instance

Suggested fields:

- `id`
- `placement_id`
- `barn_id`
- `farm_id`
- `flock_id`
- `forecast_created_at`
- `forecast_created_date`
- `window_start_date`
- `window_end_date`
- `forecast_horizon_days`
- `buffer_days`
- `projection_version`
- `projection_source`
- `baseline_method`
- `starting_inventory_lbs`
- `scheduled_inbound_lbs`
- `projected_total_use_lbs`
- `projected_end_balance_lbs`
- `reserve_threshold_lbs`
- `status`
- `coverage_status`
- `created_by`
- `notes`

Suggested enum-like values:

- `projection_source`
  - `baseline`
  - `corrected`
  - `manual_override`
- `status`
  - `open`
  - `evaluating`
  - `adjusted`
  - `closed`
- `coverage_status`
  - `on_track`
  - `watch_closely`
  - `short_before_next_delivery`
  - `inventory_unavailable`

### Proposed Table: `feed_projection_days`

Purpose:

- one row per forecast day inside a saved projection

Suggested fields:

- `id`
- `feed_projection_id`
- `forecast_day`
- `day_offset`
- `projected_use_lbs`
- `projected_inbound_lbs`
- `projected_start_balance_lbs`
- `projected_end_balance_lbs`
- `projected_population`
- `live_haul_event_type`
- `actual_inventory_lbs`
- `actual_use_estimate_lbs`
- `variance_lbs`
- `variance_percent`
- `evaluation_status`
- `last_evaluated_at`

Suggested `evaluation_status` values:

- `pending`
- `tracking`
- `running_high`
- `running_low`
- `needs_review`

### Optional Supporting Table Later: `feed_projection_adjustments`

Purpose:

- retain a clean history of revisions or corrections applied after the original forecast

Suggested fields:

- `id`
- `feed_projection_id`
- `adjustment_created_at`
- `adjustment_type`
- `prior_projected_total_use_lbs`
- `updated_projected_total_use_lbs`
- `reason`
- `applied_by`
- `notes`

## Popup Behavior With Saved Projections

The popup should eventually support two related modes:

### Live Calculation Mode

Use current data to calculate a new forecast immediately.

This is useful when:

- no saved projection exists yet
- the user wants the most current view
- the user is checking a placement informally

### Projection Lifecycle Mode

Use the most recent open saved projection and compare its daily rows against current actuals.

This is useful when:

- the forecast is already being tracked
- the user wants to evaluate accuracy over the first 2 to 3 days
- the user wants to preserve a dated planning record

Recommended rule:

- V1 popup can remain live-calculation only
- V2 should support saving the forecast snapshot
- V3 should evaluate saved forecasts against actual inventory changes

## Development Lifecycle

### Phase 0: Forecast Overlay

Goal:

- add BinSentry context to the existing popup without changing projection ownership

Scope:

- current live inventory
- projected daily use
- projected ending balance
- basic coverage status

### Phase 1: Persist Forecast Snapshots

Goal:

- save each forecast as a dated projection record

Scope:

- add `feed_projections`
- add `feed_projection_days`
- save popup forecast on generation or on explicit user action

### Phase 2: Evaluate First 2 to 3 Days

Goal:

- compare saved forecast vs actual measured depletion

Scope:

- record actual inventory readings against saved forecast days
- calculate variance
- mark forecast as tracking high, low, or on track

### Phase 3: Order Adjustment Workflow

Goal:

- support operational corrections before the 3-day safety buffer is threatened

Scope:

- show risk day clearly
- show whether inbound orders are sufficient
- show whether revised ordering is needed

### Phase 4: Multi-Season Learning

Goal:

- identify repeatable correction patterns over time

Scope:

- analyze projection accuracy by season
- analyze by temperature band if weather data is added
- analyze by breed, flock age, farm, and barn
- derive explainable correction factors

## Seasonal / Temperature Hypothesis

Expected future learning:

- feed-use variance may cluster by season
- temperature range may become a strong predictor
- some barns may have recurring drift above or below breed-spec baseline

Recommended future context fields for analysis:

- season
- high temperature band
- low temperature band
- weather source / capture date
- flock age band
- breed profile
- barn id
- farm id

These should not block V1, but the schema should leave room for them later.

## Later Refinement Layer

Only after the popup is stable:

- compute rolling correction factors
- apply correction by flock, barn, age band, or breed profile
- optionally show:
  - `Corrected forecast: +4% above breed-spec baseline`

This should be a later phase, not part of the first integration.

## UI Copy Direction

Suggested summary labels:

- `On Hand`
- `10-Day Use`
- `Inbound`
- `Projected Balance`
- `Status`

Suggested status helper copy:

- `Based on live bin readings and scheduled feed orders.`
- `Forecast starts with breed-spec consumption and current flock population.`

## Missing Data Rules

If BinSentry data is partial:

- show what is known
- do not block the popup
- fall back to the existing FlockTrax projection view

Examples:

- no live reading:
  - show `Inventory unavailable`
- no inbound orders:
  - show `No scheduled inbound`
- no external mapping:
  - show `Bin not linked to BinSentry`

## Recommended Build Phases

### Phase 1

Add BinSentry inventory only:

- current on-hand
- projected 10-day use
- projected ending balance assuming no inbound
- coverage status

### Phase 2

Add scheduled feed orders:

- inbound by day
- risk day
- improved ending balance

### Phase 3

Add short-window verification and saved projection evaluation:

- actual vs projected recent depletion
- variance label

### Phase 4

Add rolling correction factor and longer-term learning:

- refined forecast
- explainable adjustment

## Suggested First Implementation Scope

Keep the first release intentionally narrow:

1. Add external bin mapping support
2. Fetch current BinSentry inventory for mapped bins
3. Extend popup summary and daily cards with rolling balance
4. Do not change the existing core projection formula yet
5. Add order overlay only when source reliability is confirmed
6. Design projection persistence before automated correction logic is introduced

## Best V1 Definition of Done

The popup is successful when a user can open a placement's 10-day forecast and immediately tell:

- how much feed is on hand now
- how much feed the flock is expected to use
- whether the current bin inventory is enough
- the day feed risk begins, if any

## Recommended Next Engineering Step

Before coding the popup UI, define the integration contract:

- how a FlockTrax feed bin maps to a BinSentry bin
- how current inventory is represented
- whether feed orders come from BinSentry or from another source
- whether the first version is barn-level or individual-bin-level
- whether saved projections are created automatically or by explicit user action
