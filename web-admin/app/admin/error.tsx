"use client";

type AdminErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminErrorPage({ error, reset }: AdminErrorPageProps) {
  return (
    <section className="panel card admin-error-panel">
      <p className="eyebrow">Admin Data Error</p>
      <h1 className="admin-error-title">The admin console could not load live Supabase data.</h1>
      <p className="body-copy">
        The admin app is no longer falling back to mock records automatically. This screen is shown so the data
        source problem is visible instead of misleading.
      </p>
      <div className="helper-banner" style={{ marginTop: 18 }}>
        <strong>Reported error:</strong> {error.message}
      </div>
      <div className="hero-actions">
        <button className="button" onClick={reset} type="button">
          Try Again
        </button>
      </div>
    </section>
  );
}
