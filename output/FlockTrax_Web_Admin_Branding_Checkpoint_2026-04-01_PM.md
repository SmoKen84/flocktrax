# FlockTrax Web Admin Branding Checkpoint 2026-04-01 PM

## Current state

Project roots involved tonight:
- `C:\dev\FlockTrax\web-admin`
- supporting reference images in `C:\dev\FlockTrax\images`

Primary visual references used:
- `C:\dev\FlockTrax\images\subtitleBlock.jpg`
- `C:\dev\FlockTrax\images\wordmarks.jpg`
- `C:\dev\FlockTrax\images\sampleHero-Text.jpg`

## What was completed tonight

The landing page was refined to match the user’s preferred presentation more closely:
- one main hero/focus card on the landing screen
- a discreet `...` button in the top-right area of the hero
- a separate plain centered signature/copyright block below the hero
- no extra application-registry framing on the landing page itself

The broader Application Registry content was moved off the landing screen and into its own admin page.

The FlockTrax subsystem wordmarks were standardized into a reusable shared component so future screens can carry consistent branding.

## Final landing-page intent at pause

Landing page should present:
- `FlockTrax-Admin™` wordmark in the hero
- hero title/body/actions
- discreet `...` button for deeper configuration access
- separate centered signature block below hero showing:
  - `FlockTrax-Admin™ & FlockTrax-Mobile™`
  - `Integrated Flock Management Platform`
  - descriptor line
  - copyright / operating entity line

This should feel like the user’s `sampleHero-Text.jpg` reference, not like a second card or management panel.

## Files changed / now important

Landing page:
- `C:\dev\FlockTrax\web-admin\app\page.tsx`

Application Registry page:
- `C:\dev\FlockTrax\web-admin\app\admin\app-registry\page.tsx`

Shared wordmark component:
- `C:\dev\FlockTrax\web-admin\components\flocktrax-wordmark.tsx`

Shared styling:
- `C:\dev\FlockTrax\web-admin\app\globals.css`

Registry data/config:
- `C:\dev\FlockTrax\web-admin\lib\app-registry.ts`

## Important implementation details

### Landing page

Current landing page behavior:
- hero includes the discreet `...` link to `/admin/app-registry`
- hero uses shared `FlockTraxWordmark`
- the signature block below hero is now free-standing, centered, and plain

### Registry page

Registry content now lives on:
- `/admin/app-registry`

Current registry page contains:
- ownership statement
- ownership/copyright/support details table
- feature preference / rollout tags section

The status pill on that page was changed to:
- `...`

### Shared wordmark behavior

Reusable wordmark component now renders subsystem marks in the style:
- `FlockTrax-Admin™`
- `FlockTrax-Mobile™`

Important detail:
- the `TM` superscript is attached to the subsystem portion, not to `FlockTrax`

Current color/styling direction:
- `FlockTrax` in blue
- subsystem suffix in rust-red
- serif styling to echo the provided wordmark reference

## Config values now driving the visible signature text

The signature/legal block is driven in part from:
- `C:\dev\FlockTrax\web-admin\lib\app-registry.ts`

Important fields there:
- `subtitleLine`
- `descriptorLine`
- `fields`
- `featurePreferences`

This file is now the intended single place to update:
- product naming
- ownership wording
- copyright line
- support contact
- feature toggle labels / notes

## Verification completed

TypeScript verification was run successfully from:
- `C:\dev\FlockTrax\web-admin`

Command used:

```powershell
npm run typecheck
```

Result:
- passed cleanly after the final landing/signature adjustments

## Known follow-up item

The Application Registry page is only visually separated right now.
It is not yet access-controlled.

User’s intended end state:
- registry access should ultimately be limited to an `app_owner` security role

So the next meaningful implementation step is:
- wire auth/role checks for `/admin/app-registry`
- hide or conditionally show the `...` entry point based on that role

## Best next step when resuming

1. Open the landing page and visually compare it to:
   - `C:\dev\FlockTrax\images\sampleHero-Text.jpg`
2. If any spacing/scale still feels off, do a final polish pass on:
   - hero spacing
   - signature block spacing
   - wordmark size/weight
3. Then implement access control for:
   - `/admin/app-registry`
4. Gate the discreet `...` button to the future `app_owner` role

## Short resume prompt

"Resume `C:\dev\FlockTrax\web-admin` from `output/FlockTrax_Web_Admin_Branding_Checkpoint_2026-04-01_PM.md`. The landing page should now have only the hero/focus block plus a separate centered signature block underneath, matching the `sampleHero-Text.jpg` direction. The Application Registry content has been moved to `/admin/app-registry`, reached by a discreet `...` link, and the shared wordmark component now renders `FlockTrax-Admin™` / `FlockTrax-Mobile™` in the approved style. Next step is likely a final visual polish pass if needed, then role-gating the registry and `...` entry point to an `app_owner` security role."
