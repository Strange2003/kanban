# Implementation Plan: Fase 1 — Cuentas, Proyectos, Tablero y Work Items

**Branch**: `001-accounts-invitations` (ancla técnica de la Fase 1) | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specifications de la Fase 1 completa:
[001-accounts-invitations](spec.md),
[002-project-spaces](../002-project-spaces/spec.md),
[003-kanban-board](../003-kanban-board/spec.md),
[004-work-items](../004-work-items/spec.md).

**Nota de alcance**: Las 4 specs de la Fase 1 comparten un único codebase y
un único deploy (no son servicios independientes), así que este plan cubre
la arquitectura técnica de las cuatro juntas. Los archivos `plan.md` dentro
de `specs/002-project-spaces/`, `specs/003-kanban-board/` y
`specs/004-work-items/` son stubs que apuntan de vuelta a este documento en
vez de repetir la investigación — ver el aviso en cada uno.

## Summary

Aplicación web colaborativa de tableros Kanban (Next.js + Neon Postgres +
Better Auth self-hosted) que cubre el loop completo del MVP: registro/login
(Google OAuth o email/contraseña con verificación y recuperación), creación
de proyectos que se clasifican automáticamente en "Personal"/"Compartido"
según su número de miembros, invitación de colaboradores sin límite por
email con notificación in-app, un tablero por proyecto con columnas
(=stages) creables/reordenables/eliminables por drag-and-drop, y Work
Items con identificador legible por proyecto, tags de catálogo, y
movimiento fluido entre columnas. El enfoque técnico prioriza velocidad de
entrega del MVP (sin sync en tiempo real, sin editor enriquecido)
reutilizando una base de datos gestionada (Neon) y una librería de
autenticación madura (Better Auth) para no reconstruir infraestructura de
base de datos ni flujos de identidad desde cero — ver
[research.md](research.md) para el detalle de cada decisión y sus
alternativas (incluye por qué se descartó el wrapper gestionado "Neon
Auth", todavía en beta).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 20+

**Primary Dependencies**: Next.js 14+ (App Router), React 18, Drizzle ORM +
`@neondatabase/serverless`, Better Auth (self-hosted) + su adapter de
Drizzle, Resend (envío de emails de verificación/reset), `dnd-kit`
(drag-and-drop), Tailwind CSS + shadcn/ui, Zod (validación de inputs de
Server Actions)

**Storage**: Neon (Postgres serverless)

**Testing**: Vitest (unidades: validaciones, helpers de permisos, cálculo
de prefijo/correlativo) + Playwright (end-to-end, sobre los escenarios de
[quickstart.md](quickstart.md))

**Target Platform**: Web (navegador de escritorio como caso principal per
el vision doc; debe seguir siendo usable en un viewport móvil aunque no sea
el foco de la Fase 1), desplegado en Render (Web Service de Node.js)

**Project Type**: Aplicación web monolítica (Next.js unifica frontend y
backend vía Server Actions — no hay frontend/backend como proyectos
separados)

**Performance Goals**: Interacciones de arrastre (columnas y Work Items)
percibidas como instantáneas (UI optimista, sin esperar confirmación del
servidor antes de repintar — Principio I); resto de acciones (crear
proyecto, columna, Work Item) completadas en <1s percibido, alineado con
los Success Criteria de las 4 specs.

**Constraints**: Sin sincronización en tiempo real entre miembros en esta
fase (los cambios se ven "la próxima vez que se abre el tablero", ya
definido así en las specs); sin editor de texto enriquecido (descripciones
en texto plano); sin límite artificial de miembros por proyecto (Principio
II) — el único límite es de *velocidad* de envío de invitaciones (FR-017 de
001).

**Scale/Scope**: MVP de 4 features/22 historias de usuario en total;
soporta ≥100 miembros por proyecto, ≥20 columnas por tablero, ≥100 Work
Items por columna sin degradar la fluidez (Success Criteria de 001/003/004).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | `dnd-kit` + estado optimista con reversión ante fallo (FR-011 de 003); Server Components para carga rápida del tablero. |
| II. Colaboración sin Límites | PASS | Ningún límite de miembros en el esquema ni en las queries; solo rate limit de *velocidad* de invitaciones (no de cantidad total), ya especificado en la spec. |
| III. Jerarquía de Datos Consistente | PASS | `data-model.md` modela Cuenta→Proyecto→Stage/Columna→Work Item; `stages` es una única tabla (stage = columna, nunca separados). |
| IV. Aislamiento y Seguridad de Datos | PASS | Toda Server Action valida membresía antes de leer/escribir (ver contracts/); `onDelete: cascade` en todas las FKs hacia `projects`; `publicId` nanoid en vez de PK interna para proyectos/invitaciones/stages (Work Items documentan una excepción justificada en research.md). |
| V. Código Abierto y Sin Bloqueo de Ecosistema | PASS (con nota) | MIT, sin dependencia de un VCS/CI-CD específico. Nota: Neon es un servicio gestionado propietario; se mitiga usando Postgres estándar vía Drizzle (portable a cualquier Postgres) — ver "Nota de alineación" en research.md. La autenticación usa Better Auth self-hosted (no el wrapper gestionado de Neon), lo que además evita depender de un servicio de terceros en beta. No es una violación del principio (que habla de VCS/CI-CD), se documenta por transparencia. |
| VI. Simplicidad y Alcance Enfocado (YAGNI) | PASS | Sin sync en tiempo real, sin editor enriquecido, sin roles más allá de owner/member, sin gestión de catálogo de tags separada — todo explícitamente diferido en las Assumptions de las specs. |
| Estándares de Producto y Datos § Auditoría | PASS (corregido en `/speckit-analyze`) | Tabla `work_item_activity` en data-model.md, escrita desde `moveWorkItem`/`updateWorkItem` (contracts/work-items.md) y mostrada en `WorkItemDetailPanel` (tasks.md T018, T054, T091, T095-T096). Esta fila del Constitution Check faltaba en la versión original del plan — el gap fue detectado por `/speckit-analyze` (hallazgo D1) y corregido en los mismos artefactos, no requirió un cambio de spec. |

Sin violaciones que requieran la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-accounts-invitations/
├── plan.md              # Este archivo — plan técnico de toda la Fase 1
├── research.md           # Phase 0 — decisiones compartidas por 001-004
├── data-model.md         # Phase 1 — entidades de toda la Fase 1
├── quickstart.md         # Phase 1 — validación end-to-end de las 4 specs
├── contracts/
│   ├── accounts-invitations.md
│   ├── projects.md
│   ├── board.md
│   └── work-items.md
└── tasks.md              # Phase 2 (/speckit-tasks) — no creado por este comando

specs/002-project-spaces/plan.md   # stub → referencia a este plan.md
specs/003-kanban-board/plan.md     # stub → referencia a este plan.md
specs/004-work-items/plan.md       # stub → referencia a este plan.md
```

### Source Code (repository root)

```text
app/                          # Next.js App Router
├── (auth)/                    # páginas de login/registro (formularios propios sobre el client de Better Auth)
├── api/
│   └── auth/[...all]/route.ts  # handler de Better Auth (self-hosted)
├── (workspace)/
│   ├── layout.tsx              # shell con ProjectSidebar (Personal/Compartido + buscador)
│   └── projects/
│       └── [projectPublicId]/
│           ├── page.tsx         # tablero (stages + work items)
│           └── settings/page.tsx # nombre/descripción del proyecto, miembros

db/
├── schema.ts                  # tablas Drizzle: projects, project_members, invitations,
│                               #   notifications, stages, work_items, tags, work_item_tags,
│                               #   work_item_activity (las tablas de Better Auth —
│                               #   user/session/account/verification — las genera su propio CLI)
├── client.ts                  # instancia de Neon + Drizzle
└── migrations/

lib/
├── actions/
│   ├── accounts-invitations.ts # sendInvitation, respondToInvitation, cancelInvitation, ...
│   ├── projects.ts             # createProject, listMyProjects, renameProject, ...
│   ├── board.ts                # createStage, reorderStages, deleteStage, ...
│   └── work-items.ts           # createWorkItem, moveWorkItem, updateWorkItem, ...
├── auth.ts                    # instancia de `betterAuth()` (Drizzle adapter, plugins email/password + Google, callbacks de email vía Resend) y helpers de sesión
└── permissions.ts              # requireProjectMember(), requireProjectOwner()

components/
├── ui/                        # primitivas shadcn/ui
├── sidebar/                   # ProjectSidebar, buscador, secciones colapsables
├── board/                     # Board, StageColumn, WorkItemCard (dnd-kit)
└── work-items/                # WorkItemDetailPanel, TagPicker

tests/
├── unit/                      # Vitest: permissions.ts, cálculo de prefijo/correlativo
└── e2e/                       # Playwright: un spec por bloque de quickstart.md
```

**Structure Decision**: Next.js monolítico en la raíz del repo (sin
monorepo/paquetes separados — Principio VI, no se justifica esa
complejidad para una sola app). `lib/actions/` agrupa las Server Actions
por dominio siguiendo 1:1 los archivos de `contracts/`, lo que facilita
mapear cada contrato a su implementación en la fase de tareas.

## Acciones Manuales Requeridas

*(Fuera del alcance de Claude Code — requieren credenciales, pagos o
decisiones del usuario en paneles externos)*

1. **Crear cuenta y proyecto en Neon** ([neon.tech](https://neon.tech)):
   crear una base de datos Postgres y copiar el `DATABASE_URL` (connection
   string) a las variables de entorno del proyecto.
2. **Crear cuenta en Resend** ([resend.com](https://resend.com)) y generar
   una API key — la usan los callbacks `sendVerificationEmail` y
   `sendResetPassword` de Better Auth (FR-015/FR-016 de [001](spec.md)).
   El free tier alcanza para esta etapa del proyecto.
3. **Crear credenciales OAuth de Google** en Google Cloud Console (tipo
   "Web application"), configurar los URIs de redirect autorizados (Better
   Auth espera `<tu-dominio>/api/auth/callback/google`) y guardar el
   Client ID/Secret en las variables de entorno de la app (Better Auth los
   lee directamente, no hay un panel externo donde cargarlos).
4. **Crear cuenta en Render**, conectar el repositorio del proyecto como
   Web Service (Node.js), y configurar ahí las mismas variables de entorno
   (`DATABASE_URL`, `RESEND_API_KEY`, credenciales de Google, secreto de
   sesión de Better Auth).
5. **(Opcional) Dominio propio**: si se configura, actualizar los URIs de
   redirect de Google OAuth con el dominio final.
6. **Crear el repositorio remoto** (GitHub/GitLab/etc.) — el archivo
   `LICENSE` (MIT, Principio V) ya lo crea la tarea T008 de `tasks.md`, así
   que solo falta crear el repositorio remoto y subirlo.
7. ~~Revisar el umbral de rate limit de invitaciones~~ — **Resuelto** (T120):
   se confirmó 20/hora, sin cambios sobre el valor ilustrativo de FR-017 de
   001.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
