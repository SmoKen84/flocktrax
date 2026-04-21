import Link from "next/link";

import {
  createBarnAction,
  createFarmAction,
  createFarmGroupAction,
  deleteBarnAction,
  deleteFarmAction,
  deleteFarmGroupAction,
  updateBarnAction,
  updateFarmAction,
  updateFarmGroupAction,
} from "@/app/admin/farm-structure/actions";
import { getAdminData } from "@/lib/admin-data";
import { getFarmStructureEditorBundle } from "@/lib/farm-structure-data";
import { getPlatformScreenTextValues } from "@/lib/platform-content";

type FarmStructureViewProps = {
  routeBase: string;
};

type SearchParamShape = {
  group?: string | string[];
  farm?: string | string[];
  barn?: string | string[];
  notice?: string | string[];
  error?: string | string[];
};

export async function FarmStructureView({
  routeBase,
  searchParams,
}: FarmStructureViewProps & { searchParams?: Promise<SearchParamShape> }) {
  const params = searchParams ? await searchParams : undefined;
  const selectedGroupParam = readParam(params?.group);
  const selectedFarmParam = readParam(params?.farm);
  const selectedBarnParam = readParam(params?.barn);
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);
  const data = await getAdminData();

  const selectedGroup = data.farmGroups.find((group) => group.id === selectedGroupParam) ?? data.farmGroups[0] ?? null;
  const visibleFarms = selectedGroup ? data.farms.filter((farm) => farm.farmGroupId === selectedGroup.id) : data.farms;
  const selectedFarm = visibleFarms.find((farm) => farm.id === selectedFarmParam) ?? visibleFarms[0] ?? null;
  const visibleBarns = selectedFarm ? data.barnsByFarmId[selectedFarm.id] ?? [] : [];
  const selectedBarn = visibleBarns.find((barn) => barn.id === selectedBarnParam) ?? visibleBarns[0] ?? null;
  const editorBundle = await getFarmStructureEditorBundle({
    farmGroupId: selectedGroup?.id ?? null,
    farmId: selectedFarm?.id ?? null,
    barnId: selectedBarn?.id ?? null,
  });
  const screenText = await getPlatformScreenTextValues(["farm_barn_title", "farm_barn_desc"]);

  const buildHref = (options: { group?: string | null; farm?: string | null; barn?: string | null } = {}) => {
    const query = new URLSearchParams();
    const group = options.group === undefined ? selectedGroup?.id ?? null : options.group;
    const farm = options.farm === undefined ? selectedFarm?.id ?? null : options.farm;
    const barn = options.barn === undefined ? selectedBarn?.id ?? null : options.barn;

    if (group) query.set("group", group);
    if (farm) query.set("farm", farm);
    if (barn) query.set("barn", barn);

    const search = query.toString();
    return search ? `${routeBase}?${search}` : routeBase;
  };

  const returnTo = buildHref();

  const totalBarns = Object.values(data.barnsByFarmId).reduce((sum, barns) => sum + barns.length, 0);
  const heroTitle = screenText.get("farm_barn_title") || "Manage the farm-group, farm, and barn hierarchy together.";
  const heroBody =
    screenText.get("farm_barn_desc") ||
    "This live structure view keeps the parent-child relationship visible in one place so farm groups, farms, and barns can be reviewed in context instead of across separate screens.";
  const prioritizedFarms = selectedFarm
    ? [selectedFarm, ...visibleFarms.filter((farm) => farm.id !== selectedFarm.id)]
    : visibleFarms;
  const relationshipFarms = prioritizedFarms.slice(0, 2).map((farm) => {
    const barns = data.barnsByFarmId[farm.id] ?? [];
    const prioritizedBarns =
      farm.id === selectedFarm?.id && selectedBarn
        ? [selectedBarn, ...barns.filter((barn) => barn.id !== selectedBarn.id)]
        : barns;

    return {
      ...farm,
      totalBarnCount: barns.length,
      barns: prioritizedBarns.slice(0, 2),
    };
  });
  const hasAdditionalFarms = prioritizedFarms.length > relationshipFarms.length;
  const editorSelectionKey = [
    selectedGroup?.id ?? "no-group",
    selectedFarm?.id ?? "no-farm",
    selectedBarn?.id ?? "no-barn",
  ].join(":");

  return (
    <>
      <section className="panel farm-structure-hero-panel">
        <div className="farm-structure-hero-grid">
          <div className="farm-structure-hero-copy">
            <p className="hero-kicker">Groups, Farms &amp; Barns</p>
            <p className="farm-structure-hero-brand">FlockTrax-Admin</p>
            <h1 className="farm-structure-hero-title">{heroTitle}</h1>
            <p className="farm-structure-hero-body">{heroBody}</p>
          </div>

          <div className="farm-structure-hero-graphic" aria-label="Relationships of Groups, Farms and Barns">
            <p className="farm-structure-hero-graphic-title">Relationships of Groups, Farms &amp; Barns</p>
            <div className="farm-structure-tree">
              <div className="farm-structure-tree-group-row">
                <span className="farm-structure-tree-label" data-level="group">Group</span>
                <span className="farm-structure-tree-value">{selectedGroup?.groupName ?? "No group selected"}</span>
              </div>
              <div className="farm-structure-tree-branch">
                {relationshipFarms.length > 0 ? (
                  relationshipFarms.map((farm) => (
                    <div className="farm-structure-tree-farm" key={farm.id}>
                      <div className="farm-structure-tree-row">
                        <span className="farm-structure-tree-label" data-level="farm">Farm</span>
                        <span className="farm-structure-tree-value">{farm.farmName}</span>
                      </div>
                      <div className="farm-structure-tree-barns">
                        {farm.barns.length > 0 ? (
                          <>
                            {farm.barns.map((barn) => (
                              <div className="farm-structure-tree-row" key={barn.id}>
                                <span className="farm-structure-tree-label" data-level="barn">Barn</span>
                                <span className="farm-structure-tree-value">{barn.barnCode}</span>
                              </div>
                            ))}
                            {farm.totalBarnCount > farm.barns.length ? (
                              <div className="farm-structure-tree-more-row">
                                <span className="farm-structure-tree-more-marker">...</span>
                                <span className="farm-structure-tree-more-copy">More barns in this farm</span>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="farm-structure-tree-row">
                            <span className="farm-structure-tree-label" data-level="barn">Barn</span>
                            <span className="farm-structure-tree-value">None configured</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="farm-structure-tree-farm">
                    <div className="farm-structure-tree-row">
                      <span className="farm-structure-tree-label" data-level="farm">Farm</span>
                      <span className="farm-structure-tree-value">No farms selected</span>
                    </div>
                  </div>
                )}
                {hasAdditionalFarms ? (
                  <div className="farm-structure-tree-more-row" data-level="farm">
                    <span className="farm-structure-tree-more-marker">...</span>
                    <span className="farm-structure-tree-more-copy">More farms in this group</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="farm-structure-hero-footprint">
              <p className="farm-structure-summary-label">System Footprint</p>
              <p className="farm-structure-summary-value">{`${data.farmGroups.length} groups / ${data.farms.length} farms / ${totalBarns} barns`}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="farm-structure-summary-grid">
        <article className="farm-structure-summary-card">
          <p className="farm-structure-summary-label">Selected Group</p>
          <p className="farm-structure-summary-value">{selectedGroup?.groupName ?? "No farm groups found"}</p>
          <p className="farm-structure-summary-note">
            {selectedGroup ? `${selectedGroup.farmCount} farms · ${selectedGroup.activePlacements} active placements` : "Add a farm group to begin structuring the hierarchy."}
          </p>
        </article>

        <article className="farm-structure-summary-card">
          <p className="farm-structure-summary-label">Selected Farm</p>
          <p className="farm-structure-summary-value">{selectedFarm?.farmName ?? "No farms in this group"}</p>
          <p className="farm-structure-summary-note">
            {selectedFarm ? `${selectedFarm.barnCount} barns · ${selectedFarm.activePlacements} active placements` : "Choose a farm group to view the farm layer beneath it."}
          </p>
        </article>

        <article className="farm-structure-summary-card">
          <p className="farm-structure-summary-label">Selected Barn</p>
          <p className="farm-structure-summary-value">{selectedBarn?.barnCode ?? "No barns on this farm"}</p>
          <p className="farm-structure-summary-note">
            {selectedBarn
              ? `${selectedBarn.currentPlacementCode ? `Placement ${selectedBarn.currentPlacementCode}` : "No active placement"} · Capacity ${formatNumber(selectedBarn.capacity)}`
              : "Select a farm to review the barns tied to it."}
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
              <p className="farm-structure-card-title">Farm Groups</p>
              <p className="farm-structure-card-copy">Parent operating entities under the current integrator.</p>
            </div>
            <form action={createFarmGroupAction}>
              <input name="route_base" type="hidden" value={routeBase} />
              <button className="button farm-structure-mini-action" type="submit">New Group</button>
            </form>
          </div>

          <div className="farm-structure-list farm-structure-selector-list">
            {data.farmGroups.map((group) => (
              <Link
                className="farm-structure-item"
                data-active={group.id === selectedGroup?.id}
                href={buildHref({ group: group.id, farm: null, barn: null })}
                key={group.id}
              >
                <div>
                  <p className="farm-structure-item-title">{group.groupName}</p>
                  <p className="farm-structure-item-subtitle">{group.homeBase || "Home base not recorded"}</p>
                </div>
                <div className="farm-structure-item-meta">
                  <span>{group.farmCount} farms</span>
                  <span
                    className="status-pill"
                    data-tone={group.status === "active" ? "good" : group.status === "seasonal" ? "warn" : "danger"}
                  >
                    {group.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <article className="card farm-structure-card">
          <div className="farm-structure-card-header">
            <div>
              <p className="farm-structure-card-title">Farms</p>
              <p className="farm-structure-card-copy">
                {selectedGroup ? `Farms operating under ${selectedGroup.groupName}.` : "Select a farm group to review its farms."}
              </p>
            </div>
            <form action={createFarmAction}>
              <input name="route_base" type="hidden" value={routeBase} />
              <input name="selected_group_id" type="hidden" value={selectedGroup?.id ?? ""} />
              <button className="button farm-structure-mini-action" disabled={!selectedGroup} type="submit">New Farm</button>
            </form>
          </div>

          <div className="farm-structure-list farm-structure-selector-list">
            {visibleFarms.length > 0 ? (
              visibleFarms.map((farm) => (
                <Link
                  className="farm-structure-item"
                  data-active={farm.id === selectedFarm?.id}
                  href={buildHref({ farm: farm.id, barn: null })}
                  key={farm.id}
                >
                  <div>
                    <p className="farm-structure-item-title">{farm.farmName}</p>
                    <p className="farm-structure-item-subtitle">{`${farm.city}, ${farm.state}`.replace(/^,\s*/, "") || "Location not recorded"}</p>
                  </div>
                  <div className="farm-structure-item-meta">
                    <span>{farm.barnCount} barns</span>
                    <span
                      className="status-pill"
                      data-tone={farm.status === "active" ? "good" : farm.status === "seasonal" ? "warn" : "danger"}
                    >
                      {farm.status}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="farm-structure-empty-state">No farms are linked to this farm group yet.</p>
            )}
          </div>
        </article>

        <article className="card farm-structure-card">
          <div className="farm-structure-card-header">
            <div>
              <p className="farm-structure-card-title">Barns</p>
              <p className="farm-structure-card-copy">
                {selectedFarm ? `Barn inventory for ${selectedFarm.farmName}.` : "Select a farm to review its barn layer."}
              </p>
            </div>
            <form action={createBarnAction}>
              <input name="route_base" type="hidden" value={routeBase} />
              <input name="selected_group_id" type="hidden" value={selectedGroup?.id ?? ""} />
              <input name="selected_farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
              <button className="button farm-structure-mini-action" disabled={!selectedFarm} type="submit">New Barn</button>
            </form>
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
                    <span>{formatNumber(barn.capacity)} hd</span>
                    <span className="farm-structure-item-tag" data-tone={barn.currentPlacementCode ? "live" : "idle"}>
                      {barn.currentPlacementCode ? "In cycle" : "Open"}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="farm-structure-empty-state">No barns are configured for this farm yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="farm-structure-editor-grid" key={editorSelectionKey}>
        <article className="card farm-structure-editor-card" key={editorBundle.farmGroup?.id ?? "farm-group-empty"}>
          <div className="farm-structure-card-header">
            <p className="farm-structure-card-title">Edit Farm Group</p>
            <p className="farm-structure-card-copy">Update the selected farm-group profile without leaving the hierarchy view.</p>
          </div>

          {editorBundle.farmGroup ? (
            <form
              action={updateFarmGroupAction}
              className="farm-structure-editor-form"
              key={editorBundle.farmGroup.id}
            >
              <input name="return_to" type="hidden" value={returnTo} />
              <input name="route_base" type="hidden" value={routeBase} />
              <input name="farm_group_id" type="hidden" value={editorBundle.farmGroup.id} />

              <label className="field field-wide">
                <span>Group Name</span>
                <input defaultValue={editorBundle.farmGroup.groupName} name="group_name" />
              </label>
              <label className="field">
                <span>Primary Contact</span>
                <input defaultValue={editorBundle.farmGroup.contactName} name="group_contact_name" />
              </label>
              <label className="field">
                <span>Contact Title</span>
                <input defaultValue={editorBundle.farmGroup.contactTitle} name="contact_title" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input defaultValue={editorBundle.farmGroup.phone} name="phone" />
              </label>
              <label className="field field-wide">
                <span>Address 1</span>
                <input defaultValue={editorBundle.farmGroup.address1} name="addr1" />
              </label>
              <label className="field field-wide">
                <span>Address 2</span>
                <input defaultValue={editorBundle.farmGroup.address2} name="addr2" />
              </label>
              <label className="field">
                <span>City</span>
                <input defaultValue={editorBundle.farmGroup.city} name="city" />
              </label>
              <label className="field">
                <span>State</span>
                <input defaultValue={editorBundle.farmGroup.state} name="st" />
              </label>
              <label className="field">
                <span>Postal Code</span>
                <input defaultValue={editorBundle.farmGroup.postalCode} name="zip" />
              </label>
              <label className="settings-toggle">
                <input defaultChecked={editorBundle.farmGroup.isActive} name="is_active" type="checkbox" />
                <span>Active farm group</span>
              </label>

              <div className="settings-action-row">
                <button className="button settings-action-button" type="submit">
                  Save Farm Group
                </button>
                <button className="button settings-action-button farm-structure-danger-button" formAction={deleteFarmGroupAction} type="submit">
                  Delete Group
                </button>
              </div>
            </form>
          ) : (
            <p className="farm-structure-empty-state">Select a farm group to edit its detail profile.</p>
          )}
        </article>

        <article className="card farm-structure-editor-card" key={editorBundle.farm?.id ?? "farm-empty"}>
          <div className="farm-structure-card-header">
            <p className="farm-structure-card-title">Edit Farm</p>
            <p className="farm-structure-card-copy">Maintain the selected farm’s identifying and location details in context.</p>
          </div>

          {editorBundle.farm ? (
            <form action={updateFarmAction} className="farm-structure-editor-form" key={editorBundle.farm.id}>
              <input name="return_to" type="hidden" value={returnTo} />
              <input name="route_base" type="hidden" value={routeBase} />
              <input name="farm_id" type="hidden" value={editorBundle.farm.id} />
              <input name="selected_group_id" type="hidden" value={selectedGroup?.id ?? ""} />

              <label className="field">
                <span>Farm Code</span>
                <input defaultValue={editorBundle.farm.farmCode} name="farm_code" />
              </label>
              <label className="field field-wide">
                <span>Farm Name</span>
                <input defaultValue={editorBundle.farm.farmName} name="farm_name" />
              </label>
              <label className="field field-wide">
                <span>Address</span>
                <input defaultValue={editorBundle.farm.address} name="addr" />
              </label>
              <label className="field">
                <span>City</span>
                <input defaultValue={editorBundle.farm.city} name="city" />
              </label>
              <label className="field">
                <span>State</span>
                <input defaultValue={editorBundle.farm.state} name="state" />
              </label>
              <label className="field">
                <span>Postal Code</span>
                <input defaultValue={editorBundle.farm.postalCode} name="zip" />
              </label>
              <label className="field field-wide">
                <span>Map URL</span>
                <input defaultValue={editorBundle.farm.mapUrl} name="map_url" />
              </label>
              <label className="settings-toggle">
                <input defaultChecked={editorBundle.farm.isActive} name="is_active" type="checkbox" />
                <span>Active farm</span>
              </label>

              <div className="settings-action-row">
                <button className="button settings-action-button" type="submit">
                  Save Farm
                </button>
                <button className="button settings-action-button farm-structure-danger-button" formAction={deleteFarmAction} type="submit">
                  Delete Farm
                </button>
              </div>
            </form>
          ) : (
            <p className="farm-structure-empty-state">Select a farm to edit its detail profile.</p>
          )}
        </article>

        <article className="card farm-structure-editor-card" key={editorBundle.barn?.id ?? "barn-empty"}>
          <div className="farm-structure-card-header">
            <p className="farm-structure-card-title">Edit Barn</p>
            <p className="farm-structure-card-copy">Adjust the selected barn’s code, dimensions, and capacity in place.</p>
          </div>

          {editorBundle.barn ? (
            <form action={updateBarnAction} className="farm-structure-editor-form" key={editorBundle.barn.id}>
              <input name="return_to" type="hidden" value={returnTo} />
              <input name="route_base" type="hidden" value={routeBase} />
              <input name="barn_id" type="hidden" value={editorBundle.barn.id} />
              <input name="selected_group_id" type="hidden" value={selectedGroup?.id ?? ""} />
              <input name="selected_farm_id" type="hidden" value={selectedFarm?.id ?? ""} />

              <label className="field">
                <span>Barn Code</span>
                <input defaultValue={editorBundle.barn.barnCode} name="barn_code" />
              </label>
              <label className="field">
                <span>Sort Code</span>
                <input defaultValue={editorBundle.barn.sortCode} name="sort_code" />
              </label>
              <label className="field">
                <span>Length Ft</span>
                <input defaultValue={editorBundle.barn.lengthFt} name="length_ft" />
              </label>
              <label className="field">
                <span>Width Ft</span>
                <input defaultValue={editorBundle.barn.widthFt} name="width_ft" />
              </label>
              <label className="field">
                <span>Sq Ft</span>
                <input defaultValue={editorBundle.barn.sqft} name="sqft" />
              </label>
              <label className="field field-wide">
                <span>Standard Head</span>
                <input defaultValue={editorBundle.barn.standardHead} name="stdroc_head" />
              </label>
              <label className="settings-toggle">
                <input defaultChecked={editorBundle.barn.isActive} name="is_active" type="checkbox" />
                <span>Active barn</span>
              </label>

              <div className="settings-action-row">
                <button className="button settings-action-button" type="submit">
                  Save Barn
                </button>
                <button className="button settings-action-button farm-structure-danger-button" formAction={deleteBarnAction} type="submit">
                  Delete Barn
                </button>
              </div>
            </form>
          ) : (
            <p className="farm-structure-empty-state">Select a barn to edit its detail profile.</p>
          )}
        </article>
      </section>
    </>
  );
}

function readParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
