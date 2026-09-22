/**
 * The single implementation of 008-work-item-fields' closing transitions
 * (research.md § Estado de cierre derivado). A Work Item is closed exactly
 * when its column is a closing column (FR-012) — that state isn't stored, only
 * `work_items.closed_at` is, and every path that changes a Work Item's column
 * or a column's `is_closing` mark computes the new `closed_at` here so the
 * invariant `closed_at IS NOT NULL ⇔ stages.is_closing` holds (SC-006).
 * Pure, so the client uses it for optimistic updates too.
 */

export type ClosingTransition =
  | { closedAt: Date | null; event: null }
  | { closedAt: Date; event: "closed" }
  | { closedAt: null; event: "reopened" };

export function nextClosedAt(input: {
  /** The origin column's mark, or `null` when the Work Item is being created. */
  fromIsClosing: boolean | null;
  toIsClosing: boolean;
  currentClosedAt: Date | null;
  now: Date;
}): ClosingTransition {
  const { fromIsClosing, toIsClosing, currentClosedAt, now } = input;

  if (toIsClosing) {
    // Between two closing columns the Work Item stays closed and keeps its
    // original closing date — no new "closed" event (Edge Cases, FR-013).
    if (fromIsClosing === true) return { closedAt: currentClosedAt, event: null };
    return { closedAt: now, event: "closed" };
  }

  if (fromIsClosing === true) return { closedAt: null, event: "reopened" };
  return { closedAt: null, event: null };
}
