import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { ProjectSidebarSkeleton } from "@/components/sidebar/ProjectSidebarSkeleton";
import { NotificationsPanel } from "@/components/sidebar/NotificationsPanel";
import { WorkspaceShell } from "@/components/sidebar/WorkspaceShell";

// Protected shell for everything behind login. ProjectSidebar and
// NotificationsPanel are each Suspense-wrapped (Principle I of the
// constitution — no perceptible loading blocks) since both are async
// Server Components that re-fetch on every revalidatePath("/").
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <WorkspaceShell
      notifications={
        <Suspense
          fallback={<div className="h-9 w-9 animate-pulse rounded-md bg-muted" />}
        >
          <NotificationsPanel />
        </Suspense>
      }
      sidebar={
        <Suspense fallback={<ProjectSidebarSkeleton />}>
          <ProjectSidebar />
        </Suspense>
      }
    >
      {children}
    </WorkspaceShell>
  );
}
