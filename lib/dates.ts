import { useSyncExternalStore } from "react";

// Date helpers for 008-work-item-fields (research.md § Fechas y "hoy" sin
// desajustes de hidratación). The board and detail view are server-rendered
// (Render runs in UTC) and then hydrated in the viewer's browser, so anything
// that depends on the viewer's local date must only resolve on the client.

const noopSubscribe = () => () => {};

function toCalendarString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * The viewer's local date as "YYYY-MM-DD" — `null` on the server and during
 * hydration, so an "overdue" mark is never rendered from the server's clock
 * (Edge Cases of the spec: overdue is judged by the viewer's local date).
 */
export function useLocalToday(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => toCalendarString(new Date()),
    () => null,
  );
}

// A fixed locale (the UI is in English): the server and the browser must
// produce the same string, or hydration mismatches.
const calendarFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });

/**
 * Formats a calendar day ("YYYY-MM-DD") with no time-zone conversion: it's
 * built from its local components, never `new Date("YYYY-MM-DD")`, which is
 * UTC midnight and would show the previous day west of Greenwich.
 */
export function formatCalendarDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return calendarFormatter.format(new Date(y!, m! - 1, d!));
}
