import Link from "next/link";
import { requireProjectMember } from "@/lib/permissions";
import { ROLE_LABELS, can } from "@/lib/roles";
import { listProjectMembers } from "@/lib/actions/projects";
import { listPendingInvitations } from "@/lib/actions/accounts-invitations";
import { RenameProjectForm } from "@/components/settings/RenameProjectForm";
import { ProjectDescriptionForm } from "@/components/settings/ProjectDescriptionForm";
import { MembersList } from "@/components/settings/MembersList";
import { PendingInvitationsList } from "@/components/settings/PendingInvitationsList";
import { DeleteProjectSection } from "@/components/settings/DeleteProjectSection";
import { LeaveProjectButton } from "@/components/settings/LeaveProjectButton";

// Any project member can view; each section shows itself according to the
// permission matrix of 007-roles-permissions (lib/roles.ts). The Server Actions
// behind every control enforce the same matrix — this page only reflects it.
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectPublicId: string }>;
}) {
  const { projectPublicId } = await params;
  const { project, membership } = await requireProjectMember(projectPublicId);
  const role = membership.role;

  const membersResult = await listProjectMembers(projectPublicId);
  const members = membersResult.ok ? membersResult.data : [];

  // FR-018 of 007: a Viewer never even requests this list (the action would
  // reject them anyway) — pending invitations expose third parties' emails.
  const canViewPending = can(role, "invitation:viewPending");
  const pendingInvitationsResult = canViewPending ? await listPendingInvitations(projectPublicId) : null;
  const pendingInvitations = pendingInvitationsResult?.ok ? pendingInvitationsResult.data : [];

  return (
    <main className="mx-auto min-w-0 max-w-2xl flex-1 space-y-8 overflow-y-auto p-4 sm:p-8">
      <div>
        <Link href={`/projects/${projectPublicId}`} className="text-muted-foreground text-sm underline underline-offset-4">
          ← Back to board
        </Link>
        <h1 className="text-2xl font-semibold">{project.name} — Settings</h1>
        <p className="text-muted-foreground text-sm">Signed in as {ROLE_LABELS[role]}.</p>
      </div>

      {can(role, "project:edit") ? (
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

      <MembersList
        projectPublicId={projectPublicId}
        members={members}
        role={role}
        currentUserId={membership.userId}
      />

      {canViewPending && (
        <PendingInvitationsList
          projectPublicId={projectPublicId}
          invitations={pendingInvitations}
          role={role}
          currentUserId={membership.userId}
        />
      )}

      {can(role, "project:delete") && <DeleteProjectSection projectPublicId={projectPublicId} />}
      {can(role, "project:leave") && <LeaveProjectButton projectPublicId={projectPublicId} />}
    </main>
  );
}
