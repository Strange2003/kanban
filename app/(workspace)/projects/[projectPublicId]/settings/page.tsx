import { requireProjectMember } from "@/lib/permissions";

// Settings shell — created early (Foundational) so later, independent
// user-story phases (rename, description, invite, members, delete, leave)
// can each add their own control here without fighting over who creates
// this route first. Any project member can view it; individual controls
// gate themselves (most are owner-only, per FR-008 of 002-project-spaces).
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectPublicId: string }>;
}) {
  const { projectPublicId } = await params;
  const { project, membership } = await requireProjectMember(projectPublicId);

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">{project.name} — Settings</h1>
      <p className="text-muted-foreground text-sm">
        Signed in as {membership.role}.
      </p>
      {/* Rename / description (Phase 13), members + invite (Phase 10, 16),
          delete (Phase 14), leave (Phase 22) each add a section below. */}
    </main>
  );
}
