import { cn, initials } from "@/lib/utils";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={name}
      aria-label={name}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  return (
    <span className="flex -space-x-2">
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} className="ring-2 ring-white" />
      ))}
      {names.length > max ? (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700 ring-2 ring-white">
          +{names.length - max}
        </span>
      ) : null}
    </span>
  );
}
