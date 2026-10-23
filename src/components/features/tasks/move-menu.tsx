"use client";

import { ArrowRightLeft } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { TASK_STATUS_LABELS, type TaskStatusValue } from "@/contracts/tasks";
import { Button } from "@/components/ui/button";
import { COLUMN_ORDER } from "./board-utils";

export type MoveTarget = { status: TaskStatusValue; place: "top" | "bottom" };

/**
 * Keyboard alternative to drag and drop (NFR-03): a menu button listing the other columns plus top/bottom of the
 * current one. Arrow keys / Home / End move between items, Enter activates, Esc closes and returns focus.
 */
export function MoveMenu({
  title,
  status,
  onMove,
}: {
  title: string;
  status: TaskStatusValue;
  onMove: (target: MoveTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items: { label: string; target: MoveTarget }[] = [
    ...COLUMN_ORDER.filter((s) => s !== status).map((s) => ({
      label: TASK_STATUS_LABELS[s],
      target: { status: s, place: "bottom" as const },
    })),
    { label: `Top of ${TASK_STATUS_LABELS[status]}`, target: { status, place: "top" } },
    { label: `Bottom of ${TASK_STATUS_LABELS[status]}`, target: { status, place: "bottom" } },
  ];

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const all = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (n: number) => all[(n + all.length) % all.length]?.focus();
    if (e.key === "ArrowDown") focus(i + 1);
    else if (e.key === "ArrowUp") focus(i - 1);
    else if (e.key === "Home") focus(0);
    else if (e.key === "End") focus(all.length - 1);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") close(false);
    else return;
    e.preventDefault();
  }

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="whitespace-nowrap"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Move to… “${title}”`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <ArrowRightLeft aria-hidden />
        Move to…
      </Button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Move “${title}” to`}
          onKeyDown={onMenuKeyDown}
          className="bg-surface absolute right-0 z-20 mt-1 w-48 rounded-md border border-slate-200 py-1 shadow-lg"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close();
                onMove(item.target);
              }}
              className={`focus:bg-brand-50 block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 ${i === items.length - 2 ? "border-t border-slate-100" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
