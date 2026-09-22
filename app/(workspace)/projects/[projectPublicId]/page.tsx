import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { getBoard } from "@/lib/actions/board";
import { Board } from "@/components/board/Board";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { can } from "@/lib/roles";

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
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        {can(result.data.role, "board:edit") ? <span /> : <ReadOnlyNotice role={result.data.role} />}
        <Link
          href={`/projects/${projectPublicId}/settings`}
          aria-label="Project settings"
          className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
      <Board
        projectPublicId={projectPublicId}
        role={result.data.role}
        initialStages={result.data.stages}
        initialWorkItems={result.data.workItems}
      />
    </div>
  );
}
