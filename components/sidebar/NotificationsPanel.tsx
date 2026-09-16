import { listMyNotifications } from "@/lib/actions/accounts-invitations";
import { NotificationsPanelClient } from "@/components/sidebar/NotificationsPanelClient";

// FR-006 of 001-accounts-invitations, US3. Server Component so it re-renders
// (and re-fetches) whenever a Server Action calls revalidatePath("/") —
// same pattern as ProjectSidebar.
export async function NotificationsPanel() {
  const result = await listMyNotifications();
  const notifications = result.ok ? result.data : [];

  return <NotificationsPanelClient notifications={notifications} />;
}
