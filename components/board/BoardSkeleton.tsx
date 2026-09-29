"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { Bone, SkeletonFrame } from "@/components/loading/Skeleton";
import { DEFAULT_BOARD_COLUMNS, readBoardColumns } from "@/lib/board-column-memory";

// Principle I of the constitution: no perceptible loading blocks — shown via
// app/(workspace)/projects/[projectPublicId]/loading.tsx while the board's
// Server Component fetches stages and Work Items. 015-loading-animations: as
// many columns as the board had last time in this browser, with card
// silhouettes falling into them (contracts/loading-states.md).

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function useRememberedColumns(projectPublicId: string | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!projectPublicId) return DEFAULT_BOARD_COLUMNS;
      try {
        return readBoardColumns(window.localStorage, projectPublicId);
      } catch {
        return DEFAULT_BOARD_COLUMNS;
      }
    },
    // The server can't see localStorage: a full reload starts at the default
    // and settles on the remembered count right after hydration.
    () => DEFAULT_BOARD_COLUMNS,
  );
}

export function BoardSkeleton() {
  const params = useParams<{ projectPublicId?: string }>();
  const columns = useRememberedColumns(params?.projectPublicId);

  return (
    <SkeletonFrame label="Loading board…" className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* BoardFilters' bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Bone className="h-8 w-24 rounded-md" fall={false} />
        <Bone className="h-8 w-20 rounded-md" fall={false} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-hidden p-4">
        {Array.from({ length: columns }).map((_, col) => (
          <div
            key={col}
            aria-hidden
            className="flex w-72 shrink-0 flex-col self-start rounded-lg border border-dashed border-border bg-card/40"
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <Bone className="h-3.5 w-24" fall={false} />
              <Bone className="h-3 w-4" fall={false} />
            </div>
            <div className="flex flex-col gap-2 px-2 pb-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="kb-fall h-16 rounded-md border border-border bg-muted/70"
                  style={{ "--kb-delay": `${col * 140 + i * 260}ms` } as CSSProperties}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}
