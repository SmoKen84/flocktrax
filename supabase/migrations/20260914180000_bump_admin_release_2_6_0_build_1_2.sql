do $$
declare
  updated_rows integer;
begin
  update platform.control
  set
    version = '2.6.0',
    build = 3,
    build_label = '1.2',
    released = '2026-09-14'
  where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');

  get diagnostics updated_rows = row_count;
  if updated_rows <> 1 then
    raise exception
      'Expected to update exactly one Admin platform.control row, updated %',
      updated_rows;
  end if;
end
$$;
