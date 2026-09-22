import { ROLE_LABELS, type ProjectRole } from "@/lib/roles";

// FR-005 of 007-roles-permissions: explains why the edit controls are missing,
// so a Viewer doesn't mistake a read-only screen for a broken one.
export function ReadOnlyNotice({ role }: { role: ProjectRole }) {
  return (
    <p role="status" className="text-muted-foreground text-xs">
      Your role here is {ROLE_LABELS[role]}: this project is read-only for you.
    </p>
  );
}
