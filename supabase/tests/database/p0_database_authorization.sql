-- Catalog-level regression checks for P0 database authorization containment.
-- Run against a disposable/local database after migrations are applied:
--   psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/p0_database_authorization.sql

begin;

do $test$
declare
  table_name text;
  unsafe_policy_count integer;
  unsafe_function_count integer;
begin
  foreach table_name in array array[
    'placement_closeouts', 'activity_log', 'app_users', 'core_users',
    'document_archives', 'farm_group_memberships', 'feed_inventory_snapshots',
    'feed_order_commitments', 'livehaul_loads', 'livehaul_schedule',
    'role_permissions'
  ]
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity
    ) then
      raise exception 'P0 regression: public.% does not have RLS enabled', table_name;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.user_roles', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_roles', 'UPDATE') then
    raise exception 'P0 regression: user_roles is client-writable';
  end if;

  if has_table_privilege('anon', 'public.farm_memberships', 'INSERT')
     or has_table_privilege('authenticated', 'public.farm_memberships', 'INSERT')
     or has_table_privilege('authenticated', 'public.farm_memberships', 'UPDATE') then
    raise exception 'P0 regression: farm_memberships is client-writable';
  end if;

  if has_table_privilege('anon', 'public.farm_group_memberships', 'INSERT')
     or has_table_privilege('authenticated', 'public.farm_group_memberships', 'INSERT')
     or has_table_privilege('authenticated', 'public.farm_group_memberships', 'UPDATE') then
    raise exception 'P0 regression: farm_group_memberships is client-writable';
  end if;

  select count(*)
  into unsafe_policy_count
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'barns', 'farms', 'flocks', 'placements',
      'log_daily', 'log_mortality', 'log_weight'
    )
    and (
      coalesce(pg_get_expr(p.polqual, p.polrelid), '') = 'true'
      or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') = 'true'
    )
    and exists (
      select 1
      from unnest(p.polroles) role_oid
      join pg_roles r on r.oid = role_oid
      where r.rolname in ('anon', 'authenticated')
    );

  if unsafe_policy_count <> 0 then
    raise exception 'P0 regression: % unconditional farm/log client policies remain', unsafe_policy_count;
  end if;

  if has_table_privilege('anon', 'public.auth_audit_log_readable', 'SELECT')
     or has_table_privilege('authenticated', 'public.auth_audit_log_readable', 'SELECT')
     or has_table_privilege('anon', 'public.core_users_ui', 'SELECT')
     or has_table_privilege('authenticated', 'public.farm_memberships_ui', 'SELECT') then
    raise exception 'P0 regression: a sensitive owner-rights view remains client-readable';
  end if;

  select count(*)
  into unsafe_function_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.proname not in (
      'is_admin',
      'can_access_farm',
      'can_write_farm',
      'can_perform_farm_action',
      'save_log_daily_mobile',
      'save_log_mortality_mobile',
      'save_log_weight_mobile'
    )
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if unsafe_function_count <> 0 then
    raise exception 'P0 regression: % privileged functions remain client-executable', unsafe_function_count;
  end if;
end
$test$;

-- Exercise the effective RLS behavior with one active farm assignment and one
-- inactive assignment. Fixed IDs keep this test deterministic and the outer
-- transaction ensures that no fixture survives the run.
insert into auth.users (id, email, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', 'p0-active@example.invalid', now(), now());

insert into public.roles (id, code, description)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'FarmManager', 'P0 test role');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

insert into public.farms (
  id, farm_code, farm_name, updated_by, created_by
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P0-ACTIVE', 'P0 Active Farm',
    '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'P0-INACTIVE', 'P0 Inactive Farm',
    '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'
  );

insert into public.barns (id, farm_id, barn_code, created_by)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'P0-A',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'P0-B',
    '11111111-1111-1111-1111-111111111111'
  );

insert into public.farm_memberships (user_id, farm_id, role_id, is_active)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    false
  );

set local role authenticated;

do $behavior$
declare
  visible_barns integer;
  changed_rows integer;
begin
  if not public.can_access_farm('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
     or not public.can_write_farm('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then
    raise exception 'P0 regression: active farm-manager membership is not honored';
  end if;

  if public.can_access_farm('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
     or public.can_write_farm('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') then
    raise exception 'P0 regression: inactive membership grants farm access';
  end if;

  select count(*) into visible_barns from public.barns;
  if visible_barns <> 1 then
    raise exception 'P0 regression: expected 1 scoped barn, observed %', visible_barns;
  end if;

  update public.barns
  set barn_code = 'P0-B-BLOCKED'
  where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 0 then
    raise exception 'P0 regression: inactive cross-farm barn update was allowed';
  end if;
end
$behavior$;

reset role;

rollback;
