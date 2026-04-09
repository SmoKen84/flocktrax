-- FlockTrax identity diagnostics
-- Purpose:
-- 1. show how core_users resolves to auth/app identities
-- 2. find duplicate app_users rows
-- 3. find membership rows that point to stale or unresolved user ids

-- 1. Core users with resolved auth and app identity
select
  cu.id as core_user_id,
  au.id as auth_user_exists,
  au.email as auth_email,
  apu.email as app_email,
  apu.display_name as app_display_name,
  cu.created_at as core_user_created_at
from public.core_users cu
left join auth.users au
  on au.id = cu.id
left join public.app_users apu
  on apu.user_id = cu.id
order by coalesce(au.email, apu.email), cu.created_at desc;

-- 2. Duplicate app_users rows by email
select
  lower(email) as email_key,
  count(*) as row_count,
  array_agg(user_id order by created_at desc) as user_ids
from public.app_users
where email is not null
group by lower(email)
having count(*) > 1
order by row_count desc, email_key;

-- 3. Duplicate app_users rows by user_id
select
  user_id,
  count(*) as row_count,
  array_agg(email order by created_at desc) as emails
from public.app_users
group by user_id
having count(*) > 1
order by row_count desc, user_id;

-- 4. core_users rows that do not map to auth.users
select
  cu.id as core_user_id,
  cu.created_at
from public.core_users cu
left join auth.users au
  on au.id = cu.id
where au.id is null
order by cu.created_at desc;

-- 5. farm memberships with resolved identity
select
  fm.user_id,
  au.email as auth_email,
  apu.display_name,
  fm.farm_id,
  f.farm_name,
  f.farm_group_id,
  fg.group_name as farm_group_name,
  fm.role_id,
  r.code as role_code,
  fm.is_active,
  fm.created_at,
  fm.updated_at
from public.farm_memberships fm
left join auth.users au
  on au.id = fm.user_id
left join public.app_users apu
  on apu.user_id = fm.user_id
left join public.farms f
  on f.id = fm.farm_id
left join public.farm_groups fg
  on fg.id = f.farm_group_id
left join public.roles r
  on r.id = fm.role_id
order by coalesce(au.email, apu.email), f.farm_name;

-- 6. farm memberships pointing at core_users ids that do not exist in auth.users
select
  fm.user_id,
  fm.farm_id,
  f.farm_name,
  fm.role_id,
  r.code as role_code,
  fm.is_active
from public.farm_memberships fm
left join auth.users au
  on au.id = fm.user_id
left join public.farms f
  on f.id = fm.farm_id
left join public.roles r
  on r.id = fm.role_id
where au.id is null
order by fm.user_id, f.farm_name;

-- 7. farm group memberships with resolved identity
select
  fgm.user_id,
  au.email as auth_email,
  apu.display_name,
  fgm.farm_group_id,
  fg.group_name as farm_group_name,
  fgm.role_id,
  r.code as role_code,
  fgm.active,
  fgm.created_at
from public.farm_group_memberships fgm
left join auth.users au
  on au.id = fgm.user_id
left join public.app_users apu
  on apu.user_id = fgm.user_id
left join public.farm_groups fg
  on fg.id = fgm.farm_group_id
left join public.roles r
  on r.id = fgm.role_id
order by coalesce(au.email, apu.email), fg.group_name;

-- 8. Current authenticated user with memberships and roles
select
  auth.uid() as current_user_id,
  au.email as auth_email
from auth.users au
where au.id = auth.uid();

select
  fm.user_id,
  f.farm_name,
  fg.group_name as farm_group_name,
  r.code as role_code,
  fm.is_active
from public.farm_memberships fm
left join public.farms f
  on f.id = fm.farm_id
left join public.farm_groups fg
  on fg.id = f.farm_group_id
left join public.roles r
  on r.id = fm.role_id
where fm.user_id = auth.uid()
order by f.farm_name;

select
  fgm.user_id,
  fg.group_name as farm_group_name,
  r.code as role_code,
  fgm.active
from public.farm_group_memberships fgm
left join public.farm_groups fg
  on fg.id = fgm.farm_group_id
left join public.roles r
  on r.id = fgm.role_id
where fgm.user_id = auth.uid()
order by fg.group_name;
