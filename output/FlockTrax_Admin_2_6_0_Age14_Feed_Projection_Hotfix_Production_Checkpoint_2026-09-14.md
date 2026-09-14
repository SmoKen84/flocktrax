# FlockTrax Admin 2.6.0 Age-14 Feed Projection Hotfix Production Checkpoint

Date: `2026-09-14`
Production source commit: `bb96d31`
Branch: `release/admin-2.6.0`
Production URL: `https://flocktrax.com`
Vercel deployment: `dpl_Es6PHuExie1oYtobsXAmWWVXfqMj`

## Outcome

This hotfix corrects the age-14 Starter transition everywhere the Admin web
application calculates or presents feed requirements.

At age 14 or older:

- the unfulfilled historical Starter target remains visible for audit and
  explanation;
- new Starter ordering is zero;
- the historical Starter shortfall expires and is not converted into Grower;
- Grower need and Grower ordering are based only on projected flock consumption,
  available Grower inventory, and open Grower orders.

This supersedes the earlier 2.6.0 release description that said an outstanding
Starter shortage would be added to Grower ordering.

## W6 Acceptance Example

The reported W6 values that exposed the defect were:

- actual 10-day Grower requirement: `30,573 lb`;
- Grower on hand: `8,677 lb`;
- Grower arriving tomorrow: `18,000 lb`;
- total available: `26,677 lb`;
- corrected Grower order recommendation: `3,896 lb`.

Calculation: `30,573 - 8,677 - 18,000 = 3,896`.

The former `54,573 lb` Grower Need was incorrect because it included the entire
`24,000 lb` historical Starter target: `30,573 + 24,000 = 54,573`.

## Changed Surfaces

- Live Dashboard feed-order recommendations in `web-admin/lib/admin-data.ts`.
- Standard and custom Feed Projection report rows and totals in
  `web-admin/lib/feed-projection-report-data.ts`.
- Starter math popup wording and historical shortfall display in
  `web-admin/app/admin/reports/feed-projection/feed-projection-report-table.tsx`.

The historical Starter target, recognized supply, open-order amount, and
calculated shortfall remain available in the popup. The popup now explicitly
states that the shortfall is historical only after day 14.

## Validation And Deployment

- Production Admin typecheck passed.
- Production Admin optimized build passed all 49 routes.
- `git diff --check` passed before commit.
- Source commit `bb96d31` was pushed to both `release/admin-2.6.0` and `main`.
- Vercel production build completed with status `READY`.
- Deployment aliases include `https://flocktrax.com` and
  `https://admin.flocktrax.com`.
- Both production home pages returned HTTP `200`.
- The production splash retained version `2.6.0`, build label `1.2`, and no demo
  identity.
- Unauthenticated `https://flocktrax.com/admin/overview` returned HTTP `307` to
  `/login`.
- No database migration or Edge Function deployment was required.

## Demo Parity

The same business-rule correction was independently committed to the isolated
`demo-hosted` branch as `a0d4fec` and deployed to the separate demo Vercel
project as `dpl_FZwcMhH3oRD8mx8HRQ8jabGEDN6f`.

## Resume Guidance

Treat `bb96d31` and Vercel deployment
`dpl_Es6PHuExie1oYtobsXAmWWVXfqMj` as the current production Admin baseline.
The Admin release marker remains `2.6.0` / numeric build `3` / visible build
label `1.2`. No mobile binary, Supabase migration, or Edge Function changed in
this hotfix.
