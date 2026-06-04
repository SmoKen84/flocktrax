update platform.control
set version = '2.0.0',
    build = 7,
    build_label = '5.4',
    released = '2026-06-04'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
