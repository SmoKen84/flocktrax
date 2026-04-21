grant usage on schema platform to authenticated, service_role;

grant select on platform.screen_txt to authenticated, service_role;
grant update (display, note) on platform.screen_txt to service_role;
