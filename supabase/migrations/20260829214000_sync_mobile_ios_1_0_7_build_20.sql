do $$
declare
  updated_rows integer;
begin
  update platform.control
  set version = '1.0.7',
      build = 20,
      build_label = null
  where lower("group") = 'mobile_ios';

  get diagnostics updated_rows = row_count;
  if updated_rows <> 1 then
    raise exception
      'Expected to update exactly one platform.control mobile_ios row, updated %',
      updated_rows;
  end if;
end
$$;
