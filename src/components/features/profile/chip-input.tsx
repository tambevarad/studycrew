"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { addChip, type ChipRules } from "./chips";

/**
 * Text input that turns each entry into a removable chip. Enter (or comma) adds; × or Backspace on an empty input
 * removes. Receives `id` / `aria-describedby` / `aria-invalid` from FormField and passes them to the text input.
 */
export function ChipInput({
  values,
  onChange,
  rules,
  placeholder,
  listLabel,
  id,
  ...aria
}: {
  values: string[];
  onChange: (values: string[]) => void;
  rules: ChipRules;
  placeholder?: string;
  listLabel: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const errorId = id ? `${id}-chip-error` : undefined;
  const describedBy = [aria["aria-describedby"], error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  function commit() {
    const result = addChip(values, draft, rules);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setDraft("");
    setAnnouncement(`Added ${result.added}.`);
    onChange(result.values);
  }

  function remove(value: string) {
    setError(null);
    setAnnouncement(`Removed ${value}.`);
    onChange(values.filter((v) => v !== value));
  }

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 ? (
        <ul aria-label={listLabel} className="flex flex-wrap gap-2">
          {values.map((v) => (
            <li
              key={v}
              className="bg-brand-50 text-brand-800 inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm font-medium"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                aria-label={`Remove ${v}`}
                className="text-brand-700 hover:bg-brand-100 inline-flex size-6 items-center justify-center rounded-full"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        maxLength={rules.maxLength + 10}
        aria-describedby={describedBy}
        aria-invalid={aria["aria-invalid"] || (error ? true : undefined)}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
            remove(values[values.length - 1]);
          }
        }}
      />
      {error ? (
        <p id={errorId} className="text-danger-700 text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
