"use client";

import { Flag, LayoutTemplate, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import type { MilestoneDTO } from "@/contracts/milestones";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { MilestoneCard, type TaskOption } from "./milestone-card";
import { MilestoneFormDialog } from "./milestone-form-dialog";
import { TemplateDialog } from "./template-dialog";

/** PB-13 page body. Dialogs mount only while open (the shared Dialog uses one fixed heading id). */
export function MilestonesView({
  teamId,
  milestones,
  tasks,
  timeZone,
  nowIso,
}: {
  teamId: string;
  milestones: MilestoneDTO[];
  tasks: TaskOption[];
  timeZone: string;
  nowIso: string;
}) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MilestoneDTO | null>(null);
  const [deleting, setDeleting] = useState<MilestoneDTO | null>(null);
  const del = useApiAction();

  const base = `/api/v1/teams/${teamId}/milestones`;

  async function confirmDelete() {
    if (!deleting) return;
    const ok = await del.run(() => apiFetch(`${base}/${deleting.id}`, { method: "DELETE" }), {
      success: "Milestone deleted",
    });
    if (ok) setDeleting(null);
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setTemplateOpen(true)}>
        <LayoutTemplate aria-hidden /> Use a template
      </Button>
      <Button onClick={() => setFormOpen(true)}>
        <Plus aria-hidden /> New milestone
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Milestones"
        description="Break the project into checkpoints. Progress comes from the tasks you link to each one."
        actions={actions}
      />

      {milestones.length === 0 ? (
        <EmptyState
          title="No milestones yet"
          description="Start from a template for a presentation, report, exam or group assignment, or add your own."
          action={
            <Button onClick={() => setTemplateOpen(true)}>
              <Flag aria-hidden /> Start from a template
            </Button>
          }
        />
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Milestones">
          {milestones.map((m) => (
            <li key={m.id}>
              <MilestoneCard
                teamId={teamId}
                milestone={m}
                tasks={tasks}
                timeZone={timeZone}
                nowIso={nowIso}
                onEdit={() => setEditing(m)}
                onDelete={() => setDeleting(m)}
              />
            </li>
          ))}
        </ol>
      )}

      {templateOpen ? (
        <TemplateDialog
          teamId={teamId}
          timeZone={timeZone}
          nowIso={nowIso}
          existing={milestones.length}
          onClose={() => setTemplateOpen(false)}
        />
      ) : null}
      {formOpen || editing ? (
        <MilestoneFormDialog
          teamId={teamId}
          timeZone={timeZone}
          milestone={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          open
          title={`Delete “${deleting.title}”?`}
          description={
            deleting.taskCount > 0
              ? `Its ${deleting.taskCount} linked ${deleting.taskCount === 1 ? "task stays" : "tasks stay"} on the board, just not linked to a milestone. This can't be undone.`
              : "This can't be undone."
          }
          pending={del.pending}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
