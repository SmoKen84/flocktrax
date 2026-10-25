# FlockTrax production handoff checkpoint

Saved October 25, 2026, America/Chicago, for Ken Smotherman. The landing-page work is complete and deployed to https://flocktrax.com. Ken accepted the final green footer with “that works.” There is no unfinished feature or deployment request at this checkpoint. Resume with Ken’s next request; do not rebuild the landing page or deploy again just to resume.

## Start here in a fresh chat

Read this checkpoint and `CHECKPOINT_INDEX.md` in the same directory. Inspect the current Git status and recent commits before editing because this checkpoint records a point in time. Use the production source checkout below. Preserve unrelated changes. Ask Ken what he wants to work on next if the new chat contains no new task.

Suggested opening message:

> Continue my FlockTrax work. Read C:\dev\FlockTrax-Production-Release\docs\checkpoints\CHECKPOINT_INDEX.md and C:\dev\FlockTrax-Production-Release\docs\checkpoints\2026-10-25-landing-page-handoff.md first. The landing page is already deployed and approved. Use the production repository and preserve unrelated local changes. Then we can start my next task.

## Repositories and deployment

| Purpose | Location or value |
| --- | --- |
| Production source checkout | `C:\dev\FlockTrax-Production-Release` |
| Source branch | `release/admin-2.6.0` |
| Git remote | `https://github.com/SmoKen84/flocktrax.git` |
| Web application | `C:\dev\FlockTrax-Production-Release\web-admin` |
| Production deployment checkout | `C:\dev\FlockTrax-Vacancy-Release` |
| Deployment command directory | `C:\dev\FlockTrax-Vacancy-Release\web-admin` |
| Production site | `https://flocktrax.com` |
| Last deployed application commit | `350dfdb` — Blend landing footer into green contact section |
| Last verified deployment | `dpl_8CLR26UnrB2w3qcxNh6jTdcp6f5R` |
| Deployment URL | `https://web-admin-46fqvq5cn-flock-trax.vercel.app` |
| Vercel project | `flock-trax/web-admin` |

The deployment was READY and aliased to flocktrax.com. These checkpoint files are documentation added after the deployed application commit; their commit does not require another website deployment.

The source and deployment checkouts share Git history. The deployment checkout was clean and detached at `350dfdb` when this checkpoint was prepared. Do not use `C:\dev\FlockTrax`, `FlockTrax-Demo-Hosted`, or `FlockTrax-Marketing-Preview` as the production source. Other similarly named checkouts exist and serve other purposes.

Preexisting unrelated source changes: modified `supabase/.temp/cli-latest` and untracked `tools/`. Leave them intact and exclude them from task commits. No applicable AGENTS.md was found during this work; check again when resuming.

## Approved landing page

The landing page uses the entire seven-page brochure, adapted into responsive web sections, from:

`C:\dev\marketing\_docs\FlockTrax_Marketing_Brochure_Letter.pdf`

The page includes the barn introduction, Mobile and Admin overview, platform introduction, mobile daily records, feed management, Work Orders, Document Archive, feed forecasting and integrations, Ken’s About Us story, and demo/contact section. The About Us copy was polished and approved by Ken. Keep that accepted copy unless he requests an edit.

Important approved behavior:

- “Explore the technical layout” opens one native modal dialog. The diagram is not shown automatically on the landing page. The dialog contains one image, the four component descriptions, and Close/Return controls. Escape closes it. The nested “Explore component details” link and duplicate technical diagram were intentionally removed.
- Work Orders is its own section. Its descriptive text, farm-maintenance illustration, and mobile work-order screenshot stay together.
- Document Archive is the following, separate section with its own text and flock-report screenshot.
- Eleven screenshot thumbnails open enlarged views. Each “Open original” link points to the same image as its thumbnail. The Mobile Dashboard and Operations Calendar image files were initially swapped, then corrected and visually verified.
- Header ownership line below the bird/wordmark: `Smotherman Farms, Ltd.  West, Texas USA`.
- Footer uses the same forest green as the contact section, `#14382d`, with white, bold text. There is no border or shadow between the final section and footer. The footer wordmark text is also white; the original bird image remains.
- Footer is fixed at the bottom on widths above 700px. At widths of 700px or less it scrolls normally after the contact section. Ken explicitly requested the phone exception.
- A ResizeObserver measures the footer and reserves matching bottom space on larger screens. Phone layout sets this padding to zero. Preserve this so fixed-footer content does not cover the end of the page.
- Sign-in, Privacy Policy, contact, demo request, and existing demo-access links remain available. No demo form was submitted during testing.

Exact approved footer text:

> The FlockTrax™ Platform  (FlockTrax-ADMIN™, FlockTrax-MOBILE™ & their hosted Postgres Database) are Trademarks of Smotherman Farms, Ltd.  West, Texas USA Copyright © 2026 All Rights Reserved.

## Main implementation files

- `web-admin/app/page.tsx`: public home route, metadata, marketing styles, and existing privacy-content lookup.
- `web-admin/components/marketing/marketing-landing.tsx`: page sections, screenshots, ownership text, dialogs, and footer measurement.
- `web-admin/components/marketing/brochure.css`: brochure layout, responsive rules, modal styling, fixed/scrolling footer, and final green/white styling.
- `web-admin/components/marketing/marketing.css`: existing base styles; brochure.css provides scoped overrides.
- `web-admin/components/marketing/demo-request-form.tsx`: retained demo request flow.
- `web-admin/components/marketing/technical-architecture.tsx`: older component remains in the repository but is intentionally not imported by the landing page.
- `web-admin/public/marketing/brochure/`: 16 WebP assets extracted from the brochure, including illustrations and the eleven product screenshots.
- `web-admin/public/marketing/media/flocktrax-bird-original.svg`: retained original bird logo.

## Relevant commits

| Commit | Change |
| --- | --- |
| `350dfdb` | Green footer, white bold text, removed footer border/shadow |
| `d4f6a0e` | Phone footer scrolls normally |
| `bd25263` | Ownership line, replacement copyright, fixed footer |
| `73aa39e` | Full approved brochure landing page, corrected screenshot mapping, single layout modal, separated Work Orders and archive |
| `c0ddb9c` | Original-document links from flock audit reports |
| `aa850df` | Dashboard button footer alignment |
| `9d5fc89` | Dashboard feed button labels |

Earlier completed work in this conversation included an iPhone feed-ticket flock selector fix, dashboard Feed Projection and Feed Audit icon-and-text buttons with hover labels and aligned footers, and navy underlined original-document links in flock reports. Document links were made available in archived/settled flock reports when a corresponding original exists. These are already completed changes, not new work to repeat. Inspect their code for any future changes rather than relying only on this historical summary.

## Validation and evidence

Production builds, type checks, and whitespace checks passed during the work. Vercel built the final green-footer version successfully. Live browser verification confirmed matching footer/contact background colors, white text with weight 700, and fixed positioning on desktop. Phone checks confirmed normal document flow, zero reserved bottom padding, and no horizontal overflow at 390px and 320px widths. Privacy dialog behavior was checked after the footer changes. All eleven screenshot destinations were checked on the deployed brochure version; later changes affected the footer only.

Local evidence is under `C:\dev\output\landing-brochure`:

- `green-footer-live.jpg`: final approved live green footer and contact section.
- `ownership-live-phone.jpg`: live phone scrolling footer before the later green-color change; do not treat its white footer as current.
- `work-orders-corrected.jpg` and `document-archive-corrected.jpg`: section separation proof.
- `brochure-1.png` through `brochure-7.png`: rendered source PDF pages.

Some older screenshots in that folder show superseded designs. Use the current website and source files as authoritative.

## Local preview and future publishing

The preview used `http://127.0.0.1:3040/`. It is not needed for the live website to run and may be stopped after logout or restart. To restart it, use PowerShell in `C:\dev\FlockTrax-Production-Release\web-admin`:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 3040
```

Check for an existing process on that port first; do not stop unrelated processes. Browser tabs and tool-session handles from the old chat are not durable. Reacquire them in a fresh chat. Browser automation in this work used the documented cua_repl APIs. Reset temporary viewport overrides after responsive checks.

For future authorized production updates: inspect both checkout statuses, validate the source change, commit only intended files, push `release/admin-2.6.0`, then fast-forward the deployment checkout to the intended application commit. Run `vercel.cmd deploy --prod --yes` from its `web-admin` directory. Wait for READY and the flocktrax.com alias, then verify the live behavior. Do not assume a successful upload alone means the deployment is complete. No database migration or mobile-app release was needed for these landing-page changes.

Ken prefers concise updates and practical action. Do not repeat permission requests for already-authorized work. Preserve the established production/deployment workflow and user-approved copy/design decisions.
