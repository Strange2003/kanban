"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";

// FR-013/FR-014 of 002-project-spaces
export function LeaveProjectButton({ projectPublicId }: { projectPublicId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function handleLeave() {
    setError(null);
    setLeaving(true);
    const result = await leaveProject(projectPublicId);
    setLeaving(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push("/");
  }

  return (
    <section className="space-y-2 border-t border-border pt-6">
      {error && <p className="text-destructive text-sm">{error}</p>}
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Leave this project?</span>
          <Button size="sm" variant="destructive" onClick={handleLeave} disabled={leaving}>
            {leaving ? "Leaving..." : "Confirm"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
          Leave project
        </Button>
      )}
    </section>
  );
}
