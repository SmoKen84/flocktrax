update platform.control
set version = '2.0.0',
    build = 5,
    build_label = '5.0',
    released = '2026-05-18'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
