begin;
do $$ begin
 if not exists(select 1 from demo_control.environment where singleton and project_ref='srkgobayrzidytmvoago' and owner_user_id='ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a'::uuid) then
  raise exception 'Demo project required';
 end if;
end $$;
alter table public.demo_evaluators drop constraint demo_evaluators_role_code_check;
alter table public.demo_evaluators add constraint demo_evaluators_role_code_check check(role_code in ('integrator_manager','farm_manager','flock_supervisor'));
alter table public.demo_evaluators alter column farm_id drop not null;
alter table public.demo_evaluators add constraint demo_evaluator_scope_check check(role_code='integrator_manager' or farm_id is not null);
create or replace function public.demo_evaluator_status()
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
select coalesce((select jsonb_build_object('evaluator',true,'active',disabled_at is null and expires_at>now(),
 'alias',alias,'expires_at',expires_at,'accepted',accepted_at is not null,'role_code',role_code)
 from public.demo_evaluators where user_id=auth.uid()),'{"evaluator":false}'::jsonb);
$$;
create function public.demo_integrator_access()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.demo_evaluators where user_id=auth.uid() and role_code='integrator_manager'
 and disabled_at is null and expires_at>now() and accepted_at is not null);
$$;
revoke all on function public.demo_integrator_access() from public;
grant execute on function public.demo_integrator_access() to authenticated,service_role;
-- Preserve the existing farm authorization expression and its function identity/grants.
do $$ declare f text; body text; begin
 foreach f in array array['can_access_farm','can_write_farm'] loop
  select p.prosrc into strict body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname=f and p.oid=to_regprocedure('public.'||f||'(uuid)') and p.prolang=(select oid from pg_language where lanname='sql');
  execute format('create or replace function public.%I(target_farm_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as %L',f,
   'select public.demo_integrator_access() or ('||regexp_replace(body, '[;[:space:]]+$', '')||');');
 end loop;
end $$;
create policy demo_integrator_read on public.farm_groups for select to authenticated using(public.demo_integrator_access());
create policy demo_integrator_read on public.farms for select to authenticated using(public.demo_integrator_access());
create policy demo_integrator_read on public.barns for select to authenticated using(public.demo_integrator_access());
commit;
