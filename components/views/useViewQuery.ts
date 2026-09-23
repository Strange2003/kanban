"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { parseViewQuery, serializeViewQuery, type ViewQuery } from "@/lib/work-item-view";

/**
 * The List/Table filters and sort, read from and written to the page's
 * address (FR-009 of 009-work-item-views). Writing goes through
 * `window.history.replaceState`, which Next.js syncs with `useSearchParams`
 * (docs: 01-getting-started/04-linking-and-navigating.md § Native History
 * API): the address updates without asking the server for the page again, and
 * `replaceState` (not `pushState`) keeps "back" going to the previous screen
 * instead of undoing filter by filter (research.md § Filtros y orden).
 */
export function useViewQuery(
  view: "list" | "table",
  validStagePublicIds: ReadonlySet<string>,
): [ViewQuery, (next: ViewQuery) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const query = useMemo(
    () => parseViewQuery(new URLSearchParams(searchParams.toString()), validStagePublicIds),
    [searchParams, validStagePublicIds],
  );

  const setQuery = useCallback(
    (next: ViewQuery) => {
      const qs = serializeViewQuery(next, view);
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, view],
  );

  return [query, setQuery];
}
