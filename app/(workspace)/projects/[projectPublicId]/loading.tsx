import { BoardSkeleton } from "@/components/board/BoardSkeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="h-[41px] shrink-0 border-b border-border" />
      <BoardSkeleton />
    </div>
  );
}
