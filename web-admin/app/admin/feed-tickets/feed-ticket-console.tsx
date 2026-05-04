"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { FeedTicketAdminBundle, FeedTicketAdminRow } from "@/lib/feed-ticket-data";
import { FeedTicketEditor } from "./feed-ticket-editor";

const ROWS_PER_PAGE = 12;

type FeedTicketConsoleProps = {
  bundle: FeedTicketAdminBundle;
};

type SelectorState =
  | {
      field: "farm" | "barn" | "bin" | "flock";
      title: string;
      options: string[];
    }
  | null;

type TicketAggregateRow = {
  id: string;
  ticketId: string;
  deliveryDate: string | null;
  ticketNumber: string | null;
  source: string | null;
  grossWeightLbs: number | null;
  farmName: string | null;
  barnCode: string | null;
  binCode: string | null;
  placementCode: string | null;
  feedType: string | null;
  dropWeightLbs: number;
  starterDropWeightLbs: number;
  growerDropWeightLbs: number;
  dropCount: number;
  comment: string | null;
};

export function FeedTicketConsole({ bundle }: FeedTicketConsoleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [listMode, setListMode] = useState<"ticket" | "drop">(bundle.filters.listMode);
  const [ticketNumber, setTicketNumber] = useState(bundle.filters.ticketNumber);
  const [farm, setFarm] = useState(bundle.filters.farm);
  const [barn, setBarn] = useState(bundle.filters.barn);
  const [bin, setBin] = useState(bundle.filters.bin);
  const [flockCode, setFlockCode] = useState(bundle.filters.flockCode);
  const [dateFrom, setDateFrom] = useState(bundle.filters.dateFrom);
  const [dateTo, setDateTo] = useState(bundle.filters.dateTo);
  const [includeStarter, setIncludeStarter] = useState(bundle.filters.includeStarter);
  const [includeGrower, setIncludeGrower] = useState(bundle.filters.includeGrower);
  const [selectorState, setSelectorState] = useState<SelectorState>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [readerState, setReaderState] = useState<{ title: string; value: string } | null>(null);
  const [editorTicketId, setEditorTicketId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const ticketRows = useMemo(() => groupTicketRows(bundle.rows), [bundle.rows]);
  const displayedRows = listMode === "drop" ? bundle.rows : ticketRows;
  const totalPages = Math.max(1, Math.ceil(displayedRows.length / ROWS_PER_PAGE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleRows = useMemo(
    () => displayedRows.slice(safePageIndex * ROWS_PER_PAGE, safePageIndex * ROWS_PER_PAGE + ROWS_PER_PAGE),
    [displayedRows, safePageIndex],
  );
  const selectedRows = useMemo(
    () => displayedRows.filter((row) => selectedIds.includes(row.id)),
    [displayedRows, selectedIds],
  );

  const summaryRows = selectedRows.length > 0 ? selectedRows : displayedRows;
  const summaryLabel = selectedRows.length > 0 ? "By Selected Items:" : "List Totals:";
  const summary = useMemo(
    () => computeSummary(summaryRows, listMode),
    [summaryRows, listMode],
  );

  function applyFilters() {
    setPageIndex(0);
    const params = new URLSearchParams();
    params.set("listMode", listMode);
    if (ticketNumber.trim()) params.set("ticketNumber", ticketNumber.trim());
    if (farm.trim()) params.set("farm", farm.trim());
    if (barn.trim()) params.set("barn", barn.trim());
    if (bin.trim()) params.set("bin", bin.trim());
    if (flockCode.trim()) params.set("flockCode", flockCode.trim());
    if (dateFrom.trim()) params.set("dateFrom", dateFrom.trim());
    if (dateTo.trim()) params.set("dateTo", dateTo.trim());
    if (includeStarter) params.set("includeStarter", "true");
    if (includeGrower) params.set("includeGrower", "true");
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  function clearFilters() {
    setTicketNumber("");
    setFarm("");
    setBarn("");
    setBin("");
    setFlockCode("");
    setDateFrom("");
    setDateTo("");
    setIncludeStarter(false);
    setIncludeGrower(false);
    setSelectedIds([]);
    setPageIndex(0);
    const params = new URLSearchParams();
    params.set("listMode", listMode);
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function setAllSelected(checked: boolean) {
    setSelectedIds((current) => {
      const pageIds = visibleRows.map((row) => row.id);
      if (!checked) {
        return current.filter((id) => !pageIds.includes(id));
      }

      return Array.from(new Set([...current, ...pageIds]));
    });
  }

  return (
    <section className="panel table-card feed-ticket-flat-shell">
      {editorTicketId ? (
        <FeedTicketEditor
          onClose={() => setEditorTicketId(null)}
          onSaved={() => {
            setEditorTicketId(null);
            router.refresh();
          }}
          ticketId={editorTicketId === "__new__" ? null : editorTicketId}
        />
      ) : (
        <>
          <div className="feed-ticket-flat-top">
            <div className="feed-ticket-flat-left">
              <div className="feed-ticket-flat-heading">
                <p className="feed-ticket-flat-title">Filter Feed Tickets & Deliveries:</p>
              </div>

              <div className="feed-ticket-flat-listby">
                <span>List By:</span>
                <button
                  className="feed-ticket-flat-listby-option"
                  data-active={listMode === "ticket"}
                  onClick={() => {
                    setListMode("ticket");
                    setSelectedIds([]);
                    setPageIndex(0);
                  }}
                  type="button"
                >
                  <span className="feed-ticket-flat-listby-box">{listMode === "ticket" ? "X" : ""}</span>
                  Ticket
                </button>
                <button
                  className="feed-ticket-flat-listby-option"
                  data-active={listMode === "drop"}
                  onClick={() => {
                    setListMode("drop");
                    setSelectedIds([]);
                    setPageIndex(0);
                  }}
                  type="button"
                >
                  <span className="feed-ticket-flat-listby-box">{listMode === "drop" ? "X" : ""}</span>
                  Drop
                </button>
              </div>

              <div className="feed-ticket-flat-actions">
                <button className="button" onClick={() => setEditorTicketId("__new__")} type="button">
                  New Ticket
                </button>
                <button className="button" onClick={applyFilters} type="button">
                  Apply
                </button>
                <button className="button-secondary" onClick={clearFilters} type="button">
                  Clear
                </button>
              </div>
            </div>

            <div className="feed-ticket-flat-summary">
              <p className="feed-ticket-flat-summary-kicker">{summaryLabel}</p>
              <div className="feed-ticket-flat-summary-box">
                <div className="feed-ticket-flat-summary-line">
                  <span>Feed Order Tickets:</span>
                  <strong>{summary.ticketCount}</strong>
                </div>
                <div className="feed-ticket-flat-summary-line">
                  <span>Num Drops:</span>
                  <strong>{summary.dropCount}</strong>
                </div>
                <div className="feed-ticket-flat-summary-divider" />
                <div className="feed-ticket-flat-summary-line">
                  <span>Feed Type Starter:</span>
                  <strong>{formatWeightCompact(summary.starterDropWeightLbs)}</strong>
                </div>
                <div className="feed-ticket-flat-summary-line">
                  <span>Grower:</span>
                  <strong>{formatWeightCompact(summary.growerDropWeightLbs)}</strong>
                </div>
                <div className="feed-ticket-flat-summary-divider" />
                <div className="feed-ticket-flat-summary-line">
                  <span>Weight:</span>
                  <strong>{formatWeightCompact(summary.selectedDropWeightLbs)}</strong>
                </div>
              </div>
            </div>

            <div className="feed-ticket-flat-options">
              <p className="feed-ticket-flat-options-kicker">Filter Selections:</p>

              <label className="feed-ticket-flat-field feed-ticket-flat-ticket">
                <span>Ticket:</span>
                <input onChange={(event) => setTicketNumber(event.target.value)} placeholder="Feed Ticket #" type="text" value={ticketNumber} />
              </label>

              <div className="feed-ticket-flat-field-grid">
                <SelectorField
                  label="Farm:"
                  onOpen={() =>
                    setSelectorState({
                      field: "farm",
                      title: "Select Farm",
                      options: bundle.filterOptions.farms,
                    })
                  }
                  value={farm}
                />
                <SelectorField
                  label="Barn:"
                  onOpen={() =>
                    setSelectorState({
                      field: "barn",
                      title: "Select Barn",
                      options: bundle.filterOptions.barns,
                    })
                  }
                  value={barn}
                />
                <SelectorField
                  label="Bin:"
                  onOpen={() =>
                    setSelectorState({
                      field: "bin",
                      title: "Select Bin",
                      options: bundle.filterOptions.bins,
                    })
                  }
                  value={bin}
                />
              </div>

              <div className="feed-ticket-flat-field-grid feed-ticket-flat-field-grid-dates">
                <label className="feed-ticket-flat-field">
                  <span>From:</span>
                  <input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
                </label>
                <label className="feed-ticket-flat-field">
                  <span>To:</span>
                  <input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
                </label>
              </div>

              <SelectorField
                label="Flock Code:"
                onOpen={() =>
                  setSelectorState({
                    field: "flock",
                    title: "Select Flock",
                    options: bundle.filterOptions.flocks,
                  })
                }
                value={flockCode}
              />

              <div className="feed-ticket-flat-checks">
                <label className="feed-ticket-flat-check">
                  <input checked={includeStarter} onChange={(event) => setIncludeStarter(event.target.checked)} type="checkbox" />
                  <span>Starter</span>
                </label>
                <label className="feed-ticket-flat-check">
                  <input checked={includeGrower} onChange={(event) => setIncludeGrower(event.target.checked)} type="checkbox" />
                  <span>Grower</span>
                </label>
              </div>
            </div>
          </div>

          <p className="feed-ticket-flat-summary-text">{buildSummaryText({ farm, barn, bin, flockCode, ticketNumber }, displayedRows.length)}</p>

          <div className="feed-ticket-flat-table-shell">
            <div className="feed-ticket-flat-table-wrap">
              {listMode === "drop" ? (
                <table className="feed-ticket-flat-table feed-ticket-flat-table-drop" key="feed-ticket-drop-table">
                  <thead>
                    <tr>
                      <th className="feed-ticket-flat-checkcol">
                        <input
                          checked={visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id))}
                          onChange={(event) => setAllSelected(event.target.checked)}
                          type="checkbox"
                        />
                      </th>
                      <th>Date</th>
                      <th>Farm(s)</th>
                      <th>Barn(s)</th>
                      <th>Bin(s)</th>
                      <th>Flock(s)</th>
                      <th>Type</th>
                      <th>Drop Weight</th>
                      <th>Ticket</th>
                      <th>Source</th>
                      <th>Gross Weight</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length > 0 ? (
                      visibleRows.map((row) => (
                        <tr key={row.id}>
                          <td className="feed-ticket-flat-checkcol">
                            <input checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} type="checkbox" />
                          </td>
                          <td>{formatDate(row.deliveryDate)}</td>
                          <td>{row.farmName || "--"}</td>
                          <td>{row.barnCode || "--"}</td>
                          <td>{row.binCode || "--"}</td>
                          <td>{row.placementCode || "--"}</td>
                          <td>{toFeedShortLabel(row.feedType)}</td>
                          <td>{formatWeightCompact(row.dropWeightLbs)}</td>
                          <td>
                            <div className="feed-ticket-flat-subnote-cell">
                              <strong>{row.ticketNumber || "--"}</strong>
                              <span>ticket ref</span>
                            </div>
                          </td>
                          <td>{row.source || "--"}</td>
                          <td>{formatWeightCompact(row.grossWeightLbs)}</td>
                          <td className="list-action-cell">
                            <div className="list-action-stack">
                              <button
                                aria-label="Edit feed ticket"
                                className="list-action-button list-action-button-edit"
                                onClick={() => setEditorTicketId(row.ticketId)}
                                title="Edit"
                                type="button"
                              >
                                ✎
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="feed-ticket-flat-empty" colSpan={12}>
                          No feed ticket deliveries matched the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="feed-ticket-flat-table feed-ticket-flat-table-ticket" key="feed-ticket-ticket-table">
                  <thead>
                    <tr>
                      <th className="feed-ticket-flat-checkcol">
                        <input
                          checked={visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id))}
                          onChange={(event) => setAllSelected(event.target.checked)}
                          type="checkbox"
                        />
                      </th>
                      <th>Date</th>
                      <th>Ticket</th>
                      <th>Source</th>
                      <th>Gross Weight</th>
                      <th>Farm</th>
                      <th>Barn</th>
                      <th>Bin</th>
                      <th>Flock</th>
                      <th>Type</th>
                      <th>Drop Weight</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length > 0 ? (
                      visibleRows.map((row) => (
                        <tr key={row.id}>
                          <td className="feed-ticket-flat-checkcol">
                            <input checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} type="checkbox" />
                          </td>
                          <td>{formatDate(row.deliveryDate)}</td>
                          <td>{row.ticketNumber || "--"}</td>
                          <td>{row.source || "--"}</td>
                          <td>{formatWeightCompact(row.grossWeightLbs)}</td>
                          <td>
                            {renderAggregateCell("Included Farms", row.farmName, (title, value) =>
                              setReaderState({ title, value }),
                            )}
                          </td>
                          <td>
                            {renderAggregateCell("Included Barns", row.barnCode, (title, value) =>
                              setReaderState({ title, value }),
                            )}
                          </td>
                          <td>
                            {renderAggregateCell("Included Bins", row.binCode, (title, value) =>
                              setReaderState({ title, value }),
                            )}
                          </td>
                          <td>
                            {renderAggregateCell("Included Flocks", row.placementCode, (title, value) =>
                              setReaderState({ title, value }),
                            )}
                          </td>
                          <td>{row.feedType || "--"}</td>
                          <td>{formatWeightCompact(row.dropWeightLbs)}</td>
                          <td className="list-action-cell">
                            <div className="list-action-stack">
                              <button
                                aria-label="Edit feed ticket"
                                className="list-action-button list-action-button-edit"
                                onClick={() => setEditorTicketId(row.ticketId)}
                                title="Edit"
                                type="button"
                              >
                                ✎
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="feed-ticket-flat-empty" colSpan={12}>
                          No feed ticket deliveries matched the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {displayedRows.length > ROWS_PER_PAGE ? (
            <div className="feed-ticket-flat-pagination">
              <p className="feed-ticket-flat-pagination-copy">
                Page {safePageIndex + 1} of {totalPages}
              </p>
              <div className="feed-ticket-flat-pagination-actions">
                <button
                  className="button-secondary"
                  disabled={safePageIndex === 0}
                  onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="button-secondary"
                  disabled={safePageIndex >= totalPages - 1}
                  onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {selectorState ? (
        <div className="feed-ticket-selector-scrim" onClick={() => setSelectorState(null)}>
          <div className="feed-ticket-selector-card" onClick={(event) => event.stopPropagation()}>
            <p className="feed-ticket-selector-title">{selectorState.title}</p>
            <div className="feed-ticket-selector-list">
              <button
                className="feed-ticket-selector-option"
                onClick={() => {
                  assignSelectorValue(selectorState.field, "", { setFarm, setBarn, setBin, setFlockCode });
                  setSelectorState(null);
                }}
                type="button"
              >
                Clear Selection
              </button>
              {selectorState.options.map((option) => (
                <button
                  className="feed-ticket-selector-option"
                  key={option}
                  onClick={() => {
                    assignSelectorValue(selectorState.field, option, { setFarm, setBarn, setBin, setFlockCode });
                    setSelectorState(null);
                  }}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <button className="button-secondary" onClick={() => setSelectorState(null)} type="button">
              Close
            </button>
          </div>
        </div>
      ) : null}

      {readerState ? (
        <div className="sync-outbox-modal-shell" onClick={() => setReaderState(null)}>
          <div className="sync-outbox-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="sync-outbox-modal-header">
              <div>
                <p className="eyebrow">Feed Ticket Reader</p>
                <h3 className="section-title">{readerState.title}</h3>
              </div>
              <button className="button-secondary" onClick={() => setReaderState(null)} type="button">
                Close
              </button>
            </div>
            <pre className="sync-outbox-modal-value">{readerState.value}</pre>
          </div>
        </div>
      ) : null}

    </section>
  );
}

function SelectorField({
  label,
  value,
  onOpen,
}: {
  label: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <div className="feed-ticket-flat-field">
      <span>{label}</span>
      <button className="feed-ticket-flat-selector" onClick={onOpen} type="button">
        {value || label.replace(":", "")}
      </button>
    </div>
  );
}

function assignSelectorValue(
  field: "farm" | "barn" | "bin" | "flock",
  value: string,
  setters: {
    setFarm: (value: string) => void;
    setBarn: (value: string) => void;
    setBin: (value: string) => void;
    setFlockCode: (value: string) => void;
  },
) {
  if (field === "farm") setters.setFarm(value);
  if (field === "barn") setters.setBarn(value);
  if (field === "bin") setters.setBin(value);
  if (field === "flock") setters.setFlockCode(value);
}

function groupTicketRows(rows: FeedTicketAdminRow[]): TicketAggregateRow[] {
  const grouped = new Map<string, TicketAggregateRow>();

  for (const row of rows) {
    const key = `${row.ticketNumber ?? ""}:${row.deliveryDate ?? ""}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        id: key,
        ticketId: row.ticketId,
        deliveryDate: row.deliveryDate,
        ticketNumber: row.ticketNumber,
        source: row.source,
        grossWeightLbs: row.grossWeightLbs,
        farmName: row.farmName,
        barnCode: row.barnCode,
        binCode: row.binCode,
        placementCode: row.placementCode,
        feedType: row.feedType ? toFeedShortLabel(row.feedType) : null,
        dropWeightLbs: row.dropWeightLbs ?? 0,
        starterDropWeightLbs: row.feedType?.toLowerCase() === "starter" ? row.dropWeightLbs ?? 0 : 0,
        growerDropWeightLbs: row.feedType?.toLowerCase() === "grower" ? row.dropWeightLbs ?? 0 : 0,
        dropCount: 1,
        comment: row.comment,
      });
      continue;
    }

    current.dropWeightLbs += row.dropWeightLbs ?? 0;
    current.ticketId = row.ticketId;
    current.starterDropWeightLbs += row.feedType?.toLowerCase() === "starter" ? row.dropWeightLbs ?? 0 : 0;
    current.growerDropWeightLbs += row.feedType?.toLowerCase() === "grower" ? row.dropWeightLbs ?? 0 : 0;
    current.dropCount += 1;
    current.farmName = joinUnique(current.farmName, row.farmName);
    current.barnCode = joinUnique(current.barnCode, row.barnCode);
    current.binCode = joinUnique(current.binCode, row.binCode);
    current.placementCode = joinUnique(current.placementCode, row.placementCode);
    current.feedType = joinUnique(current.feedType, row.feedType ? toFeedShortLabel(row.feedType) : null);
    current.comment = joinUnique(current.comment, row.comment);
  }

  return Array.from(grouped.values());
}

function joinUnique(current: string | null, next: string | null) {
  const values = new Set(
    [current, next]
      .flatMap((value) => (value ?? "").split(","))
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return values.size > 0 ? Array.from(values).join(", ") : null;
}

function renderAggregateCell(
  title: string,
  value: string | null,
  onOpen: (title: string, value: string) => void,
) {
  const values = (value ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return "--";
  }

  if (values.length === 1) {
    return values[0];
  }

  return (
    <button
      aria-label={`View ${title}`}
      className="list-action-button list-action-button-more"
      onClick={() => onOpen(title, values.join("\n"))}
      title={title}
      type="button"
    >
      ...
    </button>
  );
}

function renderCommentCell(
  comment: string | null,
  onOpen: (title: string, value: string) => void,
) {
  const value = (comment ?? "").trim();
  if (!value) {
    return "--";
  }

  if (value.length <= 18 && !value.includes(",")) {
    return value;
  }

  const preview = value.length > 18 ? `${value.slice(0, 18).trimEnd()}...` : value;
  return (
    <button
      aria-label="View comment"
      className="list-action-button list-action-button-more"
      onClick={() => onOpen("Comment", value)}
      title="View comment"
      type="button"
    >
      ...
    </button>
  );
}

function computeSummary(
  rows: Array<FeedTicketAdminRow | TicketAggregateRow>,
  listMode: "ticket" | "drop",
) {
  if (listMode === "drop") {
    const dropRows = rows as FeedTicketAdminRow[];
    return {
      ticketCount: new Set(dropRows.map((row) => `${row.ticketNumber ?? ""}:${row.deliveryDate ?? ""}`)).size,
      dropCount: dropRows.length,
      starterDropWeightLbs: dropRows.reduce(
        (sum, row) => sum + (row.feedType?.toLowerCase() === "starter" ? row.dropWeightLbs ?? 0 : 0),
        0,
      ),
      growerDropWeightLbs: dropRows.reduce(
        (sum, row) => sum + (row.feedType?.toLowerCase() === "grower" ? row.dropWeightLbs ?? 0 : 0),
        0,
      ),
      selectedDropWeightLbs: dropRows.reduce((sum, row) => sum + (row.dropWeightLbs ?? 0), 0),
    };
  }

  const ticketRows = rows as TicketAggregateRow[];
  return {
    ticketCount: ticketRows.length,
    dropCount: ticketRows.reduce((sum, row) => sum + row.dropCount, 0),
    starterDropWeightLbs: ticketRows.reduce((sum, row) => sum + row.starterDropWeightLbs, 0),
    growerDropWeightLbs: ticketRows.reduce((sum, row) => sum + row.growerDropWeightLbs, 0),
    selectedDropWeightLbs: ticketRows.reduce((sum, row) => sum + row.dropWeightLbs, 0),
  };
}

function buildSummaryText(
  filters: {
    farm: string;
    barn: string;
    bin: string;
    flockCode: string;
    ticketNumber: string;
  },
  rowCount: number,
) {
  if (filters.flockCode) {
    return `Includes all feed_drops for Flock ${filters.flockCode}`;
  }
  if (filters.ticketNumber) {
    return `Includes all matched feed_drops for Ticket ${filters.ticketNumber}`;
  }
  if (filters.farm || filters.barn || filters.bin) {
    const parts = [filters.farm, filters.barn, filters.bin].filter(Boolean);
    return `Includes ${rowCount} matching records for ${parts.join(" / ")}`;
  }

  return `Includes ${rowCount} current list records.`;
}

function formatWeightCompact(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "2-digit",
    year: "2-digit",
  });
}

function toFeedShortLabel(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "starter") return "S";
  if (normalized === "grower") return "G";
  return normalized ? normalized.slice(0, 1).toUpperCase() : "--";
}
