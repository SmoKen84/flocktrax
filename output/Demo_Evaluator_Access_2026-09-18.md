> Release update: deployed to the hosted demo on 2026-09-18 as source fa7588c, deployment dpl_JA4ZUjTz9UxmZBs6bPWpjuGaERNy. Earlier local-only statements below describe the implementation stage and are superseded by the combined release checkpoint.

# Demo evaluator access

Implemented in the demo worktree only. Migration 20260918200000 is applied to hosted demo project srkgobayrzidytmvoago and recorded in migration history. Website changes remain local and have not been deployed. Production was not changed for this feature.

## Owner workflow

1. Launch GoDemo.bat and sign in as the owner.
2. Open Demo Evaluator Access: http://localhost:3005/admin/demo-access.
3. Enter private contact details, role, farm and access days.
4. Choose Localhost:3005 for testing on this PC. Hosted links require website deployment before sharing externally.
5. Create access and copy the private setup link. Send it yourself; the demo sends no email.
6. The evaluator sets a password and signs in with the displayed alias.
7. New setup link handles forgotten passwords and replaces any unused link. Enable / extend sets expiry from today. Disable blocks access.

## Design and limitations

- Real contact data is service-only and shown through the owner screen. Auth identities use random aliases and fictitious email addresses.
- Setup tokens are single-use, stored only as SHA-256 hashes, and expire within 24 hours or the access expiry, whichever is earlier.
- Website middleware checks access status. Restricted owner routes and sensitive user/settings actions reject evaluators. Database restrictive policies gate expired or disabled sessions.
- Existing farm and role policies still determine data access. Shared demo records and notes remain visible according to those permissions.
- Activity reports show setup, sign-ins and page visits within the latest 2,000 events. They do not prove edits. Evaluators see a tracking notice.
- The UI reset preserves evaluator records and restores farm memberships. Direct SQL reset calls bypass membership restoration.
- Mobile can reuse the identities and registry. Mobile login, setup links, activity reporting, and security-definer RPC/storage expiry enforcement require further implementation and review before native mobile access is enabled.

## Validation

TypeScript and git diff checks passed. Disposable PostgreSQL tests cover token replay/expiry/revocation, register privacy, service-only token claims, role escalation denial, session gating, and register preservation through reset. Local setup and alias-login screens rendered. A complete evaluator onboarding session still needs user acceptance testing.

## Integrator evaluator extension
Integrator Manager is now available during evaluator creation. It has no single-farm assignment, can read current/future farm groups and farms, and can maintain groups, farms and barns through the existing farm structure actions. Owner-only evaluator contacts, user management, settings and reset controls remain blocked. Migration 20260918210000 was applied to hosted demo only. Local website code still needs deployment. Tests cover active, expired and disabled integrator scope and preservation of ordinary evaluator authorization.
