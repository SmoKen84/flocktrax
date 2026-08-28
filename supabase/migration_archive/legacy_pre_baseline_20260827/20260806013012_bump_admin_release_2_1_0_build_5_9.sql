update platform.control
set
  version = '2.1.0',
  build = 12,
  build_label = '5.9',
  released = '2026-08-06'
where id = 4
  and "group" = 'admin';
