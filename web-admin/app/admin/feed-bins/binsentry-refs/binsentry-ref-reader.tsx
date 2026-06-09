"use client";

import { useMemo, useState } from "react";

type BinSentryRefReaderProps = {
  label: string;
  value: string;
};

function buildPreview(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 40) {
    return trimmed;
  }

  return `${trimmed.slice(0, 26)}...${trimmed.slice(-12)}`;
}

export function BinSentryRefReader({ label, value }: BinSentryRefReaderProps) {
  const [open, setOpen] = useState(false);
  const preview = useMemo(() => buildPreview(value), [value]);

  return (
    <>
      <button
        className="binsentry-ref-reader-button"
        onClick={() => setOpen(true)}
        title={value}
        type="button"
      >
        {preview}
      </button>

      {open ? (
        <div className="sync-outbox-modal-shell" onClick={() => setOpen(false)}>
          <div
            aria-labelledby="binsentry-ref-reader-title"
            aria-modal="true"
            className="sync-outbox-modal-panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="sync-outbox-modal-header">
              <div>
                <p className="eyebrow">BinSentry Reader</p>
                <h3 className="section-title" id="binsentry-ref-reader-title">{label}</h3>
              </div>
              <button className="button-secondary" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>
            <pre className="sync-outbox-modal-value">{value}</pre>
          </div>
        </div>
      ) : null}
    </>
  );
}
