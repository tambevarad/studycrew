import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 disabled:bg-slate-50 aria-[invalid=true]:border-danger-600";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClass, "h-10 pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-slate-800", className)} {...props} />;
}
