update platform.control
set version = '2.1.0',
    build = 10,
    build_label = '5.7',
    released = '2026-07-16'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
