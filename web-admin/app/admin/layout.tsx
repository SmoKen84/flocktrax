import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin-shell";
import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";
import { getPlatformSplashContent } from "@/lib/platform-content";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createSupabaseServerClient();
  const [splash, accessBundle] = await Promise.all([getPlatformSplashContent(), getUserAccessBundle()]);
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    redirect("/login");
  }

  const actingUser = accessBundle.users.find((candidate) => candidate.id === user.id) ?? null;
  const actingRole = actingUser ? resolveRoleTemplate(accessBundle.roles, actingUser.role) : null;
  const displayName =
    actingUser?.displayName ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "Signed In User";
  const roleKey = actingUser?.role ?? user.app_metadata?.role ?? user.user_metadata?.role ?? user.user_metadata?.title ?? "Authorized User";
  const roleLabel = actingUser?.roleLabel ?? actingRole?.label ?? roleKey;
  const scopeLabel =
    actingUser?.memberships?.[0]?.scopeLabel ??
    user.user_metadata?.farm_group ??
    user.user_metadata?.company ??
    user.user_metadata?.scope ??
    null;

  return (
    <AdminShell
      copyrightLine={splash.copyrightLine}
      displayName={displayName}
      roleKey={roleKey}
      roleLabel={roleLabel}
      scopeLabel={scopeLabel}
      versionLine={splash.versionLine}
    >
      {children}
    </AdminShell>
  );
}
