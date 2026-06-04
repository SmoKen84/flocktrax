alter table public.livehaul_schedule
  add column if not exists target_sex text;

comment on column public.livehaul_schedule.target_sex is
  'Optional sex target for the livehaul event so breed comparisons can be evaluated against the correct male or female standard.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'livehaul_schedule_target_sex_check'
      and conrelid = 'public.livehaul_schedule'::regclass
  ) then
    alter table public.livehaul_schedule
      add constraint livehaul_schedule_target_sex_check
      check (target_sex is null or target_sex in ('male', 'female'));
  end if;
end
$$;
