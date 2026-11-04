"use client";

import { Check, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import type { AgendaItemDTO } from "@/contracts/agenda";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { helpCountLabel } from "./format";

export function AgendaCard({
  teamId,
  meetingId,
  items,
  me,
}: {
  teamId: string;
  meetingId: string;
  items: AgendaItemDTO[];
  me: { id: string; isLeader: boolean };
}) {
  const base = `/api/v1/teams/${teamId}/meetings/${meetingId}/agenda`;
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [deleting, setDeleting] = useState<AgendaItemDTO | null>(null);
  const add = useApiAction();
  const flag = useApiAction();
  const remove = useApiAction();

  // The list re-sorts after a flag, which moves the button in the DOM and drops keyboard focus. Put it back.
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    if (!refocus.current) return;
    document.getElementById(`help-${refocus.current}`)?.focus();
    refocus.current = null;
  }, [items]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const created = await add.run(() => apiFetch<AgendaItemDTO>(base, { method: "POST", body: { title, notes } }), {
      success: "Topic added",
    });
    if (!created) return;
    setTitle("");
    setNotes("");
  }

  async function toggleHelp(item: AgendaItemDTO) {
    refocus.current = item.id;
    const updated = await flag.run(() =>
      apiFetch<AgendaItemDTO>(`${base}/${item.id}/help`, { method: "PUT", body: { needsHelp: !item.flaggedByMe } }),
    );
    if (!updated) refocus.current = null;
  }

  async function confirmDelete() {
    if (!deleting) return;
    const ok = await remove.run(() => apiFetch(`${base}/${deleting.id}`, { method: "DELETE" }), {
      success: "Topic deleted",
    });
    if (ok) setDeleting(null);
  }

  return (
    <Card aria-labelledby="agenda-heading">
      <CardHeader>
        <CardTitle id="agenda-heading">Agenda</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {items.length === 0 ? (
          <EmptyState title="No topics yet" description="Add topics so everyone comes prepared." />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  {item.notes ? (
                    <p className="mt-0.5 text-sm whitespace-pre-wrap text-slate-700">{item.notes}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-600">
                    Added by {item.author.name}
                    {item.helpCount > 0 ? (
                      <span className="font-medium text-slate-800">
                        {" · "}
                        <span aria-hidden>🙋 </span>
                        {helpCountLabel(item.helpCount)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    id={`help-${item.id}`}
                    size="sm"
                    variant={item.flaggedByMe ? "secondary" : "outline"}
                    aria-pressed={item.flaggedByMe}
                    aria-label={`I need help with this: ${item.title}`}
                    onClick={() => toggleHelp(item)}
                  >
                    {item.flaggedByMe ? <Check aria-hidden /> : null}I need help with this
                  </Button>
                  {me.isLeader || item.author.id === me.id ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete “${item.title}”`}
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onAdd} noValidate className="flex flex-col gap-3 border-t border-slate-100 pt-4">
          <FormField label="Topic" error={add.fieldErrors.title} required>
            <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </FormField>
          <FormField
            label="Notes (optional)"
            hint="Anything people should read before the meeting."
            error={add.fieldErrors.notes}
          >
            <Textarea name="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={add.pending}>
              Add topic
            </Button>
          </div>
        </form>
      </CardBody>

      {/* Mounted only while open: the shared Dialog uses a fixed heading id. */}
      {deleting ? (
        <ConfirmDialog
          open
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
          pending={remove.pending}
          title={`Delete “${deleting.title}”?`}
          description="It will be removed from the agenda for everyone, along with its help flags. This can't be undone."
        />
      ) : null}
    </Card>
  );
}
