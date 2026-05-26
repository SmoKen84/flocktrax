import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";

type MobileAccessReadyPageProps = {
  searchParams?: Promise<{
    notice?: string;
  }>;
};

export default async function MobileAccessReadyPage({ searchParams }: MobileAccessReadyPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <main className="login-modal-shell">
      <section className="login-modal-panel">
        <div className="login-modal-intro">
          <p className="hero-kicker">Mobile Access</p>
          <FlockTraxWordmark compact product="Mobile" tone="accent" />
          <h1 className="hero-title login-hero-title">Your mobile account is ready.</h1>
          <p className="hero-body login-hero-body">
            Use the email address and password you just set, then sign in from the FlockTrax mobile app on your device.
          </p>
        </div>

        {params?.notice ? <p className="login-banner login-banner-notice">{params.notice}</p> : null}

        <article className="card login-card login-card-single">
          <div className="login-card-head">
            <p className="login-card-title">Next Step</p>
            <p className="login-card-copy">
              This invite was set up for mobile access, not the admin console. Open the mobile app and sign in there.
            </p>
          </div>

          <div className="login-help-box">
            <p>Use the same email and password you just saved.</p>
            <p>If you expected admin-console access too, contact your administrator for the correct invite type.</p>
          </div>
        </article>
      </section>
    </main>
  );
}
