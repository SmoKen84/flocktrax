"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";

import {
  DOCUMENT_ARCHIVE_BUCKET,
  FEED_TICKET_DOCUMENT_ROLE,
} from "@/lib/document-archive";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

export type FeedTicketDocumentActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

type FeedTicketLookupRow = {
  id: string;
  ticket_num: string | null;
  delivery_date: string | null;
};

function coerce(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function coerceNullable(value: FormDataEntryValue | null) {
  const normalized = coerce(value);
  return normalized.length > 0 ? normalized : null;
}

async function getActorId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  return user?.id ?? null;
}

function sanitizePathPart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extensionForUpload(file: File) {
  const fileName = file.name.trim();
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex > -1 && dotIndex < fileName.length - 1) {
    return sanitizePathPart(fileName.slice(dotIndex + 1)).toLowerCase();
  }

  switch (file.type) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

function buildStoragePath(ticket: FeedTicketLookupRow, file: File) {
  const deliveryDate = ticket.delivery_date?.trim() || "undated";
  const ticketLabel = sanitizePathPart(ticket.ticket_num?.trim() || "ticket");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = extensionForUpload(file);

  return `feed-tickets/${deliveryDate}/${ticket.id}/${timestamp}-${ticketLabel}.${extension}`;
}

export async function uploadFeedTicketOriginalAction(
  _prevState: FeedTicketDocumentActionState,
  formData: FormData,
): Promise<FeedTicketDocumentActionState> {
  const admin = createSupabaseAdminClient();
  const actorId = await getActorId();

  if (!admin || !actorId) {
    return {
      status: "error",
      message: "A signed-in admin user is required to archive ticket originals.",
    };
  }

  const ticketId = coerce(formData.get("feed_ticket_id"));
  const sourceKind = coerce(formData.get("source_kind")) || "manual_upload";
  const notes = coerceNullable(formData.get("notes"));
  const fileValue = formData.get("document");

  if (!ticketId) {
    return {
      status: "error",
      message: "Feed ticket id is required.",
    };
  }

  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return {
      status: "error",
      message: "Choose a PDF or image file to archive.",
    };
  }

  if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
    return {
      status: "error",
      message: "Only PDF, JPG, PNG, HEIC, and HEIF originals are allowed.",
    };
  }

  if (fileValue.size > MAX_UPLOAD_BYTES) {
    return {
      status: "error",
      message: "The selected file is larger than the 20 MB archive limit.",
    };
  }

  const { data: ticketRows, error: ticketError } = await admin
    .from("feed_tickets")
    .select("id,ticket_num,delivery_date")
    .eq("id", ticketId)
    .limit(1);

  if (ticketError) {
    return {
      status: "error",
      message: ticketError.message,
    };
  }

  const ticket = (ticketRows?.[0] ?? null) as FeedTicketLookupRow | null;
  if (!ticket) {
    return {
      status: "error",
      message: "The selected feed ticket could not be found.",
    };
  }

  const storagePath = buildStoragePath(ticket, fileValue);
  const bytes = new Uint8Array(await fileValue.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_ARCHIVE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: fileValue.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return {
      status: "error",
      message: uploadError.message,
    };
  }

  const timestamp = new Date().toISOString();

  const { error: retireError } = await admin
    .from("document_archives")
    .update({
      is_current: false,
      replaced_at: timestamp,
      replaced_by: actorId,
    })
    .eq("feed_ticket_id", ticketId)
    .eq("document_role", FEED_TICKET_DOCUMENT_ROLE)
    .eq("is_current", true);

  if (retireError) {
    await admin.storage.from(DOCUMENT_ARCHIVE_BUCKET).remove([storagePath]);
    return {
      status: "error",
      message: retireError.message,
    };
  }

  const { error: insertError } = await admin.from("document_archives").insert({
    document_role: FEED_TICKET_DOCUMENT_ROLE,
    feed_ticket_id: ticketId,
    storage_bucket: DOCUMENT_ARCHIVE_BUCKET,
    storage_path: storagePath,
    original_filename: fileValue.name.trim() || "ticket-original",
    mime_type: fileValue.type || null,
    byte_size: fileValue.size,
    sha256,
    source_kind: sourceKind,
    notes,
    is_current: true,
    created_by: actorId,
  });

  if (insertError) {
    await admin.storage.from(DOCUMENT_ARCHIVE_BUCKET).remove([storagePath]);
    return {
      status: "error",
      message: insertError.message,
    };
  }

  revalidatePath("/admin/feed-tickets");

  return {
    status: "success",
    message: `Original archived for ticket ${ticket.ticket_num?.trim() || "record"}.`,
  };
}
