/** Skeleton while the personal home loads (UI guidelines §6: loading state). */
export default function Loading() {
  return (
    <div role="status" className="flex flex-col gap-6" aria-busy="true" aria-label="Loading your home page">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
