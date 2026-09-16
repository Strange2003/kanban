// Principle I of the constitution: no perceptible loading blocks — shown
// via Suspense in app/(workspace)/layout.tsx while ProjectSidebar (an
// async Server Component) fetches the project list.
export function ProjectSidebarSkeleton() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 border-r border-border py-3">
      <div className="flex items-center justify-between px-3">
        <span className="text-sm font-semibold">Projects</span>
      </div>
      <div className="flex flex-col gap-2 px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${70 - i * 8}%` }} />
        ))}
      </div>
    </aside>
  );
}
