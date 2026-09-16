---

description: "Task list for Fase 1 implementation (001-004)"
---

# Tasks: Fase 1 — Cuentas, Proyectos, Tablero y Work Items

**Input**: Design documents from `specs/001-accounts-invitations/` (plan.md,
research.md, data-model.md, contracts/, quickstart.md), combinados con las
4 specs de la Fase 1:
[001-accounts-invitations](spec.md),
[002-project-spaces](../002-project-spaces/spec.md),
[003-kanban-board](../003-kanban-board/spec.md),
[004-work-items](../004-work-items/spec.md).

**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅,
quickstart.md ✅ (todos generados por `/speckit-plan`).

**Tests**: Se incluye una tarea de test e2e (Playwright) por historia de
usuario. No es un pedido de TDD estricto — es una consecuencia directa de
que `plan.md` ya decidió Playwright como framework de e2e y que
`quickstart.md` está redactado 1:1 como escenarios ejecutables por historia;
omitirlos dejaría esa decisión del plan sin implementar.

**Organization**: Tareas agrupadas por historia de usuario, en el orden de
dependencia real entre las 4 specs (Cuentas → Proyectos → Tablero → Work
Items) y, dentro de cada spec, por prioridad (P1 → P2 → P3). Cada historia
usa la etiqueta `[F<n>-US<m>]`, donde `F1`=001-accounts-invitations,
`F2`=002-project-spaces, `F3`=003-kanban-board, `F4`=004-work-items, y
`US<m>` es el número de historia tal como aparece en el `spec.md` de esa
feature (ej. `[F2-US5]` = Historia 5 de 002-project-spaces, "Buscar un
proyecto").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin
  dependencias de tareas incompletas)
- **[Story]**: `[F<n>-US<m>]` — a qué historia de qué spec pertenece
- Cada descripción incluye la ruta exacta de archivo

## Path Conventions

Aplicación web monolítica (Next.js App Router) según `plan.md`:
`app/`, `db/`, `lib/`, `components/`, `tests/` en la raíz del repositorio.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialización del proyecto Next.js y herramientas base.

- [X] T001 Crear proyecto Next.js 14+ (App Router) con TypeScript en la raíz del repo (`package.json`, `tsconfig.json`, `next.config.js`)
- [X] T002 [P] Instalar y configurar Tailwind CSS + shadcn/ui (`components.json`, `app/globals.css`, `tailwind.config.ts`)
- [X] T003 [P] Instalar y configurar Drizzle ORM + `@neondatabase/serverless` (`drizzle.config.ts`)
- [X] T004 [P] Instalar `dnd-kit`, `zod`, `better-auth` + su adapter de Drizzle, y el SDK de `resend` como dependencias en `package.json`
- [X] T005 [P] Configurar ESLint + Prettier (`eslint.config.js`, `.prettierrc`)
- [X] T006 [P] Configurar Vitest (`vitest.config.ts`) y Playwright (`playwright.config.ts`)
- [X] T007 Crear `.env.example` documentando `DATABASE_URL`, `RESEND_API_KEY`, las credenciales OAuth de Google (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) y el secreto de sesión de Better Auth (`BETTER_AUTH_SECRET`) (ver "Acciones Manuales Requeridas" en `plan.md`)
- [X] T008 [P] Agregar archivo `LICENSE` (MIT) en la raíz del repositorio, per Principio V de la constitución
- [X] T009 [P] Escribir `README.md` con visión general del proyecto, stack técnico y pasos de setup local referenciando `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema de base de datos completo, autenticación, permisos y
shell base. **⚠️ CRITICAL**: ninguna historia de usuario puede empezar
hasta completar esta fase, porque el modelo de datos de las 4 specs está
interrelacionado (Principio III de la constitución).

- [X] T010 Definir tabla `projects` en `db/schema.ts`: `id` serial PK, `publicId` text unique not null, `name` text not null, `description` text nullable, `workItemPrefix` text not null, `nextWorkItemNumber` integer not null default 0, `ownerId` uuid not null, `createdAt`/`updatedAt` timestamptz (ver data-model.md § Proyecto)
- [X] T011 [P] Definir tabla `project_members` en `db/schema.ts`: `projectId` FK → `projects` con `onDelete: cascade`, `userId` uuid not null, `role` enum('owner','member') not null, `joinedAt` timestamptz, PK compuesta `(projectId, userId)` (data-model.md § Membresía)
- [X] T012 [P] Definir tabla `invitations` en `db/schema.ts`: `id` serial PK, `publicId` unique, `projectId` FK cascade, `invitedEmail` text not null, `invitedByUserId` uuid not null, `status` enum('pending','accepted','rejected','cancelled') not null, `createdAt`/`respondedAt`, índice único parcial en `(projectId, invitedEmail)` donde `status='pending'` (FR-012 de 001)
- [X] T013 [P] Definir tabla `notifications` en `db/schema.ts`: `id` serial PK, `userId` uuid not null, `type` enum('invitation') not null, `payload` jsonb not null, `readAt` timestamptz nullable, `createdAt` timestamptz (data-model.md § Notificación)
- [X] T014 [P] Definir tabla `stages` en `db/schema.ts`: `id` serial PK, `publicId` unique, `projectId` FK cascade, `name` text not null, `position` integer not null, `createdAt` (data-model.md § Stage/Columna)
- [X] T015 [P] Definir tabla `work_items` en `db/schema.ts`: `id` serial PK, `projectId` FK cascade, `displayNumber` integer not null, `stageId` FK cascade, `title` text not null, `description` text nullable, `stakeholder` text nullable, `position` integer not null, `createdAt`/`updatedAt` (data-model.md § Work Item)
- [X] T016 [P] Definir tabla `tags` en `db/schema.ts`: `id` serial PK, `projectId` FK cascade, `name` text not null, índice único en `(projectId, lower(name))` (FR-008/FR-012 de 004)
- [X] T017 [P] Definir tabla de unión `work_item_tags` en `db/schema.ts`: `workItemId` FK cascade, `tagId` FK cascade, PK compuesta
- [X] T018 [P] Definir tabla `work_item_activity` en `db/schema.ts`: `id` serial PK, `workItemId` FK → `work_items` con `onDelete: cascade`, `type` text not null (ej. `stage_changed`, `fields_edited`), `payload` jsonb not null, `createdAt` timestamptz not null (Estándares de Producto y Datos § Auditoría de la constitución — log de actividad de Work Items)
- [X] T019 Generar y aplicar la migración inicial de Drizzle con las 9 tablas anteriores en `db/migrations/` (`npm run db:generate && npm run db:migrate`)
- [X] T020 Crear la instancia de cliente Neon + Drizzle en `db/client.ts` usando `DATABASE_URL`
- [X] T021 Configurar la instancia de `betterAuth()` en `lib/auth.ts` (Drizzle adapter apuntando a `db/client.ts`, plugin `emailAndPassword` y proveedor `google` leyendo credenciales de variables de entorno), exponiendo `getSession()` y `requireSession()` para Server Components y Server Actions
- [X] T022 Correr el CLI de Better Auth (`npx @better-auth/cli generate`) para generar la migración de sus tablas (`user`, `session`, `account`, `verification`) y aplicarla junto con la migración de `db/schema.ts`
- [X] T023 Crear el route handler `app/api/auth/[...all]/route.ts` que monta el manejador HTTP de Better Auth
- [X] T024 Implementar los callbacks `sendVerificationEmail` y `sendResetPassword` de Better Auth en `lib/auth.ts`, enviando los emails vía Resend (`RESEND_API_KEY`)
- [X] T025 Implementar `lib/permissions.ts` con `requireProjectMember(projectPublicId)` y `requireProjectOwner(projectPublicId)`, que consultan `project_members` y lanzan un error tipado `FORBIDDEN` (Principio IV de la constitución)
- [X] T026 [P] Implementar generador de `publicId` (nanoid) en `lib/ids.ts`, usado por `projects`, `invitations` y `stages`
- [X] T027 [P] Implementar generador de `workItemPrefix` en `lib/ids.ts` (3-4 letras mayúsculas derivadas del nombre del proyecto, con sufijo numérico ante colisión — ver research.md § Identificadores públicos)
- [X] T028 Crear el shell base `app/(workspace)/layout.tsx` (protegido con `requireSession()`)
- [X] T029 Crear el shell de la página de configuración `app/(workspace)/projects/[projectPublicId]/settings/page.tsx` (solo estructura y validación de membresía, sin controles todavía — las historias de las fases siguientes agregan sus propios controles ahí)
- [X] T030 [P] Crear `app/layout.tsx` raíz con los estilos globales de Tailwind y configuración de tema
- [X] T031 [P] Configurar el setup global de Playwright que siembra/limpia la base de datos de test entre corridas en `tests/e2e/setup.ts`

---

## Phase 3: [F1-US1] Crear cuenta e iniciar sesión (P1) 🎯 MVP

**Goal**: Una persona puede registrarse (Google OAuth o email/contraseña) e
iniciar sesión.

**Independent Test**: Registrar una cuenta por cada método y verificar que
queda autenticada con acceso a un espacio "Personal" vacío.

- [X] T032 [P] [F1-US1] Crear `app/(auth)/sign-up/page.tsx` y `app/(auth)/sign-in/page.tsx` con formularios propios sobre el cliente de Better Auth (`authClient.signUp.email`, `authClient.signIn.email`, `authClient.signIn.social({ provider: 'google' })`)
- [X] T033 [F1-US1] Implementar el hook post-registro/post-verificación que llama a `applyPendingInvitationsForUser(userId, email)` (FR-007/FR-015) en `lib/actions/accounts-invitations.ts`
- [X] T034 [P] [F1-US1] Exigir contraseña de mínimo 8 caracteres (FR-002) en la validación Zod del formulario de registro
- [X] T035 [P] [F1-US1] Test e2e: registrar por email/contraseña y por Google, luego iniciar sesión con credenciales existentes; además casos negativos: contraseña de menos de 8 caracteres rechazada (FR-002) y formato de email inválido rechazado, en `tests/e2e/accounts.spec.ts` (quickstart.md bloque 1, pasos 1-3)

**Checkpoint**: cualquier persona puede crear una cuenta y autenticarse.

---

## Phase 4: [F2-US1] Crear un proyecto nuevo (P1) 🎯 MVP

**Goal**: Un usuario autenticado crea un proyecto con nombre.

**Independent Test**: Crear un proyecto desde una cuenta recién autenticada
y verificar que aparece en "Personal".

**Depends on**: Phase 3 (requiere una cuenta autenticada).

- [X] T036 [F2-US1] Implementar Server Action `createProject` en `lib/actions/projects.ts` (FR-001/FR-002/FR-003: rechaza nombre vacío, genera `publicId` y `workItemPrefix`, inserta al creador en `project_members` con `role='owner'`)
- [X] T037 [P] [F2-US1] Crear `components/sidebar/CreateProjectDialog.tsx` con campos nombre (requerido) y descripción
- [X] T038 [P] [F2-US1] Test e2e: crear proyecto sin nombre (rechazado) y con nombre (aparece en Personal), en `tests/e2e/projects.spec.ts` (quickstart.md bloque 2, pasos 1-2)

**Checkpoint**: un usuario puede crear su primer proyecto.

---

## Phase 5: [F2-US2] Ver mis proyectos organizados en la barra lateral (P1) 🎯 MVP

**Goal**: Ver los proyectos propios agrupados en Personal/Compartido y
navegar a ellos.

**Independent Test**: Con proyectos propios y compartidos, verificar que
cada uno aparece en la sección correcta.

**Depends on**: Phase 4 (necesita proyectos para listar).

- [X] T039 [F2-US2] Implementar Server Action `listMyProjects` en `lib/actions/projects.ts`, devolviendo `{ personal, shared }` agrupado por cantidad de miembros (FR-004)
- [X] T040 [P] [F2-US2] Crear `components/sidebar/ProjectSidebar.tsx` con dos secciones colapsables (Personal/Compartido)
- [X] T041 [P] [F2-US2] Crear `components/sidebar/EmptyProjectsState.tsx` para cuando el usuario no tiene proyectos (FR-010)
- [X] T042 [F2-US2] Integrar `ProjectSidebar` en `app/(workspace)/layout.tsx`
- [X] T043 [P] [F2-US2] Test e2e: agrupación correcta, colapsar/expandir secciones, navegar a un proyecto, en `tests/e2e/projects.spec.ts` (quickstart.md bloque 2)

**Checkpoint**: navegación completa entre los proyectos propios.

---

## Phase 6: [F3-US1] Ver el tablero de un proyecto (P1) 🎯 MVP

**Goal**: Al abrir un proyecto, ver su tablero con las columnas existentes.

**Independent Test**: Abrir un proyecto con columnas ya creadas y verificar
que se muestran en orden.

**Depends on**: Phase 4 (necesita un proyecto existente).

- [X] T044 [F3-US1] Implementar Server Action `getBoard` en `lib/actions/board.ts`, devolviendo los stages ordenados por `position` con conteo de Work Items (FR-001), validando `requireProjectMember`
- [X] T045 [P] [F3-US1] Crear `app/(workspace)/projects/[projectPublicId]/page.tsx` que renderiza el tablero vía `getBoard`
- [X] T046 [P] [F3-US1] Crear `components/board/Board.tsx` y `components/board/StageColumn.tsx` (renderizado de solo lectura)

**Checkpoint**: el tablero de un proyecto es visible.

---

## Phase 7: [F3-US2] Crear una columna (P1) 🎯 MVP

**Goal**: Agregar una columna nueva al tablero, con su stage asociado.

**Independent Test**: Crear una columna en un tablero vacío y verificar que
aparece de inmediato.

**Depends on**: Phase 6.

- [X] T047 [F3-US2] Implementar Server Action `createStage` en `lib/actions/board.ts` (FR-002/FR-003/FR-004: rechaza nombre vacío, `position` = máximo actual + 1, una sola inserción stage=columna)
- [X] T048 [P] [F3-US2] Crear `components/board/AddStageButton.tsx` con input de nombre en línea
- [X] T049 [P] [F3-US2] Test e2e: un proyecto recién creado no tiene columnas (FR-010); crear columna con y sin nombre en ese tablero vacío, en `tests/e2e/board.spec.ts` (quickstart.md bloque 3, pasos 1-2)

**Checkpoint**: un tablero puede tener columnas propias.

---

## Phase 8: [F4-US1] Crear un Work Item en una columna (P1) 🎯 MVP

**Goal**: Agregar un Work Item a una columna, con identificador visible.

**Independent Test**: Crear un Work Item en una columna vacía y verificar
que aparece con un id visible y el título ingresado.

**Depends on**: Phase 7 (necesita al menos una columna).

- [X] T050 [F4-US1] Implementar Server Action `createWorkItem` en `lib/actions/work-items.ts` (FR-001/FR-002/FR-003/FR-004: rechaza título vacío, incremento atómico de `projects.nextWorkItemNumber`, calcula `displayId` = `${workItemPrefix}-${displayNumber}`)
- [X] T051 [P] [F4-US1] Crear `components/board/WorkItemCard.tsx` mostrando `displayId` + título
- [X] T052 [P] [F4-US1] Crear `components/board/AddWorkItemButton.tsx` por columna, con input rápido de solo título
- [X] T053 [P] [F4-US1] Test e2e: crear Work Item sin título (rechazado) y con título, verificar formato del id visible, en `tests/e2e/work-items.spec.ts` (quickstart.md bloque 4, pasos 1-2)

**Checkpoint**: se pueden crear Work Items en el tablero.

---

## Phase 9: [F4-US2] Mover un Work Item entre columnas (P1) 🎯 MVP — fin del MVP

**Goal**: Arrastrar un Work Item de una columna a otra.

**Independent Test**: Arrastrar un Work Item existente a otra columna y
verificar que su stage cambia de inmediato.

**Depends on**: Phase 8.

- [X] T054 [F4-US2] Implementar Server Action `moveWorkItem` en `lib/actions/work-items.ts` (FR-005: actualiza `stageId`/`position`, reordena origen y destino; registra una fila en `work_item_activity` con `type='stage_changed'`, per Estándares de Producto y Datos § Auditoría de la constitución)
- [X] T055 [F4-US2] Integrar `DndContext` de dnd-kit en `components/board/Board.tsx` habilitando arrastre entre columnas de `WorkItemCard`
- [X] T056 [F4-US2] Implementar movimiento optimista en cliente con reversión ante fallo en `components/board/Board.tsx` (Principio I, mismo patrón que FR-011 de 003)
- [X] T057 [P] [F4-US2] Test e2e: arrastrar un Work Item a otra columna, verificar persistencia tras recargar, en `tests/e2e/work-items.spec.ts` (quickstart.md bloque 4, paso 3)

**Checkpoint** 🎯: **MVP completo** — una persona puede registrarse, crear un
proyecto, armar su tablero con columnas y gestionar Work Items moviéndolos
entre columnas, en solitario (sin colaboración todavía).

---

## Phase 10: [F1-US2] Invitar a un colaborador a un proyecto (P2)

**Goal**: Sumar colaboradores por email, sin límite.

**Independent Test**: Invitar repetidamente a distintos emails y verificar
que no hay tope.

**Depends on**: Phase 4 (necesita un proyecto) y Phase 3.

- [ ] T058 [F1-US2] Implementar Server Action `sendInvitation` en `lib/actions/accounts-invitations.ts` (validación de formato de email, `ALREADY_MEMBER`/`ALREADY_INVITED`, `requireProjectOwner` — FR-005/FR-006/FR-009/FR-012/FR-013)
- [ ] T059 [F1-US2] Implementar el rate limit de invitaciones (máx. 20/hora por `invitedByUserId`, FR-017) como conteo por query dentro de `sendInvitation`
- [ ] T060 [P] [F1-US2] Crear `components/board/InviteMemberDialog.tsx` (input de email) accesible desde la configuración del proyecto
- [ ] T061 [P] [F1-US2] Test e2e: invitar repetidamente sin tope, rechazo al reinvitar a un miembro existente, y rechazo al superar el rate limit de velocidad (FR-017), en `tests/e2e/invitations.spec.ts` (quickstart.md bloque 1, paso 4)

---

## Phase 11: [F1-US3] Aceptar una invitación (P2)

**Goal**: El invitado ve la notificación y se une al proyecto.

**Independent Test**: Generar una invitación pendiente, aceptarla y
verificar que el proyecto pasa a "Compartido" para todos.

**Depends on**: Phase 10.

- [ ] T062 [F1-US3] Implementar Server Action `listMyNotifications` en `lib/actions/accounts-invitations.ts` (FR-006)
- [ ] T063 [F1-US3] Implementar la rama `accept` de `respondToInvitation` en `lib/actions/accounts-invitations.ts` (FR-008: crea `project_members`, marca la notificación leída)
- [ ] T064 [P] [F1-US3] Crear `components/sidebar/NotificationsPanel.tsx` listando invitaciones pendientes con acción de Aceptar
- [ ] T065 [F1-US3] Integrar `NotificationsPanel` en `app/(workspace)/layout.tsx` (ej. accesible desde un ícono de campana en el header), análogo a como T042 integra `ProjectSidebar`
- [ ] T066 [P] [F1-US3] Test e2e: ver notificación, aceptar, verificar reclasificación a Compartido para ambas cuentas, en `tests/e2e/invitations.spec.ts` (quickstart.md bloque 1, pasos 5-6)

**Checkpoint**: colaboración multi-usuario funcional de punta a punta.

---

## Phase 12: [F1-US5] Recuperar contraseña olvidada (P2)

**Goal**: Un usuario con email/contraseña puede recuperar el acceso a su
cuenta.

**Independent Test**: Solicitar recuperación para una cuenta existente y
verificar que, tras completar el flujo, se puede iniciar sesión con la
nueva contraseña.

**Depends on**: Phase 3.

- [ ] T067 [F1-US5] Verificar que el flujo de recuperación de contraseña de Better Auth (callback `sendResetPassword` de T024, configurado en T021) cumple FR-016 (respuesta sin revelar si el email existe); ajustar el mensaje de la UI en `app/(auth)/forgot-password/page.tsx` si hace falta
- [ ] T068 [P] [F1-US5] Crear `app/(auth)/forgot-password/page.tsx` y `app/(auth)/reset-password/page.tsx`
- [ ] T069 [P] [F1-US5] Test e2e: solicitar reset, seguir el enlace, definir nueva contraseña (≥8 caracteres), iniciar sesión con ella; además caso negativo: enlace ya usado o vencido es rechazado, en `tests/e2e/accounts.spec.ts` (Historia 5 de 001)

---

## Phase 13: [F2-US3] Renombrar un proyecto (P2)

**Goal**: El owner cambia el nombre de un proyecto.

**Independent Test**: Renombrar un proyecto y verificar que el cambio se ve
para todos los miembros.

**Depends on**: Phase 4.

- [ ] T070 [F2-US3] Implementar Server Action `renameProject` en `lib/actions/projects.ts` (FR-005, `requireProjectOwner`)
- [ ] T071 [P] [F2-US3] Agregar control de renombrado a `app/(workspace)/projects/[projectPublicId]/settings/page.tsx`
- [ ] T072 [F2-US3] Implementar Server Action `updateProjectDescription` en `lib/actions/projects.ts` (FR-009, `requireProjectOwner`)
- [ ] T073 [P] [F2-US3] Agregar control de edición de descripción a `app/(workspace)/projects/[projectPublicId]/settings/page.tsx`
- [ ] T074 [P] [F2-US3] Test e2e: el owner renombra y el resto de los miembros ve el nuevo nombre; un no-owner intenta renombrar y es rechazado, en `tests/e2e/projects.spec.ts` (quickstart.md bloque 2, paso 4; ver Historia 3 de 002, Acceptance Scenario 2 agregado en /speckit-analyze)

---

## Phase 14: [F2-US4] Eliminar un proyecto (P2)

**Goal**: El owner elimina un proyecto por completo.

**Independent Test**: Eliminar un proyecto de prueba (con y sin otros
miembros) y verificar que desaparece para todos.

**Depends on**: Phase 4.

- [ ] T075 [F2-US4] Implementar Server Action `deleteProject` en `lib/actions/projects.ts` (FR-006/FR-007, `requireProjectOwner`, confía en los `onDelete: cascade` del esquema)
- [ ] T076 [P] [F2-US4] Crear `components/sidebar/DeleteProjectDialog.tsx` con confirmación explícita, integrado en la página de configuración
- [ ] T077 [P] [F2-US4] Test e2e: un no-owner no puede eliminar; el owner elimina con confirmación y desaparece para todos, en `tests/e2e/projects.spec.ts` (quickstart.md bloque 2, pasos 5 y 7)

---

## Phase 15: [F2-US5] Buscar un proyecto en la barra lateral (P2)

**Goal**: Filtrar proyectos por nombre en la barra lateral.

**Independent Test**: Con 50 proyectos, escribir parte de un nombre y
verificar que aparece filtrado.

**Depends on**: Phase 5.

- [ ] T078 [F2-US5] Extender `listMyProjects` para aceptar y aplicar un filtro `search` por nombre (FR-011)
- [ ] T079 [P] [F2-US5] Agregar input de búsqueda a `components/sidebar/ProjectSidebar.tsx` con filtrado en vivo y estado vacío de "sin resultados"
- [ ] T080 [P] [F2-US5] Test e2e: la búsqueda filtra, al borrar el texto se restaura la lista completa, en `tests/e2e/projects.spec.ts` (quickstart.md bloque 2, paso 3)

---

## Phase 16: [F2-US7] Remover a un miembro del proyecto (P2)

**Goal**: El owner remueve a un colaborador.

**Independent Test**: Remover a un miembro desde la vista del owner y
verificar pérdida de acceso inmediata.

**Depends on**: Phase 11 (necesita al menos un miembro invitado/aceptado).

- [ ] T081 [F2-US7] Implementar Server Action `removeMember` en `lib/actions/projects.ts` (FR-012/FR-014: `requireProjectOwner`, guarda `CANNOT_REMOVE_OWNER`)
- [ ] T082 [P] [F2-US7] Agregar lista de miembros + acción "Remover" a la página de configuración, visible solo para el owner
- [ ] T083 [P] [F2-US7] Test e2e: el owner remueve a un miembro (pierde acceso de inmediato y, si queda un único miembro, el proyecto se reclasifica a "Personal"); un no-owner no puede remover, en `tests/e2e/projects.spec.ts` (Historia 7 de 002, FR-015 de 002)

---

## Phase 17: [F3-US3] Reordenar columnas (P2)

**Goal**: Arrastrar columnas a una nueva posición horizontal.

**Independent Test**: Arrastrar una columna a otra posición y verificar que
el nuevo orden persiste al recargar.

**Depends on**: Phase 7.

- [ ] T084 [F3-US3] Implementar Server Action `reorderStages` en `lib/actions/board.ts` (FR-005/FR-011: reescritura transaccional de `position`)
- [ ] T085 [F3-US3] Agregar comportamiento sortable horizontal de dnd-kit a `components/board/Board.tsx` para reordenar `StageColumn`
- [ ] T086 [F3-US3] Implementar reordenamiento optimista con reversión + aviso de error ante fallo de guardado (FR-011, Clarifications de 003)
- [ ] T087 [P] [F3-US3] Test e2e: reordenar columnas y verificar persistencia para otros miembros; simular fallo de guardado y verificar reversión, en `tests/e2e/board.spec.ts` (quickstart.md bloque 3, paso 3)

---

## Phase 18: [F3-US4] Eliminar una columna (P2)

**Goal**: Eliminar una columna vacía; bloquear si tiene contenido.

**Independent Test**: Eliminar una columna vacía (éxito) y una con
contenido (bloqueada).

**Depends on**: Phase 7, Phase 8 (para probar el caso con contenido).

- [ ] T088 [F3-US4] Implementar Server Action `deleteStage` en `lib/actions/board.ts` (FR-006/FR-007: guarda `STAGE_NOT_EMPTY` si existen `work_items` asociados)
- [ ] T089 [P] [F3-US4] Agregar control de eliminación a `components/board/StageColumn.tsx` con mensaje de bloqueo cuando no está vacía
- [ ] T090 [P] [F3-US4] Test e2e: eliminar columna vacía (éxito) y con Work Items (bloqueada, con mensaje), en `tests/e2e/board.spec.ts` (quickstart.md bloque 3, pasos 4-5)

---

## Phase 19: [F4-US3] Editar los detalles de un Work Item (P2)

**Goal**: Editar título, descripción, tags y stakeholder de un Work Item.

**Independent Test**: Editar cada campo de un Work Item existente y
verificar que persiste al reabrirlo.

**Depends on**: Phase 8.

- [ ] T091 [F4-US3] Implementar Server Action `updateWorkItem` en `lib/actions/work-items.ts` (FR-007/FR-008/FR-009/FR-012/FR-013: descripción como texto plano, stakeholder de texto libre, resolución/creación de tags del catálogo; registra una fila en `work_item_activity` con `type='fields_edited'` y el detalle de qué campos cambiaron, per Estándares de Producto y Datos § Auditoría de la constitución)
- [ ] T092 [F4-US3] Implementar Server Action `listProjectTags` en `lib/actions/work-items.ts`
- [ ] T093 [P] [F4-US3] Crear `components/work-items/WorkItemDetailPanel.tsx` (campos título, descripción, stakeholder)
- [ ] T094 [P] [F4-US3] Crear `components/work-items/TagPicker.tsx` que soporta elegir tags existentes y crear uno nuevo en línea (FR-012)
- [ ] T095 [F4-US3] Implementar Server Action `listWorkItemActivity` en `lib/actions/work-items.ts` (Estándares de Producto y Datos § Auditoría de la constitución)
- [ ] T096 [P] [F4-US3] Mostrar el historial de `work_item_activity` (vía `listWorkItemActivity`) en `components/work-items/WorkItemDetailPanel.tsx`, más reciente primero (Estándares de Producto y Datos § Auditoría de la constitución)
- [ ] T097 [P] [F4-US3] Test e2e: editar descripción/stakeholder, agregar tag existente, crear tag nuevo en línea y verificar disponibilidad en todo el proyecto; verificar que cada cambio queda visible en el historial de actividad del Work Item, en `tests/e2e/work-items.spec.ts` (quickstart.md bloque 4, paso 4)

---

## Phase 20: [F4-US4] Eliminar un Work Item (P2)

**Goal**: Eliminar un Work Item que ya no es relevante.

**Independent Test**: Eliminar un Work Item existente y verificar que
desaparece del tablero para todos.

**Depends on**: Phase 8.

- [ ] T098 [F4-US4] Implementar Server Action `deleteWorkItem` en `lib/actions/work-items.ts` (FR-010/FR-011)
- [ ] T099 [P] [F4-US4] Agregar control de eliminación con confirmación a `WorkItemDetailPanel`
- [ ] T100 [P] [F4-US4] Test e2e: eliminar un Work Item, verificar que desaparece para todos los miembros, en `tests/e2e/work-items.spec.ts` (quickstart.md bloque 4, paso 5)

---

## Phase 21: [F1-US4] Rechazar o cancelar una invitación (P3)

**Goal**: El invitado rechaza, o el invitador cancela, una invitación
pendiente.

**Independent Test**: Rechazar y cancelar, por separado, y verificar que
ambas dejan de estar pendientes.

**Depends on**: Phase 10.

- [ ] T101 [F1-US4] Implementar la rama `reject` de `respondToInvitation` en `lib/actions/accounts-invitations.ts` (FR-010)
- [ ] T102 [F1-US4] Implementar Server Action `cancelInvitation` en `lib/actions/accounts-invitations.ts` (FR-011)
- [ ] T103 [P] [F1-US4] Agregar acción "Rechazar" a `NotificationsPanel` y "Cancelar" a la lista de invitaciones pendientes en configuración del proyecto
- [ ] T104 [P] [F1-US4] Test e2e: el invitado rechaza, el invitador cancela, ambos casos dejan de estar pendientes, en `tests/e2e/invitations.spec.ts` (Historia 4 de 001)

---

## Phase 22: [F2-US6] Salir de un proyecto compartido (P3)

**Goal**: Un miembro (no owner) se retira voluntariamente.

**Independent Test**: Un miembro sale del proyecto y verifica que pierde el
acceso; si queda un único miembro, el proyecto vuelve a "Personal".

**Depends on**: Phase 11.

- [ ] T105 [F2-US6] Implementar Server Action `leaveProject` en `lib/actions/projects.ts` (FR-013/FR-014: guarda `OWNER_CANNOT_LEAVE`)
- [ ] T106 [P] [F2-US6] Agregar control "Salir del proyecto" a la página de configuración para miembros no-owner
- [ ] T107 [P] [F2-US6] Test e2e: un miembro sale (pierde acceso, reclasificación a Personal si queda uno solo); el owner no puede salir, en `tests/e2e/projects.spec.ts` (Historia 6 de 002)

---

## Phase 23: [F3-US5] Renombrar una columna (P3)

**Goal**: Cambiar el nombre de una columna existente.

**Independent Test**: Renombrar una columna y verificar que el cambio se ve
para todos los miembros.

**Depends on**: Phase 7.

- [ ] T108 [F3-US5] Implementar Server Action `renameStage` en `lib/actions/board.ts` (FR-008)
- [ ] T109 [P] [F3-US5] Agregar edición en línea (doble clic o ícono de editar) a `components/board/StageColumn.tsx`
- [ ] T110 [P] [F3-US5] Test e2e: renombrar una columna, verificar el cambio para todos los miembros, en `tests/e2e/board.spec.ts` (Historia 5 de 003)

---

## Phase 24: [F4-US5] Reordenar Work Items dentro de una columna (P3)

**Goal**: Cambiar el orden vertical de los Work Items dentro de una
columna.

**Independent Test**: Arrastrar un Work Item a otra posición dentro de la
misma columna y verificar que el orden persiste.

**Depends on**: Phase 8.

- [ ] T111 [F4-US5] Implementar Server Action `reorderWorkItemsInStage` en `lib/actions/work-items.ts` (FR-006)
- [ ] T112 [F4-US5] Extender el contexto sortable de dnd-kit en `components/board/StageColumn.tsx` para reordenamiento vertical dentro de la columna
- [ ] T113 [P] [F4-US5] Test e2e: reordenar Work Items dentro de una columna, verificar persistencia para otros miembros, en `tests/e2e/work-items.spec.ts` (Historia 5 de 004)

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Endurecer lo construido en las 22 historias anteriores antes
de considerar la Fase 1 lista para uso real.

- [ ] T114 [P] Correr manualmente el flujo completo de `quickstart.md` de punta a punta y registrar los resultados
- [ ] T115 [P] Test de escala: sembrar un proyecto con ≥100 miembros, ≥50 proyectos por cuenta, ≥20 columnas y ≥100 Work Items por columna, y verificar ausencia de degradación perceptible (SC-005 de 001, SC-004 de 002/003/004)
- [ ] T116 [P] Agregar skeletons de carga para el tablero y la barra lateral (Principio I — sin bloqueos de carga perceptibles)
- [ ] T117 [P] Agregar error boundary global + sistema de toasts para errores de Server Actions en `app/(workspace)/error.tsx`
- [ ] T118 [P] Pasada de accesibilidad: estados de foco por teclado y `aria-label` en los controles de drag-and-drop
- [ ] T119 [P] Escribir tests unitarios de `lib/permissions.ts` y `lib/ids.ts` (colisión de prefijos, numeración correlativa) en `tests/unit/`
- [ ] T120 Revisar y ajustar el umbral de rate limit de invitaciones (FR-017, hoy 20/hora) según la Acción Manual #8 de `plan.md`
- [ ] T121 [P] Actualizar `README.md` con los pasos de setup finales, validados contra `quickstart.md`

---

## Dependencies & Execution Order

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ── BLOQUEA todas las historias
    ↓
Phase 3  [F1-US1] Crear cuenta               (P1 · MVP)
    ↓
Phase 4  [F2-US1] Crear proyecto              (P1 · MVP)
    ↓
Phase 5  [F2-US2] Ver proyectos en sidebar    (P1 · MVP)
    ↓
Phase 6  [F3-US1] Ver tablero                 (P1 · MVP)
    ↓
Phase 7  [F3-US2] Crear columna               (P1 · MVP)
    ↓
Phase 8  [F4-US1] Crear Work Item             (P1 · MVP)
    ↓
Phase 9  [F4-US2] Mover Work Item             (P1 · MVP) ── fin del MVP
    ↓
Phase 10 [F1-US2] Invitar colaborador         (P2) ─┐
Phase 11 [F1-US3] Aceptar invitación          (P2) ─┤ requieren Phase 4
Phase 12 [F1-US5] Recuperar contraseña        (P2) ─┘ (independiente, solo Phase 3)
Phase 13 [F2-US3] Renombrar proyecto          (P2) ── requiere Phase 4
Phase 14 [F2-US4] Eliminar proyecto           (P2) ── requiere Phase 4
Phase 15 [F2-US5] Buscar proyecto             (P2) ── requiere Phase 5
Phase 16 [F2-US7] Remover miembro             (P2) ── requiere Phase 11
Phase 17 [F3-US3] Reordenar columnas          (P2) ── requiere Phase 7
Phase 18 [F3-US4] Eliminar columna            (P2) ── requiere Phase 7 y 8
Phase 19 [F4-US3] Editar Work Item            (P2) ── requiere Phase 8
Phase 20 [F4-US4] Eliminar Work Item          (P2) ── requiere Phase 8
    ↓
Phase 21 [F1-US4] Rechazar/cancelar invitación (P3) ── requiere Phase 10
Phase 22 [F2-US6] Salir de proyecto            (P3) ── requiere Phase 11
Phase 23 [F3-US5] Renombrar columna            (P3) ── requiere Phase 7
Phase 24 [F4-US5] Reordenar Work Items         (P3) ── requiere Phase 8
    ↓
Final Phase (Polish)
```

Las fases 10-20 (P2) son independientes entre sí una vez cumplida su
dependencia de fase P1 — pueden trabajarse en cualquier orden o en
paralelo por distintas personas. Lo mismo aplica a las fases 21-24 (P3).

## Parallel Execution Examples

**Dentro de Foundational (Phase 2)**, tras T010 (tabla `projects`):
T011-T017 son `[P]` (cada una define una tabla distinta en el mismo archivo
`db/schema.ts` — en la práctica conviene hacerlas en una sola sesión
secuencial aunque estén marcadas `[P]` por no tener dependencias lógicas
entre sí; T026/T027/T030/T031 sí son paralelizables por personas/agentes
distintos al tocar archivos distintos).

**Dentro de una historia de usuario típica** (ej. Phase 8, `[F4-US1]`):
T051 y T052 son `[P]` entre sí (componentes distintos) y ambas pueden
avanzar en paralelo con T053 (test e2e) una vez que T050 (Server Action)
está lista, ya que el test necesita la acción real para pasar.

## Implementation Strategy

**MVP primero**: Fases 1-9 (Setup + Foundational + las 6 historias P1 de
las 4 specs) entregan un tablero Kanban completo de un único usuario —
registrarse, crear un proyecto, armar columnas, crear y mover Work Items.
Es la porción más pequeña que ya es una app usable de punta a punta.

**Incremento 2 — Colaboración**: Fases 10-20 (P2) suman invitaciones,
gestión de miembros, búsqueda, y edición/eliminación de proyectos, columnas
y Work Items. Al completarlas, el producto cumple el diferencial central
del proyecto (colaboración sin límites, Principio II).

**Incremento 3 — Pulido**: Fases 21-24 (P3) más el Final Phase cubren los
casos secundarios (rechazar/cancelar invitación, salir de un proyecto,
renombrar columna, reordenar Work Items) y el endurecimiento general antes
de considerar la Fase 1 completa.

Cada fase de historia de usuario es un incremento entregable y probable de
forma independiente (Independent Test de cada una), tal como lo exige el
formato de las 4 specs.
