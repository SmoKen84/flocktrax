do $$
begin
  alter table public.document_archives
    drop constraint if exists document_archives_document_role_check;

  alter table public.document_archives
    add constraint document_archives_document_role_check
    check (
      document_role in (
        'hatch_ticket',
        'feed_ticket_original',
        'bill_of_lading',
        'scale_ticket',
        'closeout_sheet_snapshot',
        'misc_document'
      )
    );
end
$$;
