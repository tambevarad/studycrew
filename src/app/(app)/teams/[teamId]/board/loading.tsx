/** Skeleton while the board loads (UI guidelines §6: loading state). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading the task board">
      <div className="h-7 w-40 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex min-h-48 flex-col gap-3 rounded-lg bg-slate-50 p-3">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-20 animate-pulse rounded-md bg-slate-200" />
            <div className="h-20 animate-pulse rounded-md bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
