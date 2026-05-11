"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDefaultIssueTypes } from "@/lib/issues";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

function readTrimmedString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildReturnLocation(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `/admin/issues?${query}` : "/admin/issues";
}

export async function createIssueAction(formData: FormData) {
  const serverClient = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (!serverClient || !adminClient) {
    redirect(buildReturnLocation({ error: "Supabase is not configured." }));
  }

  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    redirect(buildReturnLocation({ error: "You must be signed in to create an action item." }));
  }

  const placementId = readTrimmedString(formData, "placement_id");
  const issueType = readTrimmedString(formData, "issue_type");
  const title = readTrimmedString(formData, "title");
  const description = readTrimmedString(formData, "description");
  const reportedLogDate = readTrimmedString(formData, "reported_log_date");

  if (!placementId) {
    redirect(buildReturnLocation({ error: "Choose a live placement before opening an issue." }));
  }

  const { data: placement, error: placementError } = await adminClient
    .from("placements")
    .select("id,barn_id,placement_key")
    .eq("id", placementId)
    .maybeSingle();

  if (placementError || !placement) {
    redirect(buildReturnLocation({ error: "The selected placement could not be found." }));
  }

  const issueTypeLookup = await resolveIssueType(adminClient, issueType);
  if (!issueTypeLookup) {
    redirect(buildReturnLocation({ placementId, error: "Choose a valid action-item type." }));
  }

  const entityId = issueTypeLookup.entityType === "barn" ? placement.barn_id : placement.id;
  const normalizedTitle = title || issueTypeLookup.label;

  const { data: insertedIssue, error } = await adminClient
    .from("issues")
    .insert({
      entity_type: issueTypeLookup.entityType,
      entity_id: entityId,
      issue_type: issueType,
      title: normalizedTitle,
      description: description || null,
      status: "open",
      related_placement_id: placement.id,
      reported_log_date: reportedLogDate || null,
      opened_at: new Date().toISOString(),
      opened_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    redirect(buildReturnLocation({ placementId, error: error.message }));
  }

  if (insertedIssue?.id) {
    const openingText =
      description || `${normalizedTitle} logged from action-items console.`;

    await adminClient.from("issue_updates").insert({
      issue_id: insertedIssue.id,
      entry_type: "opened",
      entry_text: openingText,
      effective_date: reportedLogDate || null,
      created_by: user.id,
    });
  }

  revalidatePath("/admin/overview");
  revalidatePath("/admin/issues");

  redirect(buildReturnLocation({ placementId, notice: `${normalizedTitle} opened.` }));
}

export async function resolveIssueAction(formData: FormData) {
  const serverClient = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (!serverClient || !adminClient) {
    redirect(buildReturnLocation({ error: "Supabase is not configured." }));
  }

  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    redirect(buildReturnLocation({ error: "You must be signed in to resolve an action item." }));
  }

  const issueId = readTrimmedString(formData, "issue_id");
  const placementId = readTrimmedString(formData, "placement_id");
  const resolutionNote = readTrimmedString(formData, "resolution_note");

  if (!issueId) {
    redirect(buildReturnLocation({ placementId, error: "Action-item id is missing." }));
  }

  const { data: issue, error: issueError } = await adminClient
    .from("issues")
    .select("id,status")
    .eq("id", issueId)
    .maybeSingle();

  if (issueError || !issue) {
    redirect(buildReturnLocation({ placementId, error: "The selected action item could not be found." }));
  }

  if (issue.status === "resolved") {
    redirect(buildReturnLocation({ placementId, issueId, notice: "This action item is already resolved." }));
  }

  const { error } = await adminClient
    .from("issues")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_note: resolutionNote || null,
    })
    .eq("id", issueId)
    .eq("status", "open");

  if (error) {
    redirect(buildReturnLocation({ placementId, error: error.message }));
  }

  await adminClient.from("issue_updates").insert({
    issue_id: issueId,
    entry_type: "resolved",
    entry_text: resolutionNote || "Action item resolved from admin console.",
    effective_date: new Date().toISOString().slice(0, 10),
    created_by: user.id,
  });

  revalidatePath("/admin/overview");
  revalidatePath("/admin/issues");

  redirect(buildReturnLocation({ placementId, notice: "Action item resolved." }));
}

export async function addIssueUpdateAction(formData: FormData) {
  const serverClient = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (!serverClient || !adminClient) {
    redirect(buildReturnLocation({ error: "Supabase is not configured." }));
  }

  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    redirect(buildReturnLocation({ error: "You must be signed in to post an update." }));
  }

  const issueId = readTrimmedString(formData, "issue_id");
  const placementId = readTrimmedString(formData, "placement_id");
  const entryType = readTrimmedString(formData, "entry_type");
  const entryText = readTrimmedString(formData, "entry_text");
  const effectiveDate = readTrimmedString(formData, "effective_date");

  if (!issueId) {
    redirect(buildReturnLocation({ placementId, error: "Action-item id is missing." }));
  }

  if (!entryText) {
    redirect(buildReturnLocation({ placementId, error: "Enter an update before posting it." }));
  }

  const { data: issue, error: issueError } = await adminClient
    .from("issues")
    .select("id,status")
    .eq("id", issueId)
    .maybeSingle();

  if (issueError || !issue) {
    redirect(buildReturnLocation({ placementId, error: "The selected action item could not be found." }));
  }

  if (issue.status === "resolved") {
    redirect(buildReturnLocation({ placementId, issueId, error: "Resolved action items cannot be updated." }));
  }

  const allowedEntryTypes = new Set(["note", "progress", "parts_ordered"]);
  const safeEntryType = allowedEntryTypes.has(entryType) ? entryType : "note";

  const { error } = await adminClient.from("issue_updates").insert({
    issue_id: issueId,
    entry_type: safeEntryType,
    entry_text: entryText,
    effective_date: effectiveDate || null,
    created_by: user.id,
  });

  if (error) {
    redirect(buildReturnLocation({ placementId, error: error.message }));
  }

  revalidatePath("/admin/overview");
  revalidatePath("/admin/issues");

  redirect(buildReturnLocation({ placementId, notice: "Update posted." }));
}

export async function updateIssueAction(formData: FormData) {
  const serverClient = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (!serverClient || !adminClient) {
    redirect(buildReturnLocation({ error: "Supabase is not configured." }));
  }

  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    redirect(buildReturnLocation({ error: "You must be signed in to edit an action item." }));
  }

  const issueId = readTrimmedString(formData, "issue_id");
  const placementId = readTrimmedString(formData, "placement_id");
  const issueType = readTrimmedString(formData, "issue_type");
  const title = readTrimmedString(formData, "title");
  const description = readTrimmedString(formData, "description");
  const reportedLogDate = readTrimmedString(formData, "reported_log_date");

  if (!issueId) {
    redirect(buildReturnLocation({ placementId, error: "Action-item id is missing." }));
  }

  const { data: issue, error: issueError } = await adminClient
    .from("issues")
    .select("id,entity_type,entity_id,related_placement_id,issue_type,title,status")
    .eq("id", issueId)
    .maybeSingle();

  if (issueError || !issue) {
    redirect(buildReturnLocation({ placementId, error: "The selected action item could not be found." }));
  }

  if (issue.status === "resolved") {
    redirect(buildReturnLocation({ placementId, issueId, error: "Resolved action items cannot be edited." }));
  }

  let nextEntityType = issue.entity_type;
  let nextEntityId = issue.entity_id;

  if (issueType) {
    const issueTypeLookup = await resolveIssueType(adminClient, issueType);
    if (!issueTypeLookup) {
      redirect(buildReturnLocation({ placementId, issueId, error: "Choose a valid action-item type." }));
    }

    if (issue.related_placement_id) {
      const { data: placement, error: placementError } = await adminClient
        .from("placements")
        .select("id,barn_id")
        .eq("id", issue.related_placement_id)
        .maybeSingle();

      if (placementError || !placement) {
        redirect(
          buildReturnLocation({
            placementId,
            issueId,
            error: "The linked placement for this action item could not be loaded.",
          }),
        );
      }

      nextEntityType = issueTypeLookup.entityType;
      nextEntityId = issueTypeLookup.entityType === "barn" ? placement.barn_id : placement.id;
    }
  }

  const { error } = await adminClient
    .from("issues")
    .update({
      entity_type: nextEntityType,
      entity_id: nextEntityId,
      issue_type: issueType || issue.issue_type || null,
      title: title || issue.title || "Action Item",
      description: description || null,
      reported_log_date: reportedLogDate || null,
    })
    .eq("id", issueId);

  if (error) {
    redirect(buildReturnLocation({ placementId, issueId, error: error.message }));
  }

  revalidatePath("/admin/overview");
  revalidatePath("/admin/issues");

  redirect(buildReturnLocation({ placementId, issueId, notice: "Action item updated." }));
}

async function resolveIssueType(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  issueType: string,
) {
  if (!issueType) {
    return null;
  }

  const { data } = await adminClient
    .from("issue_types")
    .select("code,label,entity_type,is_active")
    .eq("code", issueType)
    .eq("is_active", true)
    .maybeSingle();

  if (data?.code && data?.label && (data.entity_type === "barn" || data.entity_type === "placement")) {
    return {
      code: data.code,
      label: data.label,
      entityType: data.entity_type,
    };
  }

  const fallback = getDefaultIssueTypes().find((option) => option.code === issueType);
  if (!fallback) {
    return null;
  }

  return {
    code: fallback.code,
    label: fallback.label,
    entityType: fallback.entityType,
  };
}
