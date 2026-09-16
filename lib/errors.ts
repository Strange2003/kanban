/**
 * Shared error/result plumbing for Server Actions. Every mutation in
 * lib/actions/** returns a `Result<T>` instead of throwing across the
 * server/client boundary, so the UI can show a specific message per error
 * `code` (the codes are the ones documented in specs/001-accounts-invitations/contracts/*.md).
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
