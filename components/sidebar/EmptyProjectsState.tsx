import { Button } from "@/components/ui/button";

// FR-010 of 002-project-spaces
export function EmptyProjectsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <p className="text-muted-foreground text-sm">You don&apos;t have any projects yet.</p>
      <Button size="sm" onClick={onCreate}>
        Create your first project
      </Button>
    </div>
  );
}
