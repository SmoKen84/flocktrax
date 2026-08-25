update platform.control
set
  version = '2.5.0',
  build = 2,
  build_label = '1.1',
  released = '2026-08-25'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
