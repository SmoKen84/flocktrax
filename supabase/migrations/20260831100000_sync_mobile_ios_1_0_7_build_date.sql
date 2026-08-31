do $$
declare
  updated_rows integer;
begin
  update platform.control
  set released = '2026-08-29'
  where lower("group") = 'mobile_ios'
    and version = '1.0.7'
    and build = 20;

  get diagnostics updated_rows = row_count;
  if updated_rows <> 1 then
    raise exception
      'Expected to update exactly one mobile_ios 1.0.7 build 20 row, updated %',
      updated_rows;
  end if;
end
$$;
