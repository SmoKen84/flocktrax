update platform.control
set version = '2.1.0',
    build = 11,
    build_label = '5.8',
    released = '2026-07-20'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
