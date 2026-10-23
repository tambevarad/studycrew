"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";

/** NFR-02 / AC7: permanent delete for the author or a leader (the page only renders this when canDelete). */
export function DeleteReportButton({ teamId, reportId, title }: { teamId: string; reportId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = useApiAction();

  async function confirm() {
    const ok = await action.run(() => apiFetch(`/api/v1/teams/${teamId}/coverage-reports/${reportId}`, { method: "DELETE" }), {
      success: "Report deleted",
      refresh: false,
    });
    if (ok) {
      router.push(`/teams/${teamId}/coverage`);
      router.refresh();
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Delete report
      </Button>
      {/* Mounted only while open: the shared Dialog uses a fixed heading id. */}
      {open ? (
        <ConfirmDialog
          open
          onCancel={() => setOpen(false)}
          onConfirm={confirm}
          pending={action.pending}
          title="Permanently delete this report?"
          description={`“${title}”, its results, and the instructions and draft text are removed from StudyCrew. This can't be undone.`}
          confirmLabel="Delete permanently"
        />
      ) : null}
    </>
  );
}
