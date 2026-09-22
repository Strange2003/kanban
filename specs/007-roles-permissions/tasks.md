---

description: "Task list for 007-roles-permissions implementation"
---

# Tasks: Roles y Permisos

**Input**: Design documents from `specs/007-roles-permissions/`
(plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅,
quickstart.md ✅ (todos generados por `/speckit-plan`).

**Tests**: Se incluyen pruebas unitarias (matriz de permisos, helper,
barrido de todas las mutaciones contra un Lector, reglas de cambio de rol y
transferencia) y pruebas e2e con varias cuentas por historia, mismo criterio
que [005-work-item-relationships/tasks.md](../005-work-item-relationships/tasks.md)
y [006-work-item-detail-view/tasks.md](../006-work-item-detail-view/tasks.md).
El barrido unitario es la prueba de SC-001/SC-002 "por fuera de la
interfaz" (research.md § Cómo probar).

**Organization**: Tareas agrupadas por historia de usuario de
[spec.md](spec.md) (US1 y US2 son P1; US3 es P2; US4 es P3). Cada historia
usa la etiqueta `[F7-US<m>]` (`F7` = 007-roles-permissions), siguiendo la
convención de [AGENTS.md](../../AGENTS.md#working-with-tasksmd).

**Nota sobre dependencia entre historias**: US1 (asignar roles) y US2
(hacer cumplir el modo lectura) son ambas P1 y forman juntas el MVP: sin
US1 no hay forma de crear un Lector por la interfaz, y sin US2 el rol
Lector no restringe nada. Se pueden validar por separado —US2 en el
servidor con el barrido unitario sin necesidad de US1, y US1 sin US2
comprobando que el rol cambia—, pero solo tienen valor de producto en
conjunto. US3 (invitar con rol) y US4 (transferir propiedad) sí son
incrementos independientes encima del MVP; ambos reutilizan la lista de
miembros y la página de ajustes que US1 deja lista.

**Sin fase de Setup separada**: esta feature no agrega dependencias ni
herramientas nuevas (plan.md § Technical Context). Se empieza directo en
Foundational.

**Antes de escribir código Next.js**: [AGENTS.md](../../AGENTS.md) exige leer
la guía relevante de `node_modules/next/dist/docs/` (Server Actions,
`revalidatePath`, `router.refresh`) — esta versión de Next.js puede diferir
de lo conocido.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin
  dependencias de tareas incompletas)
- **[Story]**: `[F7-US<m>]` — a qué historia de esta spec pertenece
- Cada descripción incluye la ruta exacta de archivo

## Path Conventions

Mismo monolito Next.js (`app/`, `lib/`, `components/`, `db/`, `tests/` en la
raíz del repositorio) — ver plan.md § Project Structure. Las etiquetas de la
interfaz van en inglés, como el resto de la UI actual (Owner / Member /
Viewer); los identificadores de código y del enum también.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: La matriz de permisos, el esquema y el helper de servidor que
toda historia necesita.
**⚠️ CRITICAL**: ninguna historia de usuario puede empezar hasta completar
esta fase.

- [X] T001 Crear `lib/roles.ts` (módulo **puro**: sin imports de `db`, `next/*` ni `lib/auth`, para poder importarlo desde componentes cliente): tipo `ProjectRole = "owner" | "member" | "viewer"`, tipo `Permission` con exactamente las 13 claves de contracts/roles-permissions.md (`project:edit`, `project:delete`, `project:leave`, `project:transferOwnership`, `member:remove`, `member:changeRole`, `invitation:send`, `invitation:viewPending`, `invitation:cancelAny`, `invitation:cancelOwn`, `board:edit`, `workItem:edit`, `relationship:edit`), la tabla `Permission → ProjectRole[]` idéntica a la matriz de contracts/roles-permissions.md § Matriz de permisos → claves, `can(role, permission): boolean` y `ROLE_LABELS: Record<ProjectRole, string>` (`Owner`, `Member`, `Viewer`) para la UI (FR-001, FR-003, FR-005)
- [X] T002 [P] Test unitario de la matriz en `tests/unit/roles.test.ts`: tabla completa `permiso × rol` comparada fila por fila con la matriz de spec.md § Matriz de permisos (13 claves × 3 roles), más: `can` es `false` para cualquier permiso con un rol desconocido, y las claves de `Permission` coinciden exactamente con las filas de la spec (SC-001, SC-002)
- [X] T003 [P] Modificar `db/schema.ts` según data-model.md: (a) `projectRoleEnum` pasa a `["owner", "member", "viewer"]`; (b) `invitations` gana la columna `role: projectRoleEnum("role").notNull().default("member")` (tipo `project_role`, `NOT NULL`, `DEFAULT 'member'`) y un `check("invitations_role_not_owner_check", sql`${table.role} <> 'owner'`)` (`CHECK (role <> 'owner')`); (c) `projectMembers` gana `uniqueIndex("project_members_one_owner_idx").on(table.projectId).where(sql`${table.role} = 'owner'`)` (índice único parcial sobre `(project_id)` `WHERE role = 'owner'`); actualizar el comentario de cabecera de `projectRoleEnum` (FR-001, FR-002, FR-008)
- [X] T004 [P] Modificar `lib/errors.ts`: agregar `isRolePermissionError(result: Result<unknown>): boolean` (verdadero si `!result.ok && result.error.code === "ROLE_NOT_PERMITTED"`), sin imports de servidor para que los componentes cliente puedan usarlo; documentar en el comentario de cabecera los códigos nuevos de contracts/roles-permissions.md § Catálogo de códigos de error (research.md § Código de error propio)
- [X] T005 Generar la migración con `npm run db:generate` (depende de T003): confirmar que se crea `db/migrations/0003_*.sql` con su snapshot y la entrada en `db/migrations/meta/_journal.json`, y revisar a mano que el SQL contenga exactamente las 4 sentencias de data-model.md § Migración (`ALTER TYPE "public"."project_role" ADD VALUE 'viewer'`; `ADD COLUMN "role" "project_role" DEFAULT 'member' NOT NULL` en `invitations`; el `CHECK ("role" <> 'owner')`; el `CREATE UNIQUE INDEX "project_members_one_owner_idx" ... WHERE "project_members"."role" = 'owner'`) y que **ninguna** sentencia use el valor `viewer` (research.md § Representación del rol)
- [ ] T006 Aplicar la migración (depende de T005) contra una base de desarrollo o rama **desechable** de Neon (nunca datos reales sin respaldo): primero ejecutar la verificación previa de quickstart.md § 0 (`SELECT project_id, count(*) FROM project_members WHERE role = 'owner' GROUP BY project_id HAVING count(*) <> 1;` — esperado: 0 filas) y luego `npm run db:migrate`; verificar en la base que `invitations.role` existe con default `member`, que `project_role` incluye `viewer` y que existe `project_members_one_owner_idx` (SC-007: sin backfill, las filas existentes quedan válidas)
- [X] T007 Modificar `lib/permissions.ts` (depende de T001): agregar `requireProjectPermission(projectPublicId: string, permission: Permission)` que hace lo mismo que `requireProjectMember` (sesión → proyecto → membresía; `UNAUTHENTICATED`/`NOT_FOUND`/`FORBIDDEN`) y además lanza `AppError("ROLE_NOT_PERMITTED", …)` con un mensaje que nombre el rol del usuario (ej. "Your role in this project (Viewer) doesn't allow this action.") si `!can(membership.role, permission)`; devuelve `{ session, project, membership }`; el rol se lee de `project_members` en cada llamada, nunca de la sesión (FR-003, FR-004, SC-003). **No** eliminar aún `requireProjectOwner` (sale en T048, cuando ya no tenga usos)
- [X] T008 Modificar `tests/unit/permissions.test.ts` (depende de T007): agregar un `describe("requireProjectPermission")` con el mismo patrón de mocks que los bloques existentes (`vi.mock("@/lib/auth")`, `vi.mock("@/db/client")`, `chain()`): sin sesión → `UNAUTHENTICATED`; proyecto inexistente → `NOT_FOUND`; no miembro → `FORBIDDEN` (y **no** `ROLE_NOT_PERMITTED`); miembro con rol sin permiso (p. ej. `viewer` con `workItem:edit`, `member` con `member:remove`) → `ROLE_NOT_PERMITTED`; miembro con permiso → devuelve `{ session, project, membership }` (FR-003, FR-004)

**Checkpoint**: la matriz, el esquema migrado y el helper de permisos están
listos — las historias de usuario pueden empezar.

---

## Phase 2: [F7-US1] El owner cambia el rol de un miembro (Priority: P1) 🎯 MVP

**Goal**: El owner asigna y revierte el rol de cada miembro (Miembro ↔
Lector) desde la lista de miembros; todos ven el rol de cada persona y el
propio.

**Independent Test**: Con un proyecto de dos cuentas (owner + miembro), el
owner cambia al otro a Lector y verifica que la lista de miembros muestra el
nuevo rol; lo devuelve a Miembro; un Miembro no ve el selector de rol.

**Depends on**: Phase 1 (Foundational).

- [X] T009 [F7-US1] Modificar `lib/actions/projects.ts` — migrar los permisos existentes: `renameProject` y `updateProjectDescription` → `requireProjectPermission(..., "project:edit")`, `deleteProject` → `"project:delete"`, `removeMember` → `"member:remove"` (todos antes `requireProjectOwner`; conservar `CANNOT_REMOVE_OWNER` y demás validaciones tal cual); `leaveProject` → `requireProjectPermission(..., "project:leave")` conservando el código y mensaje `OWNER_CANNOT_LEAVE` que hoy recibe el owner (mensaje: transferir la propiedad o eliminar el proyecto); `ProjectMemberWithUser.role` pasa a `"owner" | "member" | "viewer"` (usar el tipo `ProjectRole` de `lib/roles.ts`). Un no-owner que intente una acción de owner ahora recibe `ROLE_NOT_PERMITTED` en lugar de `FORBIDDEN` (FR-003, FR-004, FR-014; contracts/roles-permissions.md § removeMember/renameProject/…, § leaveProject, § listProjectMembers)
- [X] T010 [F7-US1] Modificar `lib/actions/projects.ts` (depende de T009, mismo archivo) — agregar `changeMemberRole(input: { projectPublicId: string; userId: string; role: "member" | "viewer" }): Promise<Result<void>>` según contracts/roles-permissions.md § changeMemberRole: `requireProjectPermission(projectPublicId, "member:changeRole")`; validar `role` con zod (`z.enum(["member", "viewer"])`) → `INVALID_ROLE` (nunca `owner`, FR-002); dentro de `db.transaction`: bloquear el proyecto con `select ... from projects where id = ? for update` (`.for("update")` de Drizzle), re-verificar que el actor sigue siendo owner (`project_members.role = 'owner'` del actor, si no `ROLE_NOT_PERMITTED`), rechazar con `CANNOT_CHANGE_OWNER_ROLE` si `userId` es el owner (`projects.ownerId`, incluido el propio actor) y con `NOT_A_MEMBER` si no es miembro; ejecutar `UPDATE project_members SET role = :role WHERE project_id = :p AND user_id = :u AND role <> 'owner'` comprobando `RETURNING` (0 filas ⇒ `NOT_A_MEMBER`); idempotente si el rol ya es el pedido; `revalidatePath(`/projects/${projectPublicId}/settings`)` (FR-002, FR-006; research.md § Invariante un solo owner y concurrencia)
- [X] T011 [P] [F7-US1] Test unitario de `changeMemberRole` en `tests/unit/member-roles.test.ts` (archivo nuevo; mismo patrón de mocks que `tests/unit/permissions.test.ts`, con `db.transaction` y `db.select().from().where().for()` simulados): `role: "owner"` o cualquier valor fuera de `member | viewer` → `INVALID_ROLE` sin escrituras; destino = owner (incluido el propio actor) → `CANNOT_CHANGE_OWNER_ROLE`; destino no miembro → `NOT_A_MEMBER`; actor Miembro o Lector → `ROLE_NOT_PERMITTED`; caso feliz emite un `UPDATE` con `role <> 'owner'` en el `WHERE`; mismo rol pedido → éxito sin error (FR-002, FR-006)
- [X] T012 [F7-US1] Modificar `components/settings/MembersList.tsx`: reemplazar el prop `isOwner: boolean` por `role: ProjectRole` (rol del usuario actual); mostrar el rol de cada miembro con `ROLE_LABELS[member.role]` (FR-007); para las filas de miembros no-owner, si `can(role, "member:changeRole")`, mostrar un `<select>` (con `aria-label` "Role of {name}") con `Member`/`Viewer` que llama a `changeMemberRole` (T010) y luego `router.refresh()` (una sola Server Action, sin encadenar otra; lección de 005 research.md § Hallazgo), con estado de "guardando" y error en línea; el botón "Remove" pasa a `can(role, "member:remove")`; **el botón "Invite" se mantiene visible solo para `role === "owner"`** hasta US3 (T036) para no adelantar el permiso que el servidor todavía no concede a los Miembros — *Nota (análisis C1)*: el texto de cada fila pasó de `({role})` a la etiqueta del rol y al `<select>` del owner, así que se actualizaron las dos aserciones `getByText("Member (member)")` de `tests/e2e/projects.spec.ts` por `getByLabel("Role of Member")`
- [X] T013 [F7-US1] Modificar `app/(workspace)/projects/[projectPublicId]/settings/page.tsx`: reemplazar `const isOwner = membership.role === "owner"` por comprobaciones `can(membership.role, …)` — formularios de renombrar/descripción con `"project:edit"`, `DeleteProjectSection` con `"project:delete"`, `LeaveProjectButton` con `"project:leave"`; el encabezado pasa de "Signed in as {role}" a `Signed in as {ROLE_LABELS[membership.role]}` (el usuario identifica claramente su propio rol, FR-007); pasar `role={membership.role}` a `MembersList` (T012); actualizar el comentario de cabecera (ya no es "owner-only por FR-008 de 002 / FR-009 de 001", sino la matriz de 007)
- [X] T014 [P] [F7-US1] Modificar `tests/e2e/helpers.ts`: agregar `inviteAndAccept(ownerPage: Page, inviteePage: Page, projectUrl: string, inviteeEmail: string)` que reproduce el flujo de `tests/e2e/invitations.spec.ts` (owner abre `${projectUrl}/settings` → "Invite" → email → "Send invitation"; invitado abre "Notifications" → "Accept"; esperar a que el botón desaparezca) para dejar a un segundo usuario como miembro; se extenderá con el rol de ingreso en T038
- [ ] T015 [F7-US1] Test e2e en `tests/e2e/roles-permissions.spec.ts` (archivo nuevo, patrón de `tests/e2e/invitations.spec.ts` con `browser.newContext()` por cuenta y `signUpNewUser`/`createProjectViaUi`/`inviteAndAccept`): el owner cambia a un miembro a Lector y la lista muestra "Viewer"; lo devuelve a "Member"; un Miembro abre Ajustes y **no** ve el selector de rol pero sí el rol de cada persona y el suyo; el owner no tiene control para cambiar su propio rol (quickstart.md bloque 1, pasos 1-5)

**Checkpoint**: el owner puede asignar Miembro/Lector y todos ven los roles.

---

## Phase 3: [F7-US2] Un Lector consulta el proyecto sin poder modificarlo (Priority: P1) 🎯 MVP

**Goal**: El Lector recorre tablero, detalle, relaciones, actividad y
miembros sin poder alterar nada: la interfaz no le ofrece acciones de
edición y el servidor rechaza cualquier mutación aunque se intente por otra
vía.

**Independent Test**: Con una cuenta Lector, recorrer cada pantalla
verificando que no hay controles de edición operativos, y ejecutar cada
mutación de la matriz verificando que se rechaza con `ROLE_NOT_PERMITTED` sin
cambiar datos.

**Depends on**: Phase 1 (Foundational). El barrido unitario (T019) también
depende de T009/T010 (mutaciones de proyecto ya migradas en US1). Para
validar por la interfaz hace falta un Lector, que se crea con
`changeMemberRole` de US1.

- [X] T016 [P] [F7-US2] Modificar `lib/actions/board.ts`: `createStage`, `reorderStages`, `renameStage` y `deleteStage` pasan de `requireProjectMember` a `requireProjectPermission(..., "board:edit")`; `getBoard` sigue exigiendo solo membresía (`requireProjectMember`) y devuelve además `role: ProjectRole` (`membership.role`) en su `Result` (FR-003, FR-005; contracts/roles-permissions.md § Board)
- [X] T017 [P] [F7-US2] Modificar `lib/actions/work-items.ts`: `createWorkItem`, `moveWorkItem`, `reorderWorkItemsInStage`, `updateWorkItem` (incluye la creación inline de tags) y `deleteWorkItem` pasan de `requireProjectMember` a `requireProjectPermission(project.publicId, "workItem:edit")`; las lecturas (`getWorkItemByDisplayNumber`, `listProjectTags`, `getWorkItemTags`, `listWorkItemActivity`) no cambian (FR-003; contracts/roles-permissions.md § Work Items)
- [X] T018 [P] [F7-US2] Modificar `lib/actions/work-item-relationships.ts`: `setWorkItemParent`, `removeWorkItemParent`, `linkRelatedWorkItems` y `unlinkRelatedWorkItems` pasan de `requireProjectMember` a `requireProjectPermission(..., "relationship:edit")`; `getWorkItemDetailData` llama a `requireProjectMember(projectPublicId)` al inicio para obtener `membership.role` y lo devuelve en `WorkItemDetailData` como `role: ProjectRole` (las lecturas `getWorkItemRelations` y `listProjectWorkItems` no cambian) (FR-003, FR-005; contracts/roles-permissions.md § Relaciones)
- [X] T019 [F7-US2] Test unitario de barrido en `tests/unit/action-permissions.test.ts` (archivo nuevo; depende de T009, T010, T016, T017, T018): tabla `{ acción, importación, argumentos mínimos válidos, permiso esperado, roles denegados }` con **todas** las mutaciones exportadas de `lib/actions/board.ts`, `lib/actions/work-items.ts`, `lib/actions/work-item-relationships.ts` y `lib/actions/projects.ts` (incluido `changeMemberRole`); para cada una, mockear `@/lib/auth` y `@/db/client` (mismo patrón que `tests/unit/permissions.test.ts`, con espías para `insert`/`update`/`delete`/`transaction`) simulando a un Lector (y, para las de owner, también a un Miembro), invocar la acción y verificar `ok: false` con `error.code === "ROLE_NOT_PERMITTED"` y que **ningún** espía de escritura fue llamado (SC-001, SC-002; research.md § Cómo probar) — *Nota (análisis C3)*: el `db` simulado responde por nombre de tabla con una fila fija (proyecto, membresía con el rol bajo prueba, stage, Work Item, invitación), porque las acciones de Work Items consultan `getStageAndProject`/`getWorkItemAndProject` **antes** de comprobar el permiso
- [X] T020 [P] [F7-US2] Crear `components/ui/read-only-notice.tsx`: aviso reutilizable (con `role="status"`) del tipo "You're a Viewer on this project — read-only" para tablero y detalle, recibiendo el rol y usando `ROLE_LABELS`; mismo estilo visual sobrio que el resto de `components/ui/` (FR-005; research.md § Modo lectura de la interfaz)
- [X] T021 [F7-US2] Modificar `app/(workspace)/projects/[projectPublicId]/page.tsx`: pasar `role={result.data.role}` (T016) a `<Board>` y renderizar `<ReadOnlyNotice>` (T020) sobre el tablero cuando `!can(result.data.role, "board:edit")`
- [X] T022 [F7-US2] Modificar `components/board/Board.tsx`: nuevo prop `role: ProjectRole`; `canEdit = can(role, "board:edit")`; si `!canEdit`, no renderizar `AddStageButton` y pasar `canEdit` a `StageColumn`; los handlers `handleStageReorder`, `handleWorkItemMove` y `handleWorkItemReorder`, cuando su llamada devuelve `isRolePermissionError(result)`, además de revertir el estado y mostrar el `toast(result.error.message, "destructive")` existente, llaman a `router.refresh()` (`useRouter`) para pasar a modo lectura sin acción adicional (Historia 2, escenario 4; FR-004; research.md § Cambio de rol con la pantalla ya abierta)
- [X] T023 [F7-US2] Modificar `components/board/StageColumn.tsx`: nuevo prop `canEdit`; `useSortable({ ..., disabled: !canEdit })` (dnd-kit) y no aplicar `attributes`/`listeners`/`aria-label` de arrastre cuando es solo lectura; `StageName` no entra en modo edición con doble clic si `!canEdit`; ocultar `DeleteStageButton` y `AddWorkItemButton` si `!canEdit`; en `StageName`, si `renameStage` devuelve `isRolePermissionError(result)` llamar a `router.refresh()`; pasar `canEdit` a `WorkItemCard` (FR-005)
- [X] T024 [F7-US2] Modificar `components/board/WorkItemCard.tsx`: nuevo prop `canEdit`; `useSortable({ ..., disabled: !canEdit })` y no aplicar `listeners`/cursor de arrastre cuando es solo lectura, **conservando** el `onClick` que navega al detalle (`router.push`, FR-002 de 006) — un Lector debe poder abrir el detalle (Historia 2, escenario 2)
- [X] T025 [P] [F7-US2] Modificar `components/board/AddStageButton.tsx`: si la acción devuelve `isRolePermissionError(result)`, mostrar el mensaje del servidor y llamar a `router.refresh()` (caso de un Miembro degradado a Lector con la pantalla abierta)
- [X] T026 [P] [F7-US2] Modificar `components/board/AddWorkItemButton.tsx`: mismo tratamiento de `isRolePermissionError(result)` que T025 (mensaje + `router.refresh()`)
- [X] T027 [P] [F7-US2] Modificar `components/board/DeleteStageButton.tsx`: mismo tratamiento de `isRolePermissionError(result)` que T025 (mensaje + `router.refresh()`)
- [X] T028 [P] [F7-US2] Modificar `components/work-items/TagPicker.tsx`: nuevo prop opcional `disabled?: boolean` (por defecto `false`); cuando es `true`, mostrar las tags seleccionadas sin poder agregar, quitar ni crear ninguna (todos los controles deshabilitados/ocultos) (FR-005)
- [X] T029 [F7-US2] Modificar `components/work-items/WorkItemDetailView.tsx` (depende de T018, T020, T028): `canEdit = can(initialDetail.role, "workItem:edit")` y `canEditRelations = can(initialDetail.role, "relationship:edit")`; si `!canEdit`, los campos título/descripción/stakeholder pasan a `readOnly`/`disabled`, `TagPicker` recibe `disabled`, y no se renderizan los botones Guardar y Eliminar (ni su confirmación); si `!canEditRelations`, no se renderizan los formularios de "set parent"/"link related" ni los botones de quitar (padre, relacionado); los `<Link>` de navegación a padre/hijos/relacionados **se conservan**; mostrar `<ReadOnlyNotice>` (T020) cuando el usuario no puede editar; en `handleSave`, `handleDelete` y los handlers de relaciones, ante `isRolePermissionError(result)` mostrar el mensaje y llamar a `router.refresh()`; incluir el rol nuevo en el reseteo de estado al navegar entre Work Items (patrón existente de ajuste en render) (Historia 2, escenario 2; FR-005)
- [X] T030 [F7-US2] Verificar `app/(workspace)/projects/[projectPublicId]/work-items/[displayNumber]/page.tsx`: como `WorkItemDetailView` lee el rol desde `initialDetail` (T018/T029), confirmar que la página no necesita cambios de código; si al probarlo el rol no llega al componente, pasarlo explícitamente como prop. Actualizar el comentario de cabecera de la página para referenciar 007 (FR-005)
- [ ] T031 [F7-US2] Test e2e en `tests/e2e/roles-permissions.spec.ts` (mismo archivo de T015, depende de T015 y de T021-T029): dejar a una cuenta como Lector (vía UI del owner con T012) y verificar: en el tablero no hay "Add column" / "Add work item" ni eliminar columna, el aviso de solo lectura es visible, arrastrar una tarjeta no la mueve (`dragWorkItemToColumn` de `tests/e2e/helpers.ts` y la tarjeta sigue en su columna) y doble clic en el nombre de una columna no abre el editor; en el detalle los campos son de solo lectura y no hay Guardar/Eliminar ni formularios de relaciones, pero sí se navega por un enlace de relacionado (`openCard`) y el botón atrás vuelve; cambio de rol con la pantalla abierta: el owner pasa a un Miembro a Lector mientras este tiene el tablero abierto, el afectado intenta mover una tarjeta y ve el mensaje de rol cambiado, la tarjeta vuelve a su columna y la pantalla queda en modo lectura tras el refresco; un Lector puede salir del proyecto desde Ajustes (quickstart.md bloque 2, pasos 1-4 y 6)

**Checkpoint**: MVP completo — los roles se asignan (US1) y se hacen cumplir
en servidor e interfaz (US2).

---

## Phase 4: [F7-US3] Invitar eligiendo el rol, y quién puede invitar (Priority: P2)

**Goal**: Al invitar se elige el rol de ingreso (Miembro o Lector); Owner y
Miembros pueden invitar y los Lectores no; las invitaciones pendientes solo
las ven Owner y Miembros (FR-018).

**Independent Test**: Un Miembro invita a un email eligiendo Lector; la
persona acepta y aparece como Lector. Un Lector no ve ni puede usar "Invite"
ni ve las invitaciones pendientes.

**Depends on**: Phase 2 (US1: `MembersList` con el prop `role` y la página
de ajustes ya migrada a `can`).

- [X] T032 [F7-US3] Modificar `lib/actions/accounts-invitations.ts` — `sendInvitation` y `respondToInvitation`: `sendInvitation` pasa a `requireProjectPermission(input.projectPublicId, "invitation:send")` (antes `requireProjectOwner`), recibe `role` en su input (`{ projectPublicId, email, role: "member" | "viewer" }`), lo valida con zod (`z.enum(["member", "viewer"])` → `INVALID_ROLE`; `owner` nunca es válido, FR-002) y lo guarda en `invitations.role`, sin tocar rate limit, `ALREADY_MEMBER`, `ALREADY_INVITED` ni la notificación; `respondToInvitation` inserta en `project_members` con `role: invitation.role` en lugar del `"member"` fijo actual (FR-008, FR-009; contracts/roles-permissions.md § sendInvitation, § respondToInvitation)
- [X] T033 [F7-US3] Modificar `lib/actions/accounts-invitations.ts` (depende de T032, mismo archivo) — `cancelInvitation` y `listPendingInvitations`: `cancelInvitation` pasa a `requireProjectPermission(..., "invitation:cancelOwn")` (rechaza al Lector); después, si `can(membership.role, "invitation:cancelAny")` cancela cualquiera, si no solo la que envió el propio usuario (`invitedByUserId === session.user.id`), en otro caso `ROLE_NOT_PERMITTED` (antes `FORBIDDEN`); `listPendingInvitations` pasa a `requireProjectPermission(..., "invitation:viewPending")` — un Lector recibe `ROLE_NOT_PERMITTED` y ninguna fila (FR-018) — y `PendingInvitation` gana `role: ProjectRole` e `invitedByUserId: string` en la selección y en el tipo (FR-010, FR-018; contracts/roles-permissions.md § cancelInvitation, § listPendingInvitations)
- [X] T034 [P] [F7-US3] Modificar `components/sidebar/InviteMemberDialog.tsx`: agregar un selector de rol de ingreso con solo `Member` (preseleccionado, preserva el flujo actual de un clic) y `Viewer` — **sin opción Owner** (FR-002) — con una línea de descripción por rol, que se envía como `role` a `sendInvitation`; limpiar/reiniciar el rol al cerrar el diálogo; el mensaje de éxito puede mencionar el rol elegido (FR-008)
- [X] T035 [P] [F7-US3] Modificar `components/settings/PendingInvitationsList.tsx`: nuevos props `role: ProjectRole` y `currentUserId: string`; mostrar el rol de ingreso de cada invitación (`ROLE_LABELS[invitation.role]`, FR-008); el botón "Cancel" se muestra si `can(role, "invitation:cancelAny")` o (`can(role, "invitation:cancelOwn")` y `invitation.invitedByUserId === currentUserId`) (FR-010); ante `isRolePermissionError(result)` mostrar el mensaje y `router.refresh()`
- [X] T036 [F7-US3] Modificar `components/settings/MembersList.tsx` (depende de T012, mismo archivo): el botón "Invite" pasa de `role === "owner"` a `can(role, "invitation:send")` (Owner y Miembro; el Lector no lo ve) (FR-009)
- [X] T037 [F7-US3] Modificar `app/(workspace)/projects/[projectPublicId]/settings/page.tsx` (depende de T013, mismo archivo): llamar a `listPendingInvitations` **solo si** `can(membership.role, "invitation:viewPending")` (para un Lector ni se invoca, FR-018) y renderizar `PendingInvitationsList` con `role={membership.role}` y `currentUserId={membership.userId}` (T035) bajo esa misma condición
- [X] T038 [P] [F7-US3] Modificar `tests/e2e/helpers.ts` (mismo archivo de T014): extender `inviteAndAccept` con un parámetro opcional `role: "member" | "viewer" = "member"` que elige el rol en el nuevo selector del diálogo (T034) antes de "Send invitation"
- [X] T039 [F7-US3] Modificar `tests/unit/action-permissions.test.ts` (mismo archivo de T019): agregar a la tabla las mutaciones de `lib/actions/accounts-invitations.ts` — `sendInvitation` (denegada a `viewer`), `cancelInvitation` (denegada a `viewer`; un `member` que no es el remitente también recibe `ROLE_NOT_PERMITTED`) y `listPendingInvitations` (lectura protegida, denegada a `viewer`, sin filas devueltas — FR-018) — con las mismas aserciones de rechazo sin escrituras (SC-001)
- [X] T040 [F7-US3] Modificar `tests/unit/member-roles.test.ts` (mismo archivo de T011): `sendInvitation` con `role: "owner"` (o valor inválido) → `INVALID_ROLE` sin escrituras; con `role: "viewer"` inserta la invitación con `role: "viewer"`; `respondToInvitation` al aceptar inserta la membresía con el `role` de la invitación (no `"member"` fijo) y una invitación previa a la feature (default `member`) ingresa como `member` (FR-008, FR-015)
- [ ] T041 [F7-US3] Test e2e en `tests/e2e/roles-permissions.spec.ts` (mismo archivo de T015, depende de T034-T038): el owner invita a un email eligiendo `Viewer`, la lista de pendientes muestra "Viewer", el invitado acepta y aparece como Viewer en la lista de miembros; un Miembro invita a otro email como Member y puede hacerlo; el selector de rol de la invitación no ofrece Owner; un Miembro cancela una invitación que **él** envió pero no ve el botón "Cancel" en una que envió el owner, mientras el owner cancela cualquiera; un Lector no ve "Invite" ni la sección de invitaciones pendientes (quickstart.md bloque 3, pasos 1-5)

**Checkpoint**: las invitaciones llevan rol y también pueden enviarlas los
Miembros.

---

## Phase 5: [F7-US4] Transferir la propiedad del proyecto (Priority: P3)

**Goal**: El owner transfiere la propiedad a otro miembro en un solo paso;
el owner anterior queda como Miembro y puede salir del proyecto; el
proyecto siempre tiene exactamente un owner.

**Independent Test**: Un owner transfiere la propiedad a otro miembro;
verificar que el nuevo owner tiene los permisos de owner, el anterior quedó
como Miembro y el proyecto conserva exactamente un owner.

**Depends on**: Phase 2 (US1: `MembersList` con el prop `role` y ajustes
migrados a `can`).

- [X] T042 [F7-US4] Modificar `lib/actions/projects.ts` — agregar `transferOwnership(input: { projectPublicId: string; newOwnerUserId: string }): Promise<Result<void>>` según contracts/roles-permissions.md § transferOwnership: `requireProjectPermission(projectPublicId, "project:transferOwnership")`; una **única** `db.transaction` que primero bloquea la fila del proyecto (`select ... for update`) y re-verifica que el actor sigue siendo owner, y luego: (1) `CANNOT_TRANSFER_TO_SELF` si `newOwnerUserId` es el actor; (2) `UPDATE project_members SET role = 'member' WHERE project_id = :p AND user_id = :actor AND role = 'owner'` — 0 filas ⇒ `ROLE_NOT_PERMITTED`; (3) `UPDATE project_members SET role = 'owner' WHERE project_id = :p AND user_id = :newOwner` — 0 filas ⇒ `NOT_A_MEMBER` y la transacción se revierte completa (el owner original se conserva); (4) `UPDATE projects SET owner_id = :newOwner, updated_at = now()`; el orden **bajar antes de subir** es obligatorio para respetar `project_members_one_owner_idx`; el destinatario puede tener cualquier rol previo, incluido `viewer` (FR-011); sin estado "pendiente de aceptar"; `revalidatePath(`/projects/${projectPublicId}/settings`)` y `revalidatePath("/")` (FR-002, FR-011, FR-012, FR-013; research.md § Invariante un solo owner y concurrencia)
- [X] T043 [F7-US4] Modificar `tests/unit/member-roles.test.ts` (mismo archivo de T011/T040): `transferOwnership` — destinatario = actor → `CANNOT_TRANSFER_TO_SELF`; destinatario no miembro → `NOT_A_MEMBER` y **ningún** commit (la transacción lanza y no se actualiza `projects.owner_id`); actor Miembro o Lector → `ROLE_NOT_PERMITTED`; caso feliz (destinatario `member` y caso `viewer`) verifica que el `UPDATE ... SET role = 'member'` del actor se emite **antes** que el `UPDATE ... SET role = 'owner'` del destinatario y que se actualiza `projects.owner_id` (FR-011, FR-012)
- [X] T044 [P] [F7-US4] Crear `components/settings/TransferOwnershipDialog.tsx`: diálogo (mismo `Dialog` de `components/ui/dialog.tsx` que `InviteMemberDialog`) con props `projectPublicId`, `member: { userId, name }`, `open`, `onOpenChange`; muestra la advertencia explícita de FR-011 — al confirmar perderá los permisos exclusivos de owner (rename/delete the project, remove members, change roles, transfer ownership) y pasará a ser Member — y un botón de confirmación que llama a `transferOwnership` (T042) y luego `router.refresh()` (una sola Server Action); muestra errores en línea (`NOT_A_MEMBER`, `ROLE_NOT_PERMITTED`, etc.) (FR-011; contracts/roles-permissions.md § Confirmación explícita)
- [X] T045 [F7-US4] Modificar `components/settings/MembersList.tsx` (depende de T012, T036, T044, mismo archivo): para cada fila no-owner, si `can(role, "project:transferOwnership")`, botón "Make owner" que abre `TransferOwnershipDialog` (T044) para ese miembro; en un proyecto Personal (sin otros miembros) no hay filas no-owner y por tanto la acción no está disponible (Historia 4, escenario 3)
- [ ] T046 [F7-US4] Test e2e en `tests/e2e/roles-permissions.spec.ts` (mismo archivo de T015, depende de T044-T045): en un proyecto Personal no aparece "Make owner"; en uno compartido el owner elige a un miembro, ve la advertencia y confirma; el owner anterior (ahora Member) recarga Ajustes y ya no ve los controles de owner mientras el nuevo owner sí; la lista muestra un solo Owner; el owner anterior puede salir del proyecto; repetir con un destinatario Viewer, que pasa a Owner con todos los permisos (quickstart.md bloque 4, pasos 1-5)
- [ ] T047 [F7-US4] Test de respaldo de la base de datos en `tests/e2e/roles-permissions.spec.ts` (mismo archivo; usa `db` de `@/db/client` como `tests/e2e/helpers.ts`): insertar directamente una segunda fila `project_members` con `role = 'owner'` en un proyecto que ya tiene owner falla por `project_members_one_owner_idx` (SC-006), e insertar una `invitations` con `role = 'owner'` falla por `invitations_role_not_owner_check` (FR-002) — verificando que las dos defensas en profundidad funcionan aunque la aplicación tuviera un bug

**Checkpoint**: las 4 historias completas — roles asignables, modo lectura
aplicado, invitaciones con rol y transferencia de propiedad.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Retirar el código reemplazado, cerrar la cobertura y validar
de punta a punta.

- [X] T048 Eliminar `requireProjectOwner` de `lib/permissions.ts` (queda sin usos tras T009 y T032) y quitar su bloque `describe("requireProjectOwner")` de `tests/unit/permissions.test.ts`; antes de borrar, confirmar con `grep -rn "requireProjectOwner" app lib components tests` que no queda ningún uso ni import (plan.md § Structure Decision; Principio VI, no dejar dos formas de decir "solo el owner")
- [X] T049 Modificar `tests/unit/action-permissions.test.ts`: agregar una comprobación de **completitud** que lea las exportaciones de `lib/actions/*.ts` (importando los módulos) y falle si existe una Server Action de mutación exportada que no tenga entrada en la tabla del barrido (lista de lecturas explícitamente permitidas, p. ej. `getBoard`, `listProjectTags`, aparte) — así una acción nueva sin permiso hace fallar el test (research.md § Cómo probar)
- [X] T050 [P] Pasada de accesibilidad de los controles nuevos: `<select>` de rol en `MembersList.tsx` y en `InviteMemberDialog.tsx` con etiqueta accesible, foco inicial y cierre con Escape en `TransferOwnershipDialog.tsx`, `role="status"` en `read-only-notice.tsx`, y estado deshabilitado/`aria-disabled` legible para las tarjetas y columnas en modo lectura; consistente con las pasadas de T021 de 005 y T018 de 006
- [X] T051 [P] Actualizar `README.md`: § Project status (Fase 2 pasa de "in progress" a completa, con el spec de roles y permisos enlazado — [`specs/007-roles-permissions`](specs/007-roles-permissions/)), § Roadmap punto 7 de la Fase 2 marcado como implementado, y § Core concepts para mencionar los tres roles (Owner / Member / Viewer)
- [X] T052 [P] Actualizar `AGENTS.md`: agregar `007-roles-permissions` a la lista de specs (§ Start here), y en § "Constitution highlights an agent is likely to violate" precisar que toda mutación MUST usar `requireProjectPermission` con una clave de `lib/roles.ts` (no comprobar `membership.role` en línea ni llamar a `requireProjectMember` en una mutación), y que la matriz vive solo en `lib/roles.ts`
- [X] T053 [P] Agregar una nota de enmienda en `specs/001-accounts-invitations/spec.md`: bajo FR-009 y bajo la asunción "solo el owner/creador puede enviar invitaciones", indicar "Enmendado por [007-roles-permissions](../007-roles-permissions/spec.md#functional-requirements) (FR-009): Owner y Miembros invitan, con rol de ingreso elegido", sin reescribir el texto histórico
- [X] T054 [P] Agregar una nota de enmienda en `specs/002-project-spaces/spec.md`: bajo la asunción de que transferir la propiedad queda fuera de alcance y bajo FR-014, indicar que la transferencia quedó en alcance de [007-roles-permissions](../007-roles-permissions/spec.md) (FR-011, FR-013), sin reescribir el texto histórico
- [X] T055 Desde la raíz del repositorio, correr los scripts `lint` y `test` de `package.json` (`npm run lint`, `npm run test`) y `npx tsc --noEmit` (config en `tsconfig.json`); corregir cualquier fallo (en particular referencias restantes a `isOwner`, tipos de `role` en los componentes tocados y mocks de tests de Fase 1 que asumían `requireProjectMember` en mutaciones)
- [ ] T056 Correr `npm run test:e2e` **contra una rama desechable de Neon** (nunca datos reales — `tests/e2e/setup.ts` trunca todas las tablas); confirmar que las suites de Fase 1 y de 005/006 siguen en verde (SC-007: los flujos de Owner y Miembro no cambian) y que pasa `tests/e2e/roles-permissions.spec.ts`
- [ ] T057 Correr manualmente el flujo completo de `quickstart.md` de punta a punta (bloques 0-5 con tres cuentas), incluidos: la verificación previa de un solo owner por proyecto, la carrera de dos transferencias a la vez (bloque 4, paso 6) y la comprobación de que los datos anteriores a la migración siguen funcionando (bloque 5), y registrar los resultados — *Nota (análisis C2)*: incluir también la comprobación de SC-008/FR-017 (sembrar ≥100 miembros con roles mezclados y abrir Ajustes y el tablero sin error ni degradación perceptible); no hay un test automatizado de escala para ello

---

## Dependencies & Execution Order

```
Phase 1 (Foundational) ── BLOQUEA todas las historias
    ↓
Phase 2 [F7-US1] Cambiar el rol de un miembro     (P1 · MVP)
    ↓ (MembersList y ajustes ya migrados a can())
Phase 3 [F7-US2] Modo lectura del Lector          (P1 · MVP) ─┐
Phase 4 [F7-US3] Invitar con rol                  (P2)       ─┼─ independientes entre sí;
Phase 5 [F7-US4] Transferir la propiedad          (P3)       ─┘  US3 y US4 requieren US1
    ↓
Final Phase (Polish)
```

- **US2** puede empezar tras Phase 1 en el servidor (T016-T018) y validarse
  con el barrido unitario sin depender de US1; su parte de interfaz/e2e
  usa `changeMemberRole` de US1 para producir un Lector. Su barrido (T019)
  incluye las mutaciones de proyecto, por lo que sigue a T009/T010.
- **US3 y US4** tocan los mismos archivos de la sección de miembros
  (`MembersList.tsx`, `settings/page.tsx`, `projects.ts`,
  `tests/e2e/roles-permissions.spec.ts`, `tests/unit/member-roles.test.ts`):
  pueden trabajarse en paralelo por personas o agentes distintos, pero los
  cambios en esos archivos deben fusionarse con cuidado (mismo criterio que
  006). Orden recomendado dentro de `MembersList.tsx`: T012 → T036 → T045.
- **Polish**: T048 requiere que ya no queden usos de `requireProjectOwner`
  (tras T009 y T032); T049 requiere que la tabla del barrido esté completa
  (tras T019 y T039).

## Parallel Execution Examples

**Dentro de Phase 1**: T002 (test de la matriz), T003 (esquema) y T004
(helper de errores) son `[P]` entre sí y con T001 ya hecho; T005 (generar
migración) espera a T003; T007 espera a T001.

**Dentro de `[F7-US1]` (Phase 2)**: T011 (test unitario) y T014 (helper e2e)
son `[P]` entre sí una vez que T010 está listo; T012 y T013 tocan archivos
distintos pero T013 pasa `role` a `MembersList`, así que conviene T012
primero.

**Dentro de `[F7-US2]` (Phase 3)**: T016, T017 y T018 (tres archivos de
Server Actions) son `[P]` entre sí; T020, T025, T026, T027 y T028 (archivos de
componentes independientes) son `[P]` entre sí y con las acciones.

**Entre historias**: una vez cerrada Phase 2 (US1), Phase 3 (US2), Phase 4
(US3) y Phase 5 (US4) pueden avanzar en paralelo por distintas personas;
US3 y US4 comparten `MembersList.tsx` y `settings/page.tsx`.

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + Phase 3)

1. Completar Phase 1: Foundational (matriz, esquema, helper de permisos).
2. Completar Phase 2 (`[F7-US1]`): el owner puede asignar roles.
3. Completar Phase 3 (`[F7-US2]`): el rol Lector se aplica en servidor y
   en la interfaz.
4. **STOP and VALIDATE**: ya existen tres roles reales y un Lector que lee
   todo y no puede modificar nada, ni desde la UI ni por fuera de ella
   (barrido T019) — es el MVP de esta feature, aunque todavía sin invitar con
   rol ni transferir la propiedad.
5. Continuar con Phase 4 y Phase 5.

### Incremental Delivery

1. Foundational → matriz, esquema migrado y helper listos.
2. `[F7-US1]` → roles asignables desde la lista de miembros.
3. `[F7-US2]` → modo lectura hecho cumplir (MVP).
4. `[F7-US3]` → invitaciones con rol; Owner y Miembros invitan.
5. `[F7-US4]` → transferencia de propiedad; un owner puede dejar de serlo.
6. Polish → se retira `requireProjectOwner`, se cierra la cobertura del
   barrido, se actualizan README/AGENTS/specs anteriores y se valida todo
   de punta a punta.

### Orden de despliegue

`npm run db:migrate` (con la verificación previa de un solo owner por
proyecto, T006) **antes** de desplegar el código nuevo — ver research.md §
Despliegue y orden de migración.
