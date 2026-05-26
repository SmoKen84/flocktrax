# FlockTrax BinSentry Forecast Planning Checkpoint

Date: `2026-05-25`  
Branch: `main`  
HEAD: `05f88b7ca72f84471801be2d72f5c3e488dec695`

## Checkpoint Type

This is a planning checkpoint, not an execution checkpoint.

Purpose:

- capture the agreed concept for BinSentry-assisted feed forecasting
- preserve the product reasoning behind the 10-day forecast window
- record the popup-first rollout strategy
- keep the work clearly in `implementation plan only` status for now

## Current Product Understanding

The BinSentry integration should begin as a lightweight extension to the existing 10-day feed forecast popup on the live dashboard placement tiles.

The intent is not to replace the current FlockTrax forecast model.

Instead:

- FlockTrax remains the source of the baseline forecast
- BinSentry is used as a live inventory and verification layer
- feed orders may later be included in the projection balance
- the first user-facing integration should stay inside the existing popup

## Agreed 10-Day Forecast Intent

The 10-day forecast exists partly to preserve a practical safety buffer, not because feed ordering typically requires a full 10-day lead time.

Working understanding:

- the first 2 to 3 days of the forecast are used to validate whether the projection is tracking reality
- the remaining days preserve enough time to correct feed orders if the projection is drifting
- the forecast should eventually function as:
  - `forecast + verification + correction`

This is the core product framing that should guide later implementation decisions.

## Agreed BinSentry Role

The integration is expected to help answer:

- how much feed is projected to be used over the next 10 days
- how much feed is actually on hand now
- what feed is already expected to arrive
- whether the flock is on track or likely to run short
- whether the forecast is proving accurate over the first few days

Likely first external inputs needed from BinSentry:

- bin identity / mapping
- current measured inventory
- reading timestamp

Likely next external inputs:

- scheduled feed orders
- delivery date
- delivery quantity
- destination bin or barn

Likely later external inputs:

- historical inventory readings for forecast verification

## Planning Documents Created

Primary planning spec:

- [FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md](C:/dev/FlockTrax/output/FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md)

That spec now captures:

- popup-first integration scope
- 10-day window rationale
- BinSentry data needs
- current inventory plus inbound-order balance formula
- projection verification concept
- saved projection lifecycle concept
- proposed projection storage tables
- phased development plan
- future seasonal / temperature learning hypothesis

## Projection Lifecycle Direction

A key planning decision was made during this session:

- the forecast should not remain only a transient popup calculation
- it should eventually become a saved and dated forecast record that can be evaluated over time

Expected future shape:

- forecast snapshot created for a placement / barn
- first 2 to 3 days compared against actual measured depletion
- variance reviewed while there is still time to adjust feed orders
- projection results cataloged for historical analysis

Likely future tables discussed in planning:

- `feed_projections`
- `feed_projection_days`
- optionally later `feed_projection_adjustments`

## Important Constraint

This work should remain planning-only until explicitly approved for implementation.

That means:

- no projection tables yet
- no BinSentry connector code yet
- no popup UI changes for this feature yet
- no migrations yet for the BinSentry forecasting feature

The spec is being treated as an implementation plan, not an approved build order.

## Related Local Code Change Already Made

Separate from the BinSentry planning work, the local live dashboard feed-projection logic was corrected during this session.

The local-only fix adjusts the existing FlockTrax live-haul reduction behavior so the projection now follows the intended sequence:

- first live haul reduces the following day by one-third of the haul-day population
- second live haul reduces the following day by that same bird count again
- final live haul clears the remaining population for the following day

Files touched for that local correction:

- [admin-data.ts](C:/dev/FlockTrax/web-admin/lib/admin-data.ts)
- [types.ts](C:/dev/FlockTrax/web-admin/lib/types.ts)
- [active-placement-dashboard.tsx](C:/dev/FlockTrax/web-admin/components/active-placement-dashboard.tsx)

Verification completed:

- `npm run build` passed in `C:\dev\FlockTrax\web-admin`

Status:

- local only
- not deployed by this session

## Current Dirty Worktree Snapshot

Current `git status --short` includes:

```text
 M output/FlockTrax_Checkpoint_Index.md
 M supabase/.temp/cli-latest
 M supabase/functions/placement-day-get-adalo/index.ts
 M supabase/functions/placement-day-get/index.ts
 M supabase/functions/placement-day-submit/index.ts
 M web-admin/app/admin/flocks/[flockId]/page.tsx
 M web-admin/app/admin/flocks/[flockId]/report/page.tsx
 M web-admin/app/admin/placements/new/page.tsx
 M web-admin/app/admin/user-access/actions.ts
 M web-admin/app/admin/user-access/page.tsx
 M web-admin/app/globals.css
 M web-admin/app/login/actions.ts
 M web-admin/app/reset-password/page.tsx
 M web-admin/components/active-placement-dashboard.tsx
 M web-admin/lib/admin-data.ts
 M web-admin/lib/email/invite-email.ts
 M web-admin/lib/types.ts
?? output/FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md
?? output/FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md
?? supabase/migrations/20260519094709_bump_admin_release_build_5_1.sql
?? web-admin/app/mobile-access-ready/
?? web-admin/screens/FeedBin.png
```

Notes:

- `supabase/.temp/cli-latest` is still temp noise
- the invite-flow split and `Micro Archive Copy` local work from the May 19 checkpoint still appear to be pending locally
- the new BinSentry planning spec is currently untracked
- the live-haul feed-projection fix is also currently local-only in the dirty worktree

## Relationship To Previous Checkpoints

For execution baseline and broader current-state recovery, still use:

- [FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md](C:/dev/FlockTrax/output/FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md)

Reason:

- it remains the best checkpoint for production-vs-local status
- it captures what was already live as of build marker `5.1`
- it documents the broader invite-flow and report-related local changes already in progress

For the BinSentry forecast planning thread specifically, use this May 25 checkpoint plus the planning spec.

## Recommended Resume Point

If work resumes in a new chat and the topic is BinSentry feed forecasting, start with:

1. [FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md](C:/dev/FlockTrax/output/FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md)
2. [FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md](C:/dev/FlockTrax/output/FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md)
3. [FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md](C:/dev/FlockTrax/output/FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md)

## Likely Next Steps When Approved Later

When this moves from planning into execution, likely first steps are:

1. Confirm how FlockTrax feed bins will map to BinSentry bins
2. Confirm whether feed-order data will come from BinSentry or another source
3. Decide whether saved projections are automatic or user-created
4. Design the Supabase schema for `feed_projections` and `feed_projection_days`
5. Only then begin popup UI and connector implementation
