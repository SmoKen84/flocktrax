-- P0 database authorization containment.
--
-- This migration closes the direct PostgREST/RPC paths identified in the
-- 2026-08-28 permissions review. It intentionally fails closed: application
-- code that needs owner-level access must use the server-side service role
-- after completing its own actor, role, and target-farm checks.

begin;

-- New public objects must be explicitly granted to client roles. Supabase's
-- historical defaults granted every table, sequence, and function to both
-- anon and authenticated, which silently recreated exposure after migrations.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

-- Authorization helpers execute as the owner so their lookups cannot recurse
-- through policies on the same role/membership tables. They expose booleans
-- only, derive the actor exclusively from auth.uid(), and use a fixed path.
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
      and lower(r.code) in ('admin', 'superadmin', 'super_admin')
  );
$$;

create or replace function public.can_access_farm(target_farm_id uuid)
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
      where fm.user_id = auth.uid()
        and fm.farm_id = target_farm_id
        and fm.is_active = true
    )
    or exists (
      select 1
      from public.farms f
      join public.farm_group_memberships fgm
        on fgm.farm_group_id = f.farm_group_id
      where f.id = target_farm_id
        and fgm.user_id = auth.uid()
        and fgm.active = true
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
        and lower(r.code) in (
          'manager', 'farm_manager', 'grower_admin',
          'integrator_manager', 'admin', 'superadmin', 'super_admin'
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
        and lower(r.code) in (
          'manager', 'farm_manager', 'grower_admin',
          'integrator_manager', 'admin', 'superadmin', 'super_admin'
        )
    );
$$;

-- Role and membership assignment is never self-service. Authenticated clients
-- may read only their own assignments; all writes go through reviewed server
-- administration paths using service_role.
drop policy if exists "User can insert own memberships" on public.farm_memberships;
drop policy if exists "User can update own memberships" on public.farm_memberships;
drop policy if exists "user_insert_own_memberships" on public.farm_memberships;
drop policy if exists "user_update_own_memberships" on public.farm_memberships;
drop policy if exists "farm_memberships_write" on public.farm_memberships;
drop policy if exists "User can insert own roles" on public.user_roles;
drop policy if exists "User can update own roles" on public.user_roles;
drop policy if exists "auth_insert_user_roles" on public.user_roles;
drop policy if exists "auth_update_user_roles" on public.user_roles;
drop policy if exists "user_roles_write" on public.user_roles;
drop policy if exists "auth_read_user_roles" on public.user_roles;

revoke all privileges on table public.user_roles from anon, authenticated;
revoke all privileges on table public.farm_memberships from anon, authenticated;
grant select on table public.user_roles to authenticated;
grant select on table public.farm_memberships to authenticated;

-- Keep exactly one own-row read policy on each table. Duplicate permissive
-- policies are removed so later review has one authoritative rule per action.
drop policy if exists "User can view own roles" on public.user_roles;
drop policy if exists "user_roles_read" on public.user_roles;
create policy user_roles_select_own
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "User can view own memberships" on public.farm_memberships;
drop policy if exists "farm_memberships_read" on public.farm_memberships;
drop policy if exists "user_select_own_memberships" on public.farm_memberships;
create policy farm_memberships_select_own
  on public.farm_memberships for select to authenticated
  using (user_id = auth.uid());

-- Farm-group assignments and the normalized permission matrix were shipped
-- without RLS. They are readable only where needed and never client-writable.
alter table public.farm_group_memberships enable row level security;
alter table public.farm_group_memberships force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;

revoke all privileges on table public.farm_group_memberships from anon, authenticated;
revoke all privileges on table public.role_permissions from anon, authenticated;
grant select on table public.farm_group_memberships to authenticated;
grant select on table public.role_permissions to authenticated;

drop policy if exists farm_group_memberships_select_own on public.farm_group_memberships;
create policy farm_group_memberships_select_own
  on public.farm_group_memberships for select to authenticated
  using (user_id = auth.uid());

drop policy if exists role_permissions_select_authenticated on public.role_permissions;
create policy role_permissions_select_authenticated
  on public.role_permissions for select to authenticated
  using (true);

-- Remove the global policies that neutralized farm scoping. Client table
-- privileges remain limited to ordinary CRUD and every row is authorized by
-- can_access_farm/can_write_farm.
drop policy if exists barns_anon_select on public.barns;
drop policy if exists barns_auth_select on public.barns;
drop policy if exists barns_auth_write on public.barns;
drop policy if exists farms_anon_select on public.farms;
drop policy if exists farms_auth_select on public.farms;
drop policy if exists farms_auth_write on public.farms;
drop policy if exists flocks_anon_select on public.flocks;
drop policy if exists flocks_auth_select on public.flocks;
drop policy if exists flocks_auth_write on public.flocks;
drop policy if exists placements_anon_select on public.placements;
drop policy if exists placements_auth_select on public.placements;
drop policy if exists placements_auth_write on public.placements;

revoke all privileges on table
  public.barns, public.farms, public.flocks, public.placements
from anon, authenticated;
grant select, insert, update, delete on table
  public.barns, public.farms, public.flocks, public.placements
to authenticated;

-- Daily/mortality/weight logs inherit farm scope from their placement.
drop policy if exists log_daily_all_delete on public.log_daily;
drop policy if exists log_daily_all_insert on public.log_daily;
drop policy if exists log_daily_all_select on public.log_daily;
drop policy if exists log_daily_all_update on public.log_daily;
drop policy if exists log_mortality_all_delete on public.log_mortality;
drop policy if exists log_mortality_all_insert on public.log_mortality;
drop policy if exists log_mortality_all_select on public.log_mortality;
drop policy if exists log_mortality_all_update on public.log_mortality;
drop policy if exists log_weight_all_delete on public.log_weight;
drop policy if exists log_weight_all_insert on public.log_weight;
drop policy if exists log_weight_all_select on public.log_weight;
drop policy if exists log_weight_all_update on public.log_weight;

revoke all privileges on table
  public.log_daily, public.log_mortality, public.log_weight
from anon, authenticated;
grant select, insert, update, delete on table
  public.log_daily, public.log_mortality, public.log_weight
to authenticated;

create policy log_daily_select_scoped
  on public.log_daily for select to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_daily.placement_id
      and public.can_access_farm(p.farm_id)
  ));
create policy log_daily_insert_scoped
  on public.log_daily for insert to authenticated
  with check (exists (
    select 1 from public.placements p
    where p.id = log_daily.placement_id
      and public.can_write_farm(p.farm_id)
  ));
create policy log_daily_update_scoped
  on public.log_daily for update to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_daily.placement_id
      and public.can_write_farm(p.farm_id)
  ))
  with check (exists (
    select 1 from public.placements p
    where p.id = log_daily.placement_id
      and public.can_write_farm(p.farm_id)
  ));
create policy log_daily_delete_scoped
  on public.log_daily for delete to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_daily.placement_id
      and public.can_write_farm(p.farm_id)
  ));

create policy log_mortality_select_scoped
  on public.log_mortality for select to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_mortality.placement_id
      and public.can_access_farm(p.farm_id)
  ));
create policy log_mortality_insert_scoped
  on public.log_mortality for insert to authenticated
  with check (exists (
    select 1 from public.placements p
    where p.id = log_mortality.placement_id
      and public.can_write_farm(p.farm_id)
  ));
create policy log_mortality_update_scoped
  on public.log_mortality for update to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_mortality.placement_id
      and public.can_write_farm(p.farm_id)
  ))
  with check (exists (
    select 1 from public.placements p
    where p.id = log_mortality.placement_id
      and public.can_write_farm(p.farm_id)
  ));
create policy log_mortality_delete_scoped
  on public.log_mortality for delete to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_mortality.placement_id
      and public.can_write_farm(p.farm_id)
  ));

create policy log_weight_select_scoped
  on public.log_weight for select to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_weight.placement_id
      and public.can_access_farm(p.farm_id)
  ));
create policy log_weight_insert_scoped
  on public.log_weight for insert to authenticated
  with check (exists (
    select 1 from public.placements p
    where p.id = log_weight.placement_id
      and public.can_write_farm(p.farm_id)
  ));
create policy log_weight_update_scoped
  on public.log_weight for update to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_weight.placement_id
      and public.can_write_farm(p.farm_id)
  ))
  with check (exists (
    select 1 from public.placements p
    where p.id = log_weight.placement_id
      and public.can_write_farm(p.farm_id)
  ));
create policy log_weight_delete_scoped
  on public.log_weight for delete to authenticated
  using (exists (
    select 1 from public.placements p
    where p.id = log_weight.placement_id
      and public.can_write_farm(p.farm_id)
  ));

-- Tables that previously had no RLS. Identity, audit, and document-archive
-- tables remain service-only. Operational rows with a direct or derivable farm
-- receive explicit scoped policies below.
alter table public.placement_closeouts enable row level security;
alter table public.placement_closeouts force row level security;
alter table public.activity_log enable row level security;
alter table public.activity_log force row level security;
alter table public.app_users enable row level security;
alter table public.app_users force row level security;
alter table public.core_users enable row level security;
alter table public.core_users force row level security;
alter table public.document_archives enable row level security;
alter table public.document_archives force row level security;
alter table public.feed_inventory_snapshots enable row level security;
alter table public.feed_inventory_snapshots force row level security;
alter table public.feed_order_commitments enable row level security;
alter table public.feed_order_commitments force row level security;
alter table public.livehaul_loads enable row level security;
alter table public.livehaul_loads force row level security;
alter table public.livehaul_schedule enable row level security;
alter table public.livehaul_schedule force row level security;

revoke all privileges on table
  public.placement_closeouts,
  public.activity_log,
  public.app_users,
  public.core_users,
  public.document_archives,
  public.feed_inventory_snapshots,
  public.feed_order_commitments,
  public.livehaul_loads,
  public.livehaul_schedule
from anon, authenticated;

grant select, insert, update, delete on table
  public.placement_closeouts,
  public.feed_inventory_snapshots,
  public.feed_order_commitments,
  public.livehaul_loads,
  public.livehaul_schedule
to authenticated;

create policy placement_closeouts_select_scoped
  on public.placement_closeouts for select to authenticated
  using (public.can_access_farm(farm_id));
create policy placement_closeouts_insert_scoped
  on public.placement_closeouts for insert to authenticated
  with check (public.can_write_farm(farm_id));
create policy placement_closeouts_update_scoped
  on public.placement_closeouts for update to authenticated
  using (public.can_write_farm(farm_id))
  with check (public.can_write_farm(farm_id));
create policy placement_closeouts_delete_scoped
  on public.placement_closeouts for delete to authenticated
  using (public.can_write_farm(farm_id));

create policy feed_inventory_snapshots_select_scoped
  on public.feed_inventory_snapshots for select to authenticated
  using (farm_id is not null and public.can_access_farm(farm_id));
create policy feed_inventory_snapshots_insert_scoped
  on public.feed_inventory_snapshots for insert to authenticated
  with check (farm_id is not null and public.can_write_farm(farm_id));
create policy feed_inventory_snapshots_update_scoped
  on public.feed_inventory_snapshots for update to authenticated
  using (farm_id is not null and public.can_write_farm(farm_id))
  with check (farm_id is not null and public.can_write_farm(farm_id));
create policy feed_inventory_snapshots_delete_scoped
  on public.feed_inventory_snapshots for delete to authenticated
  using (farm_id is not null and public.can_write_farm(farm_id));

create policy feed_order_commitments_select_scoped
  on public.feed_order_commitments for select to authenticated
  using (farm_id is not null and public.can_access_farm(farm_id));
create policy feed_order_commitments_insert_scoped
  on public.feed_order_commitments for insert to authenticated
  with check (farm_id is not null and public.can_write_farm(farm_id));
create policy feed_order_commitments_update_scoped
  on public.feed_order_commitments for update to authenticated
  using (farm_id is not null and public.can_write_farm(farm_id))
  with check (farm_id is not null and public.can_write_farm(farm_id));
create policy feed_order_commitments_delete_scoped
  on public.feed_order_commitments for delete to authenticated
  using (farm_id is not null and public.can_write_farm(farm_id));

create policy livehaul_schedule_select_scoped
  on public.livehaul_schedule for select to authenticated
  using (public.can_access_farm(farm_id));
create policy livehaul_schedule_insert_scoped
  on public.livehaul_schedule for insert to authenticated
  with check (public.can_write_farm(farm_id));
create policy livehaul_schedule_update_scoped
  on public.livehaul_schedule for update to authenticated
  using (public.can_write_farm(farm_id))
  with check (public.can_write_farm(farm_id));
create policy livehaul_schedule_delete_scoped
  on public.livehaul_schedule for delete to authenticated
  using (public.can_write_farm(farm_id));

create policy livehaul_loads_select_scoped
  on public.livehaul_loads for select to authenticated
  using (exists (
    select 1 from public.livehaul_schedule lhs
    where lhs.livehaul_id = livehaul_loads.livehaul_id
      and public.can_access_farm(lhs.farm_id)
  ));
create policy livehaul_loads_insert_scoped
  on public.livehaul_loads for insert to authenticated
  with check (exists (
    select 1 from public.livehaul_schedule lhs
    where lhs.livehaul_id = livehaul_loads.livehaul_id
      and public.can_write_farm(lhs.farm_id)
  ));
create policy livehaul_loads_update_scoped
  on public.livehaul_loads for update to authenticated
  using (exists (
    select 1 from public.livehaul_schedule lhs
    where lhs.livehaul_id = livehaul_loads.livehaul_id
      and public.can_write_farm(lhs.farm_id)
  ))
  with check (exists (
    select 1 from public.livehaul_schedule lhs
    where lhs.livehaul_id = livehaul_loads.livehaul_id
      and public.can_write_farm(lhs.farm_id)
  ));
create policy livehaul_loads_delete_scoped
  on public.livehaul_loads for delete to authenticated
  using (exists (
    select 1 from public.livehaul_schedule lhs
    where lhs.livehaul_id = livehaul_loads.livehaul_id
      and public.can_write_farm(lhs.farm_id)
  ));

-- App settings are configuration, not user content. Preserve authenticated
-- reads but remove the unconditional client mutation policies.
drop policy if exists app_settings_delete_authenticated on public.app_settings;
drop policy if exists app_settings_insert_authenticated on public.app_settings;
drop policy if exists app_settings_update_authenticated on public.app_settings;
revoke insert, update, delete, truncate, references, trigger
  on table public.app_settings from anon, authenticated;

-- Owner-rights identity and audit views are not client APIs. security_invoker
-- also prevents accidental re-exposure if a grant is added later.
alter view public.auth_audit_log_readable set (security_invoker = true);
alter view public.core_users_ui set (security_invoker = true);
alter view public.farm_group_memberships_ui set (security_invoker = true);
alter view public.farm_memberships_ui set (security_invoker = true);
alter view public.v_user_role_permissions set (security_invoker = true);

revoke all privileges on table
  public.auth_audit_log_readable,
  public.core_users_ui,
  public.farm_group_memberships_ui,
  public.farm_memberships_ui,
  public.v_user_role_permissions
from anon, authenticated;

-- All owner-privileged public functions become internal server APIs. Safe
-- boolean authorization helpers are explicitly re-exposed below.
do $block$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke all privileges on function %s from public, anon, authenticated',
      fn.signature
    );
    execute format(
      'grant execute on function %s to service_role',
      fn.signature
    );
  end loop;
end
$block$;

grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.can_access_farm(uuid) to anon, authenticated, service_role;
grant execute on function public.can_write_farm(uuid) to anon, authenticated, service_role;

commit;
