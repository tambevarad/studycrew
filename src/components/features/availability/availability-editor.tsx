"use client";

import { useEffect, useRef, useState } from "react";
import { DAY_LABELS, dayAndHalfHour, slotOf, SLOTS_PER_DAY, type AvailabilityDTO } from "@/contracts/availability";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { cn, pluralize } from "@/lib/utils";
import {
  boundaryTime,
  copyDay,
  countChanged,
  formatRange,
  slotsToRanges,
  to12h,
  toggleRange,
  weekdayEvenings,
  type PaintMode,
} from "./grid";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FIRST_DEFAULT_ROW = 14; // 07:00
const ROW_CLASS = "grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))]";

type Cell = { day: number; hh: number };
type Drag = { anchor: number; current: number; mode: PaintMode; pointerId: number };

const cellLabel = (day: number, hh: number) =>
  `${DAY_NAMES[day]} ${to12h(boundaryTime(hh))} to ${to12h(boundaryTime(hh + 1))}`;

export function AvailabilityEditor({ initial }: { initial: AvailabilityDTO }) {
  const [saved, setSaved] = useState(initial.slots);
  const [slots, setSlots] = useState(initial.slots);
  const [showAll, setShowAll] = useState(false);
  // The live drag is in a ref so pointer events that arrive before React re-renders (fast drags, quick taps) still
  // see it; the state copy only drives the preview.
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const [focus, setFocus] = useState<Cell>({ day: 0, hh: 36 });
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const { run, pending } = useApiAction();
  const gridRef = useRef<HTMLDivElement>(null);

  const firstRow = showAll ? 0 : FIRST_DEFAULT_ROW;
  const rows = Array.from({ length: SLOTS_PER_DAY - firstRow }, (_, i) => firstRow + i);
  const changed = countChanged(slots, saved);
  const shown = new Set(drag ? toggleRange(slots, drag.anchor, drag.current, drag.mode) : slots);
  const selection = anchor ? toggleRange([], slotOf(anchor.day, anchor.hh), slotOf(focus.day, focus.hh), "add") : [];
  const selected = new Set(selection);
  const ranges = slotsToRanges(slots);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (changed === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [changed]);

  // Keep keyboard focus on the active cell after it moves (roving tabindex).
  const focusCell = (cell: Cell) => {
    setFocus(cell);
    requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLElement>(`[data-slot="${slotOf(cell.day, cell.hh)}"]`)?.focus(),
    );
  };

  function slotAt(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-slot]");
    return el && gridRef.current?.contains(el) ? Number(el.dataset.slot) : null;
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const slot = slotAt(e.clientX, e.clientY);
    if (slot === null) return;
    e.preventDefault();
    setAnchor(null);
    setDrag({ anchor: slot, current: slot, mode: slots.includes(slot) ? "remove" : "add", pointerId: e.pointerId });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const slot = slotAt(e.clientX, e.clientY);
    if (slot !== null && slot !== d.current) setDrag({ ...d, current: slot });
  }

  // Commit on pointer up anywhere (the pointer may leave the grid while painting). Registered once; reads the ref.
  useEffect(() => {
    const commit = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      setDragState(null);
      setSlots((s) => toggleRange(s, d.anchor, d.current, d.mode));
      // Move keyboard focus to where the pointer stopped so keyboard use can continue from there.
      const { day, halfHour } = dayAndHalfHour(d.current);
      setFocus({ day, hh: halfHour });
      requestAnimationFrame(() =>
        gridRef.current?.querySelector<HTMLElement>(`[data-slot="${d.current}"]`)?.focus({ preventScroll: true }),
      );
    };
    const cancel = () => {
      dragRef.current = null;
      setDragState(null);
    };
    window.addEventListener("pointerup", commit);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerup", commit);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const slot = slotOf(focus.day, focus.hh);
    if (e.key in moves) {
      e.preventDefault();
      const [dd, dh] = moves[e.key];
      const next = {
        day: Math.min(6, Math.max(0, focus.day + dd)),
        hh: Math.min(SLOTS_PER_DAY - 1, Math.max(firstRow, focus.hh + dh)),
      };
      if (e.shiftKey) setAnchor((a) => a ?? focus);
      else setAnchor(null);
      focusCell(next);
    } else if (e.key === " ") {
      e.preventDefault();
      setAnchor(null);
      setSlots((s) => toggleRange(s, slot, slot, s.includes(slot) ? "remove" : "add"));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const from = anchor ?? focus;
      const fromSlot = slotOf(from.day, from.hh);
      setSlots((s) => toggleRange(s, fromSlot, slot, s.includes(fromSlot) ? "remove" : "add"));
      setAnchor(null);
    } else if (e.key === "Escape" && anchor) {
      e.preventDefault();
      setAnchor(null);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setAnchor(null);
      focusCell({ day: e.key === "Home" ? 0 : 6, hh: focus.hh });
    }
  }

  async function save() {
    const result = await run(
      () => apiFetch<AvailabilityDTO>("/api/v1/me/availability", { method: "PUT", body: { slots } }),
      { success: "Availability saved" },
    );
    if (result) {
      setSaved(result.slots);
      setSlots(result.slots);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Quick actions">
        <Button variant="outline" size="sm" onClick={() => setSlots((s) => copyDay(s, 0, [1, 2, 3, 4]))}>
          Copy Monday to weekdays
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSlots((s) => weekdayEvenings(s))}>
          Weekday evenings (6–10 pm)
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} disabled={slots.length === 0}>
          Clear all
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => {
              setShowAll(e.target.checked);
              if (!e.target.checked && focus.hh < FIRST_DEFAULT_ROW) setFocus({ ...focus, hh: FIRST_DEFAULT_ROW });
            }}
            className="accent-brand-600 size-4"
          />
          Show all hours
        </label>
      </div>

      <p id="grid-help" className="text-sm text-slate-600">
        Drag across the grid to mark when you&apos;re free; start on a green cell to erase. Keyboard: arrow keys move,
        Space toggles one half-hour, Shift + arrows selects a block, Enter fills or clears it, Esc cancels.
      </p>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Weekly availability"
        aria-describedby="grid-help"
        aria-multiselectable="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="bg-surface touch-none overflow-hidden rounded-lg border border-slate-200 select-none"
      >
        <div role="row" className={cn(ROW_CLASS, "border-b border-slate-200 bg-slate-50")}>
          <div role="columnheader" className="px-2 py-2 text-xs font-medium text-slate-600">
            <span className="sr-only">Time</span>
          </div>
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              role="columnheader"
              aria-label={DAY_NAMES[i]}
              className="py-2 text-center text-xs font-semibold text-slate-800"
            >
              {d}
            </div>
          ))}
        </div>
        {rows.map((hh) => (
          <div key={hh} role="row" className={cn(ROW_CLASS, hh % 2 === 0 ? "border-t border-slate-200" : "")}>
            <div role="rowheader" className="pr-2 text-right text-xs leading-5 text-slate-600">
              {hh % 2 === 0 ? to12h(boundaryTime(hh)) : <span className="sr-only">{to12h(boundaryTime(hh))}</span>}
            </div>
            {DAY_LABELS.map((_, day) => {
              const slot = slotOf(day, hh);
              const on = shown.has(slot);
              const isFocus = focus.day === day && focus.hh === hh;
              return (
                <div
                  key={day}
                  role="gridcell"
                  data-slot={slot}
                  aria-selected={on}
                  aria-label={cellLabel(day, hh)}
                  tabIndex={isFocus ? 0 : -1}
                  onFocus={() => !isFocus && setFocus({ day, hh })}
                  className={cn(
                    "h-5 cursor-pointer border-l border-slate-200 focus-visible:relative focus-visible:z-10",
                    on ? "bg-success-600" : "hover:bg-success-50",
                    selected.has(slot) && "ring-brand-600 bg-brand-100 ring-2 ring-inset",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>

      <section aria-labelledby="summary-heading" className="flex flex-col gap-2">
        <h2 id="summary-heading" className="text-base font-semibold text-slate-900">
          Summary
        </h2>
        {ranges.length === 0 ? (
          <p className="text-sm text-slate-600">
            You haven&apos;t marked any free time yet. Teammates can&apos;t find a meeting time with you until you do.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm text-slate-800" aria-label="Your free times">
            {ranges.map((r) => (
              <li key={`${r.day}-${r.start}`} className="bg-success-50 text-success-700 rounded-md px-2 py-1">
                {formatRange(r)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {changed > 0 ? (
        <div
          className="bg-surface sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 shadow-lg"
          role="region"
          aria-label="Unsaved changes"
        >
          <p className="text-sm text-slate-700">{pluralize(changed, "unsaved change")}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSlots(saved)} disabled={pending}>
              Discard
            </Button>
            <Button onClick={save} loading={pending}>
              Save availability
            </Button>
          </div>
        </div>
      ) : null}

      {confirmClear ? (
        <ConfirmDialog
          open
          title="Clear all availability?"
          description="This empties the whole week in the grid. Nothing is saved until you press Save availability."
          confirmLabel="Clear all"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setSlots([]);
            setConfirmClear(false);
          }}
        />
      ) : null}
    </div>
  );
}
