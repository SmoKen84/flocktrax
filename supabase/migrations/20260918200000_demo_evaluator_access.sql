begin;
do $$
begin
  if not exists(select 1 from demo_control.environment where singleton
    and project_ref='srkgobayrzidytmvoago'
    and owner_user_id='ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a'::uuid) then
    raise exception 'Evaluator access migration is restricted to the isolated demo project';
  end if;
end $$;

create table public.demo_evaluators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text unique not null check (alias ~ '^evaluator-[a-f0-9]{12}$'),
  contact_name text not null,
  contact_email text not null,
  company text not null default '',
  role_code text not null check(role_code in ('farm_manager','flock_supervisor')),
  -- No farm FK: showcase reset truncates farms with CASCADE; keep the private register.
  farm_id uuid not null,
  expires_at timestamptz not null,
  disabled_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.demo_access_links (
  token_hash text primary key,
  user_id uuid unique not null references public.demo_evaluators(user_id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.demo_access_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.demo_evaluators(user_id) on delete cascade,
  kind text not null check(kind in ('login','page_view','setup')),
  path text,
  client text not null default 'web' check(client in ('web','mobile')),
  created_at timestamptz not null default now()
);
create index on public.demo_access_events(user_id,created_at desc);
alter table public.demo_evaluators enable row level security;
alter table public.demo_access_links enable row level security;
alter table public.demo_access_events enable row level security;
revoke all on public.demo_evaluators,public.demo_access_links,public.demo_access_events from anon, authenticated;
grant all on public.demo_evaluators,public.demo_access_links,public.demo_access_events to service_role;
grant usage,select on sequence public.demo_access_events_id_seq to service_role;

create function public.demo_evaluator_status()
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
select coalesce(
 (select jsonb_build_object('evaluator',true,'active',disabled_at is null and expires_at>now(),
   'alias',alias,'expires_at',expires_at,'accepted',accepted_at is not null)
  from public.demo_evaluators where user_id=auth.uid()),
 '{"evaluator":false}'::jsonb);
$$;
revoke all on function public.demo_evaluator_status() from public,anon;
grant execute on function public.demo_evaluator_status() to authenticated;

create function public.claim_demo_access_link(p_hash text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid;
begin
  update public.demo_access_links l set used_at=now()
  where token_hash=p_hash and used_at is null and l.expires_at>now()
    and exists(select 1 from public.demo_evaluators e where e.user_id=l.user_id
      and e.disabled_at is null and e.expires_at>now())
  returning l.user_id into v_user;
  return v_user;
end $$;
revoke all on function public.claim_demo_access_link(text) from public,anon,authenticated;
grant execute on function public.claim_demo_access_link(text) to service_role;

-- Existing sessions must also stop working after expiration or revocation.
create function public.demo_evaluator_session_allowed()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
select not exists(select 1 from public.demo_evaluators where user_id=auth.uid()
  and (disabled_at is not null or expires_at<=now()));
$$;
revoke all on function public.demo_evaluator_session_allowed() from public,anon;
grant execute on function public.demo_evaluator_session_allowed() to authenticated;

do $$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='public'
   and tablename not like 'demo_%'
 loop
   execute format('alter table public.%I enable row level security',t.tablename);
   execute format('create policy demo_evaluator_expiration on public.%I as restrictive for all to authenticated using (public.demo_evaluator_session_allowed()) with check (public.demo_evaluator_session_allowed())',t.tablename);
 end loop;
end $$;
-- Evaluators cannot grant themselves roles or farm access through the public API.
create function public.is_demo_evaluator()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
select exists(select 1 from public.demo_evaluators where user_id=auth.uid());
$$;
revoke all on function public.is_demo_evaluator() from public,anon;
grant execute on function public.is_demo_evaluator() to authenticated;
do $$
declare t text;
begin
 foreach t in array array['user_roles','farm_memberships','farm_group_memberships','roles','roles_actions_permissions','app_settings']
 loop
  if to_regclass('public.'||t) is not null then
   execute format('create policy demo_no_access_grants_insert on public.%I as restrictive for insert to authenticated with check (not public.is_demo_evaluator())',t);
   execute format('create policy demo_no_access_grants_update on public.%I as restrictive for update to authenticated using (not public.is_demo_evaluator()) with check (not public.is_demo_evaluator())',t);
   execute format('create policy demo_no_access_grants_delete on public.%I as restrictive for delete to authenticated using (not public.is_demo_evaluator())',t);
  end if;
 end loop;
end $$;
commit;
