"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Catches errors thrown while rendering anywhere under (workspace) — e.g. a
// Server Action's Result carrying an error code the caller didn't handle
// explicitly (see lib/errors.ts) getting re-thrown by a page component.
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">{error.message || "Please try again."}</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
