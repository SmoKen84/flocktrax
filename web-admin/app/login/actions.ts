"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getAppOrigin() {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  if (host) {
    return `${forwardedProto ?? "http"}://${host}`;
  }

  return "http://localhost:3000";
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Enter+your+email+and+password.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/login?error=Supabase+login+is+not+configured+for+the+web+app.");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("reset_email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/login?notice=Enter+an+email+address+to+send+a+reset+link.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/login?error=Supabase+password+reset+is+not+configured+for+the+web+app.");
  }

  const appOrigin = await getAppOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appOrigin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?notice=Password+reset+email+sent.+Check+your+inbox.");
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!password || !confirmPassword) {
    redirect("/reset-password?error=Enter+and+confirm+the+new+password.");
  }

  if (password !== confirmPassword) {
    redirect("/reset-password?error=The+passwords+do+not+match.");
  }

  if (password.length < 8) {
    redirect("/reset-password?error=Use+at+least+8+characters+for+the+new+password.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/reset-password?error=Supabase+password+reset+is+not+configured+for+the+web+app.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Your+password+reset+session+expired.+Request+a+new+reset+email.");
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?notice=Password+updated.+Sign+in+with+your+new+password.");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect("/login?notice=Signed+out.+Sign+in+with+another+user+to+switch+sessions.");
}
