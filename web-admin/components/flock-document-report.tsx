import type { FlockDocumentInventoryItem } from "@/lib/document-archive";

export function FlockDocumentReportSection({ documents }: { documents: FlockDocumentInventoryItem[] }) {
  return (
    <section className="closeout-report-section digital-archive-report-break">
      <div className="closeout-report-section-header">
        <div>
          <p className="eyebrow">Document Archive</p>
          <h2>Documents Linked To This Flock</h2>
        </div>
        <p>Current filed documents linked through the placement, closeout, feed tickets, or livehaul records.</p>
      </div>

      <div className="closeout-report-table-wrap">
        <table className="closeout-report-table">
          <thead>
            <tr>
              <th>Document Type</th>
              <th>Title / Note</th>
              <th>Filename</th>
              <th>Linked Through</th>
              <th>Source</th>
              <th>Filed</th>
            </tr>
          </thead>
          <tbody>
            {documents.length > 0 ? (
              documents.map((document) => (
                <tr key={document.documentId}>
                  <td>{document.documentLabel}</td>
                  <td>{document.title || "--"}</td>
                  <td>{document.originalFilename || "--"}</td>
                  <td>{document.linkedBy}</td>
                  <td>{formatSource(document.sourceKind)}</td>
                  <td>{formatFiledDate(document.uploadedAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="closeout-report-empty" colSpan={6}>
                  No current documents are linked to this flock.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatSource(value: string | null) {
  if (!value) return "--";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFiledDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}
