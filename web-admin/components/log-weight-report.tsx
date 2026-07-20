import type {
  PlacementLogWeightReportBundle,
  PlacementLogWeightReportRow,
} from "@/lib/placement-log-weight-report";

export function LogWeightReportSection({
  bundle,
  description,
  title = "Log Weight vs Breed Specs",
}: {
  bundle: PlacementLogWeightReportBundle;
  description: string;
  title?: string;
}) {
  const sampledDates = new Set(bundle.rows.map((row) => row.logDate)).size;

  return (
    <section className="closeout-report-section digital-archive-report-break">
      <div className="closeout-report-section-header">
        <div>
          <p className="eyebrow">Log Weight Report</p>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </div>

      <div className="closeout-report-feed-summary-strip">
        <span className="closeout-report-summary-pill">
          <small>Sample Rows</small>
          <strong>{formatWhole(bundle.rows.length)}</strong>
        </span>
        <span className="closeout-report-summary-pill">
          <small>Sample Dates</small>
          <strong>{formatWhole(sampledDates)}</strong>
        </span>
        <span className="closeout-report-summary-pill">
          <small>Male Breed</small>
          <strong>{bundle.maleBreedName || "--"}</strong>
        </span>
        <span className="closeout-report-summary-pill">
          <small>Female Breed</small>
          <strong>{bundle.femaleBreedName || "--"}</strong>
        </span>
        <span className="closeout-report-summary-pill">
          <small>Latest Male</small>
          <strong>{formatLatestSample(bundle.latestMaleRow)}</strong>
        </span>
        <span className="closeout-report-summary-pill">
          <small>Latest Female</small>
          <strong>{formatLatestSample(bundle.latestFemaleRow)}</strong>
        </span>
      </div>

      <div className="closeout-report-table-wrap">
        <table className="closeout-report-table log-weight-report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Age</th>
              <th>Sex</th>
              <th>Breed</th>
              <th>Cnt</th>
              <th>Avg Wt</th>
              <th>StdDev</th>
              <th>Procure</th>
              <th>Spec Wt</th>
              <th>Breed Spec %</th>
              <th>Delta</th>
              <th>Feed/Bird</th>
              <th>Sample Note</th>
              <th>Spec Note</th>
            </tr>
          </thead>
          <tbody>
            {bundle.rows.length > 0 ? (
              bundle.rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatShortDate(row.logDate)}</td>
                  <td>{formatWholeNullable(row.ageDays)}</td>
                  <td>{formatSex(row.sex)}</td>
                  <td>{row.breedName || row.benchmarkGeneticName || "--"}</td>
                  <td>{formatWholeNullable(row.sampleCount)}</td>
                  <td>{formatRatio(row.averageWeight)}</td>
                  <td>{formatRatio(row.standardDeviation)}</td>
                  <td>{formatRatio(row.procure)}</td>
                  <td>{formatRatio(row.benchmarkTargetWeight)}</td>
                  <td>{formatPercent(row.percentOfBenchmark)}</td>
                  <td className={varianceClassName(row)}>{formatSignedRatio(row.varianceFromBenchmark)}</td>
                  <td>{formatRatio(row.benchmarkDayFeedPerBird)}</td>
                  <td>{formatText(row.sampleNote)}</td>
                  <td>{formatText(row.benchmarkNote)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="closeout-report-empty" colSpan={14}>
                  No active `log_weight` rows were found for this placement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatLatestSample(row: PlacementLogWeightReportRow | null) {
  if (!row) return "--";
  return `${formatShortDate(row.logDate)} | ${formatRatio(row.averageWeight)}`;
}

function formatShortDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

function formatSex(value: PlacementLogWeightReportRow["sex"]) {
  if (value === "male") return "Roo";
  if (value === "female") return "Hen";
  return "Unknown";
}

function formatWhole(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatWholeNullable(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return formatWhole(value);
}

function formatRatio(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatSignedRatio(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatText(value: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized || "--";
}

function varianceClassName(row: PlacementLogWeightReportRow) {
  if (row.varianceFromBenchmark === null || !Number.isFinite(row.varianceFromBenchmark) || row.varianceFromBenchmark === 0) {
    return "log-weight-report-variance";
  }

  return row.varianceFromBenchmark > 0
    ? "log-weight-report-variance log-weight-report-variance--good"
    : "log-weight-report-variance log-weight-report-variance--bad";
}
