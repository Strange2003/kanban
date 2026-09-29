import { Bone, SkeletonFrame } from "@/components/loading/Skeleton";

// 015-loading-animations (contracts/loading-states.md): one loading skeleton per
// page, each shaped like the page it stands in for, so no page borrows the
// board's columns. The blocks fall in row by row (~40 ms apart, capped).

const step = (i: number) => Math.min(i * 40, 400);

/** ProjectViewHeader: project name, Board/List/Table switcher, settings button. */
export function ViewHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2" aria-hidden>
      <div className="flex items-center gap-3">
        <Bone className="h-5 w-32" fall={false} />
        <Bone className="h-8 w-44 rounded-md" fall={false} />
      </div>
      <Bone className="h-9 w-9 rounded-md" fall={false} />
    </div>
  );
}

/** ViewFilters' bar in List and Table: search box and filter buttons. */
function FiltersBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2" aria-hidden>
      <Bone className="h-8 w-56 rounded-md" fall={false} />
      <Bone className="h-8 w-24 rounded-md" fall={false} />
      <Bone className="h-8 w-20 rounded-md" fall={false} />
      <Bone className="h-8 w-28 rounded-md" fall={false} />
    </div>
  );
}

export function WorkItemDetailSkeleton() {
  return (
    <SkeletonFrame label="Loading Work Item…" className="min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="border-b border-border px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-3">
          <Bone className="h-4 w-28" fall={false} />
          <div className="flex items-center gap-2">
            <Bone className="h-5 w-16" delay={step(0)} />
            <Bone className="h-5 w-14 rounded-full" delay={step(1)} />
            <Bone className="h-5 w-20 rounded-full" delay={step(1)} />
          </div>
          <Bone className="h-8 w-full max-w-xl" delay={step(2)} />
          <div className="flex gap-4 pb-2">
            <Bone className="h-5 w-16" delay={step(3)} />
            <Bone className="h-5 w-16" delay={step(3)} />
          </div>
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-7xl gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:gap-8 lg:px-8">
        <div className="order-2 space-y-3 lg:order-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Bone className="h-3 w-16" fall={false} />
              <Bone className="h-8 w-full rounded-md" delay={step(i + 2)} />
            </div>
          ))}
        </div>
        <div className="order-1 space-y-6 lg:order-2">
          <div className="space-y-2">
            <Bone className="h-4 w-24" fall={false} />
            <Bone className="h-28 w-full rounded-md" delay={step(3)} />
          </div>
          <div className="space-y-2">
            <Bone className="h-4 w-20" fall={false} />
            {[0, 1, 2].map((i) => (
              <Bone key={i} className="h-7 w-full rounded-md" delay={step(i + 4)} />
            ))}
          </div>
          <div className="space-y-2">
            <Bone className="h-4 w-28" fall={false} />
            <Bone className="h-20 w-full rounded-md" delay={step(7)} />
          </div>
        </div>
      </div>
    </SkeletonFrame>
  );
}

export function ListSkeleton() {
  return (
    <SkeletonFrame label="Loading list…" className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <ViewHeaderSkeleton />
      <FiltersBarSkeleton />
      <div className="flex flex-col" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-2.5">
            <Bone className="h-4 w-5" fall={false} />
            <Bone className="h-4 w-14" delay={step(i)} />
            <Bone className="h-4 min-w-0 flex-1" delay={step(i)} />
            <Bone className="hidden h-4 w-20 sm:block" delay={step(i)} />
            <Bone className="h-5 w-14 rounded-full" delay={step(i)} />
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

export function TableSkeleton() {
  const cells = ["w-14", "w-56", "w-20", "w-16", "w-20", "w-24", "w-20"];
  return (
    <SkeletonFrame label="Loading table…" className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <ViewHeaderSkeleton />
      <FiltersBarSkeleton />
      <div className="min-h-0 flex-1 overflow-hidden" aria-hidden>
        <div className="flex gap-6 border-b border-border bg-card px-3 py-2.5">
          {cells.map((w, c) => (
            <Bone key={c} className={`h-3.5 shrink-0 ${w}`} fall={false} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-6 border-b border-border px-3 py-3">
            {cells.map((w, c) => (
              <Bone key={c} className={`h-4 shrink-0 ${w}`} delay={step(i)} />
            ))}
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

/** The back link and page title shared by the settings pages. */
function SettingsTitleSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <Bone className="h-4 w-28" fall={false} />
      <Bone className="h-8 w-72 max-w-full" delay={step(0)} />
    </div>
  );
}

/** A section heading over a bordered list of rows (members, catalog values, agents). */
function ListSectionSkeleton({ rows, start }: { rows: number; start: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      <Bone className="h-5 w-32" delay={step(start)} />
      <div className="divide-y divide-border rounded-md border border-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Bone className="h-4 w-40" delay={step(start + i + 1)} />
            <Bone className="ml-auto h-4 w-16" delay={step(start + i + 1)} />
          </div>
        ))}
      </div>
    </div>
  );
}

const settingsMain = "mx-auto min-w-0 w-full max-w-2xl flex-1 space-y-8 overflow-hidden p-4 sm:p-8";

export function ProjectSettingsSkeleton() {
  return (
    <SkeletonFrame label="Loading settings…" className={settingsMain}>
      <SettingsTitleSkeleton />
      <div className="space-y-2" aria-hidden>
        <Bone className="h-5 w-28" delay={step(1)} />
        <Bone className="h-9 w-full rounded-md" delay={step(2)} />
      </div>
      <div className="space-y-2" aria-hidden>
        <Bone className="h-5 w-36" delay={step(3)} />
        <Bone className="h-20 w-full rounded-md" delay={step(4)} />
      </div>
      <ListSectionSkeleton rows={3} start={5} />
    </SkeletonFrame>
  );
}

export function CatalogsSkeleton() {
  return (
    <SkeletonFrame label="Loading tags, areas and sizes…" className={settingsMain}>
      <SettingsTitleSkeleton />
      <ListSectionSkeleton rows={3} start={1} />
      <ListSectionSkeleton rows={3} start={3} />
      <ListSectionSkeleton rows={3} start={5} />
    </SkeletonFrame>
  );
}

export function MyWorkSkeleton() {
  return (
    <SkeletonFrame label="Loading your work…" className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3" aria-hidden>
        <Bone className="h-5 w-24" fall={false} />
        <Bone className="h-4 w-28" fall={false} />
      </div>
      <div className="flex flex-col gap-6 p-4" aria-hidden>
        {[0, 1].map((g) => (
          <div key={g} className="space-y-1">
            <Bone className="mb-2 h-3 w-28" delay={step(g * 4)} />
            <div className="divide-y divide-border rounded-md border border-border">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Bone className="h-4 w-14" delay={step(g * 4 + i + 1)} />
                  <Bone className="h-4 min-w-0 flex-1" delay={step(g * 4 + i + 1)} />
                  <Bone className="h-4 w-20" delay={step(g * 4 + i + 1)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

export function ConnectedAgentsSkeleton() {
  return (
    <SkeletonFrame label="Loading connected agents…" className="flex-1 overflow-hidden">
      <div className="mx-auto w-full max-w-2xl space-y-6 p-6" aria-hidden>
        <div className="space-y-2">
          <Bone className="h-6 w-44" fall={false} />
          <Bone className="h-4 w-full" delay={step(0)} />
          <Bone className="h-4 w-4/5" delay={step(1)} />
        </div>
        <Bone className="h-24 w-full rounded-md" delay={step(2)} />
        <div className="divide-y divide-border rounded-md border border-border">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Bone className="h-8 w-8 shrink-0 rounded-full" delay={step(i + 3)} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Bone className="h-4 w-40" delay={step(i + 3)} />
                <Bone className="h-3 w-56 max-w-full" delay={step(i + 3)} />
              </div>
              <Bone className="h-8 w-20 rounded-md" delay={step(i + 3)} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}
