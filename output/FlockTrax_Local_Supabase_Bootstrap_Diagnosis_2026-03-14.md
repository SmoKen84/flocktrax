# FlockTrax Local Supabase Bootstrap Diagnosis

Date: 2026-03-14

## Summary

The local Supabase startup failure is caused by a mismatch between the Supabase Postgres image bootstrap behavior and what is actually mounted into the local DB container.

## Confirmed Facts

### Environment after updates

- Docker Desktop: 4.64.0
- Docker Engine: 29.2.1
- Supabase CLI: 2.78.1

Updating Docker Desktop and Supabase CLI did not resolve the failure.

### The local failure is not caused by stale data

- Local DB volume was destructively reset multiple times.
- The same failure persisted after clean rebuilds.

### The image explicitly requires `99-roles.sql`

Inspection of the Supabase Postgres image entrypoint showed:

- `/usr/local/bin/docker-entrypoint.sh` contains:
  - `docker_process_sql -f /docker-entrypoint-initdb.d/init-scripts/99-roles.sql`

This means the local DB image expects that file to exist during startup.

### The image itself does not contain `99-roles.sql`

Inspection of the stock image filesystem showed:

- `/docker-entrypoint-initdb.d/init-scripts/00-schema.sql`
- `/docker-entrypoint-initdb.d/init-scripts/00000000000000-initial-schema.sql`
- `/docker-entrypoint-initdb.d/init-scripts/00000000000001-auth-schema.sql`
- `/docker-entrypoint-initdb.d/init-scripts/00000000000002-storage-schema.sql`
- `/docker-entrypoint-initdb.d/init-scripts/00000000000003-post-setup.sql`
- no `99-roles.sql`

So the missing file is not baked into the image.

### The project contains a local `99-roles.sql`, but it is not mounted into the DB container

Project file restored at:

- `C:\dev\FlockTrax\supabase\init-scripts\99-roles.sql`

But `docker inspect supabase_db_FlockTrax` shows only this mount relevant to the DB data path:

- `supabase_db_FlockTrax:/var/lib/postgresql/data`

There is no visible bind mount for:

- `C:\dev\FlockTrax\supabase\init-scripts`
- `/docker-entrypoint-initdb.d/init-scripts`

Therefore the container cannot see the project's `99-roles.sql` file.

### The project already contains the same logical role setup as a migration

File:

- `C:\dev\FlockTrax\supabase\migrations\20260216212000_create_admin_role.sql`

This migration creates the `admin` role and grants it to `authenticator`.

So the local `99-roles.sql` is only needed to satisfy image bootstrap behavior, not because the project lacks equivalent schema logic.

## Root Cause

The local Supabase Postgres image expects `/docker-entrypoint-initdb.d/init-scripts/99-roles.sql`, but the local project bootstrap is not mounting the project's `supabase/init-scripts` directory into that path.

As a result, the image repeatedly fails at password-sync/bootstrap time with:

- `psql: error: /docker-entrypoint-initdb.d/init-scripts/99-roles.sql: No such file or directory`

That failure then destabilizes the local DB health checks and prevents the stack from becoming healthy.

## What Was Ruled Out

- stale Docker network state
- stale local DB volume contents
- older Docker Desktop version
- older Supabase CLI version
- missing `admin` role migration in project schema

## Best Current Interpretation

This appears to be a local Supabase bootstrap regression or environment-specific mount issue rather than a problem in the new dashboard/daily-packet code.

## Practical Next Options

1. Create a local workaround that injects `99-roles.sql` into the DB container automatically after creation and before health checks matter.
2. Compare this project’s local bootstrap behavior to a freshly initialized Supabase project on the same machine.
3. File or search for a Supabase CLI / local stack bug involving missing `99-roles.sql` in the Postgres image bootstrap.
4. Bypass local runtime testing and validate new functions against the remote dev project instead.
