import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/roles";
import { getProjectCatalogs } from "@/lib/actions/project-catalogs";
import { CatalogSection } from "@/components/settings/CatalogSection";

// FR-001/FR-002/FR-007 of 013-project-catalogs: the project's tags, areas and
// sizes. Any member can view (getProjectCatalogs checks membership); only a
// role with `catalog:manage` sees the controls — the Server Actions enforce it.
export default async function ProjectCatalogsPage({
  params,
}: {
  params: Promise<{ projectPublicId: string }>;
}) {
  const { projectPublicId } = await params;
  const result = await getProjectCatalogs(projectPublicId);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "FORBIDDEN") notFound();
    throw new Error(result.error.message);
  }
  const { role, projectName, tags, areas, sizes } = result.data;
  const canManage = can(role, "catalog:manage");

  return (
    <main className="mx-auto min-w-0 max-w-2xl flex-1 space-y-8 overflow-y-auto p-4 sm:p-8">
      <div>
        <Link
          href={`/projects/${projectPublicId}/settings`}
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          ← Back to settings
        </Link>
        <h1 className="text-2xl font-semibold">{projectName} — Tags, areas &amp; sizes</h1>
        {!canManage && (
          <p className="text-muted-foreground text-sm">You can view these lists, but not change them.</p>
        )}
      </div>

      <CatalogSection projectPublicId={projectPublicId} kind="tag" title="Tags" values={tags} canManage={canManage} />
      <CatalogSection projectPublicId={projectPublicId} kind="area" title="Areas" values={areas} canManage={canManage} />
      <CatalogSection projectPublicId={projectPublicId} kind="size" title="Size" values={sizes} canManage={canManage} />
    </main>
  );
}
