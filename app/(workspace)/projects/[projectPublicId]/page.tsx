import { notFound } from "next/navigation";
import { getBoard } from "@/lib/actions/board";
import { Board } from "@/components/board/Board";

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
    <Board
      projectPublicId={projectPublicId}
      initialStages={result.data.stages}
      initialWorkItems={result.data.workItems}
    />
  );
}
