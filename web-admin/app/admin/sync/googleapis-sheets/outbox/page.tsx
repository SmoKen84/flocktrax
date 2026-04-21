import { SyncEngineNav } from "@/app/admin/sync/googleapis-sheets/sync-engine-nav";
import { OutboxConsole } from "@/app/admin/sync/googleapis-sheets/outbox/outbox-console";
import { PageHeader } from "@/components/page-header";
import { getGoogleSheetsOutboxBundle } from "@/lib/sync-data";

type GoogleSheetsOutboxPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GoogleSheetsOutboxPage({ searchParams }: GoogleSheetsOutboxPageProps) {
  const params = (await searchParams) ?? {};
  const resultBanner = buildResultBanner(params);
  const bundle = await getGoogleSheetsOutboxBundle({
    status: firstParam(params.status),
    farmId: firstParam(params.farmId),
    entityType: firstParam(params.entityType),
    search: firstParam(params.search),
  });

  return (
    <>
      <PageHeader
        eyebrow="Sync Engine"
        title="Google Sheets Outbox"
        body="This is the adapter work queue for Google Sheets. New mobile and admin log saves will land here first, then the worker can claim and send them to the farm workbook."
        actions={<SyncEngineNav current="outbox" />}
      />

      <section className="panel sync-engine-page">
        <article className="card sync-engine-shell">
          <div className="sync-engine-shell-header">
            <div>
              <p className="eyebrow">Queue Overview</p>
              <h2>{bundle.adapter?.adapter_name ?? "Google APIs / Sheets"}</h2>
              <p className="hero-body">
                Pending jobs represent date-based worksheet updates for placement tabs named from <code>placement_key</code>.
              </p>
            </div>
          </div>

          <OutboxConsole
            currentOperation={bundle.currentOperation}
            filters={bundle.filters}
            initialBanner={resultBanner}
            items={bundle.items}
            stats={bundle.stats}
          />

          <form className="sync-outbox-filters" method="get">
            <label className="sync-engine-field">
              <span>Status</span>
              <select defaultValue={bundle.filters.status} name="status">
                <option value="">All statuses</option>
                {bundle.filterOptions.statuses.map((status) => (
                  <option key={status} value={status}>
                    {formatFilterLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="sync-engine-field">
              <span>Farm</span>
              <select defaultValue={bundle.filters.farmId} name="farmId">
                <option value="">All farms</option>
                {bundle.filterOptions.farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farmName}
                  </option>
                ))}
              </select>
            </label>

            <label className="sync-engine-field">
              <span>Entity</span>
              <select defaultValue={bundle.filters.entityType} name="entityType">
                <option value="">All entities</option>
                {bundle.filterOptions.entityTypes.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {entityType}
                  </option>
                ))}
              </select>
            </label>

            <label className="sync-engine-field">
              <span>Search</span>
              <input defaultValue={bundle.filters.search} name="search" placeholder="Placement, endpoint, workbook, error..." type="text" />
            </label>

            <div className="sync-outbox-filter-actions">
              <button className="button" type="submit">
                Apply Filters
              </button>
              <a className="button-secondary" href="/admin/sync/googleapis-sheets/outbox">
                Clear
              </a>
            </div>
          </form>
        </article>
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

function formatFilterLabel(value: string) {
  return value.replaceAll("_", " ");
}

function buildResultBanner(params: Record<string, string | string[] | undefined>) {
  const retrySkipped = firstParam(params.retrySkipped);
  const skippedCount = Number.parseInt(retrySkipped ?? "", 10);
  const retryFailed = firstParam(params.retryFailed);
  const failedCount = Number.parseInt(retryFailed ?? "", 10);
  const retryReason = firstParam(params.retryReason);
  const error = firstParam(params.error);
  if (error) {
    return {
      tone: "error" as const,
      message: formatOutboxError(
        error,
        Number.isFinite(skippedCount) ? skippedCount : 0,
        Number.isFinite(failedCount) ? failedCount : 0,
        retryReason,
      ),
    };
  }

  const retried = firstParam(params.retried);
  if (retried) {
    const count = Number.parseInt(retried, 10);
    if (Number.isFinite(failedCount) && failedCount > 0) {
      return {
        tone: "success" as const,
        message: `Results: ${count} outbox ${count === 1 ? "row was" : "rows were"} moved back to pending. ${failedCount} ${failedCount === 1 ? "row failed" : "rows failed"} to requeue.${retryReason ? ` First error: ${retryReason}` : ""}`,
      };
    }

    if (Number.isFinite(count) && count > 1) {
      if (Number.isFinite(skippedCount) && skippedCount > 0) {
        return {
          tone: "success" as const,
          message: `Results: ${count} outbox rows were moved back to pending. ${skippedCount} ${skippedCount === 1 ? "row was" : "rows were"} skipped because ${skippedCount === 1 ? "it was" : "they were"} no longer retryable.`,
        };
      }

      return {
        tone: "success" as const,
        message: `Results: ${count} outbox rows were moved back to pending and are ready for the worker to claim.`,
      };
    }

    if (Number.isFinite(skippedCount) && skippedCount > 0) {
      return {
        tone: "success" as const,
        message: `Results: 1 outbox row was moved back to pending. ${skippedCount} ${skippedCount === 1 ? "row was" : "rows were"} skipped because ${skippedCount === 1 ? "it was" : "they were"} no longer retryable.`,
      };
    }

    return {
      tone: "success" as const,
      message: "Results: 1 outbox row was moved back to pending and is ready for the worker to claim.",
    };
  }

  const launched = firstParam(params.launched);
  if (launched) {
    const count = Number.parseInt(launched, 10);
    return {
      tone: "success" as const,
      message: `Results: the local sync worker was launched for up to ${Number.isFinite(count) && count > 0 ? count : 10} queued rows. Refresh to watch jobs move into progress or sent status.`,
    };
  }

  return null;
}

function formatOutboxError(error: string, skippedCount = 0, failedCount = 0, retryReason: string | null = null) {
  switch (error) {
    case "missing_google_credentials":
      return "Results: the local worker could not start because GOOGLE_APPLICATION_CREDENTIALS is not set on this machine.";
    case "missing_worker_env":
      return "Results: the local worker could not start because the hosted Supabase worker environment is incomplete.";
    case "invalid_process_limit":
      return "Results: batch size must be between 1 and 100 rows.";
    case "worker_launch_failed":
      return "Results: the local worker process could not be launched from the Outbox page.";
    case "bulk_retry_none_applied":
      return `Results: no outbox rows were requeued. ${skippedCount > 0 ? `${skippedCount} ${skippedCount === 1 ? "selected row was" : "selected rows were"} already no longer retryable.` : "The selected rows were no longer retryable."}`;
    case "bulk_retry_failed_detail":
      return `Results: no outbox rows were requeued. ${failedCount > 0 ? `${failedCount} ${failedCount === 1 ? "selected row failed" : "selected rows failed"} during retry.` : "The retry failed."}${retryReason ? ` First error: ${retryReason}` : ""}`;
    case "bulk_retry_no_matches":
      return "Results: no retryable outbox rows matched the current bulk selection.";
    case "bulk_retry_lookup_failed":
      return "Results: the bulk retry could not resolve the selected farm endpoints.";
    case "bulk_retry_query_failed":
      return "Results: the bulk retry query failed before any rows were updated.";
    case "retry_failed":
      return `Results: that outbox row could not be moved back to pending.${retryReason ? ` Error: ${retryReason}` : ""}`;
    case "retry_no_longer_retryable":
      return "Results: that outbox row is no longer in failed/rejected status, so it could not be requeued.";
    default:
      return "Results: the requested queue action could not be completed.";
  }
}
