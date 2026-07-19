"use client";

import { useState } from "react";

/**
 * ConfirmButton — renders a button that, when clicked, opens a modal asking the
 * GM to confirm before the (irreversible / destructive) action runs. Purely a
 * client-side guard; the server still enforces every authorization boundary.
 *
 * Optionally collects a short free-text value (e.g. a rejection reason) that is
 * passed to `onConfirm`.
 */
export function ConfirmButton({
  className = "btn",
  children,
  title,
  message,
  warn,
  confirmLabel = "CONFIRM",
  confirmClass = "btn-danger",
  danger = true,
  promptLabel,
  promptPlaceholder,
  promptRequired = false,
  disabled,
  onConfirm,
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
  message: React.ReactNode;
  warn?: React.ReactNode;
  confirmLabel?: string;
  confirmClass?: string;
  danger?: boolean;
  promptLabel?: string;
  promptPlaceholder?: string;
  promptRequired?: boolean;
  disabled?: boolean;
  onConfirm: (promptValue?: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState("");

  async function run() {
    if (promptRequired && !value.trim()) return;
    setBusy(true);
    try {
      await onConfirm(value.trim() || undefined);
      setOpen(false);
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={className} disabled={disabled} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => !busy && setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-head ${danger ? "danger" : ""}`}>{title}</div>
            <div className="modal-body">
              {message}
              {warn && <span className="modal-warn">! {warn}</span>}
              {promptLabel && (
                <label className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                  <span className="field-label">{promptLabel}</span>
                  <input
                    className="console-input"
                    value={value}
                    autoFocus
                    placeholder={promptPlaceholder}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
                CANCEL
              </button>
              <button
                className={`btn ${confirmClass}`}
                disabled={busy || (promptRequired && !value.trim())}
                onClick={run}
              >
                {busy ? "WORKING…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
