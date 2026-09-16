"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateProjectDialog } from "@/components/sidebar/CreateProjectDialog";
import { EmptyProjectsState } from "@/components/sidebar/EmptyProjectsState";
import { listMyProjects, type ProjectWithMemberCount } from "@/lib/actions/projects";

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
  personal: initialPersonal,
  shared: initialShared,
}: {
  personal: ProjectWithMemberCount[];
  shared: ProjectWithMemberCount[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [personal, setPersonal] = useState(initialPersonal);
  const [shared, setShared] = useState(initialShared);

  // `initial*` are fresh arrays whenever the server component re-renders
  // (e.g. after creating/renaming/deleting a project calls
  // revalidatePath("/")) — adjust local state during render (same pattern
  // as Board.tsx) so those changes show up without a full page reload, as
  // long as there's no in-flight search filtering the list already.
  const [prevInitialPersonal, setPrevInitialPersonal] = useState(initialPersonal);
  const [prevInitialShared, setPrevInitialShared] = useState(initialShared);
  if (initialPersonal !== prevInitialPersonal || initialShared !== prevInitialShared) {
    setPrevInitialPersonal(initialPersonal);
    setPrevInitialShared(initialShared);
    if (!search) {
      setPersonal(initialPersonal);
      setShared(initialShared);
    }
  }

  const isEmpty = personal.length === 0 && shared.length === 0;

  // FR-011 of 002-project-spaces
  async function handleSearchChange(value: string) {
    setSearch(value);
    const result = await listMyProjects({ search: value || undefined });
    if (result.ok) {
      setPersonal(result.data.personal);
      setShared(result.data.shared);
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-2 border-r border-border py-3">
      <div className="flex items-center justify-between px-3">
        <span className="text-sm font-semibold">Projects</span>
        <Button size="icon" variant="ghost" onClick={() => setDialogOpen(true)} aria-label="New project">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {!(isEmpty && !search) && (
        <div className="relative px-3">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-6 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search projects..."
            className="pl-8"
            aria-label="Search projects"
          />
        </div>
      )}

      {isEmpty ? (
        search ? (
          <p className="text-muted-foreground px-4 py-4 text-center text-sm">No projects match your search.</p>
        ) : (
          <EmptyProjectsState onCreate={() => setDialogOpen(true)} />
        )
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
