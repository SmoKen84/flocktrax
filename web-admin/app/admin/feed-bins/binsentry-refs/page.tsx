import Link from "next/link";

import { BinSentryRefReader } from "@/app/admin/feed-bins/binsentry-refs/binsentry-ref-reader";
import { discoverBinSentryBinRefs } from "@/lib/binsentry-browser";

export default async function BinSentryRefsPage() {
  let binsUrl: string | null = null;
  let bins: Awaited<ReturnType<typeof discoverBinSentryBinRefs>>["discoveredBins"] = [];
  let error: string | null = null;

  try {
    const result = await discoverBinSentryBinRefs();
    binsUrl = result.binsUrl;
    bins = result.discoveredBins;
  } catch (caughtError) {
    error = caughtError instanceof Error ? caughtError.message : "BinSentry discovery failed.";
  }

  return (
    <>
      <section className="panel farm-structure-hero-panel">
        <div className="farm-structure-hero-grid">
          <div className="farm-structure-hero-copy">
            <p className="hero-kicker">Feed Bins</p>
            <p className="farm-structure-hero-brand">BinSentry Ref Finder</p>
            <h1 className="farm-structure-hero-title">Discover copy-ready BinSentry refs from your live BinSentry account.</h1>
            <p className="farm-structure-hero-body">
              This helper uses the local BinSentry credentials in `web-admin/.env` to sign in server-side, follows the
              organization links, and lists the bin entity refs you can paste into FlockTrax.
            </p>
          </div>

          <div className="farm-structure-hero-graphic" aria-label="BinSentry ref helper summary">
            <p className="farm-structure-hero-graphic-title">Recommended Paste Value</p>
            <div className="farm-structure-tree">
              <div className="farm-structure-tree-group-row">
                <span className="farm-structure-tree-label" data-level="farm">Best</span>
                <span className="farm-structure-tree-value">Full BinSentry entity URL</span>
              </div>
              <div className="farm-structure-tree-group-row">
                <span className="farm-structure-tree-label" data-level="barn">Fallback</span>
                <span className="farm-structure-tree-value">Stable BinSentry entity id</span>
              </div>
              <div className="farm-structure-tree-group-row">
                <span className="farm-structure-tree-label" data-level="barn">Avoid</span>
                <span className="farm-structure-tree-value">Human-readable UI labels only</span>
              </div>
            </div>
            <div className="farm-structure-hero-footprint">
              <p className="farm-structure-summary-label">Discovery Result</p>
              <p className="farm-structure-summary-value">{error ? "Check error below" : `${bins.length} bins returned`}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="farm-structure-summary-grid binsentry-ref-summary-grid">
        <article className="farm-structure-summary-card binsentry-ref-summary-card binsentry-ref-summary-card-wide">
          <p className="farm-structure-summary-label">Source Endpoint</p>
          <p className="farm-structure-summary-value binsentry-ref-endpoint">
            {binsUrl ?? "Not resolved"}
          </p>
          <p className="farm-structure-summary-note">This is the live BinSentry collection endpoint returned by your authenticated organization entity.</p>
        </article>

        <article className="farm-structure-summary-card binsentry-ref-summary-card">
          <p className="farm-structure-summary-label">Copy Target</p>
          <p className="farm-structure-summary-value">`BinSentry Ref` field</p>
          <p className="farm-structure-summary-note">Paste the full entity URL into the feed-bin editor when possible.</p>
        </article>

        <article className="farm-structure-summary-card binsentry-ref-summary-card">
          <p className="farm-structure-summary-label">Next Step</p>
          <p className="farm-structure-summary-value">
            <Link href="/admin/feed-bins">Back to Feed Bins</Link>
          </p>
          <p className="farm-structure-summary-note">Save one ref on a real bin, then use `Sync BinSentry` on that barn.</p>
        </article>
      </section>

      <div className="farm-structure-summary-divider" aria-hidden="true" />

      {error ? (
        <div className="farm-structure-feedback-row" data-tone="danger">
          <span className="status-pill" data-tone="danger">Error</span>
          <p className="farm-structure-feedback-copy">{error}</p>
        </div>
      ) : null}

      {!error && bins.length === 0 ? (
        <div className="farm-structure-feedback-row" data-tone="danger">
          <span className="status-pill" data-tone="danger">No Bins</span>
          <p className="farm-structure-feedback-copy">
            BinSentry returned a bins collection, but this first pass did not find any child entities with ids or hrefs.
          </p>
        </div>
      ) : null}

      {bins.length > 0 ? (
        <section className="farm-structure-grid binsentry-ref-results-grid">
          {bins.map((bin, index) => (
            <article className="card farm-structure-card binsentry-ref-card" key={bin.href ?? bin.id ?? `bin-${index}`}>
              <div className="farm-structure-card-header">
                <div>
                  <p className="farm-structure-card-title">{bin.name ?? `Bin ${index + 1}`}</p>
                  <p className="farm-structure-card-copy">Paste the full URL below into the FlockTrax `BinSentry Ref` field.</p>
                </div>
              </div>

              <div className="farm-structure-list binsentry-ref-card-list">
                <div className="farm-structure-item" data-active="true">
                  <div>
                    <p className="farm-structure-item-title">Recommended Ref</p>
                    <BinSentryRefReader label={`Recommended Ref - Bin ${bin.name ?? index + 1}`} value={bin.ref} />
                  </div>
                </div>

                <div className="farm-structure-item">
                  <div>
                    <p className="farm-structure-item-title">Entity ID</p>
                    {bin.id ? (
                      <BinSentryRefReader label={`Entity ID - Bin ${bin.name ?? index + 1}`} value={bin.id} />
                    ) : (
                      <p className="farm-structure-item-subtitle binsentry-ref-value">Not exposed</p>
                    )}
                  </div>
                </div>

                <div className="farm-structure-item">
                  <div>
                    <p className="farm-structure-item-title">Entity URL</p>
                    {bin.href ? (
                      <BinSentryRefReader label={`Entity URL - Bin ${bin.name ?? index + 1}`} value={bin.href} />
                    ) : (
                      <p className="farm-structure-item-subtitle binsentry-ref-value">Not exposed</p>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
