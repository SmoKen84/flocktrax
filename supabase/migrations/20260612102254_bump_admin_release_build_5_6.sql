update platform.control
set version = '2.0.0',
    build = 9,
    build_label = '5.6',
    released = '2026-06-12'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
