# FlockTrax Off-Farm Feed Redirect Production Checkpoint

Date: `2026-05-29`  
Captured: `2026-05-29 01:06:34 -05:00`  
Branch: `main`  
HEAD: `2414194dbc4327bcbe862580309cc7630979a5bc`

## Purpose

Capture the production rollout of off-farm redirect handling for feed-ticket drops, including:

- new `feed_drops.off_farm_redirect` support
- shared Supabase function handling for redirected drops
- web-admin feed-ticket editor support
- mobile feed-ticket entry support in source
- feed-ticket print-report visibility for redirected drops
- production web-admin deployment to `flocktrax.com`

## Repo State

Committed and pushed to `origin/main`:

- commit: `2414194`
- message: `Add off-farm redirect support for feed drops`

Repo status before checkpoint documentation:

- working tree clean

## Production Deployment

Production web-admin deployment completed through Vercel:

- deployment id: `dpl_2sm51RhVTYdxhkTMR68Nos8pHK2H`
- inspector: [https://vercel.com/flock-trax/web-admin/2sm51RhVTYdxhkTMR68Nos8pHK2H](https://vercel.com/flock-trax/web-admin/2sm51RhVTYdxhkTMR68Nos8pHK2H)
- deployment URL: [https://web-admin-lnxg5lm9i-flock-trax.vercel.app](https://web-admin-lnxg5lm9i-flock-trax.vercel.app)
- production alias: [https://flocktrax.com](https://flocktrax.com)

Verification:

- `vercel deploy --prod --yes` completed successfully
- aliasing to `https://flocktrax.com` completed successfully
- `https://flocktrax.com` returned HTTP `200`

## Supabase Deployment

Supabase Edge Functions deployed successfully:

- `feed-ticket-get`
- `feed-ticket-submit`

Rollout note:

- the database migration file for `feed_drops.off_farm_redirect` is present locally in the repo
- user confirmed `sql-ok` before the function and web rollout
- this checkpoint assumes the corresponding SQL column addition is part of the intended release state

## What Is Now Live

### Feed Drop Redirect Handling

Feed-ticket drops can now be marked as an off-farm redirect.

When a drop is flagged this way:

- `feed_bin_id` is saved as `null`
- `placement_id` is saved as `null`
- `placement_code` is saved as `OFF-FARM`
- note/comment is required
- drop weight still counts toward the ticket total
- the pounds are intentionally orphaned from internal bin and flock feed allocation

This gives emergency redirected feed a documented path without falsely assigning it to one of FlockTrax's bins or flock allocations.

### Web-Admin Feed Ticket Editor

The web-admin feed-ticket editor now includes a drop-level `Off Farm` checkbox.

When checked:

- normal bin selection is bypassed
- flock assignment is replaced by `OFF-FARM`
- the user must enter a note explaining the redirection
- the drop still participates in gross-weight balancing for the ticket

### Mobile Feed Ticket Entry

The mobile feed-ticket screen now supports the same redirect workflow in source:

- drop-level `Off Farm Redirect` toggle
- note required when enabled
- no internal bin/flock allocation when enabled
- `OFF-FARM` shown as the placement code for the redirected drop

Release boundary:

- mobile source is updated and committed
- no new mobile build or store submission was cut in this rollout
- installed mobile users will not see this until the next mobile release is built and shipped

### Feed Ticket Printouts

Feed-ticket printouts now expose the redirect flag directly on each drop line with a compact checkbox-style indicator:

- `Redirect` column added
- checked rows print as `X`
- unchecked rows print blank

That keeps the paper trail neutral and readable without printing `Off Farm` as a separate textual status on the drop row.

## Local Verification

Web-admin verification completed locally before deploy:

- `npm run build` passed
- `npm run typecheck` passed after clearing stale `tsconfig.tsbuildinfo`

Mobile verification completed locally:

- `npm run typecheck` passed

Typecheck note:

- this repo still has an intermittent web-admin typecheck quirk tied to generated `.next/types` plus stale `tsconfig.tsbuildinfo`
- clearing the build-info cache and rerunning resolved the failure during this rollout

## Key Files

- [20260528121500_add_off_farm_redirect_to_feed_drops.sql](C:/dev/FlockTrax/supabase/migrations/20260528121500_add_off_farm_redirect_to_feed_drops.sql)
- [index.ts](C:/dev/FlockTrax/supabase/functions/feed-ticket-get/index.ts)
- [index.ts](C:/dev/FlockTrax/supabase/functions/feed-ticket-submit/index.ts)
- [feed-ticket-editor.tsx](C:/dev/FlockTrax/web-admin/app/admin/feed-tickets/feed-ticket-editor.tsx)
- [ticket-report/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/feed-tickets/ticket-report/page.tsx)
- [report/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/feed-tickets/report/page.tsx)
- [feed-ticket-data.ts](C:/dev/FlockTrax/web-admin/lib/feed-ticket-data.ts)
- [globals.css](C:/dev/FlockTrax/web-admin/app/globals.css)
- [FeedTicketScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/FeedTicketScreen.tsx)
- [types.ts](C:/dev/FlockTrax/mobile/src/types.ts)

## Recommended Resume Point

If work resumes later today on feed-ticket handling or the mobile/web feed-entry flow, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Off_Farm_Feed_Redirect_Production_Checkpoint_2026-05-29.md first.`

Then likely next steps are:

1. Decide whether the next mobile release should be cut immediately to ship the new redirect flow to devices.
2. Live-verify the redirected-drop save and print behavior against real authenticated feed tickets in production.
3. Decide whether redirected drops need any additional reporting, export, or audit emphasis beyond the new `Redirect` column and note requirement.
