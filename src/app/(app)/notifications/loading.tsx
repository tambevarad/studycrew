/** Skeleton while notifications load (UI guidelines §6: loading state). `role="status"` allows the aria-label. */
export default function Loading() {
  return (
    <div role="status" className="flex flex-col gap-4" aria-busy="true" aria-label="Loading notifications">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}
