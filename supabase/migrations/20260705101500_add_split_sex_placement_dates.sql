alter table public.flocks
  add column if not exists female_date_placed date,
  add column if not exists male_date_placed date;

update public.flocks
set
  female_date_placed = coalesce(female_date_placed, date_placed),
  male_date_placed = coalesce(male_date_placed, date_placed)
where date_placed is not null;

comment on column public.flocks.female_date_placed is
  'Arrival date for female birds when a flock is placed across multiple days. Defaults to the primary placement date.';

comment on column public.flocks.male_date_placed is
  'Arrival date for male birds when a flock is placed across multiple days. Defaults to the primary placement date.';
