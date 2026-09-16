"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStage } from "@/lib/actions/board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddStageButton({ projectPublicId }: { projectPublicId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createStage({ projectPublicId, name });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setName("");
    setAdding(false);
    router.refresh();
  }

  if (!adding) {
    return (
      <Button variant="outline" className="h-fit w-72 shrink-0" onClick={() => setAdding(true)}>
        + Add column
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-72 shrink-0 space-y-2" noValidate>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Column name"
        autoFocus
        onBlur={() => {
          if (!name) setAdding(false);
        }}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Adding..." : "Add"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
