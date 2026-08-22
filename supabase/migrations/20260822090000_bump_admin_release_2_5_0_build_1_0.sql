update platform.control
set
  version = '2.5.0',
  build = 1,
  build_label = '1.0',
  released = '2026-08-22'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
