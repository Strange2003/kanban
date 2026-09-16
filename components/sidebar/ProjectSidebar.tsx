import { listMyProjects } from "@/lib/actions/projects";
import { ProjectSidebarClient } from "@/components/sidebar/ProjectSidebarClient";

// FR-004 of 002-project-spaces. Server Component so it re-renders (and
// re-fetches) automatically whenever a Server Action calls
// revalidatePath("/") — no client-side refetch plumbing needed.
export async function ProjectSidebar() {
  const result = await listMyProjects();
  const { personal, shared } = result.ok ? result.data : { personal: [], shared: [] };

  return <ProjectSidebarClient personal={personal} shared={shared} />;
}
