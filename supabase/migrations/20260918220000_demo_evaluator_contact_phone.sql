begin;
do $$ begin
 if not exists(select 1 from demo_control.environment where singleton and project_ref='srkgobayrzidytmvoago' and owner_user_id='ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a'::uuid) then
  raise exception 'Demo project required';
 end if;
end $$;
alter table public.demo_evaluators add column contact_phone text not null default '' check (length(contact_phone)<=50);
comment on column public.demo_evaluators.contact_phone is 'Private owner-only evaluator contact phone; never added to Auth metadata.';
commit;
