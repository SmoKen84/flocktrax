-- Normalize the legacy/live role spellings used by database authorization.
-- Hosted roles include FarmManager and super-admin, while P0 originally
-- recognized only farm_manager and super_admin-style spellings.

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and regexp_replace(lower(coalesce(r.code, '')), '[^a-z0-9]+', '', 'g')
        in ('admin', 'superadmin')
  );
$$;

create or replace function public.can_write_farm(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.farm_memberships fm
      join public.roles r on r.id = fm.role_id
      where fm.user_id = auth.uid()
        and fm.farm_id = target_farm_id
        and fm.is_active = true
        and regexp_replace(lower(coalesce(r.code, '')), '[^a-z0-9]+', '', 'g')
          in (
            'admin', 'manager', 'farmmanager', 'grower', 'groweradmin',
            'integratormanager', 'gpcexec', 'gpcliveops', 'superadmin'
          )
    )
    or exists (
      select 1
      from public.farms f
      join public.farm_group_memberships fgm
        on fgm.farm_group_id = f.farm_group_id
      join public.roles r on r.id = fgm.role_id
      where f.id = target_farm_id
        and fgm.user_id = auth.uid()
        and fgm.active = true
        and regexp_replace(lower(coalesce(r.code, '')), '[^a-z0-9]+', '', 'g')
          in (
            'admin', 'manager', 'farmmanager', 'grower', 'groweradmin',
            'integratormanager', 'gpcexec', 'gpcliveops', 'superadmin'
          )
    );
$$;

revoke all privileges on function public.is_admin()
  from public, anon, authenticated;
revoke all privileges on function public.can_write_farm(uuid)
  from public, anon, authenticated;
grant execute on function public.is_admin()
  to anon, authenticated, service_role;
grant execute on function public.can_write_farm(uuid)
  to anon, authenticated, service_role;

commit;
