update platform.control
set version = 1,
    build = 1,
    released = '2026-04-21'
where lower("group") = 'admin';
