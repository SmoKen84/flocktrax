# FlockTrax Placement Wizard Checkpoint

Date: 2026-04-16 PM
Workspace: `C:\dev\FlockTrax`
Admin app: `C:\dev\FlockTrax\web-admin`
Primary route: `/admin/placements/new`

## Current Status

The placement scheduler / placement wizard is live on Vercel production and attached to:

- `https://admin.flocktrax.com`
- `https://flocktrax.com`

Latest production deployment at this checkpoint:

- `dpl_4wNkPYY5iCbNJhPrPQvbtPHubDXZ`

Latest live UI tweak after that:

- `dpl_FUKYEDXRUX8uMfoRbYpgvRRThKso` for LH date layout

## Implemented Wizard Behavior

- Hero text now comes from `platform.screen_txt`:
  - `placement_wizard_title`
  - `placement_wizard_desc`
- Mode description text comes from `platform.screen_txt`:
  - `calendar_farm_view`
  - `calendar_barn_view`
- View toggle labels are:
  - `Barn View`
  - `Farm View`
- Wizard starts with no farm or barn preselected.
- Farm View shows a single month calendar for all barns on the selected farm.
- Placement days display `placement_key`.
- Active placements render green.
- Scheduled placements use alternating tones.
- Clicking a placement day opens by exact `placement_id`, not by inferred date-only matching.

## Current Editor / Scheduler Rules

- Placement identity is shown as a locked display row:
  - `placement_key`
  - locked `placed date`
- `flock_number` is not editable in the editor.
- `date_placed` is not editable in the editor.
- Future placements clicked from Farm View route into Barn View scheduler-style handling.
- After successful `Save Placement`, the sidebar clears and returns to the neutral helper state.
- `Prev` / `Next` calendar nav buttons are styled as active brown buttons with white text.
- LH dates are laid out with:
  - `LH 1` and `LH 2` on the first row
  - `LH 3` on the next row

## Scheduler / Placement Creation Rules

- Scheduling a new placement creates:
  - a new `flocks` row
  - a linked `placements` row
- New scheduled placements are created inactive:
  - `placements.is_active = false`
  - `flocks.is_active = false`
  - `flocks.is_in_barn = false`
- Scheduler creation requires manual flock number entry.
- Flock numbers are integrator-issued and are not auto-assigned.

## Important DB Fixes Already Applied

These migrations were created locally and the user confirmed they were applied successfully:

1. `C:\dev\FlockTrax\supabase\migrations\20260416113000_fix_live_placements_trigger_for_active_window.sql`
   - fixes `placements_set_defaults()` to use `active_start` / `active_end`

2. `C:\dev\FlockTrax\supabase\migrations\20260416124500_sync_placement_keys_on_barn_and_flock_changes.sql`
   - keeps `placements.placement_key` synchronized when `barn_code` or `flock_number` changes

3. `C:\dev\FlockTrax\supabase\migrations\20260416131500_fix_active_placement_unique_index.sql`
   - fixes the unique active placement index so future scheduled inactive placements can coexist in a barn

## Placement Key Rule

`public.placements.placement_key` is critical and is currently maintained as:

- `flocks.flock_number + "-" + barns.barn_code`

This code is used heavily by sync / worksheet matching.

## Important Business Logic Decision Reached

We refined the meaning of the state flags:

- `placements.is_active`
  - should mean the current operational placement for the barn
  - used by feed deliveries and other operational workflows

- `flocks.is_in_barn`
  - should mean birds are physically present in the barn

- `barns.is_empty`
  - should reflect physical barn occupancy

This is a shift from the earlier interpretation where `is_active` meant birds were physically present.

## Planned Business Rule To Implement Next

When the current placement is ended with `placements.date_removed`:

1. current placement:
   - `is_active = false`
   - `date_removed` is final active date

2. current flock:
   - `is_in_barn = false`

3. barn:
   - `is_empty = true`

4. next scheduled placement in that barn:
   - automatically becomes `is_active = true`

5. next flock:
   - remains `is_in_barn = false` until birds actually arrive

Reason:

- the next placement needs to be operationally active early enough to accept feed deliveries and similar records before birds physically arrive
- but physical occupancy still needs to show the barn as empty until arrival

## Recommended Next Implementation

Create dedicated database transition functions and stop allowing normal CRUD to directly own these state transitions.

Recommended functions:

1. `close_active_placement_and_promote_next(barn_id, removed_date)`
2. `mark_flock_arrived(placement_id, arrival_date)`
3. `activate_specific_scheduled_placement(placement_id)` as an override path if needed

## Files Most Relevant At This Checkpoint

- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\scheduler-filters.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`
- `C:\dev\FlockTrax\web-admin\lib\placement-scheduler-data.ts`

## Notes

- The scheduler is now in a good refinement state rather than emergency-repair mode.
- Farm View click-through and save/return behavior were both troublesome earlier, but are currently working in production.
- The next meaningful chunk of work is the operational placement handoff logic at the database layer.
