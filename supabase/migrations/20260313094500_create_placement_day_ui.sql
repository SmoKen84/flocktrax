DO $$
DECLARE
  has_placement_key boolean;
  has_date_placed boolean;
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

  EXECUTE format($view$
    CREATE OR REPLACE VIEW public.placement_day_ui
    WITH (security_invoker = on) AS
    SELECT
        COALESCE(d.placement_id, m.placement_id) AS placement_id,
        %1$s AS placement_code,
        p.farm_id,
        f.farm_name,
        p.barn_id,
        b.barn_code,
        p.flock_id,
        fl.flock_number,
        %2$s AS placed_date,
        ((COALESCE(d.log_date, m.log_date) - %2$s))::integer AS placement_age_days,
        COALESCE(d.log_date, m.log_date) AS log_date,
        d.age_days,
        d.am_temp,
        d.set_temp,
        d.ambient_temp,
        d.min_vent,
        d.is_oda_open,
        d.oda_exception,
        d.naoh,
        d.comment,
        d.is_active AS daily_is_active,
        m.dead_female,
        m.dead_male,
        m.cull_female,
        m.cull_male,
        m.cull_female_note,
        m.cull_male_note,
        m.dead_reason,
        m.grade_litter,
        m.grade_footpad,
        m.grade_feathers,
        m.grade_lame,
        m.grade_pecking,
        m.is_active AS mortality_is_active,
        p.is_active AS placement_is_active,
        p.date_removed IS NOT NULL AS placement_is_removed
    FROM public.log_daily AS d
    FULL JOIN public.log_mortality AS m
      ON m.placement_id = d.placement_id
     AND m.log_date = d.log_date
    JOIN public.placements AS p
      ON p.id = COALESCE(d.placement_id, m.placement_id)
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
    END
  );
END
$$;

ALTER VIEW public.placement_day_ui OWNER TO postgres;

GRANT SELECT ON public.placement_day_ui TO anon;
GRANT SELECT ON public.placement_day_ui TO authenticated;
GRANT SELECT ON public.placement_day_ui TO service_role;
