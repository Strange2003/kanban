"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/actions/projects";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROJECT_TEMPLATES, DEFAULT_PROJECT_TEMPLATE_KEY, type ProjectTemplateKey } from "@/lib/project-templates";
import { cn } from "@/lib/utils";

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateKey, setTemplateKey] = useState<ProjectTemplateKey>(DEFAULT_PROJECT_TEMPLATE_KEY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createProject({ name, description, templateKey });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setName("");
    setDescription("");
    setTemplateKey(DEFAULT_PROJECT_TEMPLATE_KEY);
    onOpenChange(false);
    router.push(`/projects/${result.data.publicId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="new-project-name">Name</Label>
          <Input
            id="new-project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-project-description">Description (optional)</Label>
          <Input
            id="new-project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm leading-none font-medium">Template</legend>
          <div className="grid grid-cols-2 gap-2 pt-1.5">
            {PROJECT_TEMPLATES.map((template) => (
              <label
                key={template.key}
                className={cn(
                  "has-[:focus-visible]:ring-ring/50 cursor-pointer rounded-md border p-3 text-sm has-[:focus-visible]:ring-2",
                  templateKey === template.key ? "border-primary bg-accent" : "hover:bg-accent/50",
                )}
              >
                <input
                  type="radio"
                  name="new-project-template"
                  value={template.key}
                  checked={templateKey === template.key}
                  onChange={() => setTemplateKey(template.key)}
                  className="sr-only"
                />
                <span className="block font-medium">{template.label}</span>
                <span className="text-muted-foreground block text-xs">{template.description}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create project"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
