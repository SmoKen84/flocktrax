create table if not exists public.breeds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  breed_name text not null,
  sex text null check (sex in ('male', 'female', 'unsexed')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.breeds is 'Breed lookup for flock male/female selections.';
comment on column public.breeds.code is 'Stable application code for the breed option.';
comment on column public.breeds.breed_name is 'Human-readable breed family or line name.';
comment on column public.breeds.sex is 'Optional sex-specific variant for the breed option.';

create unique index if not exists breeds_name_sex_key
  on public.breeds (breed_name, coalesce(sex, ''));

create or replace trigger trg_breeds_updated_at
before update on public.breeds
for each row execute function public.set_updated_at();

insert into public.breeds (code, breed_name, sex, is_active)
select distinct
  lower(
    regexp_replace(
      coalesce(nullif(trim(geneticname), ''), 'breed') || '-' ||
      coalesce(
        case
          when lower(trim(breedid)) in ('male', 'female') then lower(trim(breedid))
          else nullif(lower(trim(breedid)), '')
        end,
        'unsexed'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  ) as code,
  coalesce(nullif(trim(geneticname), ''), 'Breed') as breed_name,
  case
    when lower(trim(breedid)) = 'male' then 'male'
    when lower(trim(breedid)) = 'female' then 'female'
    else 'unsexed'
  end as sex,
  coalesce(is_active, true) as is_active
from public.stdbreedspec
where nullif(trim(geneticname), '') is not null
on conflict (code) do update
set
  breed_name = excluded.breed_name,
  sex = excluded.sex,
  is_active = excluded.is_active;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'flocks_breed_males_fkey'
  ) then
    alter table public.flocks
      add constraint flocks_breed_males_fkey
      foreign key (breed_males) references public.breeds(id)
      on update cascade
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'flocks_breed_females_fkey'
  ) then
    alter table public.flocks
      add constraint flocks_breed_females_fkey
      foreign key (breed_females) references public.breeds(id)
      on update cascade
      on delete set null;
  end if;
end $$;

alter table public.breeds enable row level security;

drop policy if exists anon_read_breeds on public.breeds;
create policy anon_read_breeds
on public.breeds
for select
to anon
using (true);

drop policy if exists auth_read_breeds on public.breeds;
create policy auth_read_breeds
on public.breeds
for select
to authenticated
using (true);

drop policy if exists admin_all_breeds on public.breeds;
create policy admin_all_breeds
on public.breeds
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant all on table public.breeds to anon;
grant all on table public.breeds to authenticated;
grant all on table public.breeds to service_role;
grant select, insert, update, delete on table public.breeds to admin;
