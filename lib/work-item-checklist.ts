/**
 * KAN-9: pure pieces of the Work Item checklist, shared by the Server Actions
 * (lib/actions/work-item-checklist.ts) and the detail view — no `db` imports.
 */

export const CHECKLIST_TEXT_MAX = 500;
export const CHECKLIST_MAX_ITEMS = 100;

export type ChecklistItemView = {
  publicId: string;
  text: string;
  done: boolean;
};

export function checklistProgress(items: readonly { done: boolean }[]): { done: number; total: number } {
  return { done: items.filter((item) => item.done).length, total: items.length };
}
