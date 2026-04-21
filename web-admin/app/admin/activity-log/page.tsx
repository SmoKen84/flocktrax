import { ActivityLogTable } from "@/app/admin/activity-log/activity-log-table";
import { PageHeader } from "@/components/page-header";
import { getActivityLogEntries } from "@/lib/admin-data";
import { getPlatformScreenTextValues } from "@/lib/platform-content";

type ActivityLogPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ActivityLogPage({ searchParams }: ActivityLogPageProps) {
  const params = (await searchParams) ?? {};
  const page = parsePositiveInteger(firstParam(params.page), 1);
  const filters = {
    when: firstParam(params.when),
    farm: firstParam(params.farm),
    barn: firstParam(params.barn),
    flock: firstParam(params.flock),
    user: firstParam(params.user),
  };
  const bundle = await getActivityLogEntries(filters, page, 50);
  const screenText = await getPlatformScreenTextValues(["audit_log_title", "audit_log_desc", "log_filter_desc"]);
  const heroTitle = screenText.get("audit_log_title") || "System Activity Diary";
  const heroBody =
    screenText.get("audit_log_desc") ||
    "This archive keeps a readable chronological narrative of system work, barn activity, comments, and state changes without duplicating the detailed flock records.";
  const filterBody =
    screenText.get("log_filter_desc") ||
    "Filter by date, farm, barn, flock, or user to narrow the operating history before opening the clipped details, user, or source fields.";

  return (
    <>
      <PageHeader
        eyebrow="Archives"
        title={heroTitle}
        body={heroBody}
      />

      <section className="panel table-card">
        <div className="activity-log-shell-top">
          <div className="activity-log-shell-header">
            <div>
              <p className="eyebrow">Activity Log</p>
              <p className="hero-body activity-log-shell-body">{filterBody}</p>
            </div>
          </div>
          <form className="activity-log-filters activity-log-filter-hero" method="get">
            <p className="activity-log-filter-kicker">Filters:</p>
            <label className="sync-engine-field">
              <span>When</span>
              <input defaultValue={filters.when ?? ""} name="when" type="date" />
            </label>
            <label className="sync-engine-field">
              <span>Farm</span>
              <input defaultValue={filters.farm ?? ""} name="farm" placeholder="Farm name" type="text" />
            </label>
            <label className="sync-engine-field">
              <span>Barn</span>
              <input defaultValue={filters.barn ?? ""} name="barn" placeholder="Barn code" type="text" />
            </label>
            <label className="sync-engine-field">
              <span>Flock</span>
              <input defaultValue={filters.flock ?? ""} name="flock" placeholder="Placement / flock" type="text" />
            </label>
            <label className="sync-engine-field">
              <span>User</span>
              <input defaultValue={filters.user ?? ""} name="user" placeholder="User name" type="text" />
            </label>
            <input name="page" type="hidden" value="1" />
            <div className="activity-log-filter-actions">
              <button className="button" type="submit">
                Apply Filters
              </button>
              <a className="button-secondary" href="/admin/activity-log">
                Clear
              </a>
            </div>
          </form>
        </div>
        <ActivityLogTable entries={bundle.entries} />
        <div className="activity-log-pagination">
          <p className="activity-log-pagination-copy">
            Page {bundle.page} of {bundle.totalPages} · {bundle.totalCount} total entries
          </p>
          <div className="activity-log-pagination-actions">
            {bundle.hasPreviousPage ? (
              <a className="button-secondary" href={buildActivityLogHref(filters, bundle.page - 1)}>
                Previous
              </a>
            ) : (
              <span className="button-secondary activity-log-pagination-disabled">Previous</span>
            )}
            {bundle.hasNextPage ? (
              <a className="button-secondary" href={buildActivityLogHref(filters, bundle.page + 1)}>
                Next
              </a>
            ) : (
              <span className="button-secondary activity-log-pagination-disabled">Next</span>
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

function buildActivityLogHref(
  filters: {
    when: string | null;
    farm: string | null;
    barn: string | null;
    flock: string | null;
    user: string | null;
  },
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.when) params.set("when", filters.when);
  if (filters.farm) params.set("farm", filters.farm);
  if (filters.barn) params.set("barn", filters.barn);
  if (filters.flock) params.set("flock", filters.flock);
  if (filters.user) params.set("user", filters.user);
  params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/activity-log?${query}` : "/admin/activity-log";
}
