"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkItem } from "@/lib/actions/work-items";
import { Button } from "@/components/ui/button";
import { isRolePermissionError } from "@/lib/errors";
import { Input } from "@/components/ui/input";

export function AddWorkItemButton({ stagePublicId }: { stagePublicId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createWorkItem({ stagePublicId, title });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      // The role changed under an open screen (FR-004 of 007-roles-permissions).
      if (isRolePermissionError(result)) router.refresh();
      return;
    }

    setTitle("");
    setAdding(false);
    router.refresh();
  }

  if (!adding) {
    return (
      <Button variant="ghost" size="sm" className="justify-start" onClick={() => setAdding(true)}>
        + Add work item
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" noValidate>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        autoFocus
        onBlur={() => {
          if (!title) setAdding(false);
        }}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex gap-2">
        {/* Keeps focus in the input: otherwise its onBlur closes the empty form before
            the submit fires, and the "name is required" error never shows. */}
        <Button type="submit" size="sm" disabled={submitting} onMouseDown={(e) => e.preventDefault()}>
          {submitting ? "Adding..." : "Add"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
