"use client";
import { useEffect, useRef } from "react";
export default function ConversionPreview({
  source,
  status,
  error,
  busy,
  onClose,
}: {
  source: string;
  status: string;
  error: string;
  busy: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  const url = /^https?:\/\//.test(source) ? source : "";
  return (
    <dialog
      ref={dialog}
      className="live-workspace split-comparison"
      onCancel={onClose}
      aria-labelledby="conversion-title"
    >
      <header className="live-toolbar">
        <strong id="conversion-title">Compare preview</strong>
        <button onClick={onClose}>Close ×</button>
      </header>
      <p className="live-status">
        {busy
          ? "Conversion continues if you close this window."
          : "Conversion stopped. Your previous drafts are unchanged."}
      </p>
      <div className="live-body">
        <section className="live-pane">
          <div className="live-pane-bar">
            <b>Original website</b>
            {url && (
              <a href={url} target="_blank" rel="noreferrer">
                Open original ↗
              </a>
            )}
          </div>
          <p className="live-note">
            If this website blocks embedding, use Open original. A captured
            reference will be available after a successful capture.
          </p>
          {url ? (
            <iframe
              title="Original during conversion"
              src={url}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              style={{ width: "100%", flex: 1, border: 0 }}
            />
          ) : (
            <p>Building from your client brief.</p>
          )}
        </section>
        <section className="live-pane">
          <div className="live-pane-bar">
            <b>Converted output</b>
            <span>{busy ? "In progress" : "Needs attention"}</span>
          </div>
          <div className="conversion-state" aria-live="polite">
            <strong>{status}</strong>
            {error && <p role="alert">{error}</p>}
            <p>
              {busy
                ? "The editable preview opens here when conversion finishes."
                : "Close this window to review the input and try again."}
            </p>
          </div>
        </section>
      </div>
    </dialog>
  );
}
