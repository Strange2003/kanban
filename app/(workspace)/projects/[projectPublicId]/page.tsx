import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBoard } from "@/lib/actions/board";
import { Board } from "@/components/board/Board";
import { BoardSkeleton } from "@/components/board/BoardSkeleton";
import { ProjectViewHeader } from "@/components/views/ProjectViewHeader";

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ projectPublicId: string }>;
}) {
  const { projectPublicId } = await params;
  const result = await getBoard(projectPublicId);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "FORBIDDEN") notFound();
    throw new Error(result.error.message);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* 009-work-item-views: the Board / List / Table switcher, shared by the three views. */}
      <Suspense>
        <ProjectViewHeader projectPublicId={projectPublicId} projectName={result.data.projectName} role={result.data.role} active="board" />
      </Suspense>
      {/* 014-board-filters-mcp-catalogs: the filters read the address with
          useSearchParams — wrapped per use-search-params.md § Prerendering. */}
      <Suspense fallback={<BoardSkeleton />}>
        <Board
          projectPublicId={projectPublicId}
          role={result.data.role}
          initialStages={result.data.stages}
          initialWorkItems={result.data.workItems}
          currentUserId={result.data.currentUserId}
          members={result.data.members}
          tagCatalog={result.data.tagCatalog}
          areaCatalog={result.data.areaCatalog}
          sizeCatalog={result.data.sizeCatalog}
        />
      </Suspense>
    </div>
  );
}
