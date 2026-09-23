import { Suspense } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { ProjectSidebarSkeleton } from "@/components/sidebar/ProjectSidebarSkeleton";
import { NotificationsPanel } from "@/components/sidebar/NotificationsPanel";

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
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-end gap-1 border-b border-border px-4">
        {/* 011-agent-access-mcp FR-035 */}
        <Link
          href="/settings/agents"
          aria-label="Connected agents"
          title="Connected agents"
          className="hover:bg-accent inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Bot className="h-4 w-4" />
        </Link>
        <Suspense fallback={<div className="h-9 w-9 animate-pulse rounded-md bg-muted" />}>
          <NotificationsPanel />
        </Suspense>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Suspense fallback={<ProjectSidebarSkeleton />}>
          <ProjectSidebar />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
