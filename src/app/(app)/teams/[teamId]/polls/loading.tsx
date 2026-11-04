/** Skeleton while polls load (UI guidelines §6). `role="status"` is what allows the aria-label (D-03). */
export default function Loading() {
  return (
    <div role="status" className="flex flex-col gap-4" aria-busy="true" aria-label="Loading polls">
      <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-5">
            <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-9 animate-pulse rounded-md bg-slate-100" />
            <div className="h-9 animate-pulse rounded-md bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
