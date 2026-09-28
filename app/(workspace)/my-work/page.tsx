import { requireSession } from "@/lib/auth";
import { listAssignedWorkItems } from "@/lib/my-work-queries";
import { MyWorkList } from "@/components/views/MyWorkList";

// KAN-6: every Work Item assigned to the signed-in user, across the projects
// they belong to. Account-level page — it needs a browser session.
export default async function MyWorkPage({ searchParams }: { searchParams: Promise<{ closed?: string }> }) {
  const session = await requireSession();
  const { closed } = await searchParams;
  const showClosed = closed === "1";
  const rows = await listAssignedWorkItems(session.user.id, showClosed);

  return <MyWorkList rows={rows} showClosed={showClosed} />;
}
