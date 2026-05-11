# FlockTrax Weekend Checkpoint - May 2, 2026 AM

Recovered from Codex local session history on `2026-05-03`.

Checkpoint for tomorrow:

We’re in `C:\dev\FlockTrax`. Main workstreams are now:
- live `web-admin` verification and fixes
- iOS resubmission already sent
- Android first submission is next

## Release status

- iOS is re-submitted and waiting on Apple review.
- App Store Connect now shows a new submission for:
  - `iOS 1.0.1 (8)`
  - submitted `May 1, 2026` at `6:25 PM`
  - status: `Waiting for Review`
- Reviewer credentials that should remain in App Review Information:
  - username: `reviewme@mothercluckershenhouse.com`
  - password: `FlockTraxReview!2026`

## Android status

- Android production build was started successfully.
- Build ID:
  - `7c0f39ae-809e-4118-bf3c-e6d114b4489d`
- Version:
  - `1.0.1`
  - `versionCode 6`
- Auto-submit did not complete because Google Play service-account setup is still missing for non-interactive submit.
- Tomorrow’s likely path:
  1. check whether build `7c0f39ae-809e-4118-bf3c-e6d114b4489d` finished
  2. do first manual Play Console upload if needed
  3. configure Play service-account key for future automated submits

## Web admin live deploy status

- `web-admin` is deployed live to:
  - [https://flocktrax.com](https://flocktrax.com)
- Most recent live Vercel deployment:
  - `dpl_8bwRdkTbJaWuwZmASxz1H1sra5LY`
- Inspector:
  - [https://vercel.com/flock-trax/web-admin/8bwRdkTbJaWuwZmASxz1H1sra5LY](https://vercel.com/flock-trax/web-admin/8bwRdkTbJaWuwZmASxz1H1sra5LY)

## Recent web-admin fix just deployed live

- Historical feed-ticket entry fallback for `Reg` tickets.
- When `allow_historical_entry = true` and the barn/date auto-match fails:
  - the flock combo now unlocks
  - user can manually choose the flock
  - that manual choice now sticks
- It stays constrained to:
  - `Reg` only
  - historical mode only
  - true no-match only

## Files changed for that fix

- `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`

## Feed ticket logic currently in place

- `Reg` tickets:
  - auto-resolve flock by barn/date when possible
  - if ticket date falls in a proven checkout gap, assign to next placement
  - if no historical match and historical mode is on, unlock manual flock choice
  - otherwise do not guess a current flock
- Credit ticket numbering:
  - `Reg` uses editable ticket number
  - `xTran`, `iTran`, `f2f` use internal voucher numbering from `app_settings`

## Important production behaviors already verified/fixed

- checkout flow on dashboard
- `Prep Next Flock` state and next-placement promotion
- outbox delete action works in admin
- outbox action column pinned so delete is reachable
- session recovery modal preserves feed ticket drafts
- feed ticket total weight initializes to `0`
- `f2f` supports post-checkout monetary workflow as long as flock is not complete

## Rendering/flicker investigation status

- Still unresolved.
- Best current conclusion:
  - FlockTrax is likely contributing trigger pressure
  - especially through full-page refresh/render behavior
  - but the deeper problem still looks tied to monitor/browser/GPU/compositor/capture path
- Strong clue:
  - user reported the flicker follows the monitor where FlockTrax is running
- We already reduced one real trigger:
  - removed outbox triple refresh bursts
- Likely next app-side mitigation:
  - reduce broad `router.refresh()` usage on heavy screens like feed tickets/dashboard
  - prefer local state updates after save where possible

## Security/display notes from prior investigation

- No obvious hidden remote-control session found
- `query user` showed only local console user
- RDP was disabled
- Remote Assistance was enabled at last check unless user changed it manually
- ffmpeg is installed now and was used to convert/analyze monitor videos

## Key credentials / IDs to retain

- Reviewer login:
  - `reviewme@mothercluckershenhouse.com`
  - `FlockTraxReview!2026`
- iOS build:
  - `1.0.1 (8)`
  - build ID `4fc42091-522c-42ec-bc9f-33894058cbae`
- Android build:
  - `7c0f39ae-809e-4118-bf3c-e6d114b4489d`

## Best pickup plan tomorrow

1. Check Android build `7c0f39ae-809e-4118-bf3c-e6d114b4489d`
2. If finished, do first Play Console submission path
3. If needed, guide Play service-account/API access setup
4. After Android submission, continue chasing the rendering issue by reducing full-page refreshes on feed tickets/dashboard

I’ll pick up from there.
