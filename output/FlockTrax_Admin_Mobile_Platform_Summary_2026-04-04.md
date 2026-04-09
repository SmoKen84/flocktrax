# FlockTrax-Admin & FlockTrax-Mobile Platform Summary

## Purpose

FlockTrax is being shaped as a two-surface poultry operations platform built around one shared hosted data model. `FlockTrax-Admin` is the management, reporting, and platform-governance side. `FlockTrax-Mobile` is the fast-entry operational side used closer to the barn floor. Both surfaces are intended to work against the same hosted Supabase backend so that the business operates from one shared source of truth instead of fragmented app-specific data.

## Shared operating model

The key operating unit across the platform is the placement. A placement ties farm, barn, flock, and active production timing together into the shared key `placement_id`. Once a placement exists, both the admin and mobile surfaces can work against the same production context. That means mobile can submit daily and mortality activity while admin can summarize, monitor, and report against the exact same placement history.

Master entities such as farms, barns, and flocks define structure. Placements define the live flock-in-barn operating context. Daily logs and mortality logs define the changing production state. The result is a platform where setup, transaction flow, and reporting can all stay connected.

## Surface responsibilities

### FlockTrax-Mobile

`FlockTrax-Mobile` is designed for fast execution. Its role is to:

- authenticate the user
- show active placements
- support placement-day submission
- capture daily production activity and mortality with low friction

Mobile should stay narrow, fast, and reliable so barn-floor users can enter data quickly without carrying the weight of broader admin workflows.

### FlockTrax-Admin

`FlockTrax-Admin` is designed for visibility and control. Its role is to:

- present active placements by barn
- summarize current placement state
- support management oversight and reporting
- manage settings, preferences, feature flags, and platform identity over time

The admin side is where the business should be able to understand operations across farms and barns rather than just enter one day of records.

## Platform structure

The current platform is settling into three layers:

1. Data layer: hosted Supabase tables and views for farms, barns, flocks, placements, daily logs, mortality logs, weights, and derived dashboard rollups.
2. Service layer: Supabase Edge Functions for authentication, submission, and read-oriented APIs.
3. Application layer: `FlockTrax-Admin` and `FlockTrax-Mobile`.

This separation is healthy because each layer has a distinct job. The database stores truth. The function layer enforces business logic and request handling. The client surfaces stay focused on user workflow.

## Interconnectivity

The two surfaces do not need to communicate directly with each other. Their interconnectivity comes from shared services:

- Supabase provides the shared hosted database.
- Edge Functions provide controlled entry points such as `session-create` and `placement-day-submit`.
This means the platform is connected by common APIs, shared identifiers, and common data structures rather than by fragile custom app-to-app wiring.

## Authentication and runtime flow

The hosted `session-create` function issues the session token used by downstream requests. That token allows the platform to move toward a role-aware operating model. Over time, this will support differentiated access such as admin, higher-trust settings access, and app-owner controls across the whole platform.

The current runtime direction is straightforward:

- Supabase Edge Functions handle authentication, submit flows, and read-oriented APIs.
- Both client surfaces should operate against the same hosted project and shared identifiers.
- Legacy leftovers that do not serve the hosted Admin and Mobile platform should be treated as cleanup work, not architecture.

## Dashboard strategy

For the admin dashboard, the stronger design is live rollups from source-of-truth records rather than mutable counters hand-maintained on placements. In practical terms:

- starting counts come from flock placement data
- mortality comes from the mortality logs
- current in-house count is calculated as starting count minus net mortality

This reduces drift when historical records are corrected. The admin dashboard then becomes a trustworthy summary surface over the same underlying data mobile writes.

## Conclusion

FlockTrax is becoming a unified operations platform with two primary working surfaces under one backend model. `FlockTrax-Mobile` captures fast operational truth. `FlockTrax-Admin` organizes, summarizes, and governs that truth. Supabase is the bridge that keeps the system coherent, and the platform direction is clearly toward a shared hosted backend, role-aware access, and durable application structure.
