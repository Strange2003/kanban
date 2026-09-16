"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";

// FR-006/FR-007 of 002-project-spaces
export function DeleteProjectSection({ projectPublicId }: { projectPublicId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    const result = await deleteProject(projectPublicId);
    setDeleting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push("/");
  }

  return (
    <section className="space-y-2 border-t border-border pt-6">
      <h2 className="text-destructive text-sm font-medium">Danger zone</h2>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">This can&apos;t be undone.</span>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Confirm delete"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
          Delete project
        </Button>
      )}
    </section>
  );
}
