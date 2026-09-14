alter table public.feedbins
  add column if not exists binsentry_last_bulk_density_kg_m3 numeric,
  add column if not exists binsentry_last_bulk_density_lb_ft3 numeric,
  add column if not exists binsentry_last_estimated_volume_m3 numeric,
  add column if not exists binsentry_last_weight_source text;

comment on column public.feedbins.binsentry_last_bulk_density_kg_m3 is
  'Most recent bulk density returned by BinSentry for the bin, in kilograms per cubic meter.';

comment on column public.feedbins.binsentry_last_bulk_density_lb_ft3 is
  'Most recent BinSentry bulk density converted to pounds per cubic foot for operator visibility.';

comment on column public.feedbins.binsentry_last_estimated_volume_m3 is
  'Most recent estimated BinSentry inventory volume in cubic meters.';

comment on column public.feedbins.binsentry_last_weight_source is
  'Source field or calculation used for the cached BinSentry inventory pounds.';
