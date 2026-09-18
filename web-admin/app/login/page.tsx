import Link from "next/link";
import { redirect } from "next/navigation";

import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { forgotPasswordAction, loginAction } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const isDemo = process.env.FLOCKTRAX_ENVIRONMENT_NAME === "demo";
  const params = searchParams ? await searchParams : {};
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (user) {
    redirect("/");
  }

  return (
    <main className="login-modal-shell">
      <section className="login-modal-panel">
        <div className="login-modal-intro">
          <p className="hero-kicker">Authentication</p>
          <FlockTraxWordmark compact product="Admin" tone="accent" />
          <h1 className="hero-title login-hero-title">Sign in to the FlockTrax console.</h1>
          <p className="hero-body login-hero-body">
            {isDemo ? "Use the demo access provided by the demo owner. Sign out before switching users." : "Use your invited account to open the admin console. Sign out before switching users."}
          </p>
        </div>

        {params?.error ? <p className="login-banner login-banner-error">{params.error}</p> : null}
        {params?.notice ? <p className="login-banner login-banner-notice">{params.notice}</p> : null}

        <section className="login-grid">
          <article className="card login-card">
            <div className="login-card-head">
              <p className="login-card-title">Sign In</p>
              <p className="login-card-copy">{isDemo ? "Evaluators: use your assigned alias and demo password. For a lost password, ask the demo owner for a new setup link." : "Enter the same email and password you use from the invited account."}</p>
            </div>

            <form action={loginAction} className="login-form">
              <div className="field">
                <label htmlFor="login-email">{isDemo ? "Evaluator username or owner email" : "Email"}</label>
                <input autoComplete="username" id="login-email" name="email" type={isDemo ? "text" : "email"} />
              </div>

              <div className="field">
                <label htmlFor="login-password">Password</label>
                <input autoComplete="current-password" id="login-password" name="password" type="password" />
              </div>

              <div className="login-action-row">
                <button className="button" type="submit">
                  Login
                </button>
                <Link className="button-secondary" href="/">
                  Cancel
                </Link>
              </div>
            </form>
          </article>

          <article className="card login-card">
            <div className="login-card-head">
              <p className="login-card-title">Account Help</p>
              <p className="login-card-copy">
                {isDemo ? "Demo access and password recovery are managed by the demo owner. No email is sent from the demo." : "Contact your administrator if you need help accessing your account."}
              </p>
            </div>

            {isDemo ? <div className="login-help-box"><p>New evaluator? Open the setup link sent by the demo owner to choose your password.</p><p>Lost your password? Ask the owner for a new setup link.</p></div> : <form action={forgotPasswordAction} className="login-form">
              <div className="field">
                <label htmlFor="reset-email">Email</label>
                <input autoComplete="email" id="reset-email" name="reset_email" type="email" />
              </div>

              <div className="login-help-box">
                <p>New user?</p>
                <p>Accounts are created by invitation. Contact your administrator for access.</p>
                <p>Need to change users? Use the `Logout` link in the sidebar, then sign in again here.</p>
              </div>

              <div className="login-action-row">
                <button className="button-secondary" type="submit">
                  Send Reset Link
                </button>
              </div>
            </form>}
          </article>
        </section>
      </section>
    </main>
  );
}
