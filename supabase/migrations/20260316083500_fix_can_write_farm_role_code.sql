create or replace function public.can_write_farm(target_farm_id uuid)
returns boolean
language sql
stable
as $$
  select
    (select public.is_admin())
    or exists (
      select 1
      from public.farm_memberships fm
      join public.roles r on r.id = fm.role_id
      where fm.user_id = (select auth.uid())
        and fm.farm_id = target_farm_id
        and fm.is_active = true
        and r.code in ('admin', 'manager')
    );
$$;

alter function public.can_write_farm(uuid) owner to postgres;
