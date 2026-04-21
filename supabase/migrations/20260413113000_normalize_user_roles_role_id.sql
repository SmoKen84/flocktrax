alter table public.user_roles
  add column if not exists role_id uuid;

update public.user_roles ur
set role_id = r.id
from public.roles r
where ur.role_id is null
  and lower(btrim(ur.role)) = lower(btrim(r.code));

do $$
declare
  unresolved_count integer;
begin
  select count(*)
  into unresolved_count
  from public.user_roles
  where role_id is null;

  if unresolved_count > 0 then
    raise exception 'user_roles normalization failed: % rows could not be matched to public.roles.code', unresolved_count;
  end if;
end $$;

delete from public.user_roles ur
using (
  select
    ctid,
    row_number() over (
      partition by user_id, role_id
      order by created_at nulls last, role
    ) as row_num
  from public.user_roles
) ranked
where ur.ctid = ranked.ctid
  and ranked.row_num > 1;

alter table public.user_roles
  alter column role_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_role_id_fkey'
      and conrelid = 'public.user_roles'::regclass
  ) then
    alter table public.user_roles
      add constraint user_roles_role_id_fkey
      foreign key (role_id) references public.roles(id) on delete cascade;
  end if;
end $$;

drop index if exists public.idx_user_roles_user_role;

create index if not exists idx_user_roles_user_role_id
  on public.user_roles (user_id, role_id);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_pkey'
      and conrelid = 'public.user_roles'::regclass
  ) then
    alter table public.user_roles
      drop constraint user_roles_pkey;
  end if;
end $$;

alter table public.user_roles
  add constraint user_roles_pkey primary key (user_id, role_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and (
        lower(r.code) = 'admin'
        or lower(r.code) = 'superadmin'
        or lower(r.code) = 'super_admin'
      )
  );
$$;

comment on column public.user_roles.role_id is 'Normalized foreign key to public.roles.id';
comment on column public.user_roles.role is 'Legacy role code retained temporarily for compatibility; role_id is authoritative.';
