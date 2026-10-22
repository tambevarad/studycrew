"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";

/**
 * Accessible modal built on <dialog> (focus trap + Esc to close come from the browser).
 *   <Dialog open={open} onClose={() => setOpen(false)} title="New task">…</Dialog>
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-surface p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 id="dialog-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}

/**
 * Confirmation for destructive actions (UI lecture: recoverability).
 * Name the thing being deleted and what happens: "Delete “Draft slides”? This can't be undone."
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  pending,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
