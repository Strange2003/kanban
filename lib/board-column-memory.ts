/**
 * How many columns a project's board had the last time this browser showed it
 * (015-loading-animations, data-model.md): written by the board, read by its
 * loading skeleton so it draws the right number of columns. One integer per
 * project `publicId`, in localStorage — nothing reaches the server. Pure — no
 * `db`, `next/*` or `lib/auth` imports; the storage is passed in so tests can
 * use a fake one.
 */
export const DEFAULT_BOARD_COLUMNS = 3;
export const MAX_SKELETON_COLUMNS = 8;

export const boardColumnsKey = (projectPublicId: string) => `kanban:board-columns:${projectPublicId}`;

/** Missing, non-numeric or ≤ 0 → the default; above the cap → the cap; decimals → whole part. */
export function clampSkeletonColumns(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_BOARD_COLUMNS;
  const whole = Math.trunc(n);
  if (whole <= 0) return DEFAULT_BOARD_COLUMNS;
  return Math.min(whole, MAX_SKELETON_COLUMNS);
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** The skeleton's column count for a project; the default when nothing valid is stored or storage fails. */
export function readBoardColumns(storage: StorageLike | null | undefined, projectPublicId: string): number {
  try {
    return clampSkeletonColumns(storage?.getItem(boardColumnsKey(projectPublicId)));
  } catch {
    return DEFAULT_BOARD_COLUMNS;
  }
}

/** Remembers the real count (clamped on read). An empty board keeps the previous value. */
export function writeBoardColumns(storage: StorageLike | null | undefined, projectPublicId: string, count: number) {
  if (!Number.isInteger(count) || count <= 0) return;
  try {
    storage?.setItem(boardColumnsKey(projectPublicId), String(count));
  } catch {
    // Ignore: the remembered count is only a presentation hint.
  }
}
