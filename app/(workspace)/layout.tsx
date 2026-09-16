import { requireSession } from "@/lib/auth";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { NotificationsPanel } from "@/components/sidebar/NotificationsPanel";

// Protected shell for everything behind login.
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-end border-b border-border px-4">
        <NotificationsPanel />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar />
        {children}
      </div>
    </div>
  );
}
