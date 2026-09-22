/**
 * Single source of truth for 007-roles-permissions' permission matrix
 * (specs/007-roles-permissions/spec.md § Matriz de permisos). Deliberately
 * pure — no `db`, `next/*` or `lib/auth` imports — so client components can
 * import `can()` to decide which controls to show, while the server enforces
 * the very same table through `requireProjectPermission` (lib/permissions.ts).
 * The UI only *reflects* a role; authorization is always the server's.
 */

export type ProjectRole = "owner" | "member" | "viewer";

export type Permission =
  | "project:edit"
  | "project:delete"
  | "project:leave"
  | "project:transferOwnership"
  | "member:remove"
  | "member:changeRole"
  | "invitation:send"
  | "invitation:viewPending"
  | "invitation:cancelAny"
  | "invitation:cancelOwn"
  | "board:edit"
  | "workItem:edit"
  | "relationship:edit";

// One key per row of the spec's matrix (contracts/roles-permissions.md § Matriz
// de permisos → claves). Reads need no key: every member, viewers included,
// may read a project they belong to (`requireProjectMember` alone).
const PERMISSIONS: Record<Permission, readonly ProjectRole[]> = {
  "project:edit": ["owner"],
  "project:delete": ["owner"],
  // The owner can't leave: a project always has exactly one owner (FR-014 of 002).
  "project:leave": ["member", "viewer"],
  "project:transferOwnership": ["owner"],
  "member:remove": ["owner"],
  "member:changeRole": ["owner"],
  "invitation:send": ["owner", "member"],
  "invitation:viewPending": ["owner", "member"],
  "invitation:cancelAny": ["owner"],
  "invitation:cancelOwn": ["owner", "member"],
  "board:edit": ["owner", "member"],
  "workItem:edit": ["owner", "member"],
  "relationship:edit": ["owner", "member"],
};

export const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: "Owner",
  member: "Member",
  viewer: "Viewer",
};

/** Roles that can be granted through an invitation or a role change — never `owner` (FR-002). */
export const ASSIGNABLE_ROLES = ["member", "viewer"] as const satisfies readonly ProjectRole[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function can(role: ProjectRole, permission: Permission): boolean {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

/** Every permission key, for exhaustive checks (tests, sweeps). */
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
