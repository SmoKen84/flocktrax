# FlockTrax Weekend Checkpoint - May 1, 2026 PM

Recovered from Codex local session history on `2026-05-03`.

Checkpoint for restart:

We’re in `C:\dev\FlockTrax`. Main themes today were iOS resubmission, Android first-store path, feed ticket historical flock resolution, outbox cleanup, and display-flicker investigation.

## Completed release work

- iOS build and submission completed successfully.
  - new build: `1.0.1 (8)`
  - EAS build ID: `4fc42091-522c-42ec-bc9f-33894058cbae`
  - EAS submission ID: `89771fcc-4a12-4bf2-b514-5a9f5e3f71cf`
  - IPA: [https://expo.dev/artifacts/eas/aRhW3k8cUc1VMACQkXjUaU.ipa](https://expo.dev/artifacts/eas/aRhW3k8cUc1VMACQkXjUaU.ipa)
  - Apple processing still needs to finish in App Store Connect
- reviewer account was reset and verified directly against hosted Supabase:
  - email: `reviewme@mothercluckershenhouse.com`
  - password: `FlockTraxReview!2026`
- hosted auth chain tested and passed:
  - `auth-login`
  - `auth_me`
  - `dashboard-placements-list`
- mobile login error reporting was improved in:
  - `C:\dev\FlockTrax\mobile\App.tsx`
  - it now distinguishes auth failure vs profile bootstrap vs dashboard bootstrap
  - `npm run typecheck` passed in `C:\dev\FlockTrax\mobile`

## Android status

- Android production build kicked off successfully.
  - build ID: `7c0f39ae-809e-4118-bf3c-e6d114b4489d`
  - version: `1.0.1`
  - versionCode: `6`
- auto-submit failed because Play service account key is not configured for non-interactive submit.
- blocker message:
  - `Google Service Account Keys cannot be set up in --non-interactive mode.`
- build page:
  - [https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/7c0f39ae-809e-4118-bf3c-e6d114b4489d](https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/7c0f39ae-809e-4118-bf3c-e6d114b4489d)
- next Android path:
  1. wait for build to finish
  2. first manual Play Console upload
  3. wire Google Play service account key for future automated submits

## Feed ticket fixes completed

- `Reg` ticket number remains editable; credit types use voucher numbering from app settings.
- `f2f` live behavior was already aligned earlier with `is_complete` as financial closure.
- critical historical flock resolution bug fixed in the web admin feed ticket editor:
  - `Reg` tickets no longer use the barn’s current flock blindly
  - they now resolve by placement window on the ticket date
  - and can bridge a proven checkout gap to the next placement
- files changed:
  - `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`
  - `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`
- verification passed:
  - `npx tsc --noEmit` in `C:\dev\FlockTrax\web-admin`

## Important feed ticket resolution behavior now

- if ticket date falls inside a placement active window, use that flock
- if ticket date falls in a proven gap after checkout and before next placement start, assign to the next placement
- if there is no historical placement evidence at all, do not guess a current flock
- examples traced live:
  - `W7` on `2026-04-01`: no placement history row exists for that date, so no blind fallback to `298-W7`
  - Sedberry `bin 51` on `2026-04-08`: correctly resolves to `293-S1` because `275-S1` ended `2026-04-01` and `293-S1` starts `2026-04-13`

## Outbox / web admin work completed

- added outbox row delete action and pinned actions column so Delete is visible.
- user confirmed Delete works as advertised.
- removed the outbox triple refresh bursts that were causing visible page flashing.
- changed:
  - `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\outbox\outbox-console.tsx`
- typecheck passed:
  - `npx tsc --noEmit` in `C:\dev\FlockTrax\web-admin`

## Display flicker investigation

- user reported whole-desktop flashing, not just page-area repaint.
- the outbox triple refresh likely contributed and became less noticeable after removal.
- however, investigation suggests the real root is likely display/capture/session/compositor related, not mainly FlockTrax.
- evidence:
  - camera-recorded monitor video showed whole-monitor effect, not just browser content
  - flicker persisted even after reducing app refresh behavior
  - active session checks showed no obvious hidden remote-control software
  - RDP is disabled:
    - `fDenyTSConnections = 1`
  - Remote Assistance is enabled:
    - `fAllowToGetHelp = 1`
  - attempt to disable it failed because shell wasn’t elevated
  - user was given admin PowerShell commands to disable it
- system checks found:
  - GPU: `Intel(R) Iris(R) Xe Graphics`
  - driver version: `32.0.101.7082`
  - multiple monitor/display-audio entries in `Unknown` state
  - `Microsoft Basic Display Driver` present
  - Hyper-V virtual components present
- current conclusion:
  - FlockTrax was likely aggravating the effect
  - base issue looks more like display stack / capture / compositor / monitor enumeration weirdness
- user plans to investigate later

## Video work

- installed `ffmpeg` via winget:
  - package `Gyan.FFmpeg`
- converted:
  - `C:\Users\Ken\Downloads\IMG_0318.MOV`
  - to `C:\Users\Ken\Downloads\IMG_0318.mp4`
- extracted representative frames from the MP4 into:
  - `C:\dev\video_frames_0318_mp4\`
- that helped show the flicker appears to involve the whole monitor image

## Security/session checks done

- `query user` showed only:
  - `ken` on `console`
- no obvious TeamViewer/AnyDesk/mstsc/VNC/ScreenConnect-style process from the quick scan
- inbound LAN traffic to Expo/node existed during testing, which matched local mobile/dev activity rather than hidden control

## Files changed this session that matter most

- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\outbox\outbox-console.tsx`

## Commands/settings already provided to user

Disable Remote Assistance in elevated PowerShell:

```powershell
Set-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Remote Assistance' -Name fAllowToGetHelp -Value 0
Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Remote Assistance' | Select-Object fAllowToGetHelp
```

Verify/force Remote Desktop disabled:

```powershell
Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server' | Select-Object fDenyTSConnections
Set-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name fDenyTSConnections -Value 1
```

## Best next steps on resume

1. Check Apple processing for iOS build `1.0.1 (8)` and finish App Store Connect resubmission if needed.
2. Check Android build `7c0f39ae-809e-4118-bf3c-e6d114b4489d`; if finished, do first manual Play upload and then configure Play service account key.
3. Continue feed-ticket historical entry testing if user has more mismatches.
4. Separate display flicker investigation from app work:
   - reboot
   - test before opening browser
   - test after browser
   - test after FlockTrax
   - possibly disable hardware acceleration / clean up display path
5. If needed later, elevate PowerShell and disable Remote Assistance.

## User state

- user is stopping now and plans to investigate the display issue later.
