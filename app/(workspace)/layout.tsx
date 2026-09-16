import { requireSession } from "@/lib/auth";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";

// Protected shell for everything behind login. `NotificationsPanel`
// (Phase 11) mounts here too once that phase lands.
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <div className="flex h-dvh">
      <ProjectSidebar />
      {children}
    </div>
  );
}
