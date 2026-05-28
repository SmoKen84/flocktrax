update platform.control
set version = '2.0.0',
    build = 6,
    build_label = '5.3',
    released = '2026-05-28'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
