"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { renameProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// FR-005/FR-008 of 002-project-spaces
export function RenameProjectForm({
  projectPublicId,
  initialName,
}: {
  projectPublicId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await renameProject({ projectPublicId, name });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5" noValidate>
      <Label htmlFor="project-name">Name</Label>
      <div className="flex gap-2">
        <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={submitting || name === initialName}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
