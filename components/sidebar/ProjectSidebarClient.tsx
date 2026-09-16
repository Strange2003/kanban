"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/sidebar/CreateProjectDialog";
import { EmptyProjectsState } from "@/components/sidebar/EmptyProjectsState";
import type { ProjectWithMemberCount } from "@/lib/actions/projects";

function CollapsibleSection({
  title,
  projects,
}: {
  title: string;
  projects: ProjectWithMemberCount[];
}) {
  const [open, setOpen] = useState(true);

  if (projects.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide"
        aria-expanded={open}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {title}
      </button>
      {open && (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.publicId}`}
                className="block rounded-md px-4 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProjectSidebarClient({
  personal,
  shared,
}: {
  personal: ProjectWithMemberCount[];
  shared: ProjectWithMemberCount[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const isEmpty = personal.length === 0 && shared.length === 0;

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-2 border-r border-border py-3">
      <div className="flex items-center justify-between px-3">
        <span className="text-sm font-semibold">Projects</span>
        <Button size="icon" variant="ghost" onClick={() => setDialogOpen(true)} aria-label="New project">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isEmpty ? (
        <EmptyProjectsState onCreate={() => setDialogOpen(true)} />
      ) : (
        <nav className="flex flex-col gap-3">
          <CollapsibleSection title="Personal" projects={personal} />
          <CollapsibleSection title="Shared" projects={shared} />
        </nav>
      )}

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </aside>
  );
}
