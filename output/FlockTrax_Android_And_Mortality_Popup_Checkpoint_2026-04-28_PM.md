# FlockTrax Android And Mortality Popup Checkpoint

Date: 2026-04-28 PM
Timezone: America/Chicago

## Current Status

- iOS submission was previously rejected by Apple for a login-stage error.
- Android release prep is in progress.
- The first 7-days mortality popup on the web-admin overview was revised and pushed live.

## Android / Mobile Work Completed

### Permissions blocker fixed

Mobile save flows now honor role permissions and block unauthorized writes for:

- daily logs
- mortality
- grading
- weights
- feed tickets

Backend enforcement was also added so blocked users cannot save even if the client misbehaves.

Relevant areas changed earlier in this thread:

- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\WeightEntryScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\FeedTicketScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- `C:\dev\FlockTrax\supabase\functions\auth_me\index.ts`
- `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`
- `C:\dev\FlockTrax\supabase\functions\weight-entry-submit\index.ts`
- `C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts`

### Unsaved changes modal fix

For permission-blocked placement-day editing:

- the unsaved-changes modal no longer offers fake save behavior
- blocked users only get the safe discard path

### Recent mortality mobile popup

Mobile recent mortality popup changes already made:

- compact table layout
- 8 dates total: today plus previous 7 days
- one-character weekday marker before date
- date column widened to prevent wrapping

## Apple Review Login Investigation

Checkpoint file from earlier:

- `C:\dev\FlockTrax\output\FlockTrax_Apple_Review_Login_Investigation_Checkpoint_2026-04-28_PM.md`

Key findings:

- Apple rejected the iOS build under `Guideline 2.1(a)` due to login-stage error.
- Fresh Expo Go testing later reproduced `Invalid login credentials` for the reviewer account.
- Supabase daily email limits blocked further password-reset testing.
- Reviewer account/password lifecycle is still suspicious and not considered fully trustworthy yet.

## Web-Admin Mortality Popup

### Files changed

- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

### Live deployment

The popup update was deployed live to web-admin / production during this thread.

### Final business rule established

For the first 7-days mortality popup:

- day 1 mortality is treated as DOAs
- mortality for the popup is `DOAs + Dead`
- livability after 7 days is `Started - Mortality`
- start counts must include DOAs

User clarified that start counts had briefly had DOAs removed, but they were restored.
That restoration is what allows the popup percentages to reconcile correctly.

### Popup intent at this stop point

Header:

- flock line first
- large dark-blue flock identifier with centered dots
- title below it

Summary cards:

- left card label: `Livability after 7-days`
- right card label: `Mortality`

First 7-days mortality card layout:

- columns: `DOAs`, `Dead`, `Mort %`
- day 1 is treated as DOAs
- `Dead` is the remaining first-7 mortality after day 1

Livability card layout:

- Roo/Hen rows retained
- totals row added underneath

Math rule:

- `Mortality = DOAs + Dead`
- `Mort % = (DOAs + Dead) / Started`
- `Live % = 100 - Mort %`

### Important note

The user’s last clarification was:

- start counts now include DOAs again

That is the correct data assumption for the current popup formulas.

## Verification

Latest local verification completed:

- `npx tsc --noEmit` in `C:\dev\FlockTrax\web-admin` passed after the popup edits

## Next Recommended Steps After Meeting

1. Re-open the live first 7-days mortality popup and visually verify the percentages now that start counts include DOAs again.
2. If the popup numbers reconcile visually, leave the popup alone.
3. Resume Android release push.
4. Return to Apple login issue later by either:
   - directly setting a known-good reviewer password without email churn, or
   - increasing/changing Supabase email delivery so password resets can be tested reliably.

## User Pause Reason

User is stepping away for a Masonic meeting and secretary duties, and plans to resume later this evening.
