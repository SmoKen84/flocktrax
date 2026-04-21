import Link from "next/link";

import {
  deleteBreedBenchmarkAction,
  saveBreedBenchmarkAction,
} from "@/app/admin/breed-benchmarks/actions";
import { PageHeader } from "@/components/page-header";
import {
  buildFamilyKey,
  getBreedBenchmarksBundle,
} from "@/lib/breed-benchmarks-data";

type BreedBenchmarksPageProps = {
  searchParams?: Promise<{
    family?: string | string[];
    entry?: string | string[];
    notice?: string | string[];
    error?: string | string[];
  }>;
};

export default async function BreedBenchmarksPage({ searchParams }: BreedBenchmarksPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedFamilyParam = readParam(params?.family);
  const selectedEntryParam = readParam(params?.entry);
  const isCreatingEntry = selectedEntryParam === "new";
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);

  const bundle = await getBreedBenchmarksBundle();
  const selectedFamily =
    bundle.families.find((family) => family.key === selectedFamilyParam) ??
    bundle.families[0] ??
    null;
  const familyEntries = selectedFamily
    ? bundle.entries.filter((entry) => buildFamilyKey(entry.geneticLine, entry.sex) === selectedFamily.key)
    : bundle.entries;
  const selectedEntry =
    isCreatingEntry
      ? null
      : familyEntries.find((entry) => entry.id === selectedEntryParam) ??
        (selectedEntryParam ? null : familyEntries[0] ?? null);

  const buildBenchmarksHref = (options: {
    family?: string | null;
    entry?: string | null;
  } = {}) => {
    const query = new URLSearchParams();
    const family = options.family === undefined ? selectedFamily?.key ?? null : options.family;
    const entry = options.entry === undefined ? selectedEntry?.id ?? null : options.entry;

    if (family) query.set("family", family);
    if (entry) query.set("entry", entry);

    const search = query.toString();
    return search ? `/admin/breed-benchmarks?${search}` : "/admin/breed-benchmarks";
  };

  const returnTo = buildBenchmarksHref();

  return (
    <>
      <PageHeader
        eyebrow="Breed Benchmarks"
        title="Maintain the daily benchmark curves used to compare live flock performance."
        body="These benchmark lines define expected lifecycle performance by breed and profile so recorded weight and feed results can be judged against the right day-by-day standard."
        actions={
          <Link className="button" href={buildBenchmarksHref({ entry: "new" })}>
            New Benchmark Entry
          </Link>
        }
      />

      <section className="breed-benchmark-grid">
        <article className="panel breed-benchmark-panel">
          <div className="section-header breed-benchmark-header">
            <div>
              <p className="eyebrow">Benchmark Families</p>
              <h2>Genetic line and sex sets</h2>
            </div>
          </div>

          <p className="breed-benchmark-copy">
            Use one family per genetic-line and sex combination. For male and female standards, keep the same genetic
            line and use separate sex values so each lifecycle curve can be managed independently.
          </p>

          <div className="breed-benchmark-family-list">
            {bundle.families.length > 0 ? (
              bundle.families.map((family) => (
                <Link
                  className="breed-benchmark-family-item"
                  data-active={family.key === selectedFamily?.key}
                  href={buildBenchmarksHref({ family: family.key, entry: null })}
                  key={family.key}
                >
                  <div>
                    <p className="breed-benchmark-family-title">{family.geneticLine}</p>
                    <p className="breed-benchmark-family-subtitle">{family.sex}</p>
                  </div>
                  <div className="breed-benchmark-family-meta">
                    <span>{family.entryCount} entries</span>
                    <span>{family.activeCount} active</span>
                    <span>{family.ageRangeLabel}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="settings-empty-state">No breed benchmark rows are in the live table yet.</p>
            )}
          </div>
        </article>

        <article className="panel breed-benchmark-panel">
          <div className="section-header breed-benchmark-header">
            <div>
              <p className="eyebrow">Daily Curve</p>
              <h2>{selectedFamily ? selectedFamily.displayLabel : "Select a benchmark family"}</h2>
            </div>
          </div>

          {notice ? <p className="login-banner login-banner-notice">{decodeURIComponent(notice)}</p> : null}
          {error ? <p className="login-banner login-banner-error">{decodeURIComponent(error)}</p> : null}

          <div className="breed-benchmark-table-wrap">
            <table className="breed-benchmark-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Feed / Bird</th>
                  <th>Target Weight</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {familyEntries.length > 0 ? (
                  familyEntries.map((entry) => (
                    <tr data-active={entry.id === selectedEntry?.id} key={entry.id}>
                      <td>
                        <Link
                          className="breed-benchmark-entry-link"
                          href={buildBenchmarksHref({ entry: entry.id })}
                        >
                          Day {entry.ageDays ?? "-"}
                        </Link>
                      </td>
                      <td>{formatNumber(entry.feedPerBird)}</td>
                      <td>{formatNumber(entry.targetWeight)}</td>
                      <td>
                        <span className="status-pill" data-tone={entry.isActive ? "good" : "danger"}>
                          {entry.isActive ? "active" : "inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="breed-benchmark-empty-cell" colSpan={4}>
                      Select a family or add the first benchmark row for a new breed/profile combination.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel breed-benchmark-panel breed-benchmark-editor-panel">
          <div className="section-header breed-benchmark-header">
            <div>
              <p className="eyebrow">Benchmark Entry</p>
              <h2>{selectedEntry ? `Edit Day ${selectedEntry.ageDays ?? "-"}` : "Add a new daily benchmark"}</h2>
            </div>
          </div>

          <form action={saveBreedBenchmarkAction} className="breed-benchmark-form">
            <input name="return_to" type="hidden" value={returnTo} />
            <input name="benchmark_id" type="hidden" value={selectedEntry?.id ?? ""} />

            <div className="form-grid">
              <div className="field">
                <label htmlFor="breed-code">Genetic Line</label>
                <input
                  defaultValue={selectedEntry?.geneticLine ?? selectedFamily?.geneticLine ?? ""}
                  id="breed-code"
                  name="breed_code"
                  placeholder="ROSS708"
                />
              </div>

              <div className="field">
                <label htmlFor="profile-label">Sex</label>
                <input
                  defaultValue={selectedEntry?.sex ?? selectedFamily?.sex ?? ""}
                  id="profile-label"
                  name="profile_label"
                  placeholder="Male"
                />
              </div>

              <div className="field">
                <label htmlFor="age-days">Day</label>
                <input
                  defaultValue={selectedEntry?.ageDays ?? ""}
                  id="age-days"
                  min={0}
                  name="age_days"
                  placeholder="0"
                  type="number"
                />
              </div>

              <div className="field">
                <label htmlFor="feed-per-bird">Feed / Bird</label>
                <input
                  defaultValue={selectedEntry?.feedPerBird ?? ""}
                  id="feed-per-bird"
                  inputMode="decimal"
                  name="feed_per_bird"
                  placeholder="0.00"
                />
              </div>

              <div className="field">
                <label htmlFor="target-weight">Target Weight</label>
                <input
                  defaultValue={selectedEntry?.targetWeight ?? ""}
                  id="target-weight"
                  inputMode="decimal"
                  name="target_weight"
                  placeholder="0.00"
                />
              </div>

              <label className="settings-toggle breed-benchmark-toggle">
                <input defaultChecked={selectedEntry ? selectedEntry.isActive : true} name="is_active" type="checkbox" />
                <span>Active benchmark line</span>
              </label>

              <div className="field field-wide">
                <label htmlFor="benchmark-note">Notes</label>
                <textarea
                  defaultValue={selectedEntry?.note ?? ""}
                  id="benchmark-note"
                  name="note"
                  placeholder="Operator note, source note, or special expectation for this benchmark day."
                  rows={5}
                />
              </div>
            </div>

            <div className="breed-benchmark-help">
              <p>
                Use the same genetic line with separate sex values like <strong>Male</strong> and <strong>Female</strong> to
                maintain split lifecycle curves for the same line.
              </p>
              <p>
                Day values should be unique within a genetic-line and sex set so the weight comparison logic always resolves to one
                benchmark line for a given age.
              </p>
            </div>

            <div className="settings-action-row">
              <Link className="button-secondary settings-action-button" href={buildBenchmarksHref({ entry: "new" })}>
                Clear
              </Link>
              {selectedEntry ? (
                <button className="button-secondary settings-action-button" formAction={deleteBreedBenchmarkAction} type="submit">
                  Delete
                </button>
              ) : null}
              <button className="button settings-action-button" type="submit">
                {selectedEntry ? "Save Entry" : "Add Entry"}
              </button>
            </div>

            <input
              name="family_key"
              type="hidden"
              value={selectedFamily?.key ?? (selectedEntry ? buildFamilyKey(selectedEntry.geneticLine, selectedEntry.sex) : "")}
            />
          </form>
        </article>
      </section>
    </>
  );
}

function readParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
