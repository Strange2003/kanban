import Link from "next/link";

// Edge Cases of 009-work-item-views: Work Items are created from the board,
// so an empty List/Table points there.
export function ViewEmptyState({
  projectPublicId,
  reason,
}: {
  projectPublicId: string;
  reason: "no-items" | "no-columns";
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center" data-testid="view-empty-state">
      <p className="text-sm">{reason === "no-columns" ? "This project has no columns yet." : "No Work Items yet."}</p>
      <Link href={`/projects/${projectPublicId}`} className="text-sm underline">
        Go to the board
      </Link>
    </div>
  );
}
