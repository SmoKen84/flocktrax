# FlockTrax Release 5.0 Git Baseline Checkpoint

Date: `2026-05-18 12:44 PM America/Chicago`

Purpose:
- clean restart checkpoint after filing the current project state into git
- capture the repo commit, production deployment, and hosted admin published-version marker
- provide a single baseline note to load first in the next clean chat

## Repo Baseline

Repository:
- `C:\dev\FlockTrax`

Branch:
- `main`

Release commit:
- `df64dfd6987db1b741a9993d290b15306a9ed2b5`

Commit message:
- `Release admin build 5.0 with flock summary reporting`

Git remote:
- `origin` -> `https://github.com/SmoKen84/flocktrax.git`

Push status:
- commit pushed successfully to `origin/main`

## Production State

Primary URL:
- [https://flocktrax.com](https://flocktrax.com)

Production deployment:
- deployment id: `dpl_9DiCtGz39vTGyRhzTG7z2pCAcsFD`
- inspector: [https://vercel.com/flock-trax/web-admin/9DiCtGz39vTGyRhzTG7z2pCAcsFD](https://vercel.com/flock-trax/web-admin/9DiCtGz39vTGyRhzTG7z2pCAcsFD)
- deployment URL: [https://web-admin-4cx30s1r0-flock-trax.vercel.app](https://web-admin-4cx30s1r0-flock-trax.vercel.app)
- aliased live to: [https://flocktrax.com](https://flocktrax.com)

Build/deploy result:
- production build completed successfully from the filed git-backed workspace state

## Hosted Published Version Marker

Hosted `platform.control` admin row verified after deployment:
- `group`: `admin`
- `version`: `2.0.0`
- `build`: `5`
- `build_label`: `5.0`
- `released`: `2026-05-18`

Release-marker migration added to repo:
- [20260518124014_bump_admin_release_build_5_0.sql](C:/dev/FlockTrax/supabase/migrations/20260518124014_bump_admin_release_build_5_0.sql)

Hosted database update path used:
- direct execution of the release SQL against the linked remote project
- migration history repaired only for `20260518124014` so the new release marker is tracked without replaying the older stale migration backlog

## What This Release Includes

### Web-admin dashboard and operations updates

- split placement-tile badges so `Done hh:mm` and `# Open Issues` can show independently
- cyan selected-row highlighting in the Action Items console for consistency
- Barn View `LH` markers for scheduled live-haul dates
- lower-positioned `LH` marker placement inside Barn View date blocks
- placement editor popup on live dashboard tiles
- dashboard fallback report button now points to the flock summary report when the spare slot is unused
- open/closed Action Items summary blocks on dashboard cards

### Flock history report

Live/admin route:
- `/admin/flocks/[flockId]/report`

Launch points:
- flock detail page
- dashboard placement editor popup
- placement wizard editor panels for in-barn-or-later placements

Report layout state at release:
- Page 1 summary page with compact tiles/cards
- Page 2 `log_daily`
- Page 3 mortality
- print-first layout tuned for browser PDF/print
- grouped two-line headers on daily and mortality matrices
- daily comments print on a full-width line under their date row
- date format now reads like `05/18/26 Mo`

### Other project state captured in this repo filing

- admin About page and published version display
- user access improvements
- derived placement alerts and related Supabase functions/migrations
- mobile dashboard version and auth-error handling improvements
- project checkpoints and support assets that were still only local are now filed into git

## Cleanliness / Local State

This checkpoint was written after:
- restoring the tracked `supabase/.temp/cli-latest` temp file out of the release path
- adding ignore coverage for:
  - `backups/`
  - `mobile/dist-ios-releasecheck/`
  - `mobile/dist-store-releasecheck/`
  - `**/__pycache__/`

Intent:
- leave future `git status` focused on real source changes instead of local runtime artifacts

## Recommended First Files For Future Resume

1. [FlockTrax_Release_5_0_Git_Baseline_Checkpoint_2026-05-18.md](C:/dev/FlockTrax/output/FlockTrax_Release_5_0_Git_Baseline_Checkpoint_2026-05-18.md)
2. [FlockTrax_Project_Wide_Detailed_Checkpoint_2026-05-18.md](C:/dev/FlockTrax/output/FlockTrax_Project_Wide_Detailed_Checkpoint_2026-05-18.md)
3. [FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md](C:/dev/FlockTrax/output/FlockTrax_Flock_History_Report_Checkpoint_2026-05-18.md)

## Resume Prompt

Use this in the next clean Codex chat:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Release_5_0_Git_Baseline_Checkpoint_2026-05-18.md first. The repo baseline is commit df64dfd6987db1b741a9993d290b15306a9ed2b5 on origin/main, production is live at flocktrax.com via deployment dpl_9DiCtGz39vTGyRhzTG7z2pCAcsFD, and the hosted admin published version marker has been bumped to build 5.0 in platform.control.` 
