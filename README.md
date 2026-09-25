# Kanban Colaborativo

An open-source, self-hostable Kanban board for personal and team projects — accounts, unlimited collaborators per project, a fast drag-and-drop board, List and Table views, comments and time tracking, and an MCP server so your AI assistant can work on the board with you. Free to run yourself, forever.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: Phase 4 in progress](https://img.shields.io/badge/status-phase%204%20in%20progress-blue)](#project-status)

> **Project status**: Phases 1, 2 and 3 are complete, and Phase 4 has shipped AI agent access (MCP), the Work Item assignee, and the collaborative Work Item detail (comments, time tracking, History tab). Everything runs end-to-end against a real Postgres (Neon) database, and the first instance is live on Render with real teams using it. See [Project status](#project-status) for details and what's next.

**Contents**: [Why](#why-this-project-exists) · [Features](#features) · [Using the app](#using-the-app) · [Roles](#roles-and-permissions) · [AI agents](#ai-agents-mcp) · [Tech stack](#tech-stack) · [Self-hosting](#self-hosting-model) · [Getting started](#getting-started) · [Deploying](#deploying) · [Project structure](#project-structure) · [Status](#project-status) · [Roadmap](#roadmap) · [Contributing](#contributing)

## Why this project exists

There are plenty of Kanban tools out there (Trello, Jira, Linear, Notion, GitHub/GitLab Issues), but none of them combine what this project sets out to do: a genuinely simple task board — with organizations, invitations, tags, roles and descriptions — that stays **free to self-host**, doesn't lock your data into someone else's SaaS, and isn't tied to a code-hosting ecosystem (no Git/PR/CI concepts baked into the product).

Existing self-hostable alternatives (Kan.bn, Kaneo, Vikunja, Planka, WeKan, Kanboard) come close, but none combine an MIT license with the specific Personal/Shared project model and Work Item relationship model this project targets. See [`kanban-app-vision.md`](kanban-app-vision.md) for the full research and motivation behind that decision.

## Features

**Accounts & collaboration**
- Sign up with **Google** or **email/password** (with email verification and password recovery).
- **Projects** are the top-level container. A project is automatically **Personal** (1 member) or **Shared** (2+ members) — derived from who's on it, never set by hand.
- **Unlimited collaborators**: invite anyone by email, no cap on members, ever. That's a product principle, not a pricing tier.
- **Roles per project**: Owner, Member or Viewer (see [Roles and permissions](#roles-and-permissions)). The owner can change roles, remove members and transfer ownership.
- **In-app notifications** (the bell in the header) for invitations and for Work Items assigned to you.

**Board**
- One Kanban board per project. Columns ("stages") can be created, renamed, deleted and reordered by drag-and-drop.
- Work Items are dragged between and within columns; on mobile, columns scroll sideways and each card has a "Move to column" control.
- Any column can be marked as a **closing column** (e.g. "Done"): Work Items in it are closed; they reopen when they leave it.

**Work Items**
- A short, human-readable ID per project (e.g. `KAN-42`), title and plain-text description.
- **Assignee** (one project member, who gets notified), **tags**, **priority** and **severity** (Critical / High / Medium / Low), **area** and **iteration** (per-project catalogs), and optional **start** and **target dates** — an open Work Item past its target date shows as overdue.
- **Relationships**: one parent with many children (a hierarchy), plus "related" links.
- **Detail view** with a side panel for every field, the description, relationships and a **discussion**: any member, Viewers included, can comment.
- **Time tracking**: an estimate plus individual time entries (with an optional note); the total spent is the sum of the entries.
- **History tab**: a full audit trail of every change — who made it, when, and whether it was made through an AI agent.

**Views**
- **Board** — the Kanban, the main view.
- **List** — a collapsible parent/child backlog.
- **Table** — every field, sortable and filterable. Filters live in the URL, so a filtered view can be bookmarked or shared.

List and Table are read-only; editing happens on the board and in a Work Item's detail view.

**AI agents** — connect Claude Code, Claude Desktop, claude.ai or any other [MCP](https://modelcontextprotocol.io) client and let it read, create, assign and move Work Items, and reorganize columns, with exactly your role. See [AI agents (MCP)](#ai-agents-mcp).

**Legal pages** — every instance serves a Privacy Policy at `/privacy` and Terms of Service at `/terms`, linked from the sign-in and sign-up screens (required by Google to publish "Sign in with Google").

## Using the app

A quick tour for someone opening an instance for the first time:

1. **Create an account** on the sign-up page, with Google or with email and password. Email sign-ups must click the verification link before pending invitations reach them.
2. **Create a project** with the "+" in the sidebar. You become its Owner, and it starts with an empty board.
3. **Shape the board**: add, rename and drag columns (e.g. To do / Doing / Done). Click the check-circle icon on a column to mark it as a closing column.
4. **Add Work Items** with "+ Add work item" at the bottom of a column. Click a card to open its detail view and fill in the assignee, tags, priority, dates, estimate, and so on.
5. **Invite people** from the project's settings (gear icon → Members → Invite) with their email and a role (Member or Viewer). Invitations are delivered **inside the app**, not by email: tell the person to sign up on your instance **with that same email address**, and the invitation will be waiting in their bell to accept. Pending invitations can be seen and cancelled from the project's settings.
6. **Work together**: move cards as work progresses, comment on Work Items, log time, and switch to the List or Table view to review the backlog or filter by assignee, priority, iteration, etc.
7. **Project settings** (gear icon, top right of the project): rename or describe the project, manage members and roles, transfer ownership, leave the project, or delete it (Owner only).
8. *(Optional)* **Connect your AI assistant** — see below.

> The board doesn't update live: other members see your changes the next time they open or refresh the board. This is intentional (no WebSockets) at this stage.

## Roles and permissions

Every project has exactly one Owner. Whoever invites picks the role; the Owner can change it later.

| Action | Owner | Member | Viewer |
|---|:-:|:-:|:-:|
| See the project, its board, views and Work Items | ✅ | ✅ | ✅ |
| Comment on Work Items | ✅ | ✅ | ✅ |
| Create, edit, move and delete Work Items; relationships; estimates and time entries | ✅ | ✅ | — |
| Create, rename, reorder and delete columns | ✅ | ✅ | — |
| Invite people, see pending invitations, cancel their own invitations | ✅ | ✅ | — |
| Cancel anyone's invitation, remove members, change roles | ✅ | — | — |
| Rename/describe or delete the project, transfer ownership | ✅ | — | — |
| Leave the project | — (transfer first) | ✅ | ✅ |

The UI hides what your role can't do, but the server always enforces it. The matrix lives in [`lib/roles.ts`](lib/roles.ts).

## AI agents (MCP)

Every instance serves an MCP server at `<your-domain>/api/mcp` — nothing to configure on the server. Each user adds that address to their assistant as a remote MCP server. With Claude Code:

```bash
claude mcp add --transport http kanban https://<your-domain>/api/mcp
```

In Claude Desktop or claude.ai, add it as a custom connector with the same URL.

On first use the assistant opens the browser: you sign in (Google or email) and see a consent screen that says what the agent will and won't be able to do. No API keys to copy. After **Allow**, the agent can:

| Area | Tools |
|---|---|
| Read | `list_projects`, `list_members`, `get_board`, `get_work_item`, `search_work_items` |
| Work Items | `create_work_items` (up to 50 at once), `update_work_item` (fields, assignee), `move_work_item`, `set_parent`, `link_related`, `delete_work_item` |
| Columns | `create_column`, `rename_column`, `reorder_columns`, `set_column_closing`, `delete_column` |

Guarantees:
- It acts **as you**, with exactly your role in each project — a Viewer's agent can only read.
- It **can't** invite or remove people, change roles, or rename/delete/leave projects.
- Every change it makes appears in the Work Item's History as "by *you* via *agent*".
- **Settings → Connected agents** (the robot icon in the header) lists every authorized agent and revokes one immediately.

Design and decisions: [`specs/011-agent-access-mcp`](specs/011-agent-access-mcp/).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | [Next.js](https://nextjs.org) 16 (App Router) + TypeScript + React 19 | One codebase for frontend and backend (Server Actions) |
| Database | [Neon](https://neon.tech) (serverless Postgres) | Generous free tier, standard Postgres (no lock-in — point `DATABASE_URL` at any Postgres 15+) |
| ORM | [Drizzle](https://orm.drizzle.team) | Typed, lightweight, SQL-first migrations |
| Auth | [Better Auth](https://better-auth.com), **self-hosted** | Runs inside this app, in your own database — no external auth vendor |
| Transactional email | [Resend](https://resend.com) | Email verification and password-reset links |
| Drag & drop | [dnd-kit](https://dndkit.com) | Columns and Work Item reordering |
| UI | Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com) | — |
| AI agent access | [MCP](https://modelcontextprotocol.io) server + OAuth 2.1 from Better Auth's `mcp()` plugin | An open standard any assistant can use; authorization stays inside this app |
| Testing | Vitest (unit) + Playwright (end-to-end) | — |
| Suggested hosting | [Render](https://render.com) (Web Service) | One place for the app; the database stays on Neon wherever the app runs |

Every decision above — including the alternatives that were rejected and why (e.g. Vercel, Neon Auth) — is written up in [`specs/001-accounts-invitations/research.md`](specs/001-accounts-invitations/research.md).

## Self-hosting model

**There is no central hosted version.** "Open source" here means the *code* is free (MIT); running a live instance still costs compute, storage and email, and whoever runs an instance pays for it. So:

> **Everyone who wants to use this runs their own copy**, on their own free-tier (or paid) Neon/Render/Resend accounts. You pay nothing for other people's usage, and they pay nothing for yours.

This is the same model as comparable self-hosted tools (Kan.bn, Kaneo, Planka…). For a team, one person deploys an instance and invites everyone else — since membership is unlimited, one instance comfortably serves one person, one team or a whole organization.

## Getting started

### Prerequisites

- **Node.js 20+** and npm.
- **[Neon](https://neon.tech)** (free) — create a project and copy its Postgres connection string. **Required.**
- **[Resend](https://resend.com)** (free) — create an API key. **Required** — used for verification and password-reset emails.
- *(Optional)* **[Google Cloud Console](https://console.cloud.google.com)** — an OAuth 2.0 Client ID (type "Web application") for "Sign in with Google", with `<your-domain>/api/auth/callback/google` as an authorized redirect URI (add `http://localhost:3000/api/auth/callback/google` too for local development). Leave the Google variables blank to use email/password only.

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Description |
|---|:-:|---|
| `DATABASE_URL` | ✅ | Your Neon (or any Postgres 15+) connection string |
| `BETTER_AUTH_SECRET` | ✅ | Random secret that signs sessions — generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | ✅ | Base URL the app is reachable at — `http://localhost:3000` locally, the public `https://` address in production |
| `RESEND_API_KEY` | ✅ | API key from Resend |
| `EMAIL_FROM` | ✅ | Sender address, e.g. `Kanban <no-reply@your-domain>`. `onboarding@resend.dev` works for testing |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | From your Google Cloud OAuth client |
| `OPERATOR_NAME` / `OPERATOR_CONTACT_EMAIL` | — | Who runs your instance and how to reach them — shown on `/privacy` and `/terms` |

**About email delivery**: with Resend's sandbox sender (`onboarding@resend.dev`), emails are only delivered to the address on your own Resend account. Until you verify a sending domain in Resend, other people should sign up **with Google** (or you'll need to verify a domain).

### Run it locally

```bash
git clone https://github.com/Strange2003/kanban.git
cd kanban
npm install
cp .env.example .env.local   # then fill it in
npm run db:migrate           # creates the app tables and Better Auth's tables
npm run dev
```

Open `http://localhost:3000`, sign up, and create your first project.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Applies pending migrations in `db/migrations/` to `DATABASE_URL` |
| `npm run db:generate` | Generates a new migration after editing `db/schema.ts` |
| `npm run auth:generate` | Regenerates `db/auth-schema.ts` from Better Auth's config |
| `npm run test` | Unit tests (Vitest) — no database access, safe anytime |
| `npm run test:e2e` | End-to-end tests (Playwright) — **wipes the database**, see below |

The `db:*`, `auth:generate` and `test:e2e` scripts load `.env.local` automatically.

### Testing

**Before running `test:e2e`, point `DATABASE_URL` at a disposable Neon branch, never your real data** — `tests/e2e/setup.ts` truncates every app and auth table before the suite runs. Neon branches are free and made for exactly this. The suite runs against `next dev` (it reuses a server on port 3000 or starts one) and takes roughly 15–20 minutes against a remote Neon branch.

## Deploying

Any host that runs a persistent Node.js process works — it's a standard Next.js app with no vendor-specific code. The recommended host is **Render**:

1. Create a **Web Service** and connect your fork of this repository.
2. Build command: `npm install && npm run build`. Start command: `npm start`.
3. Set the [environment variables](#environment-variables) in Render's dashboard. `BETTER_AUTH_URL` **must** be the service's public `https://` address — sign-in redirects and the AI-agent (MCP/OAuth) metadata are derived from it.
4. Run `npm run db:migrate` once with `DATABASE_URL` pointing at the production database (e.g. `DATABASE_URL=… npx tsx db/migrate.ts`).
5. If you use Google sign-in, add `<your-domain>/api/auth/callback/google` to the OAuth client. While the Google app is in *Testing*, only listed test users can sign in; to open it to everyone, set `<your-domain>`, `<your-domain>/privacy` and `<your-domain>/terms` on its branding page (don't upload a logo — that triggers brand verification) and click **Publish app**.

Tip: use **two Neon branches** — one for production (only in Render's environment) and one for development and e2e (in `.env.local`).

### Upgrading an instance

> ⚠️ **Render never runs migrations.** Whenever an update adds files under `db/migrations/`, apply them to the production database **before** the new code goes live — first on your dev branch, then on production, then deploy. If the code ships first, pages that read the new columns will crash until the migration is applied.

Migrations `0005`–`0006` need **Postgres 15 or later** (Neon's default is newer).

### Administration notes

- **Legal text**: `/privacy` and `/terms` are a generic starting point for a personal or team instance — **not legal advice**. Whoever runs an instance is responsible for its data; edit `app/(legal)/` in your copy if you need something different.
- **Deleting an account by hand**: delete its rows in `project_members` **before** the `user` row — that unassigns its Work Items (the database does it); its AI agents' OAuth authorizations go away with the `user` row.

See [`specs/001-accounts-invitations/plan.md`](specs/001-accounts-invitations/plan.md#acciones-manuales-requeridas) for the full list of one-time manual setup steps.

## Project structure

```
app/                  Routes (App Router)
  (auth)/             Sign-in, sign-up, password reset, agent consent screen
  (workspace)/        The signed-in app: projects, board, list, table, Work Item detail, settings
  (legal)/            /privacy and /terms
  api/auth/           Better Auth handler
  api/mcp/            MCP server for AI agents
components/           UI (board, views, work-items, sidebar, settings, ui primitives)
db/                   Drizzle schema, migrations and migration runner
lib/
  actions/            Server Actions — every export is a public endpoint and checks permissions
  mcp/                MCP server: tools, id resolution, rate limiting
  roles.ts            The permission matrix (pure, shared with the client)
  permissions.ts      Membership and permission checks used by every action
  activity.ts         logActivity — the only way to write the audit trail
specs/                One folder per feature: spec, plan, data model, tasks (Spanish)
tests/unit/           Vitest
tests/e2e/            Playwright
```

## Project status

This project follows **Spec-Driven Development** with [Spec Kit](https://github.com/github/spec-kit): every feature is specified, clarified, planned and broken into tasks *before* code is written — see [`AGENTS.md`](AGENTS.md).

- ✅ **Constitution** ratified ([`.specify/memory/constitution.md`](.specify/memory/constitution.md))
- ✅ **Phase 1 (core)** — accounts & invitations, projects, board, Work Items ([`specs/001`](specs/001-accounts-invitations/)–[`004`](specs/004-work-items/)); 121/121 tasks
- ✅ **Phase 2 (depth)** — relationships ([`005`](specs/005-work-item-relationships/)), detail view ([`006`](specs/006-work-item-detail-view/)), roles & permissions ([`007`](specs/007-roles-permissions/))
- ✅ **Phase 3 (planning & views)** — extended fields and closing columns ([`008`](specs/008-work-item-fields/)), List and Table views ([`009`](specs/009-work-item-views/))
- ✅ **Legal pages** ([`010`](specs/010-legal-pages/)) — `/privacy` and `/terms`; Google sign-in published for everyone
- ✅ **Phase 4 so far** — AI agent access over MCP + Work Item assignee ([`011`](specs/011-agent-access-mcp/)); collaborative Work Item detail with comments, time tracking and History tab ([`012`](specs/012-work-item-discussion/))
- ✅ **Deployment** — the first instance runs on Render against its own production Neon branch, migrated through `0007`

Still open: the manual quickstart passes of 007 (T057), 008 (T052), 009 (T028) and 011 (T057 — end-to-end check with a real MCP client).

## Roadmap

**Phase 1 — Core** ✅
1. Accounts & invitations
2. Projects & spaces (Personal/Shared)
3. Kanban board (columns/stages)
4. Work Items

**Phase 2 — Depth** ✅
5. Work Item relationships (parent/child, related)
6. Work Item detail view
7. Roles & permissions

**Phase 3 — Planning & views** ✅
8. Extended fields (priority, severity, area, iteration, dates, closing columns)
9. List and Table views *(calendar deferred)*

**Phase 4** 🟡
11. AI agent access (MCP) + Work Item assignee ✅
12. Work Item discussion, time tracking and detail layout ✅

Candidates *(not yet confirmed in scope — each goes through `/speckit-specify` first)*:
- Calendar view (Work Items already store start, target and closing dates)
- Managing catalogs: rename/delete tags, areas and iterations (catalogs only grow today)
- Comments and time entries through the MCP server

## Contributing

Contributions are welcome. The project is spec-driven: before opening a PR that changes behavior, check [`specs/`](specs/) for the relevant feature's `spec.md`. If what you want to build isn't specified yet, open an issue or a spec first (see [`AGENTS.md`](AGENTS.md) for the workflow). PRs that touch the data model should reference the spec they implement, per the [constitution](.specify/memory/constitution.md). Specs are written in Spanish; code, comments and commits in English.

## License

MIT — see [`LICENSE`](LICENSE). Free to use, modify and self-host, including commercially.
