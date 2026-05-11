FlockTrax Recovery Checkpoint
Date: 2026-05-03
Time zone: America/Chicago

Purpose
- Reconstruct the current working baseline after April 30 from live repo state, since later checkpoint notes were not found.

Where the work stands

1. Feed Ticket Web-Admin Workspace
- Main files:
  - `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
  - `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`
  - `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`
  - `C:\dev\FlockTrax\web-admin\app\globals.css`
  - `C:\dev\FlockTrax\web-admin\lib\feed-ticket-data.ts`

- Current behavior:
  - The feed-ticket editor is no longer a modal behind a dark scrim.
  - When opened, the editor replaces the normal list/filter workspace and becomes the only block in the workspace area.
  - The list section is hidden while the editor is open.
  - The editor has:
    - non-editable ticket number in the header
    - no `Edit Feed Ticket` subtitle under the number anymore
    - `Load Type` radio-style selector with `Starter`, `Grower`, `Split`
    - fixed-height scrolling drop-frame so top fields stay anchored
    - row delete action changed from `Remove` to compact `X`
    - flock labels now use verbose state text:
      - `In Barn`
      - `Active`
      - `Open`
      - `Completed`

- Layout direction:
  - A lot of recent May 1–3 effort was spent making the editor behave like a dedicated page/workspace instead of an inserted modal.
  - Visually, the remaining complaint at pause was still about some foreground/editor “embossed” look, but functionally the workspace flow was much improved.

2. Feed Ticket Type + Save Rule Foundation
- Main files:
  - `C:\dev\FlockTrax\supabase\functions\feed-ticket-get\index.ts`
  - `C:\dev\FlockTrax\supabase\functions\feed-ticket-list\index.ts`
  - `C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts`
  - `C:\dev\FlockTrax\mobile\src\api\http.ts`
  - `C:\dev\FlockTrax\mobile\src\types.ts`
  - `C:\dev\FlockTrax\supabase\migrations\20260429121500_feed_ticket_type_rules.sql`

- Implemented ticket types:
  - `Reg`
  - `xTran`
  - `iTran`
  - `f2f`

- Rules already wired:
  - historical-entry bypass depends on:
    - `platform.allow_historical_entry`
    - role `ADMIN` or `super-admin`
  - normal `Reg` mobile path was verified working after these rules went in.

3. Mobile Work Since May 1
- Main files:
  - `C:\dev\FlockTrax\mobile\App.tsx`
  - `C:\dev\FlockTrax\mobile\src\api\config.ts`
  - `C:\dev\FlockTrax\mobile\src\api\http.ts`
  - `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
  - `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`
  - `C:\dev\FlockTrax\mobile\src\screens\WeightEntryScreen.tsx`

- Observed from current source:
  - `App.tsx` now has `LoginFailureStage = "auth" | "profile" | "dashboard"`, indicating more detailed login/bootstrap error staging than earlier.
  - `feed-ticket` and dashboard/mobile flows were still being actively edited on May 2–3.
  - `http.ts` and `config.ts` changed on May 3, so API/config behavior was still evolving after April 30.

4. Date Guard / Weight & Log Protection Work
- Main files:
  - `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`
  - `C:\dev\FlockTrax\supabase\functions\weight-entry-submit\index.ts`
  - `C:\dev\FlockTrax\supabase\migrations\20260501113000_guard_log_weight_dates.sql`
  - `C:\dev\FlockTrax\supabase\snippets\293_s1_bad_weight_log_cleanup.sql`

- This indicates May 1 work around guarding or correcting log/weight dates and cleanup.

5. Sync / Outbox Work
- Main files touched on May 1:
  - `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\actions.ts`
  - `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\outbox\outbox-table.tsx`
  - `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\outbox\outbox-console.tsx`

- Meaning:
  - Sync/outbox behavior was still being refined after the April 30 checkpoint too.

Repo state snapshot at this checkpoint
- `git status` shows many modified and untracked files.
- Notable tracked modifications:
  - mobile app/auth/dashboard/placement/weight/feed-ticket files
  - supabase feed-ticket and date-guard functions
  - web-admin feed-ticket editor/console/globals
  - live dashboard/admin shell/overview/placement/admin data files
- Notable untracked items:
  - `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`
  - `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\`
  - several recent migrations in `C:\dev\FlockTrax\supabase\migrations\`
  - screenshots and support artifacts
  - output notes that have not been committed

Important warning
- There are no checkpoint note files found after April 30 besides this newly created one.
- There are also no git commits found since May 1.
- That means the current repo contents are the main source of truth for May 1–3 work.

Likely next recovery steps
1. Decide whether to checkpoint current code into git before more changes.
2. Continue feed-ticket workspace cleanup from current inline editor state.
3. Re-test transfer/credit ticket flows in the web-admin editor:
   - `xTran`
   - `iTran`
   - `f2f`
4. Review recent May 1–3 mobile login/api changes if the Apple/Android release thread resumes.

Files most worth protecting immediately
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`
- `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`
- `C:\dev\FlockTrax\web-admin\app\globals.css`
- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\api\config.ts`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\WeightEntryScreen.tsx`
- `C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts`
- `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`
- `C:\dev\FlockTrax\supabase\functions\weight-entry-submit\index.ts`
- `C:\dev\FlockTrax\supabase\migrations\20260429121500_feed_ticket_type_rules.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260501113000_guard_log_weight_dates.sql`
