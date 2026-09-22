import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkItemByDisplayNumber } from "@/lib/actions/work-items";
import { getWorkItemDetailData } from "@/lib/actions/work-item-relationships";
import { WorkItemDetailView } from "@/components/work-items/WorkItemDetailView";

// FR-001/FR-002/FR-010/FR-011 of 006-work-item-detail-view. Same server-side
// resolution pattern as the board page
// (app/(workspace)/projects/[projectPublicId]/page.tsx) with getBoard.
// The caller's role reaches WorkItemDetailView inside `detailResult.data.role`
// (007-roles-permissions): a Viewer gets the same page in read-only mode, so
// this route needs no role handling of its own.
export default async function WorkItemDetailPage({
  params,
}: {
  params: Promise<{ projectPublicId: string; displayNumber: string }>;
}) {
  const { projectPublicId, displayNumber: rawDisplayNumber } = await params;

  const displayNumber = Number(rawDisplayNumber);
  const validDisplayNumber = Number.isInteger(displayNumber) && displayNumber > 0;

  const workItemResult = validDisplayNumber
    ? await getWorkItemByDisplayNumber(projectPublicId, displayNumber)
    : null;

  if (!workItemResult || !workItemResult.ok) {
    // FORBIDDEN: not a project member — the generic 404 doesn't reveal
    // whether the Work Item exists, consistent with Principio IV. An
    // invalid/missing displayNumber, or a Work Item that once existed and
    // was deleted, both land in the friendlier inline state below (FR-011)
    // since in that case the caller IS a member and has a real board to
    // return to.
    if (workItemResult?.error.code === "FORBIDDEN") notFound();

    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
        <p className="text-sm">This Work Item could not be found. It may have been deleted.</p>
        <Link href={`/projects/${projectPublicId}`} className="text-sm underline">
          ← Back to board
        </Link>
      </div>
    );
  }

  const detailResult = await getWorkItemDetailData(workItemResult.data.id, projectPublicId);
  if (!detailResult.ok) throw new Error(detailResult.error.message);

  return (
    <WorkItemDetailView
      workItem={workItemResult.data}
      projectPublicId={projectPublicId}
      initialDetail={detailResult.data}
    />
  );
}
