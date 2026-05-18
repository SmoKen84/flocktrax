alter table platform.control
  add column if not exists build_label text;

comment on column platform.control.build_label is
  'Optional display build label for published surfaces, e.g. 4, 4.1, or 5.2 while numeric build remains the base release counter.';
