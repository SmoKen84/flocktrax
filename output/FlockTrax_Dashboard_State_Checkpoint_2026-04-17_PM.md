# FlockTrax Dashboard + State Checkpoint

Date: 2026-04-17 PM

## Current live baseline

- Production web-admin/dashboard is live from deployment `dpl_Hj3rXrvSUWsF26SwP6dSqkSdoUKW`.
- Latest live dashboard includes:
  - all-barns dashboard tiles, not just active placements
  - tile states for `live`, `awaiting`, `scheduled`, and `empty`
  - stronger per-state tile coloring
  - empty/offline barns using a fire-engine red treatment
  - placement wizard recap columns updated to `Flock`, `Place Date`, and calculated `Next Place`
  - placement wizard historical-entry override reading from `platform.settings`

## Database work applied today

- `20260417093000_operational_placement_state_functions.sql`
  - added `sync_barn_current_state(uuid)`
  - added `mark_chicks_arrived(uuid, date)`
  - added `mark_barn_empty(uuid, date)`
  - added flock/barn sync trigger support
- `20260417101000_fix_operational_state_functions_for_active_window.sql`
  - corrected state functions to use `placements.active_start`

## State model confirmed

- `placements.is_active`
  - current operational placement for the barn
- `flocks.is_in_barn`
  - birds are physically in the barn
- `barns.is_empty`
  - the barn is physically empty

Validated intermediate state:

- placement active
- flock not in barn
- barn empty
- dashboard shows `Chicks Arrived`

## Helper SQL created for testing

Saved/used helper patterns:

- `public.make_placement_current(uuid)`
  - promotes a placement to current operational state while leaving `is_in_barn = false`
- `public.inspect_placement_state(text)`
  - lookup of placement/barn/flock flag state by `placement_key`

## Important current behavior

- Scheduler creates placements safely as scheduled/inactive.
- Dashboard now shows all barns, including:
  - live
  - awaiting arrival
  - scheduled
  - empty/offline

## Local-only change not yet deployed

- Dashboard empty-state pill label changed from `Empty` to `OFFLINE`.
- This is currently only local and should go out on the next Vercel push.

Changed local file:

- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`

## Good next starting point

Next session likely starts with:

1. deploy the local `OFFLINE` pill-label tweak
2. rename live `Pending` pill to `Daily Pending`
3. continue refining dashboard actions around operational transitions

