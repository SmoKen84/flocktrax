import Link from "next/link";

import {
  createFeedBinAction,
  deleteFeedBinAction,
  updateFeedBinAction,
} from "@/app/admin/feed-bins/actions";
import { getFeedBinScreenBundle } from "@/lib/feed-bin-data";
import { getPlatformScreenTextValues } from "@/lib/platform-content";

type FeedBinsViewProps = {
  routeBase: string;
};

type SearchParamShape = {
  farm?: string | string[];
  barn?: string | string[];
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
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);
  const data = await getFeedBinScreenBundle();
  const screenText = await getPlatformScreenTextValues(["feed_bin_title", "feed_bin_desc"]);

  const selectedFarm = data.farms.find((farm) => farm.id === selectedFarmParam) ?? data.farms[0] ?? null;
  const visibleBarns = selectedFarm ? data.barnsByFarmId[selectedFarm.id] ?? [] : [];
  const selectedBarn = visibleBarns.find((barn) => barn.id === selectedBarnParam) ?? visibleBarns[0] ?? null;
  const visibleBins = selectedBarn ? data.binsByBarnId[selectedBarn.id] ?? [] : [];

  const buildHref = (options: { farm?: string | null; barn?: string | null } = {}) => {
    const query = new URLSearchParams();
    const farm = options.farm === undefined ? selectedFarm?.id ?? null : options.farm;
    const barn = options.barn === undefined ? selectedBarn?.id ?? null : options.barn;

    if (farm) query.set("farm", farm);
    if (barn) query.set("barn", barn);

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
                  href={buildHref({ farm: farm.id, barn: null })}
                  key={farm.id}
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
                  href={buildHref({ barn: barn.id })}
                  key={barn.id}
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

        <article className="card farm-structure-card">
          <div className="farm-structure-card-header">
            <div>
              <p className="farm-structure-card-title">Feed Bins</p>
              <p className="farm-structure-card-copy">
                {selectedBarn
                  ? `Add, save, or delete the feed bins that mobile deliveries should use in ${selectedBarn.barnCode}.`
                  : "Select a barn to manage its feed bins."}
              </p>
            </div>
            <form action={createFeedBinAction}>
              <input name="route_base" type="hidden" value={routeBase} />
              <input name="selected_farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
              <input name="selected_barn_id" type="hidden" value={selectedBarn?.id ?? ""} />
              <button className="button farm-structure-mini-action" disabled={!selectedBarn} type="submit">New Bin</button>
            </form>
          </div>

          {selectedBarn ? (
            <div className="feed-bin-editor-stack">
              {visibleBins.length > 0 ? (
                visibleBins.map((bin) => (
                  <form action={updateFeedBinAction} className="farm-structure-editor-form feed-bin-editor-form" key={bin.id}>
                    <input name="return_to" type="hidden" value={returnTo} />
                    <input name="route_base" type="hidden" value={routeBase} />
                    <input name="feed_bin_id" type="hidden" value={bin.id} />
                    <input name="selected_farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
                    <input name="selected_barn_id" type="hidden" value={selectedBarn.id} />

                    <div className="feed-bin-editor-header">
                      <div className="feed-bin-editor-number-block">
                        <p className="feed-bin-editor-overline">Bin</p>
                        <p className="feed-bin-editor-number">{bin.binNumber || "--"}</p>
                      </div>
                      <span className="feed-bin-editor-badge">Barn Linked</span>
                    </div>

                    <div className="feed-bin-editor-fields">
                      <label className="field">
                        <span>Bin #</span>
                        <input defaultValue={bin.binNumber} name="bin_num" />
                      </label>
                      <label className="field">
                        <span>Capacity (lbs)</span>
                        <input defaultValue={bin.capacity} name="capacity" />
                      </label>
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
                ))
              ) : (
                <p className="farm-structure-empty-state">
                  No feed bins are configured for this barn yet. Use <strong>New Bin</strong> to add the first one.
                </p>
              )}
            </div>
          ) : (
            <p className="farm-structure-empty-state">Select a barn to manage the feed bins tied to it.</p>
          )}
        </article>
      </section>
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
