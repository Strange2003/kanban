import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projectMembers, workItems } from "@/db/schema";
import { getBoard } from "@/lib/actions/board";
import { listMyProjects, listProjectMembers } from "@/lib/actions/projects";
import { getWorkItemDetailData } from "@/lib/actions/work-item-relationships";
import { getWorkItemsView } from "@/lib/actions/work-item-views";
import { getActor } from "@/lib/actor";
import { AppError } from "@/lib/errors";
import { requireProjectMember } from "@/lib/permissions";
import { can } from "@/lib/roles";
import { READ_ONLY, defineTool } from "@/lib/mcp/define";
import { resolveWorkItem } from "@/lib/mcp/resolve";
import { unwrap } from "@/lib/mcp/result";
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT, searchRows } from "@/lib/mcp/search";
import { describeWorkItemActivity } from "@/lib/work-item-activity";
import type { AssigneeView } from "@/lib/work-item-view";

// Read tools of the Kanban MCP server (Historia 3 of 011-agent-access-mcp,
// contracts/mcp-tools.md § Lectura). Each one reuses the read the UI already
// makes, so an agent sees exactly what its user sees.

const projectId = z.string().min(1).describe("The project's id, from list_projects.");
const workItemId = z.string().min(1).describe('A Work Item ID such as "KAN-12".');

const person = (a: AssigneeView | null) => (a ? { memberId: a.userId, name: a.name } : null);

export function registerReadTools(server: McpServer) {
  defineTool(
    server,
    "list_projects",
    {
      title: "List projects",
      description:
        "Lists every project the user belongs to — personal (only them) and shared (with others) — with the " +
        "user's role in each (owner, member or viewer; a viewer can only read). Call this first to get a projectId.",
      inputSchema: z.object({}),
      annotations: READ_ONLY,
    },
    async () => {
      const actor = await getActor();
      if (!actor) throw new AppError("UNAUTHENTICATED", "Not signed in.");
      const { personal, shared } = unwrap(await listMyProjects());
      const roles = await db
        .select({ projectId: projectMembers.projectId, role: projectMembers.role })
        .from(projectMembers)
        .where(eq(projectMembers.userId, actor.userId));
      const roleOf = new Map(roles.map((r) => [r.projectId, r.role]));
      const toOut = (kind: "personal" | "shared") => (p: (typeof personal)[number]) => ({
        projectId: p.publicId,
        name: p.name,
        prefix: p.workItemPrefix,
        kind,
        role: roleOf.get(p.id) ?? null,
        memberCount: p.memberCount,
      });
      return { projects: [...personal.map(toOut("personal")), ...shared.map(toOut("shared"))] };
    },
  );

  defineTool(
    server,
    "get_board",
    {
      title: "Get a project's board",
      description:
        "Returns the project's board: its columns in order (isClosing = Work Items there count as closed) and, " +
        "per column, its Work Items in order with ID, title, assignee, priority, target date, state and tags.",
      inputSchema: z.object({ projectId }),
      annotations: READ_ONLY,
    },
    async ({ projectId }) => {
      const board = unwrap(await getBoard(projectId));
      const view = unwrap(await getWorkItemsView(projectId));
      const rowById = new Map(view.rows.map((r) => [r.id, r]));
      return {
        role: board.role,
        columns: board.stages.map((stage) => ({
          columnId: stage.publicId,
          name: stage.name,
          isClosing: stage.isClosing,
          workItems: board.workItems
            .filter((wi) => wi.stageId === stage.id)
            .map((wi) => ({
              workItemId: wi.displayId,
              title: wi.title,
              assignee: person(wi.assignee),
              priority: wi.priority,
              targetDate: wi.targetDate,
              isClosed: stage.isClosing,
              tags: rowById.get(wi.id)?.tags ?? [],
            })),
        })),
      };
    },
  );

  defineTool(
    server,
    "search_work_items",
    {
      title: "Search Work Items",
      description:
        "Finds Work Items in a project. `text` matches the title or description (case-insensitive) or an exact ID; " +
        'assigneeIds takes memberIds from list_members plus "unassigned" and "me"; filters combine with AND. ' +
        "Use it to check what already exists before creating. Paginated: follow nextOffset until it is null.",
      inputSchema: z.object({
        projectId,
        text: z.string().optional(),
        assigneeIds: z.array(z.string().min(1)).optional(),
        columnIds: z.array(z.string().min(1)).optional(),
        state: z.enum(["open", "closed"]).optional(),
        limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional().describe(`Default ${DEFAULT_SEARCH_LIMIT}.`),
        offset: z.number().int().min(0).optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ projectId, ...query }) => {
      const view = unwrap(await getWorkItemsView(projectId));
      // Descriptions aren't part of the List/Table rows; read them for the same
      // project the membership check above just allowed.
      const { project } = await requireProjectMember(projectId);
      const descriptions = await db
        .select({ id: workItems.id, description: workItems.description })
        .from(workItems)
        .where(eq(workItems.projectId, project.id));
      const descriptionOf = new Map(descriptions.map((d) => [d.id, d.description]));
      const page = searchRows(
        view.rows.map((row) => ({ ...row, description: descriptionOf.get(row.id) ?? null })),
        query,
        view.currentUserId,
      );
      return {
        total: page.total,
        nextOffset: page.nextOffset,
        items: page.items.map((row) => ({
          workItemId: row.displayId,
          title: row.title,
          columnId: row.stagePublicId,
          columnName: row.stageName,
          assignee: person(row.assignee),
          priority: row.priority,
          isClosed: row.isClosed,
        })),
      };
    },
  );

  defineTool(
    server,
    "get_work_item",
    {
      title: "Get a Work Item",
      description:
        "Returns every field of one Work Item, its parent, children and related Work Items, and its history " +
        "(who changed what, and whether it was through an agent).",
      inputSchema: z.object({ projectId, workItemId }),
      annotations: READ_ONLY,
    },
    async ({ projectId, workItemId }) => {
      const { project, workItem } = await resolveWorkItem(projectId, workItemId);
      const detail = unwrap(await getWorkItemDetailData(workItem.id, projectId));
      const ref = (r: { displayId: string; title: string }) => ({ workItemId: r.displayId, title: r.title });
      return {
        workItemId: `${project.workItemPrefix}-${workItem.displayNumber}`,
        title: workItem.title,
        description: workItem.description,
        column: detail.stage.name,
        isClosed: detail.stage.isClosing,
        assignee: person(detail.assignee),
        tags: detail.itemTags,
        priority: workItem.priority,
        severity: workItem.severity,
        area: detail.itemArea,
        iteration: detail.itemIteration,
        startDate: workItem.startDate,
        targetDate: workItem.targetDate,
        closedAt: workItem.closedAt,
        createdAt: workItem.createdAt,
        updatedAt: workItem.updatedAt,
        parent: detail.relations.parent ? ref(detail.relations.parent) : null,
        children: detail.relations.children.map(ref),
        related: detail.relations.related.map(ref),
        activity: detail.activity.map((entry) => ({
          at: entry.createdAt,
          type: entry.type,
          summary: describeWorkItemActivity(entry),
          actorName: entry.actorName,
          agentName: entry.agentName,
        })),
      };
    },
  );

  defineTool(
    server,
    "list_members",
    {
      title: "List project members",
      description:
        "Lists the people in a project with their memberId (use it to assign Work Items) and role. " +
        "Emails are included only if the user's role can see them in the app.",
      inputSchema: z.object({ projectId }),
      annotations: READ_ONLY,
    },
    async ({ projectId }) => {
      const { membership } = await requireProjectMember(projectId);
      // Same visibility of third parties' emails as the UI (FR-018 of 007).
      const showEmails = can(membership.role, "invitation:viewPending");
      const members = unwrap(await listProjectMembers(projectId));
      return {
        members: members.map((m) => ({
          memberId: m.userId,
          name: m.name,
          role: m.role,
          ...(showEmails ? { email: m.email } : {}),
        })),
      };
    },
  );
}
