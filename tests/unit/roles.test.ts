import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, ASSIGNABLE_ROLES, ROLE_LABELS, can, type Permission, type ProjectRole } from "@/lib/roles";

// Written out independently of lib/roles.ts, row by row from the matrix in
// specs/007-roles-permissions/spec.md § Matriz de permisos, so a drift in
// either place fails this test (SC-001, SC-002). Columns: owner, member, viewer.
const SPEC_MATRIX: Record<Permission, [boolean, boolean, boolean]> = {
  "invitation:viewPending": [true, true, false],
  "project:edit": [true, false, false],
  "project:delete": [true, false, false],
  "project:leave": [false, true, true],
  "member:remove": [true, false, false],
  "member:changeRole": [true, false, false],
  "project:transferOwnership": [true, false, false],
  "invitation:send": [true, true, false],
  "invitation:cancelAny": [true, false, false],
  "invitation:cancelOwn": [true, true, false],
  "board:edit": [true, true, false],
  "workItem:edit": [true, true, false],
  "workItem:comment": [true, true, true],
  "relationship:edit": [true, true, false],
};

const ROLES: ProjectRole[] = ["owner", "member", "viewer"];

describe("permission matrix (spec.md § Matriz de permisos)", () => {
  it("covers exactly the permission keys of the spec's matrix", () => {
    expect([...ALL_PERMISSIONS].sort()).toEqual(Object.keys(SPEC_MATRIX).sort());
  });

  for (const [permission, expected] of Object.entries(SPEC_MATRIX) as [Permission, boolean[]][]) {
    ROLES.forEach((role, index) => {
      it(`can(${role}, "${permission}") is ${expected[index]}`, () => {
        expect(can(role, permission)).toBe(expected[index]);
      });
    });
  }

  it("lets a viewer comment and leave, but not edit project data", () => {
    const viewerAllowed = ALL_PERMISSIONS.filter((permission) => can("viewer", permission));
    expect(viewerAllowed).toEqual(["project:leave", "workItem:comment"]);
  });

  it("keeps every owner-management permission exclusive to the owner (FR-014)", () => {
    for (const permission of [
      "project:edit",
      "project:delete",
      "member:remove",
      "member:changeRole",
      "project:transferOwnership",
      "invitation:cancelAny",
    ] as const) {
      expect(can("member", permission)).toBe(false);
      expect(can("viewer", permission)).toBe(false);
    }
  });

  it("is false for an unknown role or permission instead of throwing", () => {
    expect(can("stranger" as ProjectRole, "board:edit")).toBe(false);
    expect(can("owner", "nonexistent:permission" as Permission)).toBe(false);
  });
});

describe("assignable roles", () => {
  it("never includes owner — that role is only reachable by transferring ownership (FR-002)", () => {
    expect([...ASSIGNABLE_ROLES]).toEqual(["member", "viewer"]);
  });

  it("has a display label for every role", () => {
    expect(ROLE_LABELS).toEqual({ owner: "Owner", member: "Member", viewer: "Viewer" });
  });
});
