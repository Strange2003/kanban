// Principle I of the constitution: no perceptible loading blocks — shown
// via app/(workspace)/projects/[projectPublicId]/loading.tsx while the
// board's Server Component fetches stages and Work Items.
export function BoardSkeleton() {
  return (
    <div className="flex flex-1 gap-4 overflow-x-auto p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}
