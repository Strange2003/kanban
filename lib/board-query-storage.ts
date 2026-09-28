/**
 * Where a tab remembers its board filters (014-board-filters-mcp-catalogs,
 * research.md § Volver del detalle al tablero): written by the board, read by
 * the Work Item detail's "Back to board". Per tab (sessionStorage) and per
 * project. Pure — no `db`, `next/*` or `lib/auth` imports.
 */
export const boardQueryStorageKey = (projectPublicId: string) => `kanban:board-query:${projectPublicId}`;

/** `/projects/{id}` plus the remembered filters, or the clean address if there are none or storage fails. */
export function rememberedBoardHref(projectPublicId: string): string {
  const base = `/projects/${projectPublicId}`;
  try {
    const qs = window.sessionStorage.getItem(boardQueryStorageKey(projectPublicId));
    return qs ? `${base}?${qs}` : base;
  } catch {
    return base;
  }
}
