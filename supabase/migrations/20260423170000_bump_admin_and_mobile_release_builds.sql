update platform.control
set version = 1,
    build = 3,
    released = '2026-04-23'
where lower("group") = 'admin';

update platform.control
set version = 1,
    build = 4,
    released = '2026-04-23'
where lower("group") in ('mobile_ios', 'mobile_droid');
