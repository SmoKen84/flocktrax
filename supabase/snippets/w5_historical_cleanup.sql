begin;

update public.placements
set
  date_removed = '2026-02-14',
  is_active = false,
  updated_at = now()
where placement_key = '264-W5';

update public.flocks
set
  flock_removed = '2026-02-14',
  is_active = false,
  is_in_barn = false,
  is_complete = true,
  updated_at = now()
where id = (
  select flock_id
  from public.placements
  where placement_key = '264-W5'
);

update public.placements
set
  date_removed = '2026-04-17',
  is_active = false,
  updated_at = now()
where placement_key = '282-W5';

update public.flocks
set
  flock_removed = '2026-04-17',
  is_active = false,
  is_in_barn = false,
  is_complete = true,
  updated_at = now()
where id = (
  select flock_id
  from public.placements
  where placement_key = '282-W5'
);

commit;
