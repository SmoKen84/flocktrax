-- platform.control.version is now text so marketing versions can be stored
-- accurately (for example: 1.0.2) while build remains numeric.

update platform.control
set version = '1.0.2',
    build = 13,
    released = '2026-05-15'
where lower("group") = 'mobile_ios';

update platform.control
set version = '1.0.2',
    build = 7,
    released = '2026-05-15'
where lower("group") = 'mobile_droid';
