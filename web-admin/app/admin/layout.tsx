import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    redirect("/login");
  }

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "Signed In User";
  const roleLabel =
    user.app_metadata?.role ??
    user.user_metadata?.role ??
    user.user_metadata?.title ??
    "Authorized User";
  const scopeLabel =
    user.user_metadata?.farm_group ??
    user.user_metadata?.company ??
    user.user_metadata?.scope ??
    null;

  return (
    <AdminShell displayName={displayName} roleLabel={roleLabel} scopeLabel={scopeLabel}>
      {children}
    </AdminShell>
  );
}
