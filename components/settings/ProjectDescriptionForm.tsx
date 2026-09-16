"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProjectDescription } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// FR-009 of 002-project-spaces
export function ProjectDescriptionForm({
  projectPublicId,
  initialDescription,
}: {
  projectPublicId: string;
  initialDescription: string;
}) {
  const router = useRouter();
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await updateProjectDescription({ projectPublicId, description });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5" noValidate>
      <Label htmlFor="project-description">Description</Label>
      <textarea
        id="project-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" size="sm" disabled={submitting || description === initialDescription}>
        {submitting ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
