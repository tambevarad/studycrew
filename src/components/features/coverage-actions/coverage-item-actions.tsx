"use client";

/**
 * SLOT COMPONENT (PB-11). PB-10's report page renders <CoverageItemActions teamId={…} item={…} /> in each
 * requirement row: "Create task" for anything not yet covered, plus Helpful / Not helpful.
 */
import { ArrowRight, Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { CoverageItemDTO, CreateTaskFromItemInput } from "@/contracts/coverage";
import type { TaskDTO } from "@/contracts/tasks";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CreateTaskDialog } from "./create-task-dialog";
import { boardTaskLink } from "./due-date";

type Rating = CoverageItemDTO["rating"];

export function CoverageItemActions({ teamId, item }: { teamId: string; item: CoverageItemDTO }) {
  const router = useRouter();
  const [taskId, setTaskId] = useState(item.taskId);
  const [rating, setRating] = useState<Rating>(item.rating);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { run, pending } = useApiAction();
  const rate = useApiAction();

  async function createTask(input: CreateTaskFromItemInput) {
    const task = await run(
      () =>
        apiFetch<TaskDTO>(`/api/v1/teams/${teamId}/coverage-items/${item.id}/task`, { method: "POST", body: input }),
      { refresh: true },
    );
    if (!task) return;
    setTaskId(task.id);
    setDialogOpen(false);
    const link = boardTaskLink(teamId, task.id);
    toast.success("Task created", { action: { label: "View on board", onClick: () => router.push(link) } });
  }

  async function setHelpful(next: NonNullable<Rating>) {
    if (rating === next) return;
    const previous = rating;
    setRating(next);
    const saved = await rate.run(
      () =>
        apiFetch<CoverageItemDTO>(`/api/v1/teams/${teamId}/coverage-items/${item.id}/rating`, {
          method: "PUT",
          body: { rating: next },
        }),
      { refresh: false },
    );
    if (!saved) setRating(previous);
  }

  const canCreate = item.status !== "COVERED" && !taskId;

  return (
    <div className="flex flex-col items-start gap-2">
      {taskId ? (
        <Link
          href={boardTaskLink(teamId, taskId)}
          className="text-brand-700 inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap underline-offset-2 hover:underline"
        >
          Open task <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : canCreate ? (
        <Button size="sm" variant="secondary" className="px-2.5" onClick={() => setDialogOpen(true)}>
          <Plus aria-hidden />
          <span>
            <span className="sr-only">Create </span>Task
          </span>
        </Button>
      ) : null}

      <div role="group" aria-label="Was this suggestion helpful?" className="flex gap-1">
        <RatingButton
          label="Helpful"
          pressed={rating === "HELPFUL"}
          disabled={rate.pending}
          onClick={() => setHelpful("HELPFUL")}
        >
          <ThumbsUp aria-hidden />
        </RatingButton>
        <RatingButton
          label="Not helpful"
          pressed={rating === "NOT_HELPFUL"}
          disabled={rate.pending}
          onClick={() => setHelpful("NOT_HELPFUL")}
        >
          <ThumbsDown aria-hidden />
        </RatingButton>
      </div>

      {/* Mounted only while open: the shared Dialog uses one fixed heading id, and every row renders this slot. */}
      {dialogOpen ? (
        <CreateTaskDialog
          teamId={teamId}
          item={item}
          pending={pending}
          onCancel={() => setDialogOpen(false)}
          onSubmit={createTask}
        />
      ) : null}
    </div>
  );
}

function RatingButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border transition-colors disabled:opacity-60 [&_svg]:size-4",
        pressed
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "bg-surface border-slate-300 text-slate-600 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
