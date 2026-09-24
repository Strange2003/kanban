"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateProjectDialog } from "@/components/sidebar/CreateProjectDialog";
import { EmptyProjectsState } from "@/components/sidebar/EmptyProjectsState";
import { listMyProjects, type ProjectWithMemberCount } from "@/lib/actions/projects";

function CollapsibleSection({
  title,
  projects,
  pathname,
}: {
  title: string;
  projects: ProjectWithMemberCount[];
  pathname: string;
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
        <ChevronRight
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
        />
        {title}
      </button>
      {open && (
        <ul>
          {projects.map((project) => {
            const href = `/projects/${project.publicId}`;
            const selected = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={project.id}>
                <Link
                  href={href}
                  title={project.name}
                  aria-current={
                    selected ? (pathname === href ? "page" : "location") : undefined
                  }
                  className={cn(
                    "block truncate rounded-md px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                    selected && "bg-accent font-medium text-accent-foreground",
                  )}
                >
                  {project.name}
                </Link>
              </li>
            );
          })}
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
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [personal, setPersonal] = useState(initialPersonal);
  const [shared, setShared] = useState(initialShared);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [previousPersonal, setPreviousPersonal] = useState(initialPersonal);
  const [previousShared, setPreviousShared] = useState(initialShared);
  if (initialPersonal !== previousPersonal || initialShared !== previousShared) {
    setPreviousPersonal(initialPersonal);
    setPreviousShared(initialShared);
    if (!search) {
      setPersonal(initialPersonal);
      setShared(initialShared);
    } else {
      setSearching(true);
    }
  }

  useEffect(() => {
    const currentRequest = ++requestId.current;
    const query = search.trim();
    if (!query) return;

    const timer = window.setTimeout(async () => {
      const result = await listMyProjects({ search: query });
      if (requestId.current !== currentRequest) return;
      setSearching(false);
      if (result.ok) {
        setPersonal(result.data.personal);
        setShared(result.data.shared);
        setSearchError(null);
      } else {
        setSearchError(result.error.message);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, initialPersonal, initialShared]);

  const isEmpty = personal.length === 0 && shared.length === 0;

  function handleSearchChange(value: string) {
    requestId.current++;
    setSearch(value);
    setSearchError(null);
    if (value.trim()) {
      setSearching(true);
    } else {
      setSearching(false);
      setPersonal(initialPersonal);
      setShared(initialShared);
    }
  }

  return (
    <aside className="flex min-h-0 w-64 flex-1 flex-col gap-2 border-r border-border py-3">
      <div className="flex items-center justify-between px-3">
        <span className="text-sm font-semibold">Projects</span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setDialogOpen(true)}
          aria-label="New project"
        >
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
            className="pr-8 pl-8"
            aria-label="Search projects"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              aria-label="Clear project search"
              className="absolute top-1/2 right-5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {searching && (
        <p className="px-4 text-xs text-muted-foreground" role="status">
          Searching projects...
        </p>
      )}
      {searchError && (
        <p className="px-4 text-xs text-destructive" role="alert">
          {searchError}
        </p>
      )}

      {isEmpty && !searching && !searchError ? (
        search ? (
          <p className="text-muted-foreground px-4 py-4 text-center text-sm">
            No projects match your search.
          </p>
        ) : (
          <EmptyProjectsState onCreate={() => setDialogOpen(true)} />
        )
      ) : (
        <nav
          className="flex min-h-0 flex-col gap-3 overflow-y-auto"
          aria-label="Projects"
        >
          <CollapsibleSection title="Personal" projects={personal} pathname={pathname} />
          <CollapsibleSection title="Shared" projects={shared} pathname={pathname} />
        </nav>
      )}

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </aside>
  );
}
