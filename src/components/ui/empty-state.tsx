import type { ReactNode } from "react";

/** Use whenever a list is empty: say what goes here and offer the next action (UI lecture: user guidance). */
export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-surface px-6 py-12 text-center">
      <p className="text-base font-medium text-slate-900">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
