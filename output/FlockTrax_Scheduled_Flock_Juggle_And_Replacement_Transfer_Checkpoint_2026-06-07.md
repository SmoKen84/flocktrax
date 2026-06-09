# FlockTrax Scheduled Flock Juggle And Replacement Transfer Checkpoint

Date: `2026-06-07`
Project: `C:\dev\FlockTrax`
Primary app: `C:\dev\FlockTrax\web-admin`

## Resume Prompt

Load `C:\dev\FlockTrax\output\FlockTrax_Scheduled_Flock_Juggle_And_Replacement_Transfer_Checkpoint_2026-06-07.md` first.

## Why This Checkpoint Exists

This checkpoint captures the direct recovery/juggle work for a canceled scheduled flock that already had delivered feed tied to it.

The concrete case was:
- source canceled flock: `310-W5`
- replacement flock: `311-S1`
- final intended destination state: `311-W5`

The scheduler UI path for a reusable `Cancel And Juggle` control was partially implemented in code, but it did **not** surface reliably in the live placement scheduler screen during this session. Because operational work needed to continue, the actual juggle was completed directly in the database.

## Final Resolved Data State

The direct juggle is complete.

### Source flock removed

The old canceled source flock is gone:
- old placement key: `310-W5`
- old flock number: `310`
- old flock record no longer exists
- old placement record no longer exists

### Replacement flock now owns the W5 slot

The replacement flock now lives as:
- placement key: `311-W5`
- flock number: `311`
- farm: `Woape`
- barn: `W5`
- `active_start = 2026-06-11`
- `active_end = 2026-08-12`
- `lifecycle_stage = awaiting_arrival`
- `is_active = true`
- `is_in_barn = false`

### Feed transfer completed

Delivered feed was successfully transferred from the old canceled placement onto the replacement placement.

Verified transferred drop:
- ticket: `1002549788`
- pounds: `11,540`
- placement now attached to: `311-W5`

### Barn pointers corrected

Verified barn pointers after cleanup:
- `W5.active_flock_id -> flock 311`
- `S1.active_flock_id -> null`

## Important What-Happened Notes

The juggle did **not** finish in one step because several database integrity rules correctly blocked unsafe updates:

1. The replacement placement could not be moved into `W5` until the replacement flock’s `farm_id` matched the destination farm.
2. The destination barn overlap constraint blocked moving `311` into `W5` while the old `310-W5` placement row still existed.
3. The old `310` flock could not be deleted until `barns.active_flock_id` no longer referenced it.
4. `S1` still pointed at flock `311`, so that stale barn pointer had to be cleared after the flock moved to `W5`.

Because of those constraints, the final safe sequence became:
- transfer feed drop from `310-W5` to the `311` placement
- move `311` flock farm/date ownership to Woape/W5 timing
- delete the old `310-W5` placement
- update the `311` placement to `311-W5` in `W5`
- update barn pointers
- delete the old `310` flock

## Scheduler UI Work In Progress

Code was added for a reusable scheduler-side juggle flow, including:
- a new server action to transfer feed drops and move a replacement flock into the canceled slot
- a `Cancel And Juggle` UI section in the placement editor
- replacement-flock selection UI

Files touched for that work:
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx`
- `C:\dev\FlockTrax\web-admin\lib\placement-scheduler-data.ts`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

However:
- the new juggle section did not appear in the live scheduler browser view
- repeated restarts on `localhost:3000` did not make the control surface reliably
- direct operational database handling was used instead to finish the real business task

So the UI feature should be treated as **unfinished** and needing a focused cleanup/debug pass later.

## Related Feed-Ordering Context

This work happened on top of the same day’s first-pass feed-ordering changes:
- starter/grower split in the 10-day projection
- day-14 starter cutoff
- 12,000 lb minimum startup starter rule for incoming flocks inside the 10-day window

That checkpoint remains:
- `C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Projection_First_Pass_Checkpoint_2026-06-07.md`

And the larger future design spec remains:
- `C:\dev\FlockTrax\output\FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.md`

## Verification Performed

Verified by direct database inspection:
- replacement placement exists as `311-W5`
- replacement flock `311` now points to Woape/W5 timing
- transferred feed drop points to `311-W5`
- old flock `310` no longer exists
- `W5` barn now references flock `311`
- `S1` barn no longer references flock `311`

Code checks also passed during the session:
- `npm run typecheck`
- `npm run build`

## Best Next Steps

When work resumes, likely follow-up items are:

1. Debug why the scheduler page did not surface the new `Cancel And Juggle` UI despite the code changes.
2. Convert the direct-database juggle logic into a reliable in-app admin workflow.
3. Expand the juggle flow to support replacement flocks that may already have some feed drops, instead of only “clean” targets.
4. Revisit whether canceled scheduled flocks with transferred records should be deleted outright or retained with a dedicated canceled status for audit visibility.

## Good Resume Prompt

```text
Load C:\dev\FlockTrax\output\FlockTrax_Scheduled_Flock_Juggle_And_Replacement_Transfer_Checkpoint_2026-06-07.md first.
```
