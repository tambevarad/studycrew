/** Skeleton while coverage pages load (UI guidelines §6: loading state). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading the AI Coverage Check">
      <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
      <div className="h-80 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}
