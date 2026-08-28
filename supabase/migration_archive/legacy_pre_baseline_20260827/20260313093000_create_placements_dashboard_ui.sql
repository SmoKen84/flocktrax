DO $$
DECLARE
  has_placement_key boolean;
  has_date_placed boolean;
  has_date_removed boolean;
  has_is_active boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'placements'
      AND column_name = 'placement_key'
  ) INTO has_placement_key;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'placements'
      AND column_name = 'date_placed'
  ) INTO has_date_placed;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'placements'
      AND column_name = 'date_removed'
  ) INTO has_date_removed;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'placements'
      AND column_name = 'is_active'
  ) INTO has_is_active;

  EXECUTE format($view$
    CREATE OR REPLACE VIEW public.placements_dashboard_ui
    WITH (security_invoker = on) AS
    SELECT
        p.id AS placement_id,
        p.farm_id,
        f.farm_name,
        p.barn_id,
        b.barn_code,
        p.flock_id,
        %1$s AS placement_code,
        %2$s AS placed_date,
        ((%2$s + INTERVAL '38 days'))::date AS est_first_catch,
        CEIL(EXTRACT(EPOCH FROM (NOW() - %2$s::timestamp with time zone)) / 86400.0)::integer AS age_days,
        COALESCE(fl.start_cnt_females, 0) + COALESCE(fl.start_cnt_males, 0) AS head_count,
        %3$s AS is_active,
        %4$s AS is_removed,
        fl.is_complete,
        fl.is_in_barn,
        fl.is_settled,
        b.sort_code,
        p.created_at,
        p.updated_at
    FROM public.placements AS p
    JOIN public.farms AS f
      ON f.id = p.farm_id
    JOIN public.barns AS b
      ON b.id = p.barn_id
    JOIN public.flocks AS fl
      ON fl.id = p.flock_id
  $view$,
    CASE
      WHEN has_placement_key THEN 'p.placement_key'
      ELSE '(fl.flock_number::text || ''-'' || b.barn_code)'
    END,
    CASE
      WHEN has_date_placed THEN 'p.date_placed'
      ELSE 'fl.date_placed'
    END,
    CASE
      WHEN has_is_active THEN 'p.is_active'
      ELSE 'true'
    END,
    CASE
      WHEN has_date_removed THEN '(p.date_removed IS NOT NULL)'
      ELSE 'false'
    END
  );
END
$$;

ALTER VIEW public.placements_dashboard_ui OWNER TO postgres;

GRANT SELECT ON public.placements_dashboard_ui TO anon;
GRANT SELECT ON public.placements_dashboard_ui TO authenticated;
GRANT SELECT ON public.placements_dashboard_ui TO service_role;
