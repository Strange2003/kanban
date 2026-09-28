import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { db } from "@/db/client";
import { getProjectCatalogs, setTagColor } from "@/lib/actions/project-catalogs";
import { requireProjectMember } from "@/lib/permissions";
import { TAG_COLORS } from "@/lib/tag-colors";
import { findCatalogValue } from "@/lib/work-item-catalogs";
import { READ_ONLY, WRITE, defineTool } from "@/lib/mcp/define";
import { unwrap } from "@/lib/mcp/result";

// Catalog tools of the Kanban MCP server (Historia 4 of
// 014-board-filters-mcp-catalogs, contracts/board-filters-mcp-catalogs.md).
// They reuse 013-project-catalogs' Server Actions, so an agent reads and
// recolors exactly like the catalogs page (FR-033 of 011). Renaming,
// reordering, deleting and creating loose values stay out of reach (FR-020).

const projectId = z.string().min(1).describe("The project's id, from list_projects.");

export function registerCatalogTools(server: McpServer) {
  defineTool(
    server,
    "list_catalogs",
    {
      title: "List a project's catalogs",
      description:
        "Returns the project's tags (with their color), areas and sizes, each in the project's own order, with how " +
        "many Work Items use each value, plus the valid tag colors. Call it before assigning tags, areas or sizes " +
        "so you reuse existing values instead of creating variants.",
      inputSchema: z.strictObject({ projectId }),
      annotations: READ_ONLY,
    },
    async ({ projectId }) => {
      const catalogs = unwrap(await getProjectCatalogs(projectId));
      const value = ({ name, usage }: { name: string; usage: number }) => ({ name, workItemCount: usage });
      return {
        tags: catalogs.tags.map((tag) => ({ name: tag.name, color: tag.color, workItemCount: tag.usage })),
        areas: catalogs.areas.map(value),
        sizes: catalogs.sizes.map(value),
        colors: [...TAG_COLORS],
      };
    },
  );

  defineTool(
    server,
    "set_tag_color",
    {
      title: "Set a tag's color",
      description:
        "Changes the color of an existing tag of the project everywhere it's used. The tag is found by name " +
        `(case-insensitive). Colors: ${TAG_COLORS.join(", ")}.`,
      inputSchema: z.strictObject({
        projectId,
        tag: z.string().min(1).describe("The tag's name, from list_catalogs."),
        color: z.enum(TAG_COLORS).describe(`One of: ${TAG_COLORS.join(", ")}.`),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ projectId, tag, color }) => {
      // The role check (catalog:manage) and the NOT_FOUND for a missing tag happen inside the action.
      unwrap(await setTagColor({ projectPublicId: projectId, name: tag, color }));
      const { project } = await requireProjectMember(projectId);
      const value = await findCatalogValue(db, "tag", project.id, tag);
      return { name: value?.name ?? tag.trim(), color };
    },
  );
}
