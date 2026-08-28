alter table public.farms
add column if not exists latitude numeric,
add column if not exists longitude numeric;

comment on column public.farms.latitude is 'Farm latitude in decimal degrees for services such as weather lookup.';
comment on column public.farms.longitude is 'Farm longitude in decimal degrees for services such as weather lookup.';
