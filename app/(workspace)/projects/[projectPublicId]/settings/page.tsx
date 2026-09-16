import Link from "next/link";
import { requireProjectMember } from "@/lib/permissions";
import { listProjectMembers } from "@/lib/actions/projects";
import { RenameProjectForm } from "@/components/settings/RenameProjectForm";
import { ProjectDescriptionForm } from "@/components/settings/ProjectDescriptionForm";
import { MembersList } from "@/components/settings/MembersList";
import { DeleteProjectSection } from "@/components/settings/DeleteProjectSection";

// Any project member can view; individual controls gate themselves by role
// (rename/description/delete/invite/remove are owner-only, per FR-008 of
// 002-project-spaces and FR-009 of 001-accounts-invitations).
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectPublicId: string }>;
}) {
  const { projectPublicId } = await params;
  const { project, membership } = await requireProjectMember(projectPublicId);
  const isOwner = membership.role === "owner";

  const membersResult = await listProjectMembers(projectPublicId);
  const members = membersResult.ok ? membersResult.data : [];

  return (
    <main className="mx-auto max-w-2xl space-y-8 overflow-y-auto p-8">
      <div>
        <Link href={`/projects/${projectPublicId}`} className="text-muted-foreground text-sm underline underline-offset-4">
          ← Back to board
        </Link>
        <h1 className="text-2xl font-semibold">{project.name} — Settings</h1>
        <p className="text-muted-foreground text-sm">Signed in as {membership.role}.</p>
      </div>

      {isOwner ? (
        <>
          <RenameProjectForm projectPublicId={projectPublicId} initialName={project.name} />
          <ProjectDescriptionForm
            projectPublicId={projectPublicId}
            initialDescription={project.description ?? ""}
          />
        </>
      ) : (
        project.description && <p className="text-muted-foreground text-sm">{project.description}</p>
      )}

      <MembersList projectPublicId={projectPublicId} members={members} isOwner={isOwner} />

      {isOwner && <DeleteProjectSection projectPublicId={projectPublicId} />}
    </main>
  );
}
