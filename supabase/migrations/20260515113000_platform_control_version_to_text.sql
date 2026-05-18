alter table platform.control
  alter column version type text
  using case
    when version is null then null
    else trim(version::text)
  end;

comment on column platform.control.version is
  'Display version string for the platform surface, e.g. 1.0.2 or 1.0.2 (13).';
