"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { can, type ProjectRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

type View = "board" | "list" | "table";

// FR-001/FR-002 of 009-work-item-views: the project header shared by the
// board, the List and the Table — the view switcher, the read-only notice and
// the settings link that used to live in the board page alone.
export function ProjectViewHeader({
  projectPublicId,
  role,
  active,
}: {
  projectPublicId: string;
  role: ProjectRole;
  active: View;
}) {
  const searchParams = useSearchParams();
  const base = `/projects/${projectPublicId}`;

  // Switching between List and Table keeps the filters; the List has no sort.
  // The board has no filters, so its link is always clean.
  function hrefFor(view: View): string {
    if (view === "board") return base;
    const params = new URLSearchParams(active === "board" ? "" : searchParams.toString());
    if (view === "list") {
      params.delete("sort");
      params.delete("dir");
    }
    const qs = params.toString();
    return `${base}/${view}${qs ? `?${qs}` : ""}`;
  }

  const views: { view: View; label: string }[] = [
    { view: "board", label: "Board" },
    { view: "list", label: "List" },
    { view: "table", label: "Table" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Views" className="inline-flex rounded-md border border-border p-0.5">
          {views.map(({ view, label }) => (
            <Link
              key={view}
              href={hrefFor(view)}
              aria-current={view === active ? "page" : undefined}
              className={cn(
                "rounded px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                view === active
                  ? "bg-secondary font-medium text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        {!can(role, "board:edit") && <ReadOnlyNotice role={role} />}
      </div>
      <Link
        href={`${base}/settings`}
        aria-label="Project settings"
        className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md"
      >
        <Settings className="h-4 w-4" />
      </Link>
    </div>
  );
}
