# FlockTrax Web Admin + Security Checkpoint
Date: 2026-04-11

## Current Position

This checkpoint captures the current state of the FlockTrax web-admin console after the splash-screen redesign, initial authentication wiring, first-pass user access control model, and the start of the security-table alignment work.

The system is now beyond pure mockup stage. The web console has:

- a branded, platform-driven splash screen
- a working web login flow through Supabase
- a signed-out and signed-in splash state
- a first-pass `User Access Control` screen
- a working initial model for roles + memberships on the web side
- a confirmed existing security schema in Supabase that should be refined rather than rebuilt

The system is still in transition between:

- visual + interaction scaffolding
- live security-data wiring

So the right framing is:

- web admin is now operationally shaped
- security design is conceptually framed
- live security data and enforcement still need to be wired to the existing database model

## Web Splash Status

The web splash at `web-admin/app/page.tsx` is now the real front door to the admin console.

### It currently does all of the following

- Reads branded/version/legal content from hosted Supabase `platform` schema:
  - `platform.control`
  - `platform.screen_txt`
  - `platform.license_policy`
- Uses the hosted `admin` control row for:
  - version
  - build
  - release date
- Shows a signed-out state:
  - sidebar menu visually disabled
  - `Live Dashboard` CTA disabled
  - active `Login` button in sidebar
- Shows a signed-in state:
  - active sidebar links for built screens
  - signed-in user identity block in sidebar
  - active `Live Dashboard`
  - settings access through `...`

### Current visual/design decisions locked in

- Sidebar is the stable anchor and should not be rearranged from screen to screen.
- Bird/logo block remains intentionally a bit oversized.
- The `...` utility entry in the splash sidebar sits in the left corner and leads to settings.
- Splash sidebar space under bird block behaves like:
  - signed out: `Login`
  - signed in: current user identity
- Domain planning remains important:
  - root domain: `flocktrax.com`
  - likely web console subdomain: `admin.flocktrax.com`

## Platform Table Wiring

The splash screen is not hardcoded now. It is reading from Supabase platform tables.

### Confirmed platform text keys in use

- `webapp_tagline`
- `webapp_splash_title`
- `splash_verbose_desc`
- `platform_type`
- `platform_subsystems`
- `copyright`

### Important issue that was solved

The `platform` schema initially did not work through the Supabase API path. This was resolved by:

- exposing `platform` schema in Supabase API settings
- granting schema/table/sequence access properly

Working SQL used to fix access:

```sql
grant usage on schema platform to anon, authenticated, service_role;
grant select on all tables in schema platform to anon, authenticated, service_role;
grant select on all sequences in schema platform to anon, authenticated, service_role;

alter default privileges in schema platform
grant select on tables to anon, authenticated, service_role;

alter default privileges in schema platform
grant select on sequences to anon, authenticated, service_role;
```

## Web Login Status

The web login route is no longer placeholder-only.

### Files involved

- `web-admin/app/login/page.tsx`
- `web-admin/app/login/actions.ts`

### Current behavior

- Email/password sign-in uses Supabase auth.
- Forgot-password form sends a Supabase reset email.
- If already signed in, `/login` redirects back to `/`.
- Successful sign-in redirects to `/`, not directly to `/admin/overview`.
  - This was changed intentionally so the user returns to the signed-in splash first.

### Important note

The signed-in splash still acts as the controlled console entry point.

That is the current intended flow:

1. open splash
2. login if needed
3. return to splash in signed-in state
4. move into console from there

## Current Reachable Web Screens

From the signed-in splash, the following destinations are now actually linked:

- `Live Dashboard` -> `/admin/overview`
- `Placements` -> `/admin/placements/new`
- `Farm Groups` -> `/admin/farm-groups`
- `Farms` -> `/admin/farms`
- `Flocks` -> `/admin/flocks`
- `Placement Wizard` -> `/admin/placements/new`
- `User Access Control` -> `/admin/user-access`

Other splash menu items remain visual placeholders for now.

## Settings Screen Status

There is now a first-pass settings screen:

- `web-admin/app/admin/settings/page.tsx`

### Current purpose

- layout and visual mockup implementation
- not yet fully live-wired to real settings data

### Important decisions made

- Settings entry belongs behind the sidebar `...`, not as a primary nav item
- Explanatory copy on settings/task screens can come from `platform.screen_txt`
- Task definition/instruction text belongs in screen text
- Task rows themselves should live in task data tables

## User Access Control Screen Status

There is now a first-pass user access screen:

- `web-admin/app/admin/user-access/page.tsx`

This screen was built to make the security model human-readable before live data is wired.

### Current screen meaning

The mental model finally settled into this:

- Green row at top of user list = current acting user
- Left list = users reachable from the acting user’s current scope
- Right side = current acting user’s authority to grant/change access

This replaced the earlier, muddier interpretation where the right side looked like the target user rather than the grantor.

### Current labels that were intentionally chosen

- Left card title:
  - `User Directory`
- Left explanatory copy:
  - `The users visible in the list below are filtered with reference to common memberships.`
  - `Available actions are based on the acting user's assigned roles & permissions.`
- Right card title:
  - `Granting Authority`
- Top two right-side panels:
  - `Access Grantor`
  - `Permissions`

### Current visual behavior

- Acting user row:
  - dark green tile
  - yellow name
  - cream badges
  - slightly separated from list below
- Selected editable target:
  - cyan treatment in list
  - token panels get a light cyan outline to show pending edit context

### Important design interpretation that was agreed

The screen is effectively saying:

`Hello Ken, here are the users you can reach from where you sit, and here is the authority you currently have to affect them.`

That is the current intended reading.

## Role + Membership Model (Conceptual)

The current agreed security model is:

- roles define **what**
- memberships define **where**

### Agreed scope hierarchy

- `integrator_group`
- `farm_group`
- `farm`

### Agreed usage model

Security designers/engineers do the hard work of building role templates.

The permissions grantor should **not** be choosing many individual action tokens one-by-one for normal users.

Instead, the grantor should usually:

1. choose a role template
2. choose the memberships where it applies

### Example of the intended grant model

- role token:
  - `Farm Hand`
- membership token:
  - `Farm membership_where_i_work`

This means the system should behave more like:

- assign wholesale packages
- then assign scope

and less like:

- manually building every worker permission basket by hand

## Contra / Restriction Tokens

An important design conclusion was reached:

- contra-action / deny / restriction tokens may be valid
- but they should mostly be individual-user overrides
- they should not normally redefine a whole role template

Reason:

If an entire role should not have a capability, that capability should not be granted in the role template in the first place.

So contra-action tokens are best reserved for rare exceptions such as:

- a specific grower admin who should not be able to delete
- a specific user who needs narrower authority than the class they belong to

## Existing Security Schema in Supabase

The good news is that the underlying security schema is not starting from scratch.

Existing tables already appear to include the core bones:

- `public.roles`
- `public.role_permissions`
- `public.user_roles`
- `public.farm_group_memberships`
- `public.farm_memberships`

This means the next phase should be:

- inspect and map existing live schema to the agreed model
- extend only what is missing
- avoid creating duplicate security structures

### Likely missing or incomplete based on current model

- a true `integrator_group` membership layer
- sharper permission codes around singular vs broad management rights
- live wiring from these tables into the web `User Access Control` screen

## Security Design Conclusions Reached

### Important high-level conclusions

1. The model is understandable because it can be explained in plain language to a person.
2. The permissions grantor should work with role packages, not piles of individual action tokens.
3. Memberships are the operational boundary of authority.
4. Roles are the permission templates.
5. The UI should remain human, even if the underlying logic is powerful.

### Real-world role example discussed

The integrator service tech / weighing tech is a strong example:

- they may need to enter only weight session data
- they may need enough path access to reach the weight-entry UI
- but should not be able to alter unrelated daily log functions on the way there

This points toward either:

- a narrow specialist role
- or extremely limited user-level overrides

Most likely answer:

- a purpose-built specialist role

## Work In Progress / Pending

### Immediate pending work

- inspect live security tables and their human-readable views
- map existing roles and permissions to agreed business language
- decide whether `integrator_group` must be added as a new scope layer
- replace mock user access data with live Supabase reads
- wire actual editable target selection into the user-access UI

### Additional web work still pending

- real settings data wiring
- settings/task text from `platform.screen_txt`
- live token editing UX for user access screen
- server-side enforcement layer tied to real security tables
- eventual web-side invite/admin user management screen

## User Notes / Operational Pressure

There is real urgency and real hope behind the pace of this work.

Key operational drivers:

- real farm workers will both enter real data and naturally test the UI
- there is an organic / ROA / ROC inspection target in mid-June
- the system now feels close enough to live use that the effort is justified

This is no longer just exploratory build work. It is approaching a “working teenager getting its feet wet” stage.

## Repository State Notes

Current repo state is not clean. There are several important categories in `git status`:

### Web/admin files modified or added during this phase

- `web-admin/app/page.tsx`
- `web-admin/app/globals.css`
- `web-admin/components/admin-shell.tsx`
- `web-admin/lib/types.ts`
- `web-admin/lib/access-control.ts`
- `web-admin/lib/platform-content.ts`
- `web-admin/app/login/`
- `web-admin/app/admin/settings/`
- `web-admin/app/admin/user-access/`

### Other repo-state cautions

- There are many deletions under `tmp/pdfs/pydeps/...`
- `web-admin/config-sidebar.png` is deleted
- `web-admin/screens/` exists as an untracked area
- `supabase/security/` appears untracked

This means the next cleanup/commit pass should be deliberate and not rushed.

## Known Caution

There is still at least one visual text encoding blemish in the splash date line:

- the separator currently appears as `Â·` in at least one readback

This is minor but should be cleaned in the next pass.

## Recommended Next Resume Point

When work resumes, the best sequence is:

1. inspect the real security tables and security helper views in Supabase
2. compare actual role rows and permission rows to the agreed business-language model
3. decide whether to add `integrator_group`
4. wire live reads into `User Access Control`
5. keep the sidebar stable while building the rest of the console

## Final Summary

The project is now in a materially stronger place than earlier checkpoints:

- mobile is at functional/pre-beta pause
- web splash is real and branded
- auth works
- settings mockup exists
- user-access screen exists
- role/membership model is conceptually framed in plain language
- existing security schema already contains useful core tables

This is now a wiring-and-refinement phase, not a blank-page phase.
