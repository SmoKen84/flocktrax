-- Bind the manually created demo Auth user to the application owner role.
-- This migration is intentionally demo-project-specific and refuses to run
-- unless the expected Auth user is already present.

do $$
declare
  demo_owner_id constant uuid := 'ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a';
  demo_owner_email constant text := 'ken@mothercluckershenhouse.com';
  seeded_super_admin_role_id constant uuid := 'de000000-0000-4000-8000-000000000001';
  super_admin_role_id uuid;
begin
  if not exists (
    select 1
    from auth.users
    where id = demo_owner_id
      and lower(email) = demo_owner_email
  ) then
    raise exception
      'Demo owner Auth user % (%) does not exist; refusing to seed access',
      demo_owner_email,
      demo_owner_id;
  end if;

  insert into public.roles (id, code, description)
  values (
    seeded_super_admin_role_id,
    'super_admin',
    'Demo platform owner with full administrative authority.'
  )
  on conflict (code) do update
    set description = excluded.description;

  select id
    into super_admin_role_id
  from public.roles
  where lower(replace(code, '-', '_')) in ('super_admin', 'superadmin')
  order by case when lower(replace(code, '-', '_')) = 'super_admin' then 0 else 1 end
  limit 1;

  insert into public.core_users (id)
  values (demo_owner_id)
  on conflict (id) do nothing;

  insert into public.profiles (id, email, full_name)
  values (demo_owner_id, demo_owner_email, 'Ken Smotherman')
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();

  insert into public.app_users (
    user_id,
    adalo_user_id,
    email,
    display_name,
    active
  )
  values (
    demo_owner_id,
    'demo-owner-' || demo_owner_id::text,
    demo_owner_email,
    'Ken Smotherman',
    true
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        active = true;

  insert into public.user_roles (user_id, role, role_id)
  values (demo_owner_id, 'super_admin', super_admin_role_id)
  on conflict (user_id, role_id) do update
    set role = excluded.role,
        updated_at = now();
end
$$;
