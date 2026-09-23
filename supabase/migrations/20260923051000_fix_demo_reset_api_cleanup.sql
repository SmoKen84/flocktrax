-- The hosted API enables safeupdate; explicitly scope intentional demo cleanup.
do $$
declare
  definition text;
begin
  if not exists (select 1 from demo_control.environment where singleton and project_ref = 'srkgobayrzidytmvoago') then
    raise exception 'Demo project marker missing';
  end if;
  definition := pg_get_functiondef('demo_control.ensure_app_settings_showcase()'::regprocedure);
  execute replace(definition, 'delete from public.app_settings;', 'delete from public.app_settings where true;');
  definition := pg_get_functiondef('demo_control.ensure_daily_age_tasks_showcase()'::regprocedure);
  execute replace(definition, 'delete from public.daily_age_tasks;', 'delete from public.daily_age_tasks where true;');
end $$;
