# FlockTrax Admin Architecture 2026-04-01

## Purpose

Define the admin-side information architecture and workflow that supports the worker-facing mobile app.

Worker app responsibility:

- select farm and barn
- open the current placement
- enter daily and mortality data

Admin responsibility:

- define the master data
- define the flock and placement structure
- control what the worker app exposes as selectable farm and barn locations

## Core principle

Workers should consume placements.

Admins should create and maintain the records that make placements valid and selectable.

This is the right separation because:

- workers think in farm and barn location
- admins think in flock assignment, placement windows, and operational setup

## Real schema entities already present

Based on the current repo schema:

- `farm_groups`
- `farms`
- `barns`
- `flocks`
- `placements`
- `roles`
- `farm_memberships`
- `signup_codes`

Daily-entry entities:

- `log_daily`
- `log_mortality`
- `v_placement_daily`

## Entity roles

### 1. Farm Groups

Table:

- `public.farm_groups`

Purpose:

- top-level grouping for growers or business groupings
- administrative ownership and reporting grouping

Expected admin tasks:

- create farm group
- edit farm group
- deactivate farm group

Typical fields:

- group name
- contact information
- address information
- comments
- active status

### 2. Farms

Table:

- `public.farms`

Purpose:

- physical grower location under a group

Expected admin tasks:

- create farm
- assign to farm group
- edit farm details
- activate/deactivate farm

Typical fields:

- farm code
- farm name
- farm group
- address
- map URL
- active status

### 3. Barns

Table:

- `public.barns`

Purpose:

- physical subdivision of a farm where flocks are placed

Expected admin tasks:

- create barn under farm
- edit barn metadata
- set sort order / display order
- activate/deactivate barn

Typical fields:

- barn code
- sort code
- dimensions
- standard occupancy / head guidance
- active status

### 4. Flocks

Table:

- `public.flocks`

Purpose:

- define the bird cohort being tracked

Expected admin tasks:

- create flock
- assign flock metadata
- edit flock lifecycle state
- mark completion / settlement status

Typical fields:

- flock number
- farm
- date placed
- max date
- start counts
- breed fields
- active / complete / settled flags

Important note:

This is where several “small flock-specific fields” live, including:

- place date
- estimated first live haul or equivalent derived planning value
- start counts

If hosted schema uses different exact names, the admin UI should still conceptually treat this as flock lifecycle setup.

### 5. Placements

Table:

- `public.placements`

Purpose:

- the operational record that marries:
  - flock
  - farm
  - barn
  - date context
  into the actual worker-facing placement identity

This is the backbone of the worker app.

Worker selection of:

- farm
- barn

is operationally a selection of:

- one active `placement_id`

Expected admin tasks:

- create placement
- assign flock to farm + barn
- set placement start
- remove / close placement
- view placement lifecycle and status

Typical fields:

- farm id
- barn id
- flock id
- placement key / placement code
- active status
- placement date / removal date

## Product split

## Worker side

### Screen 1. Login

Audience:

- line workers
- farm managers

### Screen 2. Farm and Barn list

Audience:

- line workers

Purpose:

- expose active placements in the mental model of farm + barn

### Screen 3. Placement daily log

Audience:

- line workers

Purpose:

- data entry only

Not responsible for:

- creating placements
- changing flock assignment
- building farm structure

## Admin side

The admin side should be a separate app area or separate app entirely.

It should not be mixed into the worker experience.

Recommended modules:

### Module 1. Organization Setup

Screens:

- Farm Groups list
- Farm Group detail
- Farms list
- Farm detail

Purpose:

- maintain group and farm master data

### Module 2. Barn Setup

Screens:

- Barns by farm
- Barn detail

Purpose:

- create and maintain barns
- define display order and basic physical metadata

### Module 3. Flock Setup

Screens:

- Flocks list
- Flock detail
- Flock create/edit

Purpose:

- create flock records
- store placement date and other flock-level metadata
- monitor completion and settlement state

### Module 4. Placement Allocation

This is the most important admin module.

Screens:

- Placements list
- Active placements board
- New placement wizard
- Placement detail / history

Purpose:

- create the record that line workers will later see as the selectable location

Core action:

- allocate a flock to a farm and barn

That allocation yields:

- active `placement_id`
- `placement_key`
- active date context

This is the operational bridge between admin and worker.

### Module 5. User Access

Screens:

- Users list
- Farm memberships
- Roles and signup codes

Purpose:

- decide who can see which farms
- control farm manager versus worker access

### Module 6. Audit and Operations

Screens:

- placement history
- recent saves / exceptions
- incomplete flock lifecycle review

Purpose:

- operational oversight

## Recommended admin flows

### Flow A. First-time setup

1. Create farm group
2. Create farm
3. Create barns under farm
4. Create user access for managers/workers

### Flow B. New flock arrives

1. Create flock record
2. Enter flock number
3. Enter place date
4. Enter starting counts and other flock metadata
5. Confirm farm association if needed

### Flow C. Allocate active placement

1. Open placement allocation
2. Choose farm
3. Choose barn
4. Choose flock
5. Confirm placement start / active state
6. System generates or confirms placement key
7. Placement becomes visible in worker app list

This is the critical business flow.

### Flow D. Close or rotate placement

1. Open placement detail
2. Mark date removed or inactive
3. Update barn occupancy state
4. Placement falls out of worker active list

### Flow E. Manage worker access

1. Create or invite user
2. Grant farm membership
3. Assign role
4. User sees only permitted farms/barns

## Recommended UI shape for admin

Admin users think differently than line workers.

They need:

- searchable tables
- detail forms
- history panels
- status filters
- explicit create/edit workflows

This suggests:

- web-first admin UI
- not phone-first

Best product split:

- worker app: mobile-first
- admin app: responsive web or tablet-first

## Placement creation model

This is the conceptual rule set the system should follow:

1. A flock exists as a biological/operational group.
2. A barn exists as a physical location.
3. A placement exists when that flock is assigned to that barn at that farm in an active operational period.
4. The worker app should only list active placements.
5. Workers should see farm and barn labels, not internal placement mechanics.

In other words:

- admin creates the placement
- worker consumes the placement

## Naming recommendation

For worker UI:

- say "Farm"
- say "Barn"
- optionally show "Placement" as smaller metadata

For admin UI:

- use the actual domain terms:
  - Flock
  - Placement
  - Placement allocation

This keeps both sides honest without overloading field users with internal jargon.

## Recommended next implementation order

### Phase 1. Stabilize worker app

- confirm current worker flow against more real data
- add validation and unsaved-change handling
- improve dashboard grouping and filtering

### Phase 2. Build admin foundation

- admin list/detail for farms
- admin list/detail for barns
- admin list/detail for flocks

### Phase 3. Build placement allocation

- new placement wizard
- active placements list
- placement close/remove flow

### Phase 4. Build access administration

- farm memberships
- role assignment
- signup/invite flow cleanup

## Strong recommendation

Do not rebuild the admin side as a copy of the worker app.

They are different products inside the same system.

The worker app should stay:

- fast
- simple
- location-driven

The admin side should be:

- structured
- data-rich
- explicit about relationships and lifecycle

## Immediate next build artifact

The next practical artifact should be:

- an admin screen map with routes, forms, and user roles

That can then be translated into either:

- a web admin app
- an admin section of the same codebase

## Resume prompt

"Resume `C:\dev\FlockTrax` from `output/FlockTrax_Admin_Architecture_2026-04-01.md`. Worker mobile flow now works and should stay farm-and-barn-first. Next step is to turn the admin architecture into a concrete screen map and implementation plan for farm groups, farms, barns, flocks, placement allocation, and user access."
