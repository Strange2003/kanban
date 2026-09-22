/**
 * Shared error/result plumbing for Server Actions. Every mutation in
 * lib/actions/** returns a `Result<T>` instead of throwing across the
 * server/client boundary, so the UI can show a specific message per error
 * `code` (the codes are the ones documented in specs/001-accounts-invitations/contracts/*.md).
 *
 * 007-roles-permissions adds (specs/007-roles-permissions/contracts/roles-permissions.md):
 *   ROLE_NOT_PERMITTED       the user IS a member but their role doesn't allow the action.
 *                            Kept distinct from FORBIDDEN ("not a member"), which pages turn
 *                            into a 404 — a rejected viewer must not land on a 404.
 *   INVALID_ROLE             a role other than member|viewer was requested (never `owner`).
 *   CANNOT_CHANGE_OWNER_ROLE changeMemberRole on the owner (use transferOwnership).
 *   NOT_A_MEMBER             the target of a role change/transfer isn't (or is no longer) a member.
 *   CANNOT_TRANSFER_TO_SELF  transferOwnership whose recipient is the owner themselves.
 */

export class AppError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
  }
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(code: string, message?: string): Result<never> {
  return { ok: false, error: { code, message: message ?? code } };
}

/**
 * True when an action was rejected because the caller's role changed or never
 * allowed it. Client components use this to refresh the route (so the screen
 * flips to read-only) instead of chaining another Server Action — see
 * specs/005-work-item-relationships/research.md § Hallazgo.
 */
export function isRolePermissionError(result: Result<unknown>): boolean {
  return !result.ok && result.error.code === "ROLE_NOT_PERMITTED";
}

/** Runs a Server Action body, converting a thrown AppError into a Result error instead of an unhandled rejection. */
export async function runAction<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof AppError) {
      return err(error.code, error.message);
    }
    console.error(error);
    return err("UNKNOWN_ERROR", "Something went wrong. Please try again.");
  }
}
