# FlockTrax Lifecycle Stage Implementation Design

Date: 2026-05-30
Workspace: `C:\dev\FlockTrax`
Depends on: `C:\dev\FlockTrax\output\FlockTrax_Flock_Lifecycle_And_Closeout_Spec_2026-05-14.md`
Purpose: turn the lifecycle blueprint into a concrete first implementation plan, choose first ownership for `lifecycle_stage`, and outline the initial `Flock Closeout` workspace plus `livehaul_loads` schema

## Executive Decision

The first authoritative lifecycle field should live on:

- `public.placements.lifecycle_stage`

Not on `public.flocks` first.

## Why `placements` Should Own It First

This is the cleanest first implementation because the current operational system is already placement-centric:

- `placements` already owns `barn_id`, `flock_id`, `placement_key`, `active_start`, `active_end`, `date_removed`, and current queue position
- the live dashboard builds around placement records, not flock-only records
- placement checkout/promotion functions already operate on `placements`
- the scheduler and barn queue logic are already placement-driven
- the spec explicitly frames placement as the operational container for barn assignment and dashboard visibility

Relevant current code and schema:

- `supabase/migrations/20260216212854_remote_schema.sql`
- `supabase/migrations/20260417093000_operational_placement_state_functions.sql`
- `supabase/migrations/20260430103000_add_flock_removed_and_checkout_state.sql`
- `web-admin/lib/admin-data.ts`
- `web-admin/components/active-placement-dashboard.tsx`

## Important Constraint Found In The Current Model

The current system does not treat `is_active` as a general lifecycle flag. It treats it as a single-current-placement-per-barn flag.

Evidence:

- unique index: `supabase/migrations/20260416131500_fix_active_placement_unique_index.sql`
- current rule: only one row per barn may satisfy `is_active = true and date_removed is null`
- checkout RPC currently sets the checked-out placement inactive immediately and promotes the next placement

That means the following two ideas are currently in conflict:

- spec intent: `waiting_closeout` remains operationally open after checkout
- current system: checked-out placement cannot remain the same kind of active row once the next placement is promoted

## Concrete Resolution For Phase 1

Phase 1 should make `lifecycle_stage` authoritative without immediately redefining `is_active`.

So in the first implementation:

- `lifecycle_stage` becomes the business truth
- `placements.is_active` remains a compatibility/live-ops queue flag
- `flocks.is_active`, `flocks.is_in_barn`, and `flocks.is_complete` remain transitional support fields
- closeout eligibility should be driven by `lifecycle_stage`, not by `is_active`

This lets us move forward without breaking the one-active-placement-per-barn model on day one.

## Recommended Phase 1 Meaning Split

### `placements.lifecycle_stage`

Business-state authority.

### `placements.is_active`

Compatibility flag for:

- current dashboard queue logic
- current barn current-state sync
- legacy feed and mobile assumptions until they are migrated

### `flocks` booleans

Keep as transitional detail flags:

- `is_active`
- `is_in_barn`
- `is_complete`
- `is_settled`

These should no longer be the primary way the UI decides lifecycle position.

## Concrete Column Design

Add the following to `public.placements` first:

- `lifecycle_stage text not null`
- `closeout_submitted_at timestamptz null`
- `closeout_submitted_by uuid null`
- `archived_at timestamptz null`
- `archived_by uuid null`

Recommended constraint:

- check `lifecycle_stage in ('scheduled','awaiting_arrival','in_barn_growing','waiting_closeout','closeout_submitted','archived')`

Recommended index:

- index on `(lifecycle_stage, farm_id, barn_id)`

Recommended default for existing shape:

- default `scheduled`

But existing rows should be backfilled explicitly and not left on the default blindly.

## Initial Backfill Mapping

Backfill `placements.lifecycle_stage` from current placement + flock state:

### `scheduled`

Use when:

- placement exists
- `placements.is_active = false`
- `placements.date_removed is null`
- flock is not in barn
- flock is not complete

### `awaiting_arrival`

Use when:

- `placements.is_active = true`
- `placements.date_removed is null`
- flock is not in barn
- flock is not complete

### `in_barn_growing`

Use when:

- `placements.is_active = true`
- `placements.date_removed is null`
- flock is in barn
- flock is not complete

### `waiting_closeout`

Use when:

- `placements.date_removed is not null`
- flock is not complete
- placement has not been submitted/archived yet

Important:

- in phase 1 this row may still have `placements.is_active = false`
- that is acceptable because `lifecycle_stage` is the authority and `is_active` is still compatibility-only

### `closeout_submitted`

Use when:

- placement is post-removal
- closeout has been submitted
- record is not archived

### `archived`

Use when:

- record has been finalized into history

## Recommended RPC / State Transition Updates

### `make_placement_current`

Should set:

- `placements.lifecycle_stage = 'awaiting_arrival'`
- `placements.is_active = true`
- `flocks.is_active = true`
- `flocks.is_in_barn = false`

### `mark_chicks_arrived`

Should set:

- `placements.lifecycle_stage = 'in_barn_growing'`
- `placements.is_active = true`
- `flocks.is_active = true`
- `flocks.is_in_barn = true`

### `mark_barn_empty`

Should stop meaning "the record is finished".

It should set the checked-out placement to:

- `placements.date_removed = p_removed_date`
- `placements.lifecycle_stage = 'waiting_closeout'`
- `flocks.is_in_barn = false`

For phase 1 compatibility it may still set:

- `placements.is_active = false`

Then it can still promote the next row to:

- `placements.is_active = true`
- `placements.lifecycle_stage = 'awaiting_arrival'`

This preserves the current barn queue mechanism while still introducing the correct lifecycle meaning.

### New submit closeout RPC

Add a new RPC:

- `public.submit_flock_closeout(p_placement_id uuid, p_notes text default null)`

Should set:

- `placements.lifecycle_stage = 'closeout_submitted'`
- `placements.closeout_submitted_at = now()`
- `placements.closeout_submitted_by = auth.uid()`
- optionally update summary fields when present

### New archive closeout RPC

Add a new RPC:

- `public.archive_flock_closeout(p_placement_id uuid)`

Should set:

- `placements.lifecycle_stage = 'archived'`
- `placements.archived_at = now()`
- `placements.archived_by = auth.uid()`
- `placements.is_active = false`
- `flocks.is_active = false`
- `flocks.is_complete = true`

## Recommended UI Refactor Direction

Current UI derives lifecycle from:

- `tileState`
- `placementIsActive`
- `flockIsInBarn`
- `flockIsComplete`
- `dateRemoved`

That should change to:

- read `placement.lifecycle_stage` first
- use booleans as supporting badges and compatibility detail only

## First Web Admin Surfaces To Update

### 1. Shared types

- `web-admin/lib/types.ts`

Add:

- `lifecycleStage`

Recommended union:

- `"scheduled" | "awaiting_arrival" | "in_barn_growing" | "waiting_closeout" | "closeout_submitted" | "archived"`

### 2. Admin data shaping

- `web-admin/lib/admin-data.ts`

Replace the current inferred tile-state derivation as the primary lifecycle source.

Keep `tileState` temporarily, but derive it from `lifecycleStage`:

- `scheduled` -> `scheduled`
- `awaiting_arrival` -> `awaiting`
- `in_barn_growing` -> `live`
- all other stages -> exclude from live tiles

### 3. Dashboard popup display

- `web-admin/components/active-placement-dashboard.tsx`

Update the read-only lifecycle explainer to read actual `lifecycleStage`.

### 4. Overview actions

- `web-admin/app/admin/overview/actions.ts`

Update action success messaging and downstream assumptions to reflect:

- checkout means "moved to closeout"
- not "finished"

## Initial `Flock Closeout` Workspace

Add a new sidebar item:

- `Flock Closeout`

Recommended route:

- `/admin/flock-closeout`

This workspace should own:

- `waiting_closeout`
- `closeout_submitted`

It should not own:

- live growout editing
- placement scheduling
- final archive browsing

## Initial Closeout Workspace Shape

### Queue tabs

- `Waiting Closeout`
- `Submitted`

### Filters

- farm group
- farm
- barn
- date removed range
- placement / flock search

### Queue columns

- placement code
- flock code
- farm
- barn
- date removed
- current stage
- livehaul load count
- total hauled head
- total hauled weight
- submission status
- last activity timestamp

### Detail panel sections

- flock summary
- closeout status
- livehaul loads
- feed-ticket associations after checkout
- reconciliation notes
- activity log snippet
- flock history report link

### Primary actions

- `Add Load`
- `Edit Load`
- `Submit Closeout`
- `Archive`

### Permissions

Closeout should be more restrictive than generic live dashboard editing.

Initial permission model can be role-driven through existing access patterns:

- read closeout queue
- edit livehaul loads
- submit closeout
- archive closeout

## Recommended Initial Data Model For The Workspace

Phase 1 can work with:

- `placements.lifecycle_stage`
- `placements.closeout_submitted_at`
- `placements.closeout_submitted_by`
- `placements.archived_at`
- `placements.archived_by`
- `livehaul_loads`

A separate `placement_closeouts` header table is not required on day one if we keep the first version lean.

## Recommended `livehaul_loads` V1 Schema

Create:

- `public.livehaul_loads`

Recommended columns:

- `id uuid primary key default gen_random_uuid()`
- `placement_id uuid not null references public.placements(id) on delete cascade`
- `flock_id uuid not null references public.flocks(id)`
- `farm_id uuid not null references public.farms(id)`
- `barn_id uuid not null references public.barns(id)`
- `load_seq integer not null`
- `load_date date not null`
- `load_at timestamptz null`
- `ticket_number text null`
- `truck_code text null`
- `trailer_code text null`
- `driver_name text null`
- `plant_code text null`
- `head_count integer null`
- `avg_weight_lbs numeric(10,2) null`
- `gross_weight_lbs numeric(12,2) null`
- `tare_weight_lbs numeric(12,2) null`
- `net_weight_lbs numeric(12,2) null`
- `condemned_head integer null`
- `doa_head integer null`
- `notes text null`
- `is_reconciled boolean not null default false`
- `reconciled_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `created_by uuid null default auth.uid()`
- `updated_by uuid null`

Recommended constraints:

- unique `(placement_id, load_seq)`
- check `load_seq > 0`
- check `head_count is null or head_count >= 0`
- check `doa_head is null or doa_head >= 0`
- check `condemned_head is null or condemned_head >= 0`

Recommended indexes:

- `(placement_id, load_date, load_seq)`
- `(flock_id)`
- `(farm_id, barn_id, load_date)`

## Why `livehaul_loads` Should Point To Placement First

The same reason as `lifecycle_stage`:

- closeout work belongs to the placement lifecycle
- reporting still needs flock identity, so keeping `flock_id` denormalized is useful
- farm and barn are also worth storing directly for fast queue/report queries and to keep load rows resilient if joins are refactored later

## Recommended V1 Aggregates

The closeout queue should derive these values from `livehaul_loads`:

- load count
- total head hauled
- total DOA head
- total condemned head
- total net weight
- average live weight

These can remain derived in phase 1.

Do not create a summary table yet unless queue performance or reconciliation complexity forces it.

## Recommended Minimal Validation Rules

### Before `waiting_closeout` -> `closeout_submitted`

Require:

- at least one `livehaul_loads` row
- `date_removed` present
- no duplicate `load_seq`

Optional warnings, not blockers in V1:

- missing weight fields
- unreconciled loads
- missing ticket numbers

### Before `closeout_submitted` -> `archived`

Require:

- record already submitted
- no unresolved required closeout warnings flagged as blockers

## Migration / Build Order

### Step 1

Add placement lifecycle columns and backfill them.

### Step 2

Update RPCs:

- `make_placement_current`
- `mark_chicks_arrived`
- `mark_barn_empty`
- add `submit_flock_closeout`
- add `archive_flock_closeout`

### Step 3

Update web-admin data loaders and types to expose `lifecycleStage`.

### Step 4

Hide `waiting_closeout`, `closeout_submitted`, and `archived` from the live dashboard by stage, not by old booleans.

### Step 5

Add `/admin/flock-closeout` queue and detail page.

### Step 6

Add `livehaul_loads` CRUD and queue aggregates.

## Final Recommendation

Implement `lifecycle_stage` on `placements` first, not `flocks`.

Do not try to make legacy `is_active` fully match the future lifecycle model in the same first pass. That would collide with the current single-active-placement-per-barn design and slow the rollout down.

Instead:

- make `lifecycle_stage` the business truth
- keep `is_active` as a temporary queue compatibility flag
- route post-checkout work into the new closeout workspace
- attach `livehaul_loads` to placements as the first real closeout child model

That gives FlockTrax the correct lifecycle language now without forcing an unsafe barn-state rewrite before the closeout system exists.
