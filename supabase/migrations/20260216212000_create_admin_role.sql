-- Ensure custom role used by RLS policies exists in local dev
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin') THEN
    CREATE ROLE admin NOLOGIN;
  END IF;
END
$$;

-- Allow PostgREST to SET ROLE admin when JWT role=admin is used
GRANT admin TO authenticator;

-- Optional: match Supabase defaults (not strictly required)
ALTER ROLE admin INHERIT;
