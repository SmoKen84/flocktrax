insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flocktrax-document-archive',
  'flocktrax-document-archive',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.document_archives (
  id uuid primary key default gen_random_uuid(),
  document_role text not null,
  placement_id uuid null references public.placements(id) on delete cascade,
  feed_ticket_id uuid null references public.feed_tickets(id) on delete cascade,
  livehaul_schedule_id uuid null references public.livehaul_schedule(livehaul_id) on delete cascade,
  livehaul_load_id uuid null references public.livehaul_loads(load_id) on delete cascade,
  placement_closeout_id uuid null references public.placement_closeouts(placement_id) on delete cascade,
  storage_bucket text not null default 'flocktrax-document-archive',
  storage_path text not null,
  original_filename text not null,
  mime_type text null,
  byte_size bigint null,
  sha256 text null,
  source_kind text not null default 'manual_upload',
  captured_at timestamp with time zone null,
  notes text null,
  is_current boolean not null default true,
  replaced_at timestamp with time zone null,
  replaced_by uuid null,
  created_at timestamp with time zone not null default now(),
  created_by uuid null default auth.uid()
);

comment on table public.document_archives is
  'Immutable audit-document archive metadata for FlockTrax records. Originals live in private Supabase Storage and are reopened from linked records.';

comment on column public.document_archives.document_role is
  'Business role of the archived document such as hatch_ticket, feed_ticket_original, bill_of_lading, scale_ticket, or closeout_sheet_snapshot.';

comment on column public.document_archives.source_kind is
  'Acquisition path for the original document such as scanner_pdf, mobile_camera, manual_upload, sheet_export, or backfill_import.';

comment on column public.document_archives.is_current is
  'True when this row is the latest active archive version for its linked record and role.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_archives_document_role_check'
      and conrelid = 'public.document_archives'::regclass
  ) then
    alter table public.document_archives
      add constraint document_archives_document_role_check
      check (
        document_role in (
          'hatch_ticket',
          'feed_ticket_original',
          'bill_of_lading',
          'scale_ticket',
          'closeout_sheet_snapshot'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_archives_source_kind_check'
      and conrelid = 'public.document_archives'::regclass
  ) then
    alter table public.document_archives
      add constraint document_archives_source_kind_check
      check (
        source_kind in (
          'scanner_pdf',
          'mobile_camera',
          'manual_upload',
          'sheet_export',
          'backfill_import'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_archives_parent_reference_check'
      and conrelid = 'public.document_archives'::regclass
  ) then
    alter table public.document_archives
      add constraint document_archives_parent_reference_check
      check (
        num_nonnulls(
          placement_id,
          feed_ticket_id,
          livehaul_schedule_id,
          livehaul_load_id,
          placement_closeout_id
        ) = 1
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_archives_byte_size_check'
      and conrelid = 'public.document_archives'::regclass
  ) then
    alter table public.document_archives
      add constraint document_archives_byte_size_check
      check (byte_size is null or byte_size >= 0);
  end if;
end
$$;

create unique index if not exists ux_document_archives_storage_path
  on public.document_archives (storage_bucket, storage_path);

create index if not exists ix_document_archives_feed_ticket_current
  on public.document_archives (feed_ticket_id, document_role, is_current, created_at desc)
  where feed_ticket_id is not null;

create index if not exists ix_document_archives_placement_current
  on public.document_archives (placement_id, document_role, is_current, created_at desc)
  where placement_id is not null;

create index if not exists ix_document_archives_livehaul_schedule_current
  on public.document_archives (livehaul_schedule_id, document_role, is_current, created_at desc)
  where livehaul_schedule_id is not null;

create index if not exists ix_document_archives_livehaul_load_current
  on public.document_archives (livehaul_load_id, document_role, is_current, created_at desc)
  where livehaul_load_id is not null;

create index if not exists ix_document_archives_closeout_current
  on public.document_archives (placement_closeout_id, document_role, is_current, created_at desc)
  where placement_closeout_id is not null;
