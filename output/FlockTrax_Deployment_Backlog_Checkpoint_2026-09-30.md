# September 30, 2026 deployment backlog checkpoint

## Deployed source

- Production: `8abfb31`, branch `release/admin-2.6.0`, https://flocktrax.com.
- Production READY deployment: `dpl_CcAFyiQUxFKMHVKmEhhJj2V6oq8p`, https://web-admin-blpxj5v03-flock-trax.vercel.app.
- Demo: `963d758`, branch `demo-hosted`, https://flocktrax-demo.vercel.app.
- Demo READY deployment: `dpl_DttpwjhmbqRhN5ds4XqNFMPJFY9Y`, https://flocktrax-demo-ggkdlqa5n-flock-trax.vercel.app.
- Both source branches pushed to origin. Later documentation-only commits do not require deployment.

## Changes now present in both environments

- Dashboard packets with no mortality/cull number entered today are capped at 50 percent, remain pending, and do not display a completed timestamp. Explicit zero counts as entered. Awaiting-arrival behavior is unchanged.
- The dashboard feed icon opens an in-place modal using the operational ten-day report data, including BinSentry inventory and scheduled orders. Close/Escape returns focus without navigating away. Recently loaded results are reused for one minute, with Refresh available.
- Installed desktop apps launch at `/login`, which redirects authenticated users to the dashboard. Manifest identity remains `/admin/overview`; production/demo branding remains distinct. About-page instructions explain the launch behavior.

## Validation

- Five targeted regression tests and TypeScript checks passed in each release checkout.
- Both hosted production builds passed compilation, type checks and page generation.
- Both live manifests return `start_url: /login` and the existing app identity.
- Live login pages return HTTP 200; unauthenticated dashboard requests redirect to their own login page.
- Supabase linked dry runs reported both databases up to date. No migrations or Edge Functions needed deployment for this backlog.
- No new authenticated-browser audit was performed in this deployment turn. The user had confirmed the restored popup locally before requesting backlog deployment.

## Audit boundaries and remaining work

- September 27 marketing WIP status was superseded by the deployed September 28 checkpoint. Those changes are already live.
- Historical checkout mortality changes and recovered migrations duplicate released work; do not deploy the old `C:/dev/FlockTrax` app over production.
- Untracked marketing brochure tooling, screenshots, local launch tools, CLI temporary metadata, and multi-barn/BioWaste research are not an undeployed application release.
- Grower Admin evaluator support remains unfinished work described by the September 28 checkpoint, not a completed release awaiting deployment.
- The first popup lookup can still be slow: inventory reads are scoped to selected bins, but scheduled orders are searched organization-wide and filtered afterward, and the shared report loader reloads dashboard data. Further lookup optimization is not implemented.
- No mobile binary or store submission was made as part of this web backlog release.

## Recovery

Previous production READY deployment: `dpl_En5xgXpudoPYSrGKBYSg4YBJYuhA` (popup and mortality cap already included).
Previous demo READY deployment: `dpl_GU2aGyiPxudt6WLiuWhPfsp2JPKb` (September 29 baseline).
Revert through the corresponding Vercel project if required. No database rollback is needed for these web changes.
