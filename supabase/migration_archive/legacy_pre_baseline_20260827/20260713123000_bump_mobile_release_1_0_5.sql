update platform.control
set version = '1.0.5',
    build = 17,
    build_label = null,
    released = '2026-07-13'
where lower("group") = 'mobile_ios';

update platform.control
set version = '1.0.5',
    build = 11,
    build_label = null,
    released = '2026-07-13'
where lower("group") = 'mobile_droid';
