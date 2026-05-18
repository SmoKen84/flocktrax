# FlockTrax Flock Lifecycle And Closeout Spec

Date: 2026-05-14
Workspace: `C:\dev\FlockTrax`
Purpose: define the intended flock-placement lifecycle model as the blueprint for the future `Flock Closeout` workflow

## Why This Spec Exists

The current flock-placement model is reaching the point where simple boolean flags such as:

- `is_active`
- `is_in_barn`
- `is_complete`
- `date_removed`

are no longer enough to clearly describe where a flock-placement record sits in the operational lifecycle.

That was acceptable when the main question was:

- is the flock active?
- is it in the barn?

But the real business process is now broader:

- a placement can exist before chicks arrive
- a placement can be active and able to receive feed and action items before the flock is physically in the barn
- a flock can be checked out of the barn and still remain operationally unfinished
- harvest/closeout activity needs to continue after growout ends
- the flock record eventually needs a polished end-of-life path into historical storage

The missing concept is a first-class post-checkout closeout phase.

## Core Design Principle

The system should stop treating lifecycle as something inferred only from scattered booleans.

Instead, the system should move toward:

- one explicit authoritative lifecycle stage for the flock-placement record
- supporting booleans and event dates that still exist for operational detail
- separate UI surfaces for:
  - live production
  - closeout operations
  - archive/history

## Proposed Authoritative Lifecycle Stage

Recommended new field:

- `lifecycle_stage`

Recommended initial stage values:

- `scheduled`
- `awaiting_arrival`
- `in_barn_growing`
- `waiting_closeout`
- `closeout_submitted`
- `archived`

This field should become the primary business-state indicator for the flock-placement lifecycle.

## Stage Definitions

### 1. `scheduled`

Meaning:

- the placement exists
- the flock has been scheduled into a barn
- the placement has not yet been activated for operations

Operational meaning:

- planning is complete enough that the flock has a placement
- this is a future flock, not yet in active field operations

Expected behavior:

- not yet visible as a live production flock
- may appear in planning/scheduling contexts
- should not yet be treated as an active receiving point for daily operations

Typical flags:

- `placement.is_active = false`
- `flock.is_active = false`
- `flock.is_in_barn = false`
- `flock.is_complete = false`
- `date_removed = null`

### 2. `awaiting_arrival`

Meaning:

- the placement has been activated
- the system is operationally ready for the flock
- chicks have not yet been confirmed in the barn

Operational meaning:

- this is the transition state between simple scheduling and live production
- this state exists for a reason and is not just a technical placeholder
- in this state the placement can receive feed deliveries, feed allocations, and action items while the barn waits for chick arrival

Expected behavior:

- visible on the live dashboard
- visible in operational workflows
- eligible for feed and pre-arrival operational associations
- not yet treated as a true in-barn growing flock

Typical flags:

- `placement.is_active = true`
- `flock.is_active = true` or equivalent operationally active state
- `flock.is_in_barn = false`
- `flock.is_complete = false`
- `date_removed = null`

### 3. `in_barn_growing`

Meaning:

- the flock is active
- chicks have arrived
- the flock is in live production in the barn

Operational meaning:

- this is the main growout phase
- daily entries, mortality, weight, issues, feed allocations, and other live production signals are tied here

Expected behavior:

- visible on the live dashboard
- visible in daily production flows
- visible in current issue/action-item flows
- eligible for standard live feed and flock operations

Typical flags:

- `placement.is_active = true`
- `flock.is_active = true`
- `flock.is_in_barn = true`
- `flock.is_complete = false`
- `date_removed = null`

### 4. `waiting_closeout`

Meaning:

- the flock has been checked out of the barn
- growout has ended
- the flock record is still operationally open because closeout work remains

Operational meaning:

- this is the currently missing lifecycle stage
- the flock should no longer appear on the live dashboard
- the flock may still receive post-growout feed allocations and feed-ticket relationships
- the flock may now accumulate closeout-related records such as `livehaul_loads`
- this is where flock harvesting and final operational totals are assembled

Expected behavior:

- not shown on the live dashboard
- shown in a new `Flock Closeout` sidebar/workspace
- still operationally active for closeout processing
- still eligible for post-checkout associations from F2F, XTRANS, and ITRANS feed-ticket flows if business rules require it

Typical flags:

- `placement.is_active = true`
- `flock.is_active = true`
- `flock.is_in_barn = false`
- `flock.is_complete = false`
- `date_removed` is set

Important note:

- `date_removed` should be treated as the event that the flock left the barn
- `date_removed` should not, by itself, imply that the flock record is finished

### 5. `closeout_submitted`

Meaning:

- closeout work has been completed and submitted
- harvest/load/final totals are assembled
- the record is no longer a live operational workload, but may still remain visible for review/finalization

Operational meaning:

- this is the handoff point between active closeout processing and historical retirement
- this may be the stage where management review, reconciliation, or final confirmation happens

Expected behavior:

- not shown on the live dashboard
- shown in `Flock Closeout` until finalized or promoted to archive
- mostly read-only or controlled by closeout-specific permissions

Typical flags:

- `placement.is_active = true` or transitional
- `flock.is_active = true` or transitional
- `flock.is_in_barn = false`
- `flock.is_complete = true` or near-finalized equivalent
- `date_removed` is set

### 6. `archived`

Meaning:

- the flock-placement record has completed its operational lifecycle
- the record is now historical

Operational meaning:

- this is the final end-of-life state
- no further live operations or closeout actions should apply

Expected behavior:

- not shown on live dashboard
- not shown on active closeout work queue
- accessible from archive/history/reporting flows only

Typical flags:

- `placement.is_active = false`
- `flock.is_active = false`
- `flock.is_in_barn = false`
- `flock.is_complete = true`
- `date_removed` is set

## Recommended UI Ownership By Stage

### Live Dashboard

Should show only:

- `awaiting_arrival`
- `in_barn_growing`

May optionally surface:

- `scheduled` in limited/prep views if desired, but not as the same operational tile set used for current production

Should never show:

- `waiting_closeout`
- `closeout_submitted`
- `archived`

### Placement Scheduler / Placement Editor

Should primarily manage:

- `scheduled`
- the transition into `awaiting_arrival`
- limited maintenance of production-side metadata

Should not become the main tool for:

- closeout execution
- archive management

### New `Flock Closeout` Sidebar Workspace

Should own:

- `waiting_closeout`
- `closeout_submitted`

Should provide:

- harvest/load entry and editing
- closeout totals
- final reconciliation
- submission/finalization workflow

### Archive / Historical Views

Should own:

- `archived`

Should provide:

- historical lookup
- reporting
- summaries and finalized records

## Recommended Transition Rules

### `scheduled` -> `awaiting_arrival`

Trigger:

- placement is activated / promoted into current operational use

System effects:

- record becomes operationally active
- pre-arrival feed and actions may apply

### `awaiting_arrival` -> `in_barn_growing`

Trigger:

- chicks arrive and flock is confirmed in the barn

System effects:

- live production state begins
- dashboard treats flock as in-barn and growing

### `in_barn_growing` -> `waiting_closeout`

Trigger:

- flock is checked out of the barn
- `date_removed` is recorded

System effects:

- flock disappears from live dashboard
- flock enters closeout workspace
- livehaul / harvest / final operational aggregation begins

### `waiting_closeout` -> `closeout_submitted`

Trigger:

- closeout process is completed and submitted

Potential required checks:

- required closeout records exist
- required load/harvest totals are complete
- final summary values are present

### `closeout_submitted` -> `archived`

Trigger:

- record is finalized/accepted into history

Potential required checks:

- no remaining open closeout tasks
- no unresolved required reconciliation items

## Recommended Near-Term Technical Approach

### 1. Add authoritative lifecycle stage first

Add a new stage field before attempting to force all meaning out of legacy booleans.

Suggested field:

- `lifecycle_stage`

This can live on either:

- `placements`
- `flocks`
- or a future shared lifecycle concept

My recommendation:

- the placement is the operational container for barn assignment and dashboard visibility
- the flock represents the flock identity across operations
- if one table must own display state first, `placements.lifecycle_stage` is probably the cleaner first step for UI behavior

### 2. Keep existing flags for compatibility

Do not immediately remove or ignore:

- `is_active`
- `is_in_barn`
- `is_complete`
- `date_removed`

Instead:

- keep them as supporting event/state fields
- gradually migrate UI logic to read `lifecycle_stage` first
- leave booleans as derived, transitional, or compatibility indicators where necessary

### 3. Introduce closeout-specific data model

New closeout-related structures should be added rather than overloading the daily growout model.

The first specifically called-out new table is:

- `livehaul_loads`

Purpose:

- record harvesting / live-haul events
- maintain key load-level stats and totals
- support flock closeout summaries

This table will likely become one of the core children of the `waiting_closeout` state.

## Suggested Future `livehaul_loads` Responsibilities

The exact schema can be designed later, but conceptually it should support:

- association to placement and/or flock
- association to load date/time
- load count / truck / trip identifiers as needed
- harvested head totals
- weight totals if applicable
- load-level notes or reconciliation indicators

Closeout summary can then aggregate from `livehaul_loads` plus other closeout sources.

## Suggested Future Closeout Summary Responsibilities

The closeout process should ultimately pull together:

- growout totals
- live haul / harvested totals
- post-growout feed associations
- final operational summary metrics
- final closeout status and submission metadata

That could be stored either:

- as derived summary values
- or in a dedicated closeout header/summary table

This spec does not force that decision yet, but it should be planned intentionally.

## Immediate Guidance For Current UI

Until the full closeout system exists:

- keep using the read-only lifecycle projection in the dashboard popup as an explanatory bridge
- do not allow users to directly edit lifecycle position from that popup
- do not show post-checkout flocks on the live dashboard once the checkout behavior is refactored toward `waiting_closeout`

The popup lifecycle display should remain:

- explanatory
- read-only
- not authoritative

The authoritative lifecycle should come later through the formal stage model.

## Recommended Build Sequence

### Phase 1. Lifecycle definition and field introduction

- define stage enum / allowed values
- add `lifecycle_stage`
- map current records into an initial stage interpretation

### Phase 2. Dashboard and placement workflows consume stage

- live dashboard reads `lifecycle_stage`
- post-checkout records stop appearing on dashboard
- placement editor/popup continues to show lifecycle read-only

### Phase 3. Introduce `Flock Closeout` workspace

- new sidebar entry
- work queue for `waiting_closeout`
- read/write closeout operations

### Phase 4. Add `livehaul_loads`

- load entry and aggregation model
- closeout metrics and totals

### Phase 5. Add submission/finalization

- `waiting_closeout` -> `closeout_submitted`
- `closeout_submitted` -> `archived`

### Phase 6. Archive and reporting polish

- final archive surfacing
- historical summaries and reporting cleanup

## Recommended Naming Considerations

The labels should be operationally meaningful to non-technical users.

Strong candidates:

- `Scheduled`
- `Awaiting Arrival`
- `In Barn / Growing`
- `Waiting Closeout`
- `Closeout Submitted`
- `Archived`

If needed, the UI can show softer business labels while storing more technical enum values.

## Important Conceptual Rule

Checking a flock out of the barn should not mean the record is finished.

It should mean:

- production is over
- closeout is beginning

That is the central lifecycle correction this spec is introducing.

## Good Resume Prompt

Use this to resume later:

"Continue from `FlockTrax_Flock_Lifecycle_And_Closeout_Spec_2026-05-14.md`. Treat this as the authoritative blueprint for the future lifecycle model. Next step is to design the concrete `lifecycle_stage` implementation and decide where it should live first, then outline the initial `Flock Closeout` workspace and `livehaul_loads` schema."
