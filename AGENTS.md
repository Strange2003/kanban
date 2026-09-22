# AGENTS.md

Instructions for AI coding agents (Claude Code and others) working in this repository. Read this before writing or planning any code here.

## What this project is

A self-hostable, open-source Kanban board (accounts, projects, boards, work items — see [README.md](README.md)). It is built using **Spec-Driven Development (SDD)** via [Spec Kit](https://github.com/github/spec-kit): every feature is specified, clarified, planned, and broken into tasks under `specs/` *before* implementation. If you are about to write code, the design decisions almost certainly already exist somewhere in `specs/` — find them before inventing your own.

## Start here, in this order

1. [`kanban-app-vision.md`](kanban-app-vision.md) — the original product vision/context doc. Read this for *why* the product is shaped the way it is.
2. [`.specify/memory/constitution.md`](.specify/memory/constitution.md) — **non-negotiable** project principles (UX, unlimited collaboration, data hierarchy, data isolation/security, open-source/no lock-in, YAGNI) plus product-wide standards (auth requirements, the Work Item activity-log requirement, roles). Every plan and every code review is checked against this. If a principle needs to change, that happens via `/speckit-constitution`, never silently in code.
3. [`specs/`](specs/) — one directory per feature, numbered (`001-accounts-invitations` … `004-work-items` for Phase 1, then `005-work-item-relationships`, `006-work-item-detail-view`, `007-roles-permissions` for Phase 2, and `008-work-item-fields` opening Phase 3). Each feature directory can contain:
   - `spec.md` — functional spec: user stories, functional requirements (`FR-###`), success criteria (`SC-###`), edge cases. **FR/SC numbers are only unique within their own spec.md** — always qualify them with the feature (e.g. "FR-008 of 004-work-items"), never cite a bare `FR-008` across files.
   - `checklists/requirements.md` — spec quality checklist.
   - `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` — technical design. **Phase 1's four features share ONE set of these** (all real content lives in `specs/001-accounts-invitations/`; the `plan.md` in `002-004` are short stubs that point back to it). Check for a "stub" notice at the top of a `plan.md` before assuming it's the canonical one.
   - `tasks.md` — same sharing pattern: the real task list for all of Phase 1 lives in `specs/001-accounts-invitations/tasks.md` (task IDs `T001`-`T121` as of this writing), labeled per-story as `[F1-US1]`..`[F4-US5]` (`F1`=001-accounts-invitations, `F2`=002-project-spaces, `F3`=003-kanban-board, `F4`=004-work-items). The stub `tasks.md` in the other three feature directories just says which phases belong to that feature.
4. [README.md](README.md) — tech stack, self-hosting instructions, current project status.

## Golden rule

**Don't re-decide what's already decided.** Framework, database, ORM, auth library, hosting target, identifier strategy, permission model, drag-and-drop behavior, real-time-sync stance — all of it is already decided and justified with rejected alternatives in `specs/001-accounts-invitations/research.md` and `plan.md`. If you're about to make an architectural choice, check there first. If it's genuinely not covered, say so explicitly rather than guessing.

## Known "obvious-but-wrong" defaults for this repo

This project's stack was deliberately chosen *against* some choices that would otherwise be a reasonable default for a Next.js + Neon app. Do not silently reintroduce these:

- **Hosting is Render, not Vercel.** Vercel was evaluated and rejected on cost-at-scale grounds (see `research.md` § Hosting/despliegue), even though Vercel+Neon has the more "native" integration.
- **Auth is Better Auth, self-hosted — not "Neon Auth" (Neon's managed wrapper).** They're the same underlying library, but the managed version was rejected because it's in beta with no SLA (see `research.md` § Autenticación). Better Auth runs inside this app's own Next.js process (`app/api/auth/[...all]/route.ts`) and stores its tables in the same Neon Postgres database via the Drizzle adapter — it is not a separate service to deploy.
- **No real-time sync (no WebSockets) in Phase 1.** Board updates are visible to other members "next time they open the board," by design — this was clarified explicitly, not an oversight.
- **Work Item descriptions are plain text, not rich text/markdown**, in this phase.

## Current state of the codebase

Phases 1 and 2 are implemented (`001`-`007`) and merged to `main`. Phase 3 is confirmed as extended fields plus list and table views (no calendar yet): `008-work-item-fields` is implemented and merged to `main`, and the views are `009`. Branching: feature branches (`NNN-feature-name`) are cut from `main` and merged back into `main` when done (no separate `dev` branch). Nothing is deployed: the only running database is the development Neon one (all migrations applied), so there is no production data to protect — but still confirm before running e2e, which truncates it. The source follows the layout in `specs/001-accounts-invitations/plan.md` § Project Structure: routes in `app/`, the Drizzle schema and migrations in `db/`, Server Actions in `lib/actions/` (every export of those `"use server"` files is a public endpoint), plain server-only helpers in `lib/` (`permissions.ts`, `work-item-queries.ts`, `work-item-catalogs.ts`, `invitations.ts`), pure modules shared with the client (`roles.ts`, `work-item-fields.ts`, `work-item-closing.ts`), UI in `components/`, and Vitest/Playwright suites in `tests/unit/` and `tests/e2e/`. Check `README.md` § Project Status for the up-to-date picture.

## Working with `tasks.md`

- Task IDs (`T001`, `T002`, ...) **must stay sequential with no gaps**, in execution order, across the entire file — including the phase-grouping and the prose in "Dependencies & Execution Order" / "Parallel Execution Examples", which reference specific task IDs.
- If you insert or remove a task, every later task ID shifts. Do this with a script, not by hand — renumbering ~120 tasks manually is how mistakes happen. A one-off Python script that (1) applies your text edit with a placeholder ID, then (2) does a single simultaneous regex substitution pass over the whole file based on final document order, is the pattern already used in this repo's history for this exact reason.
- Every task line must match `- [ ] T### [P?] [F<n>-US<m>?] Description with an exact file path`. `[P]` = parallelizable (different file, no unmet dependencies). The `[F<n>-US<m>]` story label is required on user-story-phase tasks and absent from Setup/Foundational/Polish tasks.
- Mark a task done by flipping `- [ ]` to `- [x]` — don't renumber or reorder completed tasks.

## Spec Kit workflow (for extending scope, not for this session's code)

This repo uses the `/speckit-*` slash commands: `/speckit-specify` (new feature spec), `/speckit-clarify` (resolve ambiguities into the spec), `/speckit-plan` (technical design), `/speckit-tasks` (task breakdown), `/speckit-analyze` (cross-artifact consistency check — spec vs. plan vs. tasks vs. constitution), `/speckit-implement` (execute tasks.md). Templates and helper scripts live under `.specify/` — don't hand-edit files there; they're tooling, not project documentation. If you're asked to add a new feature to this product, it belongs in a new `specs/NNN-feature-name/` directory via `/speckit-specify`, not as ad-hoc code.

## Constitution highlights an agent is likely to violate by default

- Any query touching `projects`, `stages`, `work_items`, or `tags` **must** check the requesting user's membership first (`lib/permissions.ts` helpers) — never trust a client-supplied project ID alone.
- Every Server Action that **mutates** project data **must** call `requireProjectPermission(projectPublicId, permission)` with a key from `lib/roles.ts` (`007-roles-permissions`) — never an inline `membership.role === ...` check, and never bare `requireProjectMember` on a mutation (that would let a Viewer write). The permission matrix lives **only** in `lib/roles.ts`, which is pure so client components can import `can()` to hide controls; the UI merely reflects a role, the server enforces it. A rejected role returns `ROLE_NOT_PERMITTED` (not `FORBIDDEN`, which pages turn into a 404). `tests/unit/action-permissions.test.ts` fails if an exported action isn't classified — add new actions there.
- Everything exported from a `"use server"` file is a potential public endpoint. Don't export helpers from those files just so a sibling module can import them.
- Every entity exposed in a URL or response needs a `publicId` (nanoid) distinct from its internal serial PK — except Work Items, which intentionally use a human-readable per-project correlative ID (`PREFIX-N`) instead; see `data-model.md` for why that's still compliant.
- Every relevant change to a Work Item (stage change, field edit) must write a row to `work_item_activity` (see `data-model.md` and `contracts/work-items.md`) — this is a constitution requirement (Estándares de Producto y Datos § Auditoría), not optional polish. It was missed once already (see the `/speckit-analyze` history in `plan.md`'s Constitution Check table) — don't drop it again.
- A Work Item is **closed exactly when its column is a closing column** (`stages.is_closing`, `008-work-item-fields`); only `work_items.closed_at` is stored, under the invariant `closed_at IS NOT NULL ⇔ stages.is_closing`. Any code that changes a Work Item's column or a column's `is_closing` mark **must** compute `closed_at` through `nextClosedAt` (`lib/work-item-closing.ts`) in the same transaction, lock the affected `stages` rows (`FOR SHARE` to move, `FOR UPDATE` to (un)mark), and log `closed`/`reopened` activity. Never set `closed_at` directly or accept it as input.
- Area and iteration values are always resolved **by name within the Work Item's own project** (`resolveCatalogValue` in `lib/work-item-catalogs.ts`), never from a client-sent id — that's what keeps one project's catalog out of another's.
- No feature that ties the product to a specific Git/CI-CD provider (Principle V) — this app has nothing to do with source control.

## Language note

Spec artifacts under `specs/` and `.specify/memory/constitution.md` are written in **Spanish** (the product owner's working language for planning). Code, code comments, commit messages, and this file are in **English**. Don't translate the specs — read them as-is.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
