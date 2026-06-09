# FlockTrax Feed Order Projection First-Pass Checkpoint

Date: `2026-06-07`
Project: `C:\dev\FlockTrax`
Primary app: `C:\dev\FlockTrax\web-admin`

## Resume Prompt

Load `C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Projection_First_Pass_Checkpoint_2026-06-07.md` first.

## Current State

This checkpoint captures the first working pass of starter/grower-aware feed projection logic on top of the existing 10-day requirement engine.

The project now has:
- live BinSentry inventory sync already working and reflected in the admin dashboard popup
- a reports hub under `Reports`
- a `10 Day Feed Requirements` report that includes starter/grower split columns
- a first-pass ordering approximation that uses delivered FlockTrax feed history to determine remaining starter obligation

This is not yet the full FIFO layered-bin ordering engine from the June 7 spec. It is an intermediate implementation intended to make the next round of real-world validation easier.

## Business Rules Now Implemented

### Starter/Grower split

The 10-day projection now:
- calculates daily total feed the same way as before
- computes starter target as `started chicks * starter_lbs_per_chick`
- subtracts delivered starter feed already recorded in FlockTrax
- allocates projected starter demand first, then grower

### Day-14 starter cutoff

Starter is only treated as orderable through day 14.

That means:
- if a flock still has a raw starter shortfall after day 14, it is no longer projected as orderable starter
- days after age 14 are forced into grower in the type split

### Scheduled/incoming flock minimum starter rule

The incoming flock rule was clarified and corrected during this session.

The intent is:
- do not suggest less than `12,000 lbs` of starter for a new incoming flock
- but still include actual post-arrival feed requirement for that flock across the remaining days inside the 10-day window

Current implementation behavior:
- scheduled flocks are included once they reach projected age `0` and onward
- pre-arrival days are not given feed demand
- pre-arrival days are not reduced by mortality
- if the in-window post-arrival projected feed total is less than `12,000 lbs`, the projection is topped up to a `12,000 lb` minimum

## Key Files Changed

- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`
  - delivered feed history lookup
  - starter/grower split logic
  - day-14 starter cutoff
  - incoming-flock 12,000 lb minimum logic
  - corrected scheduled-flock pre-arrival mortality handling

- `C:\dev\FlockTrax\web-admin\lib\types.ts`
  - starter/grower projection fields added to `ActivePlacementRecord`
  - added `starterOrderableRemainingLbs`

- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
  - popup shows starter/grower requirement split
  - starter note now references the orderable starter amount through day 14

- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection\page.tsx`
  - added `Starter 10D` and `Grower 10D` report columns

## User-Facing Locations

### Dashboard popup

Starter/grower split now appears in:
- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`

This includes:
- requirement split summary
- starter program note
- daily starter/grower breakdown inside the 10-day popup

### Report

The starter/grower split is also surfaced in:
- `C:\dev\FlockTrax\web-admin\app\admin\reports\feed-projection\page.tsx`

Path in app:
- `Reports`
- `Feed Reports`
- `10-Day Feed Requirements`

## Spec Reference

The larger design direction still lives here:
- `C:\dev\FlockTrax\output\FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.md`
- `C:\dev\FlockTrax\output\FlockTrax_Feed_Type_And_BinSentry_Order_Logic_Spec_2026-06-07.pdf`

That spec reflects the more complete future model:
- FIFO layered bins
- accessible vs queued feed
- projected starter-bin readiness at current placement end
- FlockTrax as ordering/business-rules source of truth
- BinSentry as live inventory source of truth

The codebase is not at that full design yet.

## Important Limitations

This first-pass implementation does **not** yet model:
- FIFO feed layers inside a bin
- accessible vs queued feed
- typed on-hand inventory at the bin layer
- typed open order commitments
- barn-level projected starter-bin readiness at placement end

It currently uses:
- delivered starter history in FlockTrax
- starter target from started chicks
- the day-14 cutoff
- the incoming-flock 12,000 lb minimum

So it is useful for validation, but it is still an approximation.

## Validation Performed

Completed successfully:
- `npm run typecheck`
- `npm run build`

## Best Next Steps

When work resumes, likely next moves are:

1. Test several real flocks against operational expectations
2. Decide whether the first-pass split is directionally good enough to keep iterating
3. If yes, begin the fuller phase from the spec:
   - typed inventory/order commitments
   - FIFO layer model
   - starter-bin readiness forecasting

## Good Resume Context

Useful prompt for next session:

```text
Load C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Projection_First_Pass_Checkpoint_2026-06-07.md first.
```
