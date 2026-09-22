"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
// Fixed locale (the UI is in English) so server and client format identically.
const localFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });
const utcFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Shows an instant (created/updated/closed) as a day in the viewer's time zone
 * (Edge Cases of 008-work-item-fields). The server snapshot uses UTC, so the
 * server HTML and the first client render match and hydration never mismatches;
 * the client then switches to the local day.
 */
export function LocalDate({ value }: { value: Date | string }) {
  const date = typeof value === "string" ? new Date(value) : value;
  const text = useSyncExternalStore(
    noopSubscribe,
    () => localFormatter.format(date),
    () => utcFormatter.format(date),
  );
  return <time dateTime={date.toISOString()}>{text}</time>;
}
