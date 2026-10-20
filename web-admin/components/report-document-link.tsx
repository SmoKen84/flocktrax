import type { ReactNode } from "react";

export function ReportDocumentLink({
  documentId,
  children,
  title,
}: {
  documentId?: string | null;
  children: ReactNode;
  title?: string;
}) {
  if (!documentId) return <>{children}</>;

  return (
    <a
      className="report-document-link"
      href={`/api/document-archive/${encodeURIComponent(documentId)}`}
      rel="noopener noreferrer"
      target="_blank"
      title={title ?? "Open original document in a new tab"}
    >
      {children}
    </a>
  );
}
