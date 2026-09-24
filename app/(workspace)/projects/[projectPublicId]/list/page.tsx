import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getWorkItemsView } from "@/lib/actions/work-item-views";
import { ProjectViewHeader } from "@/components/views/ProjectViewHeader";
import { ViewEmptyState } from "@/components/views/ViewEmptyState";
import { WorkItemsList } from "@/components/views/WorkItemsList";

// The List view of 009-work-item-views. Same server-side resolution as the board
// page: a non-member gets the same 404 (FR-004, SC-004). Filters live in the
// address and are read on the client (useViewQuery), so this page only loads
// the project's rows once.
export default async function ProjectListPage({ params }: { params: Promise<{ projectPublicId: string }> }) {
  const { projectPublicId } = await params;
  const result = await getWorkItemsView(projectPublicId);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "FORBIDDEN") notFound();
    throw new Error(result.error.message);
  }

  const { rows, options, role, projectName, currentUserId } = result.data;
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* useSearchParams inside: wrapped per the Next.js guide (use-search-params.md § Prerendering). */}
      <Suspense>
        <ProjectViewHeader projectPublicId={projectPublicId} projectName={projectName} role={role} active="list" />
        {options.stages.length === 0 || rows.length === 0 ? (
          <ViewEmptyState projectPublicId={projectPublicId} reason={options.stages.length === 0 ? "no-columns" : "no-items"} />
        ) : (
          <WorkItemsList projectPublicId={projectPublicId} rows={rows} options={options} currentUserId={currentUserId} />
        )}
      </Suspense>
    </div>
  );
}
