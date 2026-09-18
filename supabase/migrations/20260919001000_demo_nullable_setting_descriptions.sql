begin;
do $$ begin
 if not exists(select 1 from demo_control.environment where singleton and project_ref='srkgobayrzidytmvoago') then raise exception 'Demo project required'; end if;
end $$;
alter table demo_control.app_settings_seed alter column setting_description drop not null;
update demo_control.app_settings_seed s set setting_description=a."desc" from public.app_settings a where a.id=s.id;
do $$ declare definition text; begin
 select pg_get_functiondef('demo_control.full_showcase_status()'::regprocedure) into definition;
 definition:=replace(definition,'actual."desc" = expected.setting_description','actual."desc" is not distinct from expected.setting_description');
 execute definition;
end $$;
commit;
