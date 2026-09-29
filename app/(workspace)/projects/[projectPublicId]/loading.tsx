import { BoardSkeleton } from "@/components/board/BoardSkeleton";
import { ViewHeaderSkeleton } from "@/components/loading/PageSkeletons";

// 015-loading-animations: only the board's skeleton — every page below this
// segment has its own loading.tsx (contracts/loading-states.md).
export default function Loading() {
  return (
    <div className="kb-skeleton flex min-w-0 flex-1 flex-col overflow-hidden">
      <ViewHeaderSkeleton />
      <BoardSkeleton />
    </div>
  );
}
