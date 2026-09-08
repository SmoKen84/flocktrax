-- Demo-only product copy. The marker check makes this migration fail closed
-- if it is ever aimed at any Supabase project other than FlockTrax-Demo.

do $$
declare
  v_item record;
  v_keep_id bigint;
begin
  if not exists (
    select 1
    from demo_control.environment
    where singleton = true
      and project_ref = 'srkgobayrzidytmvoago'
  ) then
    raise exception 'Demo environment marker mismatch; refusing demo copy seed';
  end if;

  for v_item in
    select *
    from (values
      (
        'webapp_tagline'::text,
        'FlockTrax Demo Environment'::text,
        'Persistent demo identity for the primary application splash.'::text,
        'webapp splash'::text
      ),
      (
        'webapp_splash_title',
        'Explore FlockTrax safely.',
        'Primary title shown on the isolated demonstration application.',
        'webapp splash'
      ),
      (
        'splash_verbose_desc',
        'You are connected to a fully isolated demo database containing synthetic showcase data. Explore the workflows and make changes freely—no production records, Google Sheets, or BinSentry account can be affected.',
        'Primary explanation of the demo data and integration safety boundary.',
        'webapp splash'
      ),
      (
        'platform_type',
        'Isolated Demonstration Platform',
        'Platform type displayed in the splash signature.',
        'webapp splash'
      ),
      (
        'platform_subsystems',
        'Synthetic data • outbound integrations disabled • resettable demonstration environment',
        'Demo safety summary displayed in the splash signature.',
        'webapp splash'
      )
    ) as desired(name, display, note, scrn_location)
  loop
    select id
      into v_keep_id
    from platform.screen_txt
    where lower(name) = lower(v_item.name)
    order by id
    limit 1;

    if v_keep_id is null then
      insert into platform.screen_txt (name, display, note, scrn_location)
      values (v_item.name, v_item.display, v_item.note, v_item.scrn_location)
      returning id into v_keep_id;
    else
      update platform.screen_txt
      set display = v_item.display,
          note = v_item.note,
          scrn_location = v_item.scrn_location
      where id = v_keep_id;
    end if;

    delete from platform.screen_txt
    where lower(name) = lower(v_item.name)
      and id <> v_keep_id;

    v_keep_id := null;
  end loop;
end
$$;
