import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBoard } from "@/lib/actions/board";
import { Board } from "@/components/board/Board";
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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 009-work-item-views: the Board / List / Table switcher, shared by the three views. */}
      <Suspense>
        <ProjectViewHeader projectPublicId={projectPublicId} role={result.data.role} active="board" />
      </Suspense>
      <Board
        projectPublicId={projectPublicId}
        role={result.data.role}
        initialStages={result.data.stages}
        initialWorkItems={result.data.workItems}
      />
    </div>
  );
}
