import { saveGoogleSheetsConfigAction } from "@/app/admin/sync/googleapis-sheets/actions";
import { SyncEngineNav } from "@/app/admin/sync/googleapis-sheets/sync-engine-nav";
import { PageHeader } from "@/components/page-header";
import { getGoogleSheetsSyncBundle } from "@/lib/sync-data";

type GoogleSheetsConfigPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GoogleSheetsConfigPage({ searchParams }: GoogleSheetsConfigPageProps) {
  const params = (await searchParams) ?? {};
  const bundle = await getGoogleSheetsSyncBundle();
  const saved = params.saved === "1";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <>
      <PageHeader
        eyebrow="Sync Engine"
        title="Google Sheets"
        body="This is the first back-office sync adapter. Each farm points to one workbook, and each worksheet tab is always the live or historical placement_key."
        actions={<SyncEngineNav current="config" />}
      />

      <section className="panel sync-engine-page">
        {saved ? <p className="sync-engine-banner sync-engine-banner-success">Google Sheets workbook settings saved.</p> : null}
        {error ? (
          <p className="sync-engine-banner sync-engine-banner-error">
            Could not save the Google Sheets config. Error key: <code>{error}</code>
          </p>
        ) : null}

        <article className="card sync-engine-shell">
          <div className="sync-engine-shell-header">
            <div>
              <p className="eyebrow">Adapter Overview</p>
              <h2>{bundle.adapter?.adapter_name ?? "Google APIs / Sheets"}</h2>
              <p className="hero-body">
                {bundle.adapter?.description ?? "Farm workbook sync using one spreadsheet per farm."}
              </p>
            </div>
            <div className="sync-engine-hero-card">
              <p className="sync-engine-hero-label">Worksheet Rule</p>
              <strong>Tab name = placement_key</strong>
              <p>The workbook is farm-level. Each placement writes to the worksheet/tab named from the placement key.</p>
            </div>
          </div>

          <div className="sync-engine-grid">
            {bundle.configs.map((config) => (
              <article className="card sync-engine-card" data-enabled={config.isEnabled} key={config.farmId}>
                <div className="sync-engine-card-header">
                  <div>
                    <p className="settings-card-title">{config.farmName}</p>
                    <p className="access-card-subtitle">{config.farmGroupName ?? "No farm group assigned"}</p>
                  </div>
                  <span className="settings-registry-badge" data-enabled={config.isEnabled}>
                    {config.isEnabled ? "Enabled" : "Paused"}
                  </span>
                </div>

                <form action={saveGoogleSheetsConfigAction} className="sync-engine-form">
                  <input name="farmId" type="hidden" value={config.farmId} />

                  <label className="sync-engine-field">
                    <span>Endpoint Name</span>
                    <input defaultValue={config.endpointName ?? `${config.farmName} Workbook`} name="endpointName" type="text" />
                  </label>

                  <label className="sync-engine-field">
                    <span>Spreadsheet ID</span>
                    <input
                      defaultValue={config.spreadsheetId ?? ""}
                      name="spreadsheetId"
                      placeholder="Google workbook id for this farm"
                      type="text"
                    />
                  </label>

                  <label className="sync-engine-field">
                    <span>Spreadsheet Name</span>
                    <input
                      defaultValue={config.spreadsheetName ?? ""}
                      name="spreadsheetName"
                      placeholder="Optional workbook label"
                      type="text"
                    />
                  </label>

                  <label className="sync-engine-field">
                    <span>Copy Maps From Farm</span>
                    <select defaultValue="" name="copyFromEndpointId">
                      <option value="">Do not copy</option>
                      {bundle.configs
                        .filter((candidate) => candidate.endpointId && candidate.endpointId !== config.endpointId && candidate.hasColumnMap)
                        .map((candidate) => (
                          <option key={candidate.endpointId} value={candidate.endpointId ?? ""}>
                            {candidate.farmName}
                          </option>
                        ))}
                    </select>
                  </label>

                  <div className="sync-engine-field-row">
                    <label className="sync-engine-field">
                      <span>Header Row</span>
                      <input defaultValue={String(config.headerRow)} min="1" name="headerRow" type="number" />
                    </label>

                    <label className="sync-engine-field">
                      <span>Date Header</span>
                      <input defaultValue={config.dateHeaderLabel} name="dateHeaderLabel" type="text" />
                    </label>
                  </div>

                  <label className="sync-engine-field">
                    <span>Adapter State</span>
                    <select defaultValue={String(config.isEnabled)} name="isEnabled">
                      <option value="true">Enabled</option>
                      <option value="false">Paused</option>
                    </select>
                  </label>

                  <label className="sync-engine-field">
                    <span>Endpoint Notes</span>
                    <textarea defaultValue={config.notes ?? ""} name="notes" rows={3} />
                  </label>

                  <label className="sync-engine-field">
                    <span>Workbook Notes</span>
                    <textarea defaultValue={config.workbookNotes ?? ""} name="workbookNotes" rows={3} />
                  </label>

                  <button className="button" type="submit">
                    Save Workbook Config
                  </button>
                </form>
              </article>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
