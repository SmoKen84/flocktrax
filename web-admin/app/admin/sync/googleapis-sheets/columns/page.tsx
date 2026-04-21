import { FarmColumnMapEditor } from "@/app/admin/sync/googleapis-sheets/columns/column-map-editor";
import { SyncEngineNav } from "@/app/admin/sync/googleapis-sheets/sync-engine-nav";
import { PageHeader } from "@/components/page-header";
import { getGoogleSheetsColumnMapBundle } from "@/lib/sync-data";

type GoogleSheetsColumnMapPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GoogleSheetsColumnMapPage({ searchParams }: GoogleSheetsColumnMapPageProps) {
  const params = (await searchParams) ?? {};
  const bundle = await getGoogleSheetsColumnMapBundle();
  const saved = params.saved === "1";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <>
      <PageHeader
        eyebrow="Sync Engine"
        title="Google Sheets Column Map"
        body="This is the field-to-header contract for the Google Sheets adapter. Each farm workbook can tune the exact worksheet labels without changing the underlying FlockTrax log schema."
        actions={<SyncEngineNav current="columns" />}
      />

      <section className="panel sync-engine-page">
        {saved ? <p className="sync-engine-banner sync-engine-banner-success">Google Sheets column map saved.</p> : null}
        {error ? (
          <p className="sync-engine-banner sync-engine-banner-error">
            Could not save the column map. Error key: <code>{error}</code>
          </p>
        ) : null}

        <article className="card sync-engine-shell">
          <div className="sync-engine-shell-header">
            <div>
              <p className="eyebrow">Column Contract</p>
              <h2>{bundle.adapter?.adapter_name ?? "Google APIs / Sheets"}</h2>
              <p className="hero-body">
                These rows define how each FlockTrax log field should be matched to worksheet headers inside a placement tab.
              </p>
            </div>
            <div className="sync-engine-hero-card">
              <p className="sync-engine-hero-label">Tab Rule</p>
              <strong>placement_key</strong>
              <p>Only the column labels vary here. Workbook selection stays farm-level and tab selection stays placement-based.</p>
            </div>
          </div>

          <div className="sync-column-map-stack">
            {bundle.farms.length > 0 ? (
              bundle.farms.map((farm) => (
                <FarmColumnMapEditor
                  endpointId={farm.endpointId}
                  endpointName={farm.endpointName}
                  farmGroupName={farm.farmGroupName}
                  farmName={farm.farmName}
                  isEnabled={farm.isEnabled}
                  key={farm.endpointId}
                  rows={farm.rows}
                  spreadsheetId={farm.spreadsheetId}
                  spreadsheetName={farm.spreadsheetName}
                />
              ))
            ) : (
              <p className="meta-copy">No workbook endpoints exist yet. Save at least one farm workbook config first, then the column maps will appear here.</p>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
