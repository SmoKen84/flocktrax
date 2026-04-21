import Link from "next/link";
import { redirect } from "next/navigation";

import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { updatePasswordAction } from "../login/actions";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    redirect("/login?error=Your+password+reset+session+expired.+Request+a+new+reset+email.");
  }

  return (
    <main className="login-modal-shell">
      <section className="login-modal-panel">
        <div className="login-modal-intro">
          <p className="hero-kicker">Password Recovery</p>
          <FlockTraxWordmark compact product="Admin" tone="accent" />
          <h1 className="hero-title login-hero-title">Set a new password.</h1>
          <p className="hero-body login-hero-body">
            You are resetting the password for <strong>{user.email}</strong>. Save the new password, then return to
            the login screen and sign in normally.
          </p>
        </div>

        {params?.error ? <p className="login-banner login-banner-error">{params.error}</p> : null}

        <article className="card login-card login-card-single">
          <div className="login-card-head">
            <p className="login-card-title">Choose New Password</p>
            <p className="login-card-copy">Use at least eight characters so the account is ready for local testing.</p>
          </div>

          <form action={updatePasswordAction} className="login-form">
            <div className="field">
              <label htmlFor="reset-password">New Password</label>
              <input autoComplete="new-password" id="reset-password" name="password" type="password" />
            </div>

            <div className="field">
              <label htmlFor="reset-confirm-password">Confirm Password</label>
              <input
                autoComplete="new-password"
                id="reset-confirm-password"
                name="confirm_password"
                type="password"
              />
            </div>

            <div className="login-action-row">
              <button className="button" type="submit">
                Save Password
              </button>
              <Link className="button-secondary" href="/login">
                Back to Login
              </Link>
            </div>
          </form>
        </article>
      </section>
    </main>
  );
}
