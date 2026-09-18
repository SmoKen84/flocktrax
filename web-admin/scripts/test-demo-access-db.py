from pathlib import Path
import subprocess, uuid
root=Path(__file__).resolve().parents[2]
db='codex_eval_test_'+uuid.uuid4().hex[:10]
def run(args,sql=None):
 r=subprocess.run(['docker','exec']+(['-i'] if sql else [])+['supabase_db_FlockTrax']+args,input=sql,text=True,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout
setup="""
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema demo_control;
create table demo_control.environment(singleton boolean, project_ref text,owner_user_id uuid);
insert into demo_control.environment values(true,'srkgobayrzidytmvoago','ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a');
create table public.farms(id uuid primary key);
create table public.farm_groups(id uuid primary key);
create table public.barns(id uuid primary key);
create function public.can_access_farm(target_farm_id uuid) returns boolean language sql stable as $$
 select target_farm_id='00000000-0000-0000-0000-000000000099'::uuid;
 $$;
create function public.can_write_farm(target_farm_id uuid) returns boolean language sql stable as $$ select false $$;
create table public.user_roles(user_id uuid,role_id uuid);
grant all on public.user_roles to authenticated;
alter table public.user_roles enable row level security;
create policy original_access on public.user_roles for all to authenticated using(true) with check(true);
"""
tests="""
insert into auth.users values('00000000-0000-0000-0000-000000000001');
insert into demo_evaluators(user_id,alias,contact_name,contact_email,role_code,farm_id,expires_at)
values('00000000-0000-0000-0000-000000000001','evaluator-abcdef123456','Private Name','private@example.com','farm_manager',gen_random_uuid(),now()+interval '1 day');
insert into demo_access_links(token_hash,user_id,expires_at)
values('one','00000000-0000-0000-0000-000000000001',now()+interval '1 hour');
do $$ begin
 assert claim_demo_access_link('one') is not null, 'first use';
 assert claim_demo_access_link('one') is null, 'replay blocked';
 assert claim_demo_access_link('expired') is null, 'expired link blocked';
 assert claim_demo_access_link('invalid') is null, 'unknown token blocked';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
do $$ begin
 assert (public.demo_evaluator_status()->>'active')::boolean, 'active status';
 begin
  perform * from public.demo_evaluators;
  raise exception 'Private register leaked';
 exception when insufficient_privilege then null; end;
 begin
  perform public.claim_demo_access_link('one');
  raise exception 'Claim RPC exposed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.user_roles values(auth.uid(),gen_random_uuid());
  raise exception 'Self role grant allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from demo_access_links;
insert into demo_access_links(token_hash,user_id,expires_at) values('expired','00000000-0000-0000-0000-000000000001',now()-interval '1 second');
do $$ begin assert claim_demo_access_link('expired') is null, 'expired link blocked'; end $$;
delete from demo_access_links;
update demo_evaluators set disabled_at=now();
insert into demo_access_links(token_hash,user_id,expires_at) values('disabled','00000000-0000-0000-0000-000000000001',now()+interval '1 hour');
do $$ begin
 assert not demo_evaluator_session_allowed(), 'existing session disabled';
 assert claim_demo_access_link('disabled') is null, 'disabled setup blocked';
end $$;
update demo_evaluators set disabled_at=null,expires_at=now()-interval '1 second';
do $$ begin
 assert not demo_evaluator_session_allowed(), 'expired session blocked';
end $$;
-- No cascading farm deletion can remove the private registry.
truncate public.farms cascade;
do $$ begin assert (select count(*)=1 from demo_evaluators), 'register survives reset'; end $$;
"""
integrator_tests="""
update demo_evaluators set role_code='integrator_manager',farm_id=null,disabled_at=null,expires_at=now()+interval '1 day',accepted_at=now();
do $$ begin
 assert demo_integrator_access(), 'integrator active';
 assert demo_evaluator_status()->>'role_code'='integrator_manager', 'trusted role';
 assert can_access_farm(gen_random_uuid()), 'all future farms readable';
 assert can_write_farm(gen_random_uuid()), 'all future farms writable';
end $$;
update demo_evaluators set disabled_at=now();
do $$ begin assert not demo_integrator_access(), 'disabled integrator'; assert not can_write_farm(gen_random_uuid()), 'disabled write'; end $$;
update demo_evaluators set disabled_at=null,expires_at=now()-interval '1 day';
do $$ begin assert not demo_integrator_access(), 'expired integrator'; end $$;
update demo_evaluators set role_code='farm_manager',farm_id=gen_random_uuid(),expires_at=now()+interval '1 day';
do $$ begin
 assert not demo_integrator_access(), 'ordinary evaluator not broadened';
 assert not can_access_farm(gen_random_uuid()), 'ordinary farm scope';
 assert can_access_farm('00000000-0000-0000-0000-000000000099'), 'original authorization preserved';
end $$;
"""
try:
 run(['createdb','-U','postgres',db])
 run(['psql','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],setup)
 migration=(root/'supabase/migrations/20260918200000_demo_evaluator_access.sql').read_text()
 run(['psql','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],migration+(root/'supabase/migrations/20260918210000_demo_integrator_evaluator.sql').read_text()+tests+integrator_tests)
 print('PASS: setup links, replay/expiry/revocation, private register, role escalation, session gate, reset preservation')
finally:
 run(['dropdb','-U','postgres',db])
