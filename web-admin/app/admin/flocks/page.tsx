import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";
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
    integrator: firstParam(params.integrator),
    placed: firstParam(params.placed),
  };

  const data = await getAdminData();
  const screenText = await getPlatformScreenTextValues([
    "archive_flocks_title",
    "archive_flocks_desc",
    "archive_flocks_filter",
  ]);

  const heroTitle = screenText.get("archive_flocks_title") || "Flock Archive";
  const heroBody =
    screenText.get("archive_flocks_desc") ||
    "This archive keeps completed flock history available without mixing it into the live scheduling workflow.";
  const filterBody =
    screenText.get("archive_flocks_filter") ||
    "Filter by flock, integrator, or placed date to narrow the archive before opening the archived flock detail.";

  const archivedFlocks = data.flocks.filter((flock) => flock.status === "complete");
  const filteredFlocks = archivedFlocks.filter((flock) => {
    const flockNeedle = normalize(filters.flock);
    const integratorNeedle = normalize(filters.integrator);
    const placedNeedle = normalize(filters.placed);

    if (
      flockNeedle &&
      !`${flock.placementCode ?? ""} ${flock.flockCode}`.toLowerCase().includes(flockNeedle.toLowerCase())
    ) {
      return false;
    }

    if (integratorNeedle && !flock.integrator.toLowerCase().includes(integratorNeedle.toLowerCase())) {
      return false;
    }

    if (placedNeedle && flock.placedDate !== placedNeedle) {
      return false;
    }

    return true;
  });

  const totalCount = filteredFlocks.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = filteredFlocks.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <>
      <PageHeader eyebrow="Archives" title={heroTitle} body={heroBody} />

      <section className="panel table-card">
        <div className="flock-archive-shell-top">
          <div className="flock-archive-shell-header">
            <div>
              <p className="eyebrow">Archived Flocks</p>
              <p className="hero-body flock-archive-shell-body">{filterBody}</p>
            </div>
          </div>
          <form className="flock-archive-filters flock-archive-filter-hero" method="get">
            <p className="flock-archive-filter-kicker">Filters:</p>
            <label className="sync-engine-field">
              <span>Flock</span>
              <input defaultValue={filters.flock ?? ""} name="flock" placeholder="Placement / flock" type="text" />
            </label>
            <label className="sync-engine-field">
              <span>Integrator</span>
              <input defaultValue={filters.integrator ?? ""} name="integrator" placeholder="Integrator" type="text" />
            </label>
            <label className="sync-engine-field">
              <span>Placed</span>
              <input defaultValue={filters.placed ?? ""} name="placed" type="date" />
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
                <th>First Catch</th>
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
                        <p className="table-subtitle">Open archived flock detail and placement context</p>
                      </Link>
                    </td>
                    <td>{flock.integrator}</td>
                    <td>{formatArchiveDate(flock.placedDate)}</td>
                    <td>{formatArchiveDate(flock.estimatedFirstCatch)}</td>
                    <td>{(flock.femaleCount + flock.maleCount).toLocaleString()}</td>
                    <td>
                      <span className="status-pill" data-tone="danger">
                        {formatStatusLabel(flock.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <p className="table-subtitle">No archived flocks matched the current filter set.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flock-archive-pagination">
          <p className="flock-archive-pagination-copy">
            Page {safePage} of {totalPages} · {totalCount} archived flocks
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
    integrator: string | null;
    placed: string | null;
  },
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.flock) params.set("flock", filters.flock);
  if (filters.integrator) params.set("integrator", filters.integrator);
  if (filters.placed) params.set("placed", filters.placed);
  params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/flocks?${query}` : "/admin/flocks";
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
  return value.charAt(0).toUpperCase() + value.slice(1);
}
