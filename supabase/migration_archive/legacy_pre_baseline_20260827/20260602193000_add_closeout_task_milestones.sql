alter table public.placement_closeouts
  add column if not exists livehaul_complete_at timestamp with time zone,
  add column if not exists livehaul_complete_by uuid,
  add column if not exists feed_verified_at timestamp with time zone,
  add column if not exists feed_verified_by uuid,
  add column if not exists invoice_created_at timestamp with time zone,
  add column if not exists invoice_created_by uuid,
  add column if not exists closeout_completed_at timestamp with time zone,
  add column if not exists closeout_completed_by uuid;

comment on column public.placement_closeouts.livehaul_complete_at is
  'Timestamp when livehaul reconciliation and load entry were confirmed complete for closeout.';

comment on column public.placement_closeouts.livehaul_complete_by is
  'Authenticated user who marked livehaul reconciliation complete.';

comment on column public.placement_closeouts.feed_verified_at is
  'Timestamp when closeout feed totals were verified against ticket activity.';

comment on column public.placement_closeouts.feed_verified_by is
  'Authenticated user who verified closeout feed totals.';

comment on column public.placement_closeouts.invoice_created_at is
  'Timestamp when the invoice or settlement-facing closeout document was created.';

comment on column public.placement_closeouts.invoice_created_by is
  'Authenticated user who marked the invoice-created milestone complete.';

comment on column public.placement_closeouts.closeout_completed_at is
  'Timestamp when all closeout tasks were complete and the flock was ready for final archive.';

comment on column public.placement_closeouts.closeout_completed_by is
  'Authenticated user who marked the closeout-complete milestone.';
