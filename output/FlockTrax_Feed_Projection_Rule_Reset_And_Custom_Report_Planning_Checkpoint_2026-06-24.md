# FlockTrax Feed Projection Rule Reset And Custom Report Planning Checkpoint

Date: `2026-06-24`  
Captured: `2026-06-24 21:50:21 -05:00`  
Repo: `C:\dev\FlockTrax`  
Branch: `main`  
HEAD: `a29d6eed8685be1a37ef1da4b9b19fd3b158df9a`  
HEAD message: `Add document archive hooks and custom feed projection tools`  
Mode: local working-tree checkpoint

## Purpose

This checkpoint captures the feed projection rule cleanup that happened after the earlier custom-day report work started surfacing muddy business rules.

The main goal of this checkpoint is to preserve the corrected separation between:

- biological feed projection rules
- starter-program obligation rules
- future truck-load ordering rules
- operational `10-day` ordering use vs longer-range custom planning use

It also captures the final compact report-table UI pass that made the collapsed custom projection fit on screen without horizontal scrolling.

## Main Rule Decisions Locked In

### 1. Starter obligation is flock-based, not time-window-based

The correct starter rule is:

- `starter target = chicks placed × starter lbs per chick`
- `starter remaining obligation = starter target - starter already delivered`

The selected report window does **not** reduce the flock's real starter obligation.

### 2. The old 12,000 lb incoming-starter shortcut was wrong in this layer

The earlier `12,000 lb` minimum was not actually a flock feed-consumption rule.

It belonged to physical truck/load definition thinking, not biological projection.

That shortcut has now been removed from the projection engines.

### 3. Starter stays starter until the obligation is exhausted

The earlier age-based cutoff rule was also wrong for this business flow.

Old behavior:

- starter stopped at age day `14`
- grower began automatically after that day

Corrected behavior:

- feed continues counting as starter until `remainingStarter` reaches zero
- only then does projected feed spill into grower

This is why barn `W6` stopped showing premature grower need after the fix.

### 4. Custom-day reports are planning-only

Operational feed ordering logic should live on the `10-day` report only.

Longer-range custom reports such as `14`, `21`, and `28` days are now treated as reference/planning tools so the user can look past holidays and see where feed demand may tighten up, without those screens pretending to be the actual load-ordering worksheet.

### 5. Truck-load rules are deferred to a later load-builder step

The user clarified that actual order shaping belongs in a later algorithm layer.

Examples of deferred load-builder rules:

- starter order minimums in practical truck terms
- truncating or shaping orders to `6,000 lb` increments
- combining starter/grower pounds into physical loads to submit to the mill

Those rules should **not** be mixed into the raw projection math.

## What Changed In Code

Primary files changed in this checkpoint:

- `web-admin/lib/feed-projection-report-data.ts`
- `web-admin/lib/admin-data.ts`
- `web-admin/app/admin/reports/feed-projection/page.tsx`
- `web-admin/app/admin/reports/feed-projection-custom/page.tsx`
- `web-admin/app/admin/reports/feed-projection/feed-projection-report-table.tsx`
- `web-admin/components/active-placement-dashboard.tsx`
- `web-admin/app/globals.css`

Key code changes:

- removed the `12,000 lb` arriving-flock starter injection from both projection engines
- removed the age-day `14` cutoff from starter vs grower splitting
- changed starter/grower split to consume starter until obligation is exhausted
- changed `10-day` report calls to explicit operational mode
- changed custom report calls to explicit planning mode
- restored custom report column meaning so it shows planning-style need, not operational ordering intent
- renamed custom report wording away from `Plan Gap` to `Req'd Feed`
- tightened collapsed report styling until the whole collapsed table fit within the current browser viewport

## Important Verified Outcomes

### W6 correction path

The user challenged the earlier numbers for barn `W6` and that exposed multiple rule defects.

Important verified checkpoints during this session:

- W6 initially showed no feed when the flock was still `Awaiting`; that was fixed
- W6 then showed starter only inside the visible report window; that was corrected for the operational starter-obligation logic
- custom planning view was reset so it no longer acts like an operational order screen
- after removing the age-14 cutoff, W6 in custom planning view now shows starter continuing until exhausted, with grower no longer appearing prematurely

Last verified browser state for custom planning behavior:

- barn `W6`
- flock `314-W6`
- age `1`
- `Starter Need = 10,366`
- `Grower Need = 0`
- `Req'd Feed = 10,300`

## UI / Report Layout Outcome

The collapsed custom report was compacted in multiple passes until it fit the user's browser width without horizontal scrolling.

Notable UI outcomes:

- smaller collapsed font only
- tighter numeric columns
- narrower `Farm`, `Barn`, `Flock`, `Age`, `Status`, and `Mode` footprint
- retained expanded daily view behavior

Final browser verification during this session:

- collapsed table width matched wrapper width
- horizontal overflow was `false`

## Current Dirty Worktree Context

Current `git status --short` at checkpoint time:

- modified:
  - `output/FlockTrax_Checkpoint_Index.md`
  - `supabase/.temp/cli-latest`
  - `web-admin/app/admin/reports/feed-projection-custom/page.tsx`
  - `web-admin/app/admin/reports/feed-projection/feed-projection-report-table.tsx`
  - `web-admin/app/admin/reports/feed-projection/page.tsx`
  - `web-admin/app/globals.css`
  - `web-admin/components/active-placement-dashboard.tsx`
  - `web-admin/lib/admin-data.ts`
  - `web-admin/lib/feed-projection-report-data.ts`
- untracked:
  - `output/FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md`
  - `output/FlockTrax_Document_Archive_Placement_Closeout_And_Backfill_Checkpoint_2026-06-23.md`
  - `output/FlockTrax_Feed_Order_Reconciliation_And_Bin_Layer_State_Checkpoint_2026-06-17.md`
  - `output/FlockTrax_Log_Weight_Report_And_Feed_Ticket_Scan_Storage_Checkpoint_2026-06-16.md`
  - `output/FlockTrax_PC_Stability_Precaution_Checkpoint_2026-06-20.md`
  - `output/feed-ticket-backfill-summary-2026-06-23.json`
  - `web-admin/app/admin/reports/feed-projection/feed-projection-report-actions.tsx`

## Diff Snapshot

Overall `git diff --stat` at checkpoint time:

- `9 files changed, 333 insertions(+), 162 deletions(-)`

Notes:

- this diffstat does not count the new checkpoint file itself
- the `supabase/.temp/cli-latest` change is incidental and not part of the feature logic

## Validation State

Validated during this work:

- `npm run typecheck` in `C:\dev\FlockTrax\web-admin` passed after the rule resets and report/layout adjustments

Browser verification performed during this session:

- custom feed projection report reloaded repeatedly in the in-app browser
- collapsed width verified numerically
- W6 row values checked directly after each major rule change

## Next Recommended Resume

The user explicitly wants to switch away from feed-ordering follow-up and work flock closeouts first.

Immediate next focus:

- flock closeout tasks on `http://localhost:3001/admin/flock-closeout`

Do **not** jump straight into truck-load ordering logic next time unless the user asks for it again.

When the feed-ordering path resumes later, the next sensible design step is:

- keep raw projection math separate
- use the `10-day` report as the operational source
- add a separate load-builder layer that converts net needs into `6,000 lb` increment truck-order suggestions

## Recommended Restart Prompt

If a new chat needs to resume this exact work context, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Feed_Projection_Rule_Reset_And_Custom_Report_Planning_Checkpoint_2026-06-24.md first, then continue with flock closeout work before returning to any feed load-builder logic. Keep the current dirty tree intact.`
