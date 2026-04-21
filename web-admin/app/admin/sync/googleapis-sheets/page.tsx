import { redirect } from "next/navigation";

export default function GoogleSheetsSyncPage() {
  redirect("/admin/sync/googleapis-sheets/outbox");
}
