# FlockTrax Web Admin Stack 2026-04-01

## Purpose

Define the recommended technical approach for the FlockTrax web-based admin and reporting application.

This document answers:

- why the admin side should be web-based
- what stack to use
- how auth should work
- what app sections should exist
- what to build first

## Product split

### Mobile app

Audience:

- line workers
- farm managers doing daily barn entry

Purpose:

- operational data entry

Key qualities:

- fast
- simple
- location-first
- minimal navigation depth

### Web admin app

Audience:

- super admins
- operations admins
- farm managers doing setup, review, and reporting

Purpose:

- master data maintenance
- placement allocation
- user access management
- operational reporting
- exports

Key qualities:

- dense information
- powerful filtering
- larger forms
- side-by-side details
- export/report support

## Recommended stack

## Frontend

Recommended:

- `Next.js`
- `TypeScript`
- `React`

Reason:

- good for admin dashboards and forms
- supports server and client patterns cleanly
- can host app routes and protected admin pages well
- strong ecosystem for tables, forms, exports, and auth-aware pages

## UI layer

Recommended:

- custom app UI with a light internal design system

Possible supporting libraries:

- table/grid library for dense admin tables
- form library for complex create/edit flows
- schema validation library for shared field validation

Design direction:

- no flashy consumer UI
- clear, data-first, operational interface
- optimized for desktop first, tablet second

## Backend

Keep:

- Supabase database
- Supabase Auth
- Supabase Edge Functions

Reason:

- this is already where the truth lives
- permissions and business rules are already moving into Supabase
- worker app and admin app can share the same backend contract

## Reporting and export layer

Use:

- direct query-backed report endpoints
- CSV export actions
- optionally PDF later for formal reporting

Do not:

- build reports as screen-only tables first and figure out exports later

Export should be part of the design from the start.

## Recommended app structure

Suggested top-level structure:

```text
/admin
  /overview
  /farm-groups
  /farms
  /barns
  /flocks
  /placements
  /users
  /memberships
  /signup-codes
  /reports
  /exports
  /operations
```

## Recommended auth model

Use standard Supabase Auth for admin users.

Reason:

- browser/web app does not need the same thin custom token flow used to work around Adalo
- admin web app can use normal auth and session handling directly

Recommendation:

- keep `session-create` for legacy Adalo/mobile bridge needs if necessary
- for the web admin app, use direct Supabase Auth session flow

Practical outcome:

- worker mobile app can continue using the current function/API path
- admin web app can authenticate in a more standard and maintainable way

## Authorization model

The web app should enforce access in two places:

### 1. Route/UI gating

Examples:

- workers cannot see admin routes
- farm managers only see their assigned farms

### 2. Supabase-side permission enforcement

Examples:

- farm-scoped queries
- placement create/update restrictions
- membership-based visibility

The UI should not be the only line of defense.

## Recommended app sections

## 1. Overview

Purpose:

- daily admin homepage

Contents:

- active placements
- barns needing attention
- recent logs
- recent exceptions
- quick links to create flock or placement

## 2. Master Data

Subsections:

- farm groups
- farms
- barns
- flocks

Purpose:

- keep the structural data correct

## 3. Placement Management

Subsections:

- placements list
- active placements board
- placement detail
- new placement wizard

Purpose:

- define what the worker app can actually select

This is the most important admin area after authentication.

## 4. User Access

Subsections:

- users
- farm memberships
- signup codes

Purpose:

- control who can access which farms and workflows

## 5. Reports and Exports

Subsections:

- flock performance reports
- daily log extracts
- mortality summaries
- placement history
- export center

Purpose:

- provide operational insight and extractable data

## 6. Operations

Subsections:

- exception queue
- incomplete logs
- occupancy conflicts
- suspicious or stale placements

Purpose:

- support cleanup and oversight

## Data-access recommendation

Use a mixed approach:

### For straightforward CRUD

Use:

- direct Supabase table/view access where schema and permissions are stable

Examples:

- farms
- barns
- flocks
- memberships

### For business-rule-heavy actions

Use:

- dedicated Edge Functions

Examples:

- create placement
- close placement
- allocation validation
- report generation
- exports

Reason:

- admin actions often carry more business rules than simple CRUD
- this keeps the backend contract explicit and auditable

## Forms strategy

For admin forms, prefer:

- server-backed validation
- explicit save actions
- dirty state detection
- cancel / discard confirmation

This is especially important for:

- flock create/edit
- placement allocation
- access changes

## Table strategy

Admin tables should support:

- search
- column sorting
- active/inactive filters
- farm filters
- date filters
- CSV export

The admin app should feel like an operations console, not a marketing website.

## First build slice

Recommended first web-admin milestone:

### Milestone 1

Build:

1. admin login
2. admin shell and nav
3. overview page
4. farms list/detail
5. flocks list/detail
6. new placement wizard

Reason:

- this is the smallest slice that proves the admin app can maintain the objects that feed the worker app

### Milestone 2

Build:

1. placements list
2. placement detail
3. active placements board
4. barn detail and edit

### Milestone 3

Build:

1. memberships
2. signup codes
3. user detail
4. first reports/export pages

## Recommended hosting model

Simplest path:

- host web admin separately from mobile
- point both apps at the same Supabase backend

This avoids:

- mixing admin complexity into worker bundle
- overloading the mobile app routing model

## Why not build admin inside Expo/mobile

Because admin needs:

- larger tables
- richer keyboard use
- more simultaneous context
- reporting/export flows

Trying to make that first-class inside a phone-oriented app will recreate the same category of compromise you just escaped with Adalo.

## Suggested implementation style

Use the web admin app to be explicit and boring in the best sense:

- stable left nav
- table/list pages
- detail pages with tabs
- wizard for placement creation
- report pages with filters and export buttons

Do not overcomplicate the first version with:

- fancy dashboards
- excessive charts
- abstract workflow builders

The important thing is clear operations control.

## Recommended next technical artifact

Next useful artifact after this document:

- a concrete module-by-module build plan for the web admin app

That plan should define:

- repo location
- route skeleton
- shared types
- which backend endpoints need to be reused or added

## Resume prompt

"Resume `C:\dev\FlockTrax` from `output/FlockTrax_Web_Admin_Stack_2026-04-01.md`. We have decided the admin maintenance and reporting side should be a separate web-first app. Next step is to create the concrete implementation plan for that admin app, including repo structure, route skeleton, auth approach, and milestone 1 screens."
