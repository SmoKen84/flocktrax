import Link from "next/link";

import {
  createFeedBinAction,
  deleteFeedBinAction,
  syncFeedBinInventoryAction,
  updateFeedBinAction,
} from "@/app/admin/feed-bins/actions";
import { BinSentryRefReader } from "@/app/admin/feed-bins/binsentry-refs/binsentry-ref-reader";
import { getFeedBinScreenBundle } from "@/lib/feed-bin-data";
import { getPlatformScreenTextValues } from "@/lib/platform-content";

type FeedBinsViewProps = {
  routeBase: string;
};

type SearchParamShape = {
  farm?: string | string[];
  barn?: string | string[];
  bin?: string | string[];
  notice?: string | string[];
  error?: string | string[];
};

export async function FeedBinsView({
  routeBase,
  searchParams,
}: FeedBinsViewProps & { searchParams?: Promise<SearchParamShape> }) {
  const params = searchParams ? await searchParams : undefined;
  const selectedFarmParam = readParam(params?.farm);
  const selectedBarnParam = readParam(params?.barn);
  const selectedBinParam = readParam(params?.bin);
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);
  const data = await getFeedBinScreenBundle();
  const screenText = await getPlatformScreenTextValues(["feed_bin_title", "feed_bin_desc"]);

  const selectedFarm = data.farms.find((farm) => farm.id === selectedFarmParam) ?? data.farms[0] ?? null;
  const visibleBarns = selectedFarm ? data.barnsByFarmId[selectedFarm.id] ?? [] : [];
  const selectedBarn = visibleBarns.find((barn) => barn.id === selectedBarnParam) ?? visibleBarns[0] ?? null;
  const visibleBins = selectedBarn ? data.binsByBarnId[selectedBarn.id] ?? [] : [];
  const selectedBin = visibleBins.find((bin) => bin.id === selectedBinParam) ?? visibleBins[0] ?? null;

  const buildHref = (options: { farm?: string | null; barn?: string | null; bin?: string | null } = {}) => {
    const query = new URLSearchParams();
    const farm = options.farm === undefined ? selectedFarm?.id ?? null : options.farm;
    const barn = options.barn === undefined ? selectedBarn?.id ?? null : options.barn;
    const bin = options.bin === undefined ? selectedBin?.id ?? null : options.bin;

    if (farm) query.set("farm", farm);
    if (barn) query.set("barn", barn);
    if (bin) query.set("bin", bin);

    const search = query.toString();
    return search ? `${routeBase}?${search}` : routeBase;
  };

  const returnTo = buildHref();
  const totalBarns = Object.values(data.barnsByFarmId).reduce((sum, barns) => sum + barns.length, 0);
  const totalBins = Object.values(data.binsByBarnId).reduce((sum, bins) => sum + bins.length, 0);
  const heroTitle = screenText.get("feed_bin_title") || "Assign feed bins to the correct barn before mobile deliveries start.";
  const heroBody =
    screenText.get("feed_bin_desc") ||
    "Feed deliveries in the mobile app resolve through the selected barn, so this setup screen keeps farms, barns, and each barn's feed bins aligned in one place.";

  return (
    <>
      <section className="panel farm-structure-hero-panel">
        <div className="farm-structure-hero-grid">
          <div className="farm-structure-hero-copy">
            <p className="hero-kicker">Feed Bins</p>
            <p className="farm-structure-hero-brand">FlockTrax-Admin</p>
            <h1 className="farm-structure-hero-title">{heroTitle}</h1>
            <p className="farm-structure-hero-body">{heroBody}</p>
          </div>

          <div className="farm-structure-hero-graphic" aria-label="Relationship of farms, barns, and feed bins">
            <p className="farm-structure-hero-graphic-title">Delivery Routing Context</p>
            <div className="farm-structure-tree">
              <div className="farm-structure-tree-group-row">
                <span className="farm-structure-tree-label" data-level="farm">Farm</span>
                <span className="farm-structure-tree-value">{selectedFarm?.farmName ?? "No farm selected"}</span>
              </div>
              <div className="farm-structure-tree-branch">
                <div className="farm-structure-tree-farm">
                  <div className="farm-structure-tree-row">
                    <span className="farm-structure-tree-label" data-level="barn">Barn</span>
                    <span className="farm-structure-tree-value">{selectedBarn?.barnCode ?? "No barn selected"}</span>
                  </div>
                  <div className="farm-structure-tree-barns">
                    {visibleBins.length > 0 ? (
                      <>
                        {visibleBins.slice(0, 3).map((bin) => (
                          <div className="farm-structure-tree-row" key={bin.id}>
                            <span className="farm-structure-tree-label" data-level="barn">Bin</span>
                            <span className="farm-structure-tree-value">{bin.binNumber ? `Bin ${bin.binNumber}` : "Unnamed bin"}</span>
                          </div>
                        ))}
                        {visibleBins.length > 3 ? (
                          <div className="farm-structure-tree-more-row">
                            <span className="farm-structure-tree-more-marker">...</span>
                            <span className="farm-structure-tree-more-copy">More bins in this barn</span>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="farm-structure-tree-row">
                        <span className="farm-structure-tree-label" data-level="barn">Bin</span>
                        <span className="farm-structure-tree-value">No feed bins configured</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="farm-structure-hero-footprint">
              <p className="farm-structure-summary-label">System Footprint</p>
              <p className="farm-structure-summary-value">{`${data.farms.length} farms / ${totalBarns} barns / ${totalBins} feed bins`}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="farm-structure-summary-grid">
        <article className="farm-structure-summary-card">
          <p className="farm-structure-summary-label">Selected Farm</p>
          <p className="farm-structure-summary-value">{selectedFarm?.farmName ?? "No farms found"}</p>
          <p className="farm-structure-summary-note">
            {selectedFarm
              ? `${selectedFarm.farmGroupName} · ${selectedFarm.barnCount} barns · ${selectedFarm.feedBinCount} bins`
              : "Choose a farm to filter the barn list."}
          </p>
        </article>

        <article className="farm-structure-summary-card">
          <p className="farm-structure-summary-label">Selected Barn</p>
          <p className="farm-structure-summary-value">{selectedBarn?.barnCode ?? "No barns in this farm"}</p>
          <p className="farm-structure-summary-note">
            {selectedBarn
              ? `${selectedBarn.currentPlacementCode ? `Placement ${selectedBarn.currentPlacementCode}` : "No active placement"} · ${formatNumber(selectedBarn.capacity)} hd capacity`
              : "Select a barn to manage the feed bins assigned to it."}
          </p>
        </article>

        <article className="farm-structure-summary-card">
          <p className="farm-structure-summary-label">Bins In Barn</p>
          <p className="farm-structure-summary-value">{selectedBarn ? String(visibleBins.length) : "0"}</p>
          <p className="farm-structure-summary-note">
            {selectedBarn
              ? "Each feed bin saved here becomes available for mobile feed delivery drops in this barn."
              : "No barn selected yet."}
          </p>
        </article>
      </section>

      <div className="farm-structure-summary-divider" aria-hidden="true" />

      {error ? (
        <div className="farm-structure-feedback-row" data-tone="danger">
          <span className="status-pill" data-tone="danger">Error</span>
          <p className="farm-structure-feedback-copy">{decodeURIComponent(error)}</p>
        </div>
      ) : null}
      {notice ? (
        <div className="farm-structure-feedback-row" data-tone="good">
          <span className="status-pill" data-tone="good">Saved</span>
          <p className="farm-structure-feedback-copy">{decodeURIComponent(notice)}</p>
        </div>
      ) : null}

      <section className="farm-structure-grid">
        <article className="card farm-structure-card">
          <div className="farm-structure-card-header">
            <div>
              <p className="farm-structure-card-title">Farms</p>
              <p className="farm-structure-card-copy">Reference list used to filter barns and keep the location context visible.</p>
            </div>
          </div>

          <div className="farm-structure-list farm-structure-selector-list">
            {data.farms.length > 0 ? (
              data.farms.map((farm) => (
                <Link
                  className="farm-structure-item"
                  data-active={farm.id === selectedFarm?.id}
                  href={buildHref({ farm: farm.id, barn: null, bin: null })}
                  key={farm.id}
                  scroll={false}
                >
                  <div>
                    <p className="farm-structure-item-title">{farm.farmName}</p>
                    <p className="farm-structure-item-subtitle">{farm.farmGroupName}</p>
                  </div>
                  <div className="farm-structure-item-meta">
                    <span>{farm.barnCount} barns</span>
                    <span>{farm.feedBinCount} bins</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="farm-structure-empty-state">No farms are available yet.</p>
            )}
          </div>
        </article>

        <article className="card farm-structure-card">
          <div className="farm-structure-card-header">
            <div>
              <p className="farm-structure-card-title">Barns</p>
              <p className="farm-structure-card-copy">
                {selectedFarm ? `Barns on ${selectedFarm.farmName} available for feed delivery routing.` : "Select a farm to filter its barns."}
              </p>
            </div>
          </div>

          <div className="farm-structure-list farm-structure-selector-list farm-structure-barn-list">
            {visibleBarns.length > 0 ? (
              visibleBarns.map((barn) => (
                <Link
                  className="farm-structure-item"
                  data-active={barn.id === selectedBarn?.id}
                  href={buildHref({ barn: barn.id, bin: null })}
                  key={barn.id}
                  scroll={false}
                >
                  <div>
                    <p className="farm-structure-item-title">{barn.barnCode}</p>
                    <p className="farm-structure-item-subtitle">
                      {barn.currentPlacementCode ? `Placement ${barn.currentPlacementCode}` : "No active placement"}
                    </p>
                  </div>
                  <div className="farm-structure-item-meta">
                    <span>{barn.feedBinCount} bins</span>
                    <span className="farm-structure-item-tag" data-tone={barn.isActive ? "live" : "idle"}>
                      {barn.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="farm-structure-empty-state">No barns are configured for this farm yet.</p>
            )}
          </div>
        </article>

        <article className="card farm-structure-card feed-bin-overview-card">
        <div className="farm-structure-card-header feed-bin-overview-header">
          <div>
            <p className="farm-structure-card-title">Feed Bins</p>
            <p className="farm-structure-card-copy">
              {selectedBarn
                ? `Bin roster for ${selectedBarn.barnCode}. Select a bin to open it in the editor below.`
                : "Select a barn to review its feed-bin roster and editor."}
            </p>
          </div>
          <div className="feed-bin-overview-actions">
            <form action={createFeedBinAction}>
              <input name="route_base" type="hidden" value={routeBase} />
              <input name="selected_farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
              <input name="selected_barn_id" type="hidden" value={selectedBarn?.id ?? ""} />
              <button className="button farm-structure-mini-action" disabled={!selectedBarn} type="submit">New Bin</button>
            </form>
            <form action={syncFeedBinInventoryAction}>
              <input name="route_base" type="hidden" value={routeBase} />
              <input name="selected_farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
              <input name="selected_barn_id" type="hidden" value={selectedBarn?.id ?? ""} />
              <button className="button-secondary farm-structure-mini-action" disabled={!selectedBarn} type="submit">
                Sync BinSentry
              </button>
            </form>
          </div>
        </div>

        {selectedBarn ? (
          visibleBins.length > 0 ? (
            <div className="feed-bin-roster">
              {visibleBins.map((bin) => (
                <Link
                  className="feed-bin-roster-item"
                  data-active={bin.id === selectedBin?.id}
                  href={buildHref({ bin: bin.id })}
                  key={bin.id}
                  scroll={false}
                >
                  <span className="feed-bin-roster-number">{bin.binNumber ? `Bin ${bin.binNumber}` : "Unnamed bin"}</span>
                  <span className="feed-bin-roster-meta">{bin.capacity ? `${bin.capacity} lbs` : "Capacity pending"}</span>
                  <span className="feed-bin-roster-meta">{bin.binSentryRef ? "Ref linked" : "Ref missing"}</span>
                  <span className="feed-bin-roster-meta">
                    {bin.binSentryLastInventoryLbs ? `${bin.binSentryLastInventoryLbs} lbs synced` : "No inventory yet"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="farm-structure-empty-state">
              No feed bins are configured for this barn yet. Use <strong>New Bin</strong> to add the first one.
            </p>
          )
        ) : (
          <p className="farm-structure-empty-state">Select a barn to review its feed bins.</p>
        )}
      </article>
      </section>

      <article className="card farm-structure-card feed-bin-editor-board">
        <div className="farm-structure-card-header">
          <div>
            <p className="farm-structure-card-title">Feed Bin Editor</p>
            <p className="farm-structure-card-copy">
              {selectedBin && selectedBarn
                ? `Editing ${selectedBarn.barnCode} bin ${selectedBin.binNumber || "--"} in a full-width layout with room for BinSentry refs and sync status.`
                : "Select a barn and bin to open the feed-bin editor."}
            </p>
          </div>
        </div>

        {selectedBarn && selectedBin ? (
          <div className="feed-bin-editor-stack feed-bin-editor-stack-bottom">
              {(
                <form
                  action={updateFeedBinAction}
                  className="farm-structure-editor-form feed-bin-editor-form feed-bin-editor-form-bottom"
                  id={`feed-bin-editor-${selectedBin.id}`}
                  key={selectedBin.id}
                >
                  <input name="return_to" type="hidden" value={returnTo} />
                  <input name="route_base" type="hidden" value={routeBase} />
                  <input name="feed_bin_id" type="hidden" value={selectedBin.id} />
                  <input name="selected_farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
                  <input name="selected_barn_id" type="hidden" value={selectedBarn.id} />

                  <div className="feed-bin-editor-header feed-bin-editor-header-bottom">
                    <div className="feed-bin-editor-number-block">
                      <p className="feed-bin-editor-overline">Bin</p>
                      <p className="feed-bin-editor-number">{selectedBin.binNumber || "--"}</p>
                    </div>
                    <div className="feed-bin-editor-header-meta">
                      <span className="feed-bin-editor-badge">Barn Linked</span>
                      <span className="feed-bin-editor-header-copy">{selectedBarn.barnCode}</span>
                    </div>
                  </div>

                  <div className="feed-bin-editor-body">
                    <div className="feed-bin-editor-flocktrax-column">
                      <p className="feed-bin-editor-section-kicker">FlockTrax Fields</p>
                      <div className="feed-bin-editor-fields feed-bin-editor-fields-bottom feed-bin-editor-fields-bottom-left">
                        <label className="field">
                          <span>Bin #</span>
                          <input defaultValue={selectedBin.binNumber} name="bin_num" />
                        </label>
                        <label className="field">
                          <span>Capacity (lbs)</span>
                          <input defaultValue={selectedBin.capacity} name="capacity" />
                        </label>
                      </div>
                    </div>

                    <div className="feed-bin-editor-binsentry-column">
                      <p className="feed-bin-editor-section-kicker">BinSentry Link</p>
                      <label className="field feed-bin-editor-field-wide feed-bin-editor-binsentry-field">
                        <div className="feed-bin-field-heading feed-bin-field-heading-wrap">
                          <span>BinSentry Ref</span>
                          {selectedBin.binSentryRef ? (
                            <BinSentryRefReader
                              label={`BinSentry Ref - Barn ${selectedBarn.barnCode} Bin ${selectedBin.binNumber || "--"}`}
                              value={selectedBin.binSentryRef}
                            />
                          ) : null}
                        </div>
                        <textarea
                          className="feed-bin-editor-binsentry-input"
                          defaultValue={selectedBin.binSentryRef ?? ""}
                          name="binsentry_bin_ref"
                          placeholder="BinSentry bin id or entity URL"
                          rows={3}
                        />
                      </label>

                      <div className="feed-bin-editor-status-strip feed-bin-editor-status-strip-bottom">
                        <span>{selectedBin.binSentryLastInventoryLbs ? `${selectedBin.binSentryLastInventoryLbs} lbs last synced` : "No BinSentry inventory yet"}</span>
                        <span>{selectedBin.binSentryLastSyncAt || "Not synced"}</span>
                        <span>{selectedBin.binSentrySyncNote || "Save a BinSentry ref, then sync this barn."}</span>
                      </div>
                    </div>
                  </div>

                  <div className="settings-action-row">
                    <button className="button settings-action-button" type="submit">
                      Save Bin
                    </button>
                    <button className="button settings-action-button farm-structure-danger-button" formAction={deleteFeedBinAction} type="submit">
                      Delete Bin
                    </button>
                  </div>
                </form>
              )}
          </div>
        ) : (
          <p className="farm-structure-empty-state">Select a barn and then a bin from the list above to manage it here.</p>
        )}
      </article>
    </>
  );
}

function readParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
