# FlockTrax Hosted Demo Branch Checkpoint — 2026-09-08

## Purpose

This is the authoritative recovery checkpoint for the isolated FlockTrax hosted-demo effort. The governing rule for this work is **DO NO HARM** to production.

The demo is not yet publicly hosted. Its Supabase backend, synthetic dataset, isolation guards, private document bucket, owner account, reset procedure, and Environment Control UI are prepared and verified. Creating a separate Vercel project remains the next explicit external gate.

## Restore points

- Demo functional baseline commit: `68216532055587185c2320a79fa777a3a2173534`
- Demo branch: `demo-hosted`
- Demo worktree: `C:\dev\FlockTrax-Demo-Hosted`
- Demo checkpoint tag: `checkpoint/demo-hosted-20260908`
- Environment-control foundation branch: `demo-platform`
- Environment-control foundation commit: `20fb4dfe1d6fbee4bfa46d6d9b6f0e8e36bdbba3`
- Stable production fallback commit: `4b494db0ab097eed3e4f748163da3670820c2aeb`
- Stable production fallback tag: `pre-demo-stable-2026-09-05`

To inspect or recover the checkpoint without moving an existing worktree, create a new worktree from the tag:

```powershell
git -C C:\dev\FlockTrax worktree add C:\dev\FlockTrax-Demo-Restore checkpoint/demo-hosted-20260908
```

Do not use a destructive reset against the production checkout.

## Repository and deployment boundary

- The production source branch and deployment were not changed by this demo work.
- `origin/main` remains at production commit `4b494db`.
- The demo branch has not been pushed to GitHub because an automatic preview deployment could inherit production Vercel variables.
- Supabase GitHub integration remains disconnected.
- A demo Vercel project has not been created.
- `demo.flocktrax.com` has not been attached or changed.
- The original checkout retains unrelated local artifacts that were deliberately preserved:
  - modified `supabase/.temp/cli-latest`
  - untracked `mobile/screens/errors/`

## Supabase project isolation

- Production Supabase project ref: `frneaccbbrijpolcesjm`
- Demo Supabase project ref: `srkgobayrzidytmvoago`
- Demo project name: `FlockTrax-Demo`
- Demo worktree local Supabase link: demo project only
- Original checkout local Supabase link: production project only
- Historically tracked Supabase `.temp` link files were removed from Git tracking on `demo-hosted` so a worktree cannot inherit a production project link from source control.

The schema migrations were applied only to the demo project. Demo-specific versions of the Google Sheets cron migrations install a disabled stub and do not schedule a cron job.

## Demo environment guards

The web and mobile clients fail closed when explicitly labeled as demo:

- A demo web deployment rejects the production Supabase project ref.
- A demo web deployment rejects the production hostname.
- Demo outbound mode must explicitly be `disabled` or `sandbox`.
- Email, Google Sheets, and BinSentry web paths enforce the outbound gate.
- Google Sheets, BinSentry, and Adalo Edge paths enforce the outbound gate.
- Demo mobile builds require explicit demo API/Supabase settings and reject the production project.

The demo Supabase Edge environment is configured with:

- `FLOCKTRAX_ENVIRONMENT_NAME=demo`
- `FLOCKTRAX_OUTBOUND_MODE=disabled`
- the protected production project ref used only as an isolation comparison

No Google, BinSentry, Adalo, SMTP, or production service credential was copied into the demo project.

## Demo owner

- Auth email: `ken@mothercluckershenhouse.com`
- Auth user id: `ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a`
- Application role: `super_admin`
- Access assignment is stored only in the demo database.

The owner-only `/admin/environment-control` page remains unavailable to users who do not have the required Super Admin role. An optional email allowlist can further constrain it through `FLOCKTRAX_ENVIRONMENT_CONTROL_OWNER_EMAILS`.

## Synthetic showcase baseline

Every reset reanchors transaction dates to the reset day using `current_date` and current timestamps. The demo therefore remains timely rather than aging into an obviously stale dataset.

Current verified baseline:

- 2 farm groups
  - Evergreen Poultry Partners
  - Blue River Growers
- 3 farms
  - Cedar Creek Farm and Redbud Ridge Farm under Evergreen Poultry Partners
  - Pine Hollow Farm under Blue River Growers
- 6 barns
- 5 placements
  - 3 active/growing placements aged 12, 31, and 45 days at reset time
  - 1 future placement scheduled 10 days after reset
  - 1 archived placement with completed history
- 91 daily log rows
- 91 mortality log rows
- 22 weekly weight samples
- 3 feed tickets and 4 feed drops
- 2 livehaul events and 2 completed livehaul loads
- 3 Action Items spanning open and resolved examples
- 1 private document archive bucket with a 25 MB per-file limit and five allowed PDF/image MIME types
- 0 Google Sheets outbox entries
- 0 platform sync outbox entries

All organization names, people, addresses, ticket numbers, flock numbers, operational values, and history are synthetic. No production business record or document was copied.

## Guarded reset design

The database contains a private `demo_control` schema with:

- a singleton environment marker bound to demo project ref `srkgobayrzidytmvoago`
- the expected owner UUID and email
- a deterministic synthetic seed/reset function
- a machine-readable verification function
- a multi-farm-group composition step

The reset refuses to run unless the marker and owner identity match. Ordinary `anon` and `authenticated` roles have no function access. Only `service_role` can call the public wrapper used by the owner-checked server action.

The Environment Control reset additionally requires:

- an authenticated owner/Super Admin
- `FLOCKTRAX_ENVIRONMENT_NAME=demo`
- all environment-safety checks to pass
- `FLOCKTRAX_OUTBOUND_MODE=disabled`
- the exact typed confirmation phrase `RESET DEMO`

Before rebuilding data, the server action removes tracked demo documents from private Storage. The reset then rebuilds synthetic operational data, reanchors dates, empties both outbound queues, and runs the expected-count verification.

## Verification evidence

Completed successfully on 2026-09-08:

- all demo schema migrations applied transactionally
- selected Edge Functions deployed to the demo project with their intended JWT verification settings
- live BinSentry isolation test returned the expected demo-blocked response without contacting the vendor
- synthetic baseline verification returned `ok=true`
- full reset sequence returned `ok=true`
- post-reset counts matched the expected baseline, including 2 farm groups
- farm-to-group assignments were read back correctly
- Google Sheets outbox count remained `0`
- platform sync outbox count remained `0`
- anonymous reset RPC attempt was rejected with HTTP `401`
- document bucket was read back as private, with a 25 MB limit and the expected MIME allowlist
- web-admin TypeScript check passed
- optimized Next.js production build passed, including `/admin/environment-control`

## Demo commits

- `1af1154` — Bootstrap isolated hosted demo database
- `93075da` — Seed demo platform owner access
- `1b7b6ad` — Add guarded synthetic demo reset
- `ec0240b` — Harden demo operations and storage
- `6821653` — Expand demo across multiple farm groups

## Legacy operational-script hazard

The isolation audit found an old tracked backup script containing an embedded production database credential and helper scripts that defaulted to the production project.

On `demo-hosted`:

- the embedded database URL was removed;
- the backup script now requires `FLOCKTRAX_DATABASE_URL` explicitly;
- the function deployment helper now requires `FLOCKTRAX_SUPABASE_PROJECT_REF` explicitly;
- farm-access and password-reset helpers now require an explicit `ProjectRef`;
- scans found no remaining credential-bearing PostgreSQL URL in executable/config source files;
- no-target execution tests fail closed with exit code `1`.

Because the removed credential remains in Git history, a coordinated production database-password rotation is still recommended. Do not rotate it casually: first inventory every production consumer so Vercel, workers, and other connection strings can be updated together without an outage.

## Known boundary before hosting

The demo backend is ready, but a complete product showcase still requires a separately approved hosting activation:

1. Create an independent Vercel project such as `flocktrax-demo`.
2. Configure only demo Supabase URL, publishable key, server credential, explicit demo label, protected production comparison values, and disabled outbound mode.
3. Deploy first to the Vercel-generated address.
4. Configure demo-only Supabase Auth site/redirect URLs for that address.
5. Sign in as the demo owner and smoke-test dashboard, reports, editing, document upload/download, and reset.
6. Only after those checks, decide whether to attach `demo.flocktrax.com`.
7. Do not connect the demo branch to automatic GitHub deployment until environment inheritance behavior has been explicitly verified.

## Resume instruction

Load this checkpoint first, work only from `C:\dev\FlockTrax-Demo-Hosted` on branch `demo-hosted`, verify `supabase/.temp/project-ref` is `srkgobayrzidytmvoago` before any Supabase mutation, and preserve production commit `4b494db` plus tag `pre-demo-stable-2026-09-05`. The next action is the explicitly approved creation of a separate Vercel demo project and first isolated deployment; do not attach the production domain or inherit production environment variables.
