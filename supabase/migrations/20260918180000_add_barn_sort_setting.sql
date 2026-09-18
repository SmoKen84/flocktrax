-- Preserve any existing preference; missing settings default to barn code.
insert into public.app_settings ("group", name, value, "desc")
select 'General', 'sort_by_sort_code', 'False',
  'True: order barns by custom sort_code within each farm. False: order by barn_code. Applies to dashboard and barn, flock and placement selectors.'
where not exists (select 1 from public.app_settings where name = 'sort_by_sort_code');
