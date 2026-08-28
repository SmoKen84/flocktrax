update platform.control
set version = '2.0.0',
    build = 8,
    build_label = '5.5',
    released = '2026-06-09'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
