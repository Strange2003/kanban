# Kanban Colaborativo

An open-source, self-hostable Kanban board for personal and team projects — accounts, unlimited collaborators per project, and a fast, drag-and-drop board. Free to run yourself, forever.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: Planning](https://img.shields.io/badge/status-planning%2Fspec--driven-blue)](specs/)

> **Project status**: this repository is in the **specification and planning stage**. The product and technical design for Phase 1 (see [Roadmap](#roadmap) below) are fully written up under [`specs/`](specs/), but no application code has been written yet. This README documents the project as it is *designed to work* once implemented — see [Project Status](#project-status) for exactly what exists today.

## Why this project exists

There are plenty of Kanban tools out there (Trello, Jira, Linear, Notion, GitHub/GitLab Issues), but none of them combine what this project sets out to do: a genuinely simple task board — with organizations, invitations, tags, roles and descriptions — that stays **free to self-host**, doesn't lock your data into someone else's SaaS, and isn't tied to a code-hosting ecosystem (no Git/PR/CI concepts baked into the product).

Existing self-hostable alternatives (Kan.bn, Kaneo, Vikunja, Planka, WeKan, Kanboard) come close, but none combine an MIT license with the specific Personal/Shared project model and Work Item relationship model this project targets. See [`kanban-app-vision.md`](kanban-app-vision.md) for the full research and motivation behind that decision.

## Core concepts

- **Accounts**: sign up with Google or email/password (with email verification and password recovery).
- **Projects**: the top-level container. A project is automatically classified as **Personal** (1 member) or **Shared** (2+ members) — you never set this manually, it's derived from who's on the project.
- **Unlimited collaborators**: invite anyone by email, no cap on project members, ever. That's a non-negotiable product principle, not a pricing tier.
- **Board**: each project has one Kanban board. Columns and "stages" are the same thing — create/rename/delete/reorder columns freely, all via drag-and-drop.
- **Work Items**: the cards on the board. Each gets a short, human-readable ID (e.g. `KAN-42`), a title, description, stakeholder, and tags from a per-project catalog.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) + TypeScript | One codebase for frontend and backend (Server Actions), best-supported framework for the auth/DB choices below |
| Database | [Neon](https://neon.tech) (serverless Postgres) | Generous free tier, standard Postgres wire protocol (no lock-in — point `DATABASE_URL` at any Postgres if you prefer) |
| ORM | [Drizzle](https://orm.drizzle.team) | Typed, lightweight, SQL-first migrations |
| Auth | [Better Auth](https://better-auth.com), **self-hosted** (not a managed third-party auth service) | Runs inside this app, in your own database — no external auth vendor, no beta-service risk |
| Transactional email | [Resend](https://resend.com) | Email verification + password reset links |
| Drag & drop | [dnd-kit](https://dndkit.com) | Columns and Work Item reordering |
| UI | Tailwind CSS + [shadcn/ui](https://ui.shadcn.com) | — |
| Testing | Vitest (unit) + Playwright (end-to-end) | — |
| Suggested hosting | [Render](https://render.com) (Web Service) | One place for the app; the database stays on Neon regardless of where the app runs |

Every decision above — including alternatives that were considered and why they were rejected — is written up in [`specs/001-accounts-invitations/research.md`](specs/001-accounts-invitations/research.md).

## Self-hosting model

**This project has no central hosted version, and there isn't a plan for one right now.** "Open source" here means the *code* is free (MIT) — running a live instance still costs real money in compute, storage, and email sending, and whoever runs an instance pays for it. Instead of one shared free-for-everyone deployment, the model is:

> **Everyone who wants to use this runs their own copy**, on their own free-tier (or paid) Neon/Render/Resend accounts. You pay nothing for other people's usage, and they pay nothing for yours.

This is the same model used by comparable self-hosted tools (Kan.bn, Kaneo, Planka, etc.). If you want a single shared instance for your own team, you deploy one yourself and invite them — since project membership is unlimited (see [Core concepts](#core-concepts)), one instance can comfortably serve one person, one team, or one whole organization.

## Getting started (self-hosting)

*(These are the target setup steps once Phase 1 is implemented — see [Project Status](#project-status).)*

### Prerequisites

You'll need free accounts with three external services (all of them have a free tier that comfortably covers a personal or small-team instance):

1. **[Neon](https://neon.tech)** — create a project, copy its Postgres connection string.
2. **[Resend](https://resend.com)** — create an API key (used to send verification and password-reset emails).
3. **[Google Cloud Console](https://console.cloud.google.com)** — create an OAuth 2.0 Client ID (type "Web application") for "Sign in with Google". Add `<your-domain>/api/auth/callback/google` as an authorized redirect URI.

You'll also need Node.js 20+ installed locally.

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Your Neon Postgres connection string |
| `RESEND_API_KEY` | API key from Resend |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From your Google Cloud OAuth client |
| `BETTER_AUTH_SECRET` | A random secret used to sign sessions (`openssl rand -base64 32`) |

### Run it locally

```bash
git clone https://github.com/<your-fork>/kanban.git
cd kanban
npm install
npm run db:migrate   # applies both the app schema and Better Auth's own tables
npm run dev
```

The app will be available at `http://localhost:3000`.

### Deploying

Any host that runs a persistent Node.js process works — the app is a standard Next.js app with no vendor-specific code. The team's default recommendation is **Render**:

1. Create a Web Service, connect this repository.
2. Set the same environment variables as above in Render's dashboard.
3. Set the build command to `npm run build` and the start command to `npm start`.

See [`specs/001-accounts-invitations/plan.md`](specs/001-accounts-invitations/plan.md#acciones-manuales-requeridas) for the full list of one-time manual setup steps and why each platform was chosen over alternatives (Vercel, Railway).

## Project status

This project follows **Spec-Driven Development**: every feature is specified, clarified, planned, and broken into tasks *before* any code is written — see [`AGENTS.md`](AGENTS.md) for how that workflow is organized in this repo.

- ✅ **Project constitution** ratified ([`.specify/memory/constitution.md`](.specify/memory/constitution.md))
- ✅ **Phase 1 (MVP core)** fully specified, clarified, planned, and broken into tasks — see [`specs/`](specs/)
- ⬜ **Phase 1 implementation** — not started (0 lines of application code yet)
- ⬜ **Phase 2** (Work Item relationships, roles & permissions, detail view) — not specified yet
- ⬜ **Phase 3** (list/table/calendar views, extended fields) — not specified yet

## Roadmap

**Phase 1 — Core (MVP)**
1. Accounts & Invitations
2. Projects & Spaces (Personal/Shared)
3. Kanban Board (columns/stages)
4. Work Items

**Phase 2 — Depth**
5. Work Item relationships (parent/child, related)
6. Work Item detail view
7. Roles & permissions

**Phase 3 — Candidates** *(not yet confirmed in scope)*
8. Additional views (list, table, calendar)
9. Extended fields (priority, severity, area, iteration)

## Contributing

Contributions are welcome. This project is spec-driven — before opening a PR that changes behavior, check [`specs/`](specs/) for the relevant feature's `spec.md`; if what you want to build isn't specified yet, open an issue or a spec first (see [`AGENTS.md`](AGENTS.md) for the full workflow). PRs that touch the data model or entity relationships should reference the spec they implement, per the project's [constitution](.specify/memory/constitution.md).

## License

MIT — see [`LICENSE`](LICENSE). Free to use, modify, and self-host, including commercially.
