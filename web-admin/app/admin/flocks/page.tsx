import Link from "next/link";

import { GoBackButton } from "@/components/go-back-button";
import { PageHeader } from "@/components/page-header";
import { getFlockArchiveRecords } from "@/lib/flock-archive-data";
import { getPlatformScreenTextValues } from "@/lib/platform-content";

type FlocksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 50;

export default async function FlocksPage({ searchParams }: FlocksPageProps) {
  const params = (await searchParams) ?? {};
  const page = parsePositiveInteger(firstParam(params.page), 1);
  const filters = {
    flock: firstParam(params.flock),
    farmGroup: firstParam(params.farmGroup),
    farm: firstParam(params.farm),
    barn: firstParam(params.barn),
    placedMonth: firstParam(params.placedMonth),
    closedMonth: firstParam(params.closedMonth),
  };

  const [archiveRecords, screenText] = await Promise.all([
    getFlockArchiveRecords(),
    getPlatformScreenTextValues([
      "archive_flocks_title",
      "archive_flocks_desc",
      "archive_flocks_filter",
    ]),
  ]);

  const heroTitle = screenText.get("archive_flocks_title") || "Flock Archive";
  const heroBody =
    screenText.get("archive_flocks_desc") ||
    "This archive keeps completed and canceled flock history available without mixing it into the live scheduling workflow.";
  const filterBody =
    screenText.get("archive_flocks_filter") ||
    "Narrow completed or canceled flock history by placement, operating location, placed month, or closeout month.";

  const visibleFlocks = archiveRecords.slice().sort((left, right) => {
    const leftDate = left.placedDate || "";
    const rightDate = right.placedDate || "";
    return (
      rightDate.localeCompare(leftDate) ||
      (left.placementCode ?? left.flockCode).localeCompare(right.placementCode ?? right.flockCode)
    );
  });
  const filteredFlocks = visibleFlocks.filter((flock) => {
    const flockNeedle = normalize(filters.flock);
    const farmGroupNeedle = normalize(filters.farmGroup);
    const farmNeedle = normalize(filters.farm);
    const barnNeedle = normalize(filters.barn);
    const placedMonth = normalize(filters.placedMonth);
    const closedMonth = normalize(filters.closedMonth);

    if (
      flockNeedle &&
      !`${flock.placementCodes.join(" ")} ${flock.flockCode}`.toLowerCase().includes(flockNeedle.toLowerCase())
    ) {
      return false;
    }

    if (farmGroupNeedle && !flock.farmGroupNames.includes(farmGroupNeedle)) return false;
    if (farmNeedle && !flock.farmNames.includes(farmNeedle)) return false;
    if (barnNeedle && !flock.barnCodes.includes(barnNeedle)) return false;
    if (placedMonth && !flock.placedDate.startsWith(placedMonth)) return false;
    if (closedMonth && !flock.closedDates.some((date) => date.startsWith(closedMonth))) return false;

    return true;
  });

  const totalCount = filteredFlocks.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = filteredFlocks.slice(pageStart, pageStart + PAGE_SIZE);
  const farmGroupOptions = collectOptions(visibleFlocks.flatMap((flock) => flock.farmGroupNames));
  const farmOptions = collectOptions(
    visibleFlocks
      .filter((flock) => !filters.farmGroup || flock.farmGroupNames.includes(filters.farmGroup))
      .flatMap((flock) => flock.farmNames),
  );
  const barnOptions = collectOptions(
    visibleFlocks
      .filter((flock) => !filters.farmGroup || flock.farmGroupNames.includes(filters.farmGroup))
      .filter((flock) => !filters.farm || flock.farmNames.includes(filters.farm))
      .flatMap((flock) => flock.barnCodes),
  );

  return (
    <>
      <PageHeader eyebrow="Flocks" title={heroTitle} body={heroBody} actions={<GoBackButton />} />

      <section className="panel table-card">
        <div className="flock-archive-shell-top">
          <div className="flock-archive-shell-header">
            <div>
              <p className="eyebrow">Flock Lookup</p>
              <p className="hero-body flock-archive-shell-body">{filterBody}</p>
            </div>
          </div>
          <form className="flock-archive-filters flock-archive-filter-hero" method="get">
            <p className="flock-archive-filter-kicker">Filters:</p>
            <label className="sync-engine-field">
              <span>Placement / Flock</span>
              <input defaultValue={filters.flock ?? ""} name="flock" placeholder="Placement / flock" type="text" />
            </label>
            <label className="sync-engine-field">
              <span>Farm Group</span>
              <select defaultValue={filters.farmGroup ?? ""} name="farmGroup">
                <option value="">All farm groups</option>
                {farmGroupOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sync-engine-field">
              <span>Farm</span>
              <select defaultValue={filters.farm ?? ""} name="farm">
                <option value="">All farms</option>
                {farmOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sync-engine-field">
              <span>Barn</span>
              <select defaultValue={filters.barn ?? ""} name="barn">
                <option value="">All barns</option>
                {barnOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sync-engine-field">
              <span>Month Placed</span>
              <input defaultValue={filters.placedMonth ?? ""} name="placedMonth" type="month" />
            </label>
            <label className="sync-engine-field">
              <span>Month Closed</span>
              <input defaultValue={filters.closedMonth ?? ""} name="closedMonth" type="month" />
            </label>
            <input name="page" type="hidden" value="1" />
            <div className="flock-archive-filter-actions">
              <button className="button" type="submit">
                Apply Filters
              </button>
              <a className="button-secondary" href="/admin/flocks">
                Clear
              </a>
            </div>
          </form>
        </div>

        <div className="table-wrap flock-archive-table-wrap">
          <table className="flock-archive-table">
            <thead>
              <tr>
                <th>Flock</th>
                <th>Integrator</th>
                <th>Placed</th>
                <th>Closed / Canceled</th>
                <th>Bird Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length > 0 ? (
                pageItems.map((flock) => (
                  <tr key={flock.id}>
                    <td>
                      <Link className="flock-archive-link" href={`/admin/flocks/${flock.id}`}>
                        <p className="table-title">{flock.placementCode ?? `Flock ${flock.flockCode}`}</p>
                      </Link>
                    </td>
                    <td>{flock.integrator}</td>
                    <td>{formatArchiveDate(flock.placedDate)}</td>
                    <td>{formatArchiveDate(flock.closedDate)}</td>
                    <td>{(flock.femaleCount + flock.maleCount).toLocaleString()}</td>
                    <td>
                      <span className="status-pill" data-tone={resolveStatusTone(flock.status)}>
                        {formatStatusLabel(flock.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <p className="table-subtitle">No flocks matched the current filter set.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flock-archive-pagination">
          <p className="flock-archive-pagination-copy">
            Page {safePage} of {totalPages} · {totalCount} historical flocks
          </p>
          <div className="flock-archive-pagination-actions">
            {safePage > 1 ? (
              <a className="button-secondary" href={buildFlockArchiveHref(filters, safePage - 1)}>
                Previous
              </a>
            ) : (
              <span className="button-secondary flock-archive-pagination-disabled">Previous</span>
            )}
            {safePage < totalPages ? (
              <a className="button-secondary" href={buildFlockArchiveHref(filters, safePage + 1)}>
                Next
              </a>
            ) : (
              <span className="button-secondary flock-archive-pagination-disabled">Next</span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function buildFlockArchiveHref(
  filters: {
    flock: string | null;
    farmGroup: string | null;
    farm: string | null;
    barn: string | null;
    placedMonth: string | null;
    closedMonth: string | null;
  },
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.flock) params.set("flock", filters.flock);
  if (filters.farmGroup) params.set("farmGroup", filters.farmGroup);
  if (filters.farm) params.set("farm", filters.farm);
  if (filters.barn) params.set("barn", filters.barn);
  if (filters.placedMonth) params.set("placedMonth", filters.placedMonth);
  if (filters.closedMonth) params.set("closedMonth", filters.closedMonth);
  params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/flocks?${query}` : "/admin/flocks";
}

function collectOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function formatArchiveDate(value: string) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

function formatStatusLabel(value: string) {
  if (value === "canceled") return "CANCELED";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function resolveStatusTone(value: string) {
  if (value === "complete") return "good";
  if (value === "archived") return "neutral";
  return "warn";
}
