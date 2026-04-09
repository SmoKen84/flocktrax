# FlockTrax Admin Screen Map 2026-04-01

## Purpose

Turn the admin architecture into a concrete, buildable screen map.

This document defines:

- admin routes
- screen responsibilities
- primary actions
- key fields
- target user roles
- suggested implementation order

## Product split

Two experiences should exist:

### 1. Worker app

Audience:

- line workers
- farm managers doing daily entry

Current mobile flow:

- login
- farm and barn list
- daily log / mortality entry

### 2. Admin app

Audience:

- super admin
- operations admin
- farm manager with setup permissions

Recommended form factor:

- web-first
- tablet acceptable
- not optimized around phone-first field use

## Role model for admin UI

Suggested conceptual roles:

### Super Admin

Can:

- manage all farm groups
- manage all farms
- manage all barns
- manage all flocks
- manage all placements
- manage users, memberships, roles, signup codes

### Operations Admin

Can:

- manage farms, barns, flocks, placements
- review logs and operations
- limited or no authority over global role definitions

### Farm Manager

Can:

- view and manage only assigned farms
- create flocks and placements for assigned farms
- review logs and worker activity for assigned farms

### Worker

Can:

- not access admin app

## Route map

Recommended admin route structure:

```text
/admin
/admin/overview
/admin/farm-groups
/admin/farm-groups/:farmGroupId
/admin/farms
/admin/farms/new
/admin/farms/:farmId
/admin/farms/:farmId/edit
/admin/farms/:farmId/barns
/admin/barns
/admin/barns/new
/admin/barns/:barnId
/admin/barns/:barnId/edit
/admin/flocks
/admin/flocks/new
/admin/flocks/:flockId
/admin/flocks/:flockId/edit
/admin/placements
/admin/placements/new
/admin/placements/:placementId
/admin/placements/:placementId/edit
/admin/placements/board
/admin/users
/admin/users/:userId
/admin/memberships
/admin/signup-codes
/admin/operations
/admin/operations/logs
/admin/operations/exceptions
```

## Navigation structure

Recommended main admin nav:

1. Overview
2. Farm Groups
3. Farms
4. Barns
5. Flocks
6. Placements
7. Users and Access
8. Operations

## Screen details

## 1. Admin Overview

Route:

- `/admin/overview`

Audience:

- Super Admin
- Operations Admin
- Farm Manager

Purpose:

- quick operational status and shortcuts

Widgets:

- active placements count
- farms with no active placement
- barns flagged empty but expected occupied
- flocks nearing live haul / closeout window
- recent daily log activity
- exceptions needing attention

Primary actions:

- create flock
- create placement
- review recent exceptions

## 2. Farm Groups List

Route:

- `/admin/farm-groups`

Audience:

- Super Admin

Purpose:

- manage grower/business groupings

Table columns:

- group name
- contact name
- phone
- city/state
- active status
- farm count

Primary actions:

- create farm group
- search
- filter active/inactive

## 3. Farm Group Detail

Route:

- `/admin/farm-groups/:farmGroupId`

Audience:

- Super Admin

Sections:

- summary
- contact info
- related farms
- notes/comments

Primary actions:

- edit
- deactivate
- create farm under group

## 4. Farms List

Route:

- `/admin/farms`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped to assigned farms

Purpose:

- manage farm master data

Table columns:

- farm code
- farm name
- farm group
- city/state
- active status
- barn count
- active placements count

Primary actions:

- create farm
- filter by group
- filter by active status

## 5. Farm Detail

Routes:

- `/admin/farms/:farmId`
- `/admin/farms/:farmId/edit`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Tabs:

1. Summary
2. Barns
3. Flocks
4. Placements
5. Access

Summary fields:

- farm code
- farm name
- farm group
- address
- map URL
- active status

Primary actions:

- edit farm
- add barn
- add flock
- create placement
- manage farm memberships

## 6. Barns List

Route:

- `/admin/barns`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Purpose:

- manage barns across farms

Table columns:

- barn code
- farm
- sort code
- active flock
- has flock
- is empty
- active status

Primary actions:

- create barn
- filter by farm
- filter by occupancy state

## 7. Barn Detail

Routes:

- `/admin/barns/:barnId`
- `/admin/barns/:barnId/edit`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Sections:

- barn identity
- physical specs
- current occupancy
- placement history

Primary actions:

- edit barn
- create placement for this barn
- close current placement

## 8. Flocks List

Route:

- `/admin/flocks`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Purpose:

- maintain flock-level setup and lifecycle

Table columns:

- flock number
- farm
- date placed
- start female count
- start male count
- active
- complete
- settled

Primary actions:

- create flock
- filter by farm
- filter by active/complete

## 9. Flock Create/Edit

Routes:

- `/admin/flocks/new`
- `/admin/flocks/:flockId/edit`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Core fields:

- farm
- flock number
- place date
- max date
- start female count
- start male count
- breed male
- breed female
- active / complete / settled flags

Derived/secondary display:

- estimated first live haul
- age today
- placement count

Primary actions:

- save flock
- create placement from flock

## 10. Flock Detail

Route:

- `/admin/flocks/:flockId`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Tabs:

1. Summary
2. Placements
3. Daily Activity
4. History

Primary actions:

- edit flock
- allocate placement
- mark complete

## 11. Placements List

Route:

- `/admin/placements`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Purpose:

- manage the actual worker-facing placement records

This is the most important admin table.

Table columns:

- placement key
- farm
- barn
- flock number
- placed date
- date removed
- active status

Primary actions:

- create placement
- filter active/inactive
- filter by farm
- filter by barn
- open placement detail

## 12. Active Placements Board

Route:

- `/admin/placements/board`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Purpose:

- operational visual view of active farm/barn occupancy

Display:

- grouped by farm
- cards for each barn
- current flock / placement
- active/inactive/empty state

Primary actions:

- open placement
- create placement in empty barn
- close active placement

This screen should mirror the way managers think in the field.

## 13. New Placement Wizard

Route:

- `/admin/placements/new`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Purpose:

- create a placement in a guided way

Suggested steps:

1. Select farm
2. Select barn
3. Select flock
4. Review derived placement info
5. Confirm start and active state

Fields:

- farm
- barn
- flock
- placement start date if needed
- active flag

Derived display:

- placement key
- flock place date
- expected first live haul
- current barn occupancy warning

Validation rules:

- barn must belong to farm
- flock must match permitted farm rules
- only one active placement per barn

Primary action:

- create placement

## 14. Placement Detail

Routes:

- `/admin/placements/:placementId`
- `/admin/placements/:placementId/edit`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Tabs:

1. Summary
2. Daily Logs
3. Mortality Logs
4. History
5. Audit

Summary fields:

- placement key
- farm
- barn
- flock number
- active status
- placed date
- removed date

Primary actions:

- edit placement
- close placement
- reopen if business rules allow

## 15. Users List

Route:

- `/admin/users`

Audience:

- Super Admin
- limited Operations Admin if needed

Purpose:

- inspect application users and assignments

Table columns:

- email
- display name
- auth id / user id
- active status
- farm memberships count

Primary actions:

- open user
- grant farm membership
- create signup code

## 16. User Detail

Route:

- `/admin/users/:userId`

Audience:

- Super Admin

Sections:

- profile
- farm memberships
- effective roles
- recent activity

Primary actions:

- add/remove farm membership
- activate/deactivate

## 17. Memberships

Route:

- `/admin/memberships`

Audience:

- Super Admin
- Operations Admin if appropriate

Purpose:

- manage farm access directly

Table columns:

- user
- farm
- role
- active status

Primary actions:

- grant membership
- revoke membership
- edit role

## 18. Signup Codes

Route:

- `/admin/signup-codes`

Audience:

- Super Admin
- Operations Admin

Purpose:

- generate and manage onboarding tokens for workers/managers

Table columns:

- code
- farm
- role
- active status
- uses
- max uses
- expiration

Primary actions:

- create signup code
- deactivate code
- filter expired/active

## 19. Operations

Routes:

- `/admin/operations`
- `/admin/operations/logs`
- `/admin/operations/exceptions`

Audience:

- Super Admin
- Operations Admin
- Farm Manager scoped

Purpose:

- monitor real usage and problems

Suggested panels:

- missing daily logs
- abnormal mortality spikes
- placements with no recent activity
- barns with conflicting occupancy state
- failed writes / exceptions

## Build order

Recommended implementation order:

### Phase 1. Shared admin shell

Build:

- `/admin/overview`
- shared navigation
- role-based route guard

### Phase 2. Core master data

Build:

- farms list/detail
- barns list/detail
- flocks list/detail

Reason:

- these are prerequisites for clean placement allocation

### Phase 3. Placement engine UI

Build:

- placements list
- new placement wizard
- placement detail
- active placements board

Reason:

- this is the operational bridge into the worker app

### Phase 4. Access administration

Build:

- users list
- memberships
- signup codes

### Phase 5. Operations review

Build:

- logs and exceptions views

## First concrete screens to build

If building immediately, start with these four:

1. Admin Overview
2. Farms List and Farm Detail
3. Flocks List and Flock Create/Edit
4. New Placement Wizard

Those four will establish the backbone of the admin side quickly.

## Important UX rule

Admin screens should use domain language explicitly:

- Flock
- Placement
- Placement allocation

Worker screens should continue using operational language:

- Farm
- Barn

This prevents worker confusion while preserving admin precision.

## Resume prompt

"Resume `C:\dev\FlockTrax` from `output/FlockTrax_Admin_Screen_Map_2026-04-01.md`. The next step is to decide whether the admin side will live in the existing mobile codebase as a separate route area or as a separate web app, then start implementing the first four screens: admin overview, farms, flocks, and new placement wizard."
