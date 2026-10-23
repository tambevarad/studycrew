"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import type { ResourceDTO, ResourceTypeValue } from "@/contracts/resources";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: Array<{ value: ResourceTypeValue; label: string; hint: string }> = [
  { value: "LINK", label: "Link", hint: "A web page, article, or tool." },
  { value: "FILE_REF", label: "File", hint: "A share link to a file in Google Drive, OneDrive, or Canvas." },
  { value: "NOTE", label: "Note", hint: "Plain text your team can read here." },
];

/** Add (choose a type) or edit (type fixed) a resource. */
export function ResourceFormDialog({
  teamId,
  open,
  onClose,
  editing,
}: {
  teamId: string;
  open: boolean;
  onClose: () => void;
  editing: ResourceDTO | null;
}) {
  const [type, setType] = useState<ResourceTypeValue>(editing?.type ?? "LINK");
  const { run, pending, fieldErrors } = useApiAction();
  const current = TYPE_OPTIONS.find((o) => o.value === type)!;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "");
    const url = String(form.get("url") ?? "");
    const body = String(form.get("body") ?? "");
    const payload = editing
      ? { title, ...(editing.type === "NOTE" ? { body } : { url }) }
      : type === "NOTE"
        ? { type, title, body }
        : { type, title, url };
    const result = await run(
      () =>
        editing
          ? apiFetch<ResourceDTO>(`/api/v1/teams/${teamId}/resources/${editing.id}`, { method: "PATCH", body: payload })
          : apiFetch<ResourceDTO>(`/api/v1/teams/${teamId}/resources`, { method: "POST", body: payload }),
      { success: editing ? "Saved" : `${current.label} added` },
    );
    if (result) onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? `Edit ${current.label.toLowerCase()}` : "Add to resources"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {editing ? null : (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-800">Type</legend>
            <div
              className="inline-flex rounded-md border border-slate-300 p-0.5"
              role="radiogroup"
              aria-label="Resource type"
            >
              {TYPE_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "has-[:focus-visible]:outline-brand-600 cursor-pointer rounded px-3 py-1.5 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
                    type === o.value ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value={o.value}
                    checked={type === o.value}
                    onChange={() => setType(o.value)}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{current.hint}</p>
          </fieldset>
        )}
        <FormField label="Title" required error={fieldErrors.title}>
          <Input
            name="title"
            defaultValue={editing?.title}
            maxLength={150}
            placeholder={type === "NOTE" ? "Retro notes — Sprint 3" : "Course syllabus"}
          />
        </FormField>
        {type === "NOTE" ? (
          <FormField label="Note" required error={fieldErrors.body}>
            <Textarea name="body" defaultValue={editing?.body ?? ""} rows={6} maxLength={10000} />
          </FormField>
        ) : (
          <FormField
            label="Link"
            required
            error={fieldErrors.url}
            hint={
              type === "FILE_REF"
                ? "Paste a share link from Google Drive, OneDrive, or Canvas. We don't store files."
                : "Starts with https://"
            }
          >
            <Input name="url" type="url" inputMode="url" defaultValue={editing?.url ?? ""} placeholder="https://" />
          </FormField>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {editing ? "Save" : `Add ${current.label.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
