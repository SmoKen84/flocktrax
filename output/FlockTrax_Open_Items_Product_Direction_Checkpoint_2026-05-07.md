# FlockTrax Open Items Product Direction Checkpoint

Date: `2026-05-07`

Purpose:
- capture the operational intent behind the new `issues` / `open items` feature
- preserve the direction before further UI and schema iteration
- document the next-step shape so future work does not drift back toward checkbox-style flags

## Current State

What is already in place:
- a forward-only `issues` table exists in Supabase
- mobile can create and resolve open items in the current dev flow
- admin now has an `Open Items` console and dashboard entry path
- dashboard status badges can reflect open-item counts instead of only daily-log flags

What this means:
- FlockTrax now has the first slice of a real operational item-tracking system
- the feature is already useful, but it should now be treated as the start of a broader maintenance / operational tracking capability

## Product Intent

The ideal operational behavior is:
1. a farm worker sees a problem while standing in the barn
2. the worker uses the mobile app to capture it immediately
3. the system records what, where, and when without relying on later transcription
4. the office/admin side sees the item immediately
5. progress can be tracked until the repair or issue is completed
6. completed work remains available for review, reporting, and historical context

This is important because manual note-taking often breaks down between:
- first noticing the issue
- getting back to the office
- rewriting it onto a whiteboard or other manual list

FlockTrax should remove that gap.

## Naming Direction

Preferred user-facing wording:
- `Open Items`

Reason:
- less severe and less vague than `Issues`
- operational and readable
- broad enough to cover repairs, alerts, and follow-up items
- avoids the “pending doom” tone of harsher labels

## Ownership Model

Core design principle:
- an item belongs to the real object that owns the problem
- but it can also carry placement context for historical interpretation

Current intended ownership:
- `Maintenance / Repair` -> `barn`
- `Feedlines` -> `barn`
- `Nipple Lines` -> `barn`
- `Water / Ventilation / Equipment` -> `barn`
- `Bird Health` -> `placement`
- other flock-cycle concerns -> `placement`

Important nuance:
- if a barn-owned item happens during a live placement, it should still be linked to that `placement_id`
- that allows placement history and reporting to show context that may have affected outcome

Example:
- a feedline may belong to the barn
- but if it was down for 4 days during a given placement, that matters to the grow-cycle history of that placement

## Next Product Nudges

### 1. Data-driven item types

Current `issue_type` choices are hard-coded in app code.

That should evolve into a table-driven setup such as:
- `public.issue_types`

Suggested fields:
- `code`
- `label`
- `entity_type`
- `is_active`
- `sort_order`
- optional `severity_default`
- optional `report_group`

Reason:
- makes the system configurable without code edits
- allows maintenance and operational categories to evolve over time

### 2. Threaded updates

The current parent item record should gain a child updates/history table.

Suggested table:
- `public.issue_updates`

Suggested fields:
- `id`
- `issue_id`
- `entry_type`
- `entry_text`
- `created_at`
- `created_by`
- optional `effective_date`

Example thread:
- `opened_entry`: feedline motor failed
- `progress_entry`: parts ordered from XYZ Company, expected Thursday
- `progress_entry`: temporary workaround in place
- `resolved_entry`: new motor installed, running

Reason:
- turns the item into a trackable work thread
- preserves repair narrative
- supports office visibility, accountability, and historical reporting

### 3. Barn ownership plus placement context

A barn-owned open item should still be visible:
- in current barn open-item views
- in live dashboard summaries
- in placement history/reporting if `related_placement_id` is present

Reason:
- placement performance can be affected by barn conditions
- placement reports should be able to explain adverse operational conditions that occurred during that cycle

## Reporting Direction

This feature should also support a printable maintenance/work list.

Named report target:
- `Open Repair Items by Farm and Barn`

Operational purpose:
- give a farm hand a concrete list of what is broken and needs attention
- avoid idle ambiguity or dependence on memory/whiteboards

Suggested printable report columns:
- Farm
- Barn
- Item Type
- Title
- Opened Date
- Days Open
- Latest Update
- Related Placement
- Status

This should eventually fit naturally into the `platform.reportoptions` pattern already being used for other reports.

## Strategic Read

This is no longer just a replacement for dashboard flags.

It is becoming:
- maintenance intake
- operational item tracking
- repair history
- placement-context incident history
- printable work-order style reporting

That makes it one of the more operationally valuable features in FlockTrax because it directly reduces the loss of first-hand field information.

## Recommended Next Implementation Sequence

1. stabilize the current `Open Items` admin/mobile workflows
2. move `issue_type` definitions into a database table
3. add `issue_updates`
4. expose latest update text in admin/mobile open-item lists
5. add printable `Open Repair Items by Farm and Barn` reporting
6. later consider assignment / owner / due-date features if needed

## Resume Note

If this feature is resumed later, the correct mental model is:
- treat `Open Items` as the start of a lightweight maintenance and operational ticketing system
- do not drift back toward checkbox-owned state flags as the primary source of truth
