# FlockTrax Release Track Checkpoint

Date: 2026-05-04
Purpose: Resume release-oriented work without dragging app-dev implementation context into the same thread.

## Current Release State

- iOS current submitted review candidate is understood to be `build 9`.
- App Store Connect status is understood to be `Awaiting Review`.
- `build 8` failure was associated with inability to reach Supabase correctly in the hosted binary/review environment.
- Mobile auth/config was hardened before `build 9` by adding built-in defaults and anon-key fallback behavior.

## iOS / Mobile Release-Specific Changes Already In Code

Key files:
- `C:\dev\FlockTrax\mobile\src\api\config.ts`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`

Important behaviors:
- `DEFAULT_API_BASE_URL` is now embedded.
- `DEFAULT_SUPABASE_ANON_KEY` is now embedded.
- requests send `apikey`.
- if no user access token exists yet, requests can fall back to `Authorization: Bearer <anon key>`.

Release interpretation:
- hosted binary no longer depends only on env injection for Supabase access.
- this change was made specifically to avoid the prior review/build authentication/connectivity failure.

## Prior Review/Auth Investigation Notes

- earlier Apple rejection was traced toward reviewer authentication reliability.
- later work suggested `build 8` had a deeper hosted-Supabase access problem.
- weekend checkpoints recovered from Codex local session history are now available as repo files.

Key recovered note for release context:
- `C:\dev\FlockTrax\output\FlockTrax_Weekend_Checkpoint_2026-05-03_Build9.md`

## Useful Release Checkpoints / Notes

- `C:\dev\FlockTrax\output\FlockTrax_Checkpoint_Index.md`
- `C:\dev\FlockTrax\output\FlockTrax_Weekend_Checkpoint_2026-05-03_Build9.md`
- `C:\dev\FlockTrax\output\FlockTrax_Recovery_Checkpoint_2026-05-03_AM.md`
- `C:\dev\FlockTrax\output\FlockTrax_App_Store_Submitted_Checkpoint_2026-04-25_PM.md`
- `C:\dev\FlockTrax\output\FlockTrax_Apple_Review_Login_Investigation_Checkpoint_2026-04-28_PM.md`

## Release-Focused Next Steps

1. Watch App Store Connect for review result on `build 9`.
2. If Apple rejects again, compare their failure mode to:
   - raw login failure
   - post-login bootstrap failure
   - Supabase access/config failure
3. Keep any new reviewer notes tied to `build 9` explicitly, not older builds.
4. Avoid mixing release triage with broader feed-ticket/admin feature work in the same session if possible.

## Repository / Workspace Notes

- repo worktree is still dirty.
- do not attempt broad cleanup until a known-good compiled working state is confirmed.
- recovered checkpoints are now saved as normal `.md` files in `C:\dev\FlockTrax\output`.

## Recommended Resume Prompt

Use this checkpoint when the goal is:
- App Store review status
- mobile binary/release behavior
- reviewer credentials/access
- iOS or Android submission readiness

