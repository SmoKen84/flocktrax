-- Local bootstrap role sync for Supabase Postgres image.
-- The image entrypoint explicitly executes this file during startup.
-- Keep this idempotent and minimal.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin') THEN
    CREATE ROLE admin NOLOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    GRANT admin TO authenticator;
  END IF;
END
$$;

ALTER ROLE admin INHERIT;
