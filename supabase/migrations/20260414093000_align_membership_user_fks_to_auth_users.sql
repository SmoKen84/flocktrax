do $$
declare
  missing_group_users integer;
  missing_farm_users integer;
begin
  select count(*)
  into missing_group_users
  from public.farm_group_memberships fgm
  left join auth.users au
    on au.id = fgm.user_id
  where au.id is null;

  if missing_group_users > 0 then
    raise exception 'farm_group_memberships contains % user_id values with no matching auth.users row', missing_group_users;
  end if;

  select count(*)
  into missing_farm_users
  from public.farm_memberships fm
  left join auth.users au
    on au.id = fm.user_id
  where au.id is null;

  if missing_farm_users > 0 then
    raise exception 'farm_memberships contains % user_id values with no matching auth.users row', missing_farm_users;
  end if;
end $$;

alter table if exists public.farm_group_memberships
  drop constraint if exists farm_group_memberships_user_id_fkey;

alter table if exists public.farm_group_memberships
  add constraint farm_group_memberships_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table if exists public.farm_memberships
  drop constraint if exists farm_memberships_user_id_fkey;

alter table if exists public.farm_memberships
  add constraint farm_memberships_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

comment on constraint farm_group_memberships_user_id_fkey on public.farm_group_memberships
  is 'Membership identity follows auth.users.id; app_users is legacy and no longer authoritative.';

comment on constraint farm_memberships_user_id_fkey on public.farm_memberships
  is 'Membership identity follows auth.users.id; core_users is no longer authoritative for web-admin access.';
