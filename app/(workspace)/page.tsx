// Placeholder workspace home — shown when no project is selected. The
// sidebar (rendered by the layout) is where projects are created/opened.
export default function WorkspaceHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2">
      <p className="text-muted-foreground text-sm">
        Select a project from the sidebar, or create a new one.
      </p>
    </main>
  );
}
