import type { FlockDocumentInventoryItem } from "@/lib/document-archive";
import { ReportDocumentLink } from "@/components/report-document-link";

export function FlockDocumentLinks({ documents }: { documents: FlockDocumentInventoryItem[] }) {
  if (!documents.length) return null;

  return (
    <div className="report-document-links">
      {documents.map((document) => (
        <ReportDocumentLink documentId={document.documentId} key={document.documentId}>
          {document.title || document.originalFilename || document.documentLabel}
        </ReportDocumentLink>
      ))}
    </div>
  );
}

export function FlockDocumentReportSection({ documents }: { documents: FlockDocumentInventoryItem[] }) {
  return (
    <section className="closeout-report-section digital-archive-report-break">
      <div className="closeout-report-section-header">
        <div>
          <p className="eyebrow">Document Archive</p>
          <h2>Documents Linked To This Flock</h2>
        </div>
        <p>Current filed documents linked through the placement, closeout, feed tickets, or livehaul records. Navy underlined links open the original document in a new tab.</p>
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
                  <td><ReportDocumentLink documentId={document.documentId}>{document.documentLabel}</ReportDocumentLink></td>
                  <td>{document.title ? <ReportDocumentLink documentId={document.documentId}>{document.title}</ReportDocumentLink> : "--"}</td>
                  <td>{document.originalFilename ? <ReportDocumentLink documentId={document.documentId}>{document.originalFilename}</ReportDocumentLink> : "--"}</td>
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
