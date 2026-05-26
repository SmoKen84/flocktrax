update platform.control
set version = '1.0.3',
    build = 14,
    build_label = null,
    released = '2026-05-26'
where lower("group") = 'mobile_ios';
