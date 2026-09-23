---

description: "Task list for 011-agent-access-mcp"
---

# Tasks: Acceso para Agentes de IA y Asignación de Work Items

**Input**: Design documents from `specs/011-agent-access-mcp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mcp-tools.md, contracts/app-changes.md, quickstart.md

**Tests**: Incluidos. El plan (§ Testing) y research.md § Pruebas los piden
explícitamente: unidad e integración con Vitest, y e2e con Playwright.

**Organization**: Tareas agrupadas por historia de usuario, con la etiqueta
`[F11-USn]` (F11 = 011-agent-access-mcp), siguiendo la convención de
AGENTS.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (otro archivo, sin dependencias pendientes).
- **[Story]**: la historia a la que pertenece (`[F11-US1]` … `[F11-US5]`).

## Path Conventions

Monolito Next.js en la raíz del repositorio (plan.md § Project Structure):

- Rutas en `app/`.
- Esquema y migraciones en `db/`.
- Server Actions en `lib/actions/`.
- Módulos de servidor sin `"use server"` en `lib/` y `lib/mcp/`.
- UI en `components/`.
- Pruebas en `tests/unit/` y `tests/e2e/`.

---

## Phase 1: Setup

- [ ] T001 Actualizar dependencias en `package.json`:
  - `better-auth` a `^1.7.5`.
  - Nuevas: `@better-auth/mcp@^1.7.5`, `@better-auth/cimd@^1.7.5` y `@modelcontextprotocol/server@^2.0.0`.

  Después, `npm install`, `npm test` y `npx tsc --noEmit`, para confirmar que la subida de patch no rompe nada.
- [ ] T002 Leer `node_modules/next/dist/docs/01-app/` (Route Handlers y `02-guides/backend-for-frontend.md` § `.well-known`), `node_modules/@better-auth/mcp/dist/index.d.mts`, `node_modules/@better-auth/cimd` y `node_modules/@modelcontextprotocol/server/README.md` + los `.d.mts` de `createMcpHandler`/`McpServer.registerTool`. Anotar en research.md cualquier diferencia con lo asumido en el plan.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Ninguna historia puede empezar antes de que esta fase esté completa.**

- [ ] T003 Crear `lib/actor.ts` (solo servidor, **sin** `"use server"`), según contracts/app-changes.md § Módulo `lib/actor.ts`:
  - `type AgentInfo = { clientId; name }` y `type Actor = { userId; agent: AgentInfo | null }`.
  - `runAsAgent(actor, fn)` con `AsyncLocalStorage` de `node:async_hooks`.
  - `getActor()`: devuelve el actor del store si existe. Si no, `{ userId: session.user.id, agent: null }` a partir de `getSession()`. Si tampoco hay sesión, `null`.
- [ ] T004 [P] Tests de `lib/actor.ts` en `tests/unit/actor.test.ts`, mockeando `@/lib/auth`:
  - Dentro de `runAsAgent`, el actor del agente gana sobre la sesión.
  - Fuera de `runAsAgent`, se usa la sesión.
  - Sin sesión, devuelve `null`.
  - El contexto no se filtra a código que corre después de que `runAsAgent` resuelve.
- [ ] T005 Modificar `lib/permissions.ts`:
  - `requireProjectMember` y `requireProjectPermission` usan `getActor()` en vez de `getSession()`. Sin actor, `UNAUTHENTICATED`.
  - Devuelven `{ actor, project, membership }` en vez de `{ session, … }`.
  - Actualizar **todos** los llamadores que desestructuran `session` (`grep -rn "session" lib/actions`) para usar `actor.userId`: `projects.ts`, `accounts-invitations.ts` y los demás que aparezcan.
  - `listMyProjects` (`lib/actions/projects.ts`) pasa a `getActor()`.
  - Las acciones de cuenta (`listMyNotifications`, `respondToInvitation`) siguen con `getSession()`.
  - `npx tsc --noEmit` y `npm test` deben pasar.
- [ ] T006 Modificar `db/schema.ts` según data-model.md:
  - `work_items`:
    - Quitar `stakeholder`.
    - Agregar `assigneeUserId: text("assignee_user_id")` nullable.
    - Agregar `foreignKey({ name: "work_items_assignee_member_fk", columns: [table.projectId, table.assigneeUserId], foreignColumns: [projectMembers.projectId, projectMembers.userId] }).onDelete("set null")`, con un comentario que explique que el SQL de la migración se editó a mano a `ON DELETE SET NULL ("assignee_user_id")` (Postgres ≥15).
    - Agregar el índice `work_items_assignee_idx` en `(project_id, assignee_user_id)`.
  - `work_item_activity`: agregar `actor_user_id`, `agent_client_id` y `agent_name`, todas `text` nullable.
  - `notificationTypeEnum`: agregar `"work_item_assigned"`.
  - `notifications`: índice parcial `notifications_user_unread_idx` en `(user_id, created_at)` con `WHERE read_at IS NULL`.
  - Tabla nueva `agent_last_used`: `user_id text`, `client_id text`, `last_used_at timestamptz not null`, PK `(user_id, client_id)`.
- [ ] T007 Configurar Better Auth en `lib/auth.ts`:
  - Crear `lib/mcp/config.ts` con `MCP_RESOURCE = \`${BETTER_AUTH_URL ?? "http://localhost:3000"}/api/mcp\``.
  - Agregar `plugins: [jwt(), mcp({ loginPage: "/sign-in", consentPage: "/consent", resource: MCP_RESOURCE, allowDynamicClientRegistration: true, allowUnauthenticatedClientRegistration: true }), cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" })]`.
  - Si la documentación lo pide, agregar `disabledPaths: ["/token"]`.
  - `lib/mcp/config.ts` **no** importa `lib/auth.ts`, para evitar ciclos.
- [ ] T008 Regenerar el esquema de Better Auth con `npm run auth:generate`, que actualiza `db/auth-schema.ts` con `jwks` y `oauth_*`. Después, `npm run db:generate`.
  - Editar el SQL generado en `db/migrations/0005_*.sql`: la FK `work_items_assignee_member_fk` debe quedar `ON DELETE SET NULL ("assignee_user_id")`.
  - Verificar que el orden de sentencias crea `agent_last_used` y las columnas antes de la FK.
  - Verificar la versión de Postgres (`SHOW server_version`, ≥15).
  - Aplicar con `npm run db:migrate` en la rama `dev` de `.env.local`.
- [ ] T009 Crear `lib/activity.ts` (solo servidor): `logActivity(tx, workItemId, type, payload)`, que inserta en `work_item_activity` con `actorUserId`, `agentClientId` y `agentName` tomados de `getActor()`.
  - Reemplazar **todas** las inserciones directas `insert(workItemActivity)` en `lib/actions/work-items.ts`, `lib/actions/board.ts` y `lib/actions/work-item-relationships.ts` (y cualquier otra que muestre `grep`) por `logActivity`.
  - Para inserciones en bloque (`setStageClosing`), agregar `logActivities(tx, rows[])`.
- [ ] T010 [P] Test `tests/unit/activity-logging.test.ts`: recorre `lib/**/*.ts` y falla si alguna aparición de `insert(workItemActivity)` está fuera de `lib/activity.ts`.
- [ ] T011 Quitar `stakeholder` de todo el código:
  - `lib/actions/work-items.ts` (schema y cuerpo de `updateWorkItem`).
  - `lib/actions/work-item-views.ts`.
  - `lib/work-item-view.ts`: clave de orden, `TEXT_KEYS` y tipo de fila.
  - `components/work-items/WorkItemDetailView.tsx`: campo, estado y `describeActivity`, que sigue mostrando eventos viejos `fields_edited.stakeholder` de forma genérica.
  - `components/views/WorkItemsTable.tsx`.
  - Los tests unitarios y e2e que lo usan (`grep -rn -i stakeholder lib components app tests`).

  Tras este paso, `npx tsc --noEmit` y `npm test` pasan.

**Checkpoint**: la base ya tiene el esquema nuevo, las acciones usan `getActor()` y `logActivity`, y el stakeholder desapareció. Las historias pueden empezar.

---

## Phase 3: [F11-US1] Asignar un Work Item a un miembro del proyecto (Priority: P1) 🎯 MVP

**Goal**: el campo Asignado, un miembro del proyecto, se edita desde el detalle, se ve en la tarjeta, la Lista y la Tabla, se filtra, notifica a la persona asignada y se desasigna al salir del proyecto.

**Independent Test**: quickstart.md § 1.

### Tests

- [ ] T012 [P] [F11-US1] En `tests/unit/work-items.test.ts`, casos de `updateWorkItem` con `assigneeUserId`:
  - Asignar a un miembro escribe el campo y registra `assignee_changed` con `{ from, to }` y nombres.
  - Asignar a un no miembro responde `NOT_A_MEMBER` sin cambios.
  - `null` desasigna y no notifica.
  - Asignar a otra persona inserta la notificación `work_item_assigned`.
  - Asignarse a uno mismo no notifica.
  - Un error `23503` de la FK se traduce a `NOT_A_MEMBER`.
- [ ] T013 [P] [F11-US1] En `tests/unit/work-item-view.test.ts`:
  - Filtro `assignee` (userId, `none` y `me`) combinado con otros filtros, y su lectura y escritura en la URL.
  - Orden por `assignee` (por nombre, vacíos al final).
- [ ] T014 [P] [F11-US1] Tests de salida de un miembro en `tests/unit/projects.test.ts`: `removeMember` y `leaveProject` registran `assignee_changed` con `reason: "member_left"` por cada Work Item asignado antes de borrar la membresía, todo en una transacción, y no notifican.

### Implementation

- [ ] T015 [F11-US1] Crear `lib/work-item-assignee.ts` (solo servidor):
  - `setAssigneeWithinTx(tx, { workItem, project, assigneeUserId })`:
    1. Si el valor no cambia, no hace nada.
    2. Verifica que el nuevo asignado sea miembro del proyecto (`project_members`). Si no, `NOT_A_MEMBER`.
    3. Hace el `UPDATE`.
    4. Llama `logActivity(…, "assignee_changed", { from: {userId,name}|null, to: {userId,name}|null })`.
    5. Si `to` no es null y es distinto de `getActor().userId`, inserta en `notifications` con `type: "work_item_assigned"` y payload `{ workItemId, projectId, assignedByUserId, agentName }`.
  - `unassignOnMemberExitWithinTx(tx, { projectId, userId })`: para cada Work Item asignado a esa persona, registra `assignee_changed` con `to: null, reason: "member_left"`. La FK hace el resto al borrar la membresía.
  - Exportar `translateAssigneeFkError(error)`: el código `23503` con el constraint `work_items_assignee_member_fk` pasa a `AppError("NOT_A_MEMBER")`.
- [ ] T016 [F11-US1] Modificar `updateWorkItem` en `lib/actions/work-items.ts`:
  - Nuevo input `assigneeUserId?: string | null` (`undefined` no toca, `null` desasigna).
  - Llama `setAssigneeWithinTx` dentro de la transacción existente.
  - Actualiza `updatedAt` si cambió.
  - Traduce el error de FK.
- [ ] T017 [F11-US1] Modificar `removeMember` y `leaveProject` en `lib/actions/projects.ts`: envolver cada una en `db.transaction` y llamar `unassignOnMemberExitWithinTx` antes del `DELETE` de `project_members`.
- [ ] T018 [F11-US1] Lecturas con asignado:
  - `getBoard` (`lib/actions/board.ts`), `getWorkItemsView` (`lib/actions/work-item-views.ts`) y `getWorkItemDetailData` (`lib/actions/work-item-relationships.ts`) devuelven `assignee: { userId, name, image } | null`, con `LEFT JOIN user` sobre `work_items.assignee_user_id`.
  - `getWorkItemDetailData` devuelve además `members: { userId, name, image }[]` del proyecto, para el desplegable.
  - `getWorkItemsView` devuelve `members` para el filtro y `currentUserId` para "me".
- [ ] T019 [P] [F11-US1] Crear `components/ui/avatar.tsx`: foto (`user.image`) o iniciales, tamaños `sm` y `md`, con `title` y `aria-label` con el nombre.
- [ ] T020 [F11-US1] Crear `components/work-items/AssigneePicker.tsx`:
  - Selector accesible con la opción "Unassigned" y los miembros (avatar + nombre).
  - Controlado (`value`, `onChange`) y deshabilitado si no se puede editar.
- [ ] T021 [F11-US1] Modificar `components/work-items/WorkItemDetailView.tsx`:
  - Campo **Assignee** (`AssigneePicker` si `canEdit`; si no, avatar + nombre o "Unassigned"). Se guarda con el mismo Save: envía `assigneeUserId` solo si cambió.
  - `describeActivity` soporta `assignee_changed` ("Assigned to X", "Unassigned", "Unassigned (X left the project)") y `created`.
  - Cada evento del historial muestra "by *actorName*" y "via *agentName*" cuando existen. `listWorkItemActivity` o `getWorkItemDetailData` resuelve `actorName` con un `LEFT JOIN user`.
- [ ] T022 [P] [F11-US1] Modificar `components/board/WorkItemCard.tsx` (y el tipo que recibe desde `Board.tsx` / `StageColumn.tsx`): avatar `sm` del asignado. El `aria-label` agrega ", assigned to X".
- [ ] T023 [F11-US1] Modificar `lib/work-item-view.ts`, `components/views/ViewFilters.tsx`, `components/views/WorkItemsTable.tsx` y `components/views/WorkItemsList.tsx`:
  - Filtro `assignee` multivalor (`assignee=<userId>`, `none`, `me`).
  - Columna "Assignee" ordenable.
  - Avatar en las filas de la Lista.
  - Las páginas `app/(workspace)/projects/[projectPublicId]/{list,table}/page.tsx` pasan lo necesario.
- [ ] T024 [F11-US1] Notificaciones en `lib/actions/accounts-invitations.ts`:
  - `listMyNotifications` devuelve la unión `NotificationItem` de contracts/app-changes.md: invitaciones como hoy, y `work_item_assigned` resueltas con `LEFT JOIN` a `work_items`/`projects` y la membresía actual del destinatario. Si falta alguna, `available: false`.
  - Nueva `markNotificationRead(id)`: solo notificaciones propias, idempotente.
- [ ] T025 [F11-US1] Modificar `components/sidebar/NotificationsPanelClient.tsx`:
  - Renderiza ambos tipos. Asignación: "*X* assigned you *KAN-12 Título* in *Proyecto*" (+ "via *Agente*"). Al hacer clic, `markNotificationRead` y después `router.push` al detalle.
  - Botón "Mark as read".
  - Con `available: false`: "This Work Item is no longer available".
- [ ] T026 [F11-US1] Registrar `markNotificationRead` en `tests/unit/action-permissions.test.ts` como acción de cuenta. Ajustar el mock si hace falta.
- [ ] T027 [F11-US1] E2E `tests/e2e/assignee.spec.ts` (quickstart § 1):
  - Asignar a otro miembro.
  - Avatar en la tarjeta.
  - Filtro "Assigned to me" en la Tabla.
  - La notificación aparece para el asignado y lleva al detalle.
  - El Lector ve el asignado pero no el selector.
  - Remover al miembro desasigna, con el historial "left the project".

**Checkpoint**: la Historia 1 funciona sola. Es una mejora útil aunque no exista el agente.

---

## Phase 4: [F11-US2] Conectar un agente de IA a la cuenta (Priority: P1)

**Goal**: un cliente MCP inicia OAuth, el usuario inicia sesión y consiente, y el cliente obtiene acceso a `/api/mcp`, verificado en cada petición.

**Independent Test**: quickstart.md § 2.

### Tests

- [ ] T028 [P] [F11-US2] `tests/unit/mcp-route.test.ts`, que prueba el handler exportado por `app/api/mcp/route.ts` con `@/lib/auth` y `@/db/client` mockeados:
  - Sin `Authorization`: 401 con header `WWW-Authenticate`.
  - Claims válidos pero sin `oauth_consent`: 401.
  - Claims válidos con consentimiento: `tools/list` responde con la lista exacta de nombres del contrato.

  Para no depender de JWKS, el test inyecta la función de verificación: la ruta exporta un `createMcpRoute({ verify })` que usa `requireMcpAuth` por defecto.

### Implementation

- [ ] T029 [F11-US2] Crear `lib/mcp/result.ts`:
  - `toToolResult(result: Result<T>, map?)`. Con `ok`, devuelve `content` de texto JSON + `structuredContent`. Con error, `isError: true` y `{ code, message }`.
  - `FORBIDDEN` → `NOT_FOUND` con el mensaje "Not found." (FR-021).
- [ ] T030 [F11-US2] Crear `lib/mcp/rate-limit.ts`: token bucket en memoria por `${userId}:${clientId}`, 120 por minuto y ráfagas de 30, con limpieza perezosa de entradas viejas. `consume(key)` devuelve `{ ok: true }` o `{ ok: false, retryAfterSeconds }`.
- [ ] T031 [F11-US2] Crear `lib/mcp/server.ts`:
  - `createKanbanMcpHandler()`, que llama a `createMcpHandler(factory, { legacy: "stateless" })`.
  - El factory crea `new McpServer({ name: "kanban", version }, { instructions })`. Las `instructions` explican los identificadores: `projectId`, `columnId`, `workItemId` `PREFIX-N` y `memberId` (contracts/mcp-tools.md § Identificadores).
  - Registra las herramientas de `lib/mcp/tools/*`.
  - Cada herramienta pasa por un wrapper `defineTool(server, name, config, handler)` que aplica el rate limit con el actor de `getActor()` y captura `AppError`.
- [ ] T032 [F11-US2] Crear `app/api/mcp/route.ts`, que exporta solo `POST`:
  - `requireMcpAuth(auth, handler, { resource: MCP_RESOURCE })`.
  - En `handler(request, claims)`:
    1. `userId = claims.sub` y `clientId = claims.azp ?? claims.client_id`.
    2. Verifica en la base de datos que existe `oauth_consent` para el par y que existe el usuario. Si no, 401 con el mismo formato de desafío.
    3. Lee el nombre de `oauth_client`.
    4. `touchAgentLastUsed` (upsert en `agent_last_used`, como máximo una vez por minuto por par, con caché en memoria).
    5. `runAsAgent({ userId, agent: { clientId, name } }, () => handler.fetch(request))`.
  - Exporta además `createMcpRoute` para los tests.
- [ ] T033 [F11-US2] Rutas de descubrimiento, si la verificación de T002 muestra que hacen falta en la raíz:
  - `app/.well-known/oauth-authorization-server/[[...path]]/route.ts`, con `oauthProviderAuthServerMetadata(auth)`.
  - `app/.well-known/oauth-protected-resource/[[...path]]/route.ts`, con los metadatos RFC 9728 de `MCP_RESOURCE`: el helper del plugin o `auth.api` equivalente.

  Verificar con `curl` que responden JSON.
- [ ] T034 [F11-US2] Crear la pantalla de consentimiento `app/(auth)/consent/page.tsx` (Server Component) + `components/auth/ConsentForm.tsx` (cliente):
  - Exige sesión (sin sesión, redirige a `/sign-in` conservando la query).
  - Lee `client_id` de la query y busca el cliente (nombre, URI).
  - Muestra el texto de FR-016: acceso completo con tus permisos, incluye eliminar Work Items y columnas, no incluye administrar miembros ni proyectos.
  - Botones **Allow** y **Deny** con el mismo peso visual, que llaman `authClient.oauth2.consent({ accept })` y siguen la `redirect`/`url` devuelta.
- [ ] T035 [F11-US2] `lib/auth-client.ts`: agregar `oauthProviderClient()`, de `@better-auth/oauth-provider/client` o el export equivalente de `@better-auth/mcp`. Confirmar que `/sign-in` (email y Google) reanuda `/oauth2/authorize` tras iniciar sesión: si el plugin no lo hace solo, pasar `callbackURL` con la query firmada.
- [ ] T036 [F11-US2] Verificación manual local de quickstart § 2, pasos 5-6: `curl` sin token → 401 + `WWW-Authenticate`, y metadatos `.well-known` accesibles. Registrar en research.md qué rutas se usaron.

**Checkpoint**: un cliente MCP se autentica y ve la lista de herramientas.

---

## Phase 5: [F11-US3] El agente consulta proyectos y verifica lo que ya existe (Priority: P1)

**Goal**: herramientas de lectura `list_projects`, `get_board`, `search_work_items`, `get_work_item` y `list_members`.

**Independent Test**: quickstart.md § 3.

### Tests

- [ ] T037 [P] [F11-US3] `tests/unit/mcp-search.test.ts` para `lib/mcp/search.ts` (puro):
  - Texto en título y descripción, sin distinguir mayúsculas.
  - Filtro de asignado (`memberId`, `unassigned`, `me`), columna y estado.
  - Combinación con AND.
  - `limit` por defecto 100 y máximo 500.
  - `offset`, `total` y `nextOffset` (null al final).
- [ ] T038 [P] [F11-US3] `tests/unit/mcp-resolve.test.ts` para `lib/mcp/resolve.ts`:
  - `parseDisplayId("KAN-12")` → `{ prefix, number }`; formatos inválidos → `VALIDATION_ERROR`.
  - Un prefijo que no es el del proyecto → `NOT_FOUND`.
  - Un número inexistente → `NOT_FOUND`.
  - Un `columnId` de otro proyecto → `NOT_FOUND`.

### Implementation

- [ ] T039 [F11-US3] Crear `lib/mcp/resolve.ts`:
  - `resolveWorkItem(projectId, displayId)`: primero `requireProjectMember`, después busca por `(project.id, displayNumber)` y compara el prefijo. Devuelve el `workItem` interno.
  - `resolveColumn(projectId, columnId)`.
  - `parseDisplayId`.
- [ ] T040 [F11-US3] Crear `lib/mcp/search.ts` (puro): `searchRows(rows, { text, assigneeIds, columnIds, state, currentUserId, limit, offset })`.
- [ ] T041 [F11-US3] Crear `lib/mcp/tools/read.ts` con las cinco herramientas de contracts/mcp-tools.md § Lectura, todas con `readOnlyHint: true` y `openWorldHint: false`:
  - `list_projects`: usa `listMyProjects` y aplana a `{ projectId, name, prefix, kind, role, memberCount }`. El rol se obtiene con una consulta de `project_members` del actor.
  - `get_board`: usa `getBoard` + `getWorkItemsView`, para tener tags, asignado y estado de cierre.
  - `search_work_items`: usa `getWorkItemsView` + `searchRows`.
  - `get_work_item`: usa `resolveWorkItem` + `getWorkItemDetailData` + `listWorkItemActivity`, y resume cada evento en una línea legible.
  - `list_members`: usa `listProjectMembers`. Solo incluye `email` si `can(role, "invitation:viewPending")`, que es la misma regla de visibilidad de datos de terceros de FR-018 de 007.

**Checkpoint**: el agente puede leer y buscar.

---

## Phase 6: [F11-US4] El agente crea, actualiza y organiza el trabajo (Priority: P1)

**Goal**: herramientas de escritura de Work Items y columnas, creación en bloque todo-o-nada y atribución al agente.

**Independent Test**: quickstart.md § 4.

### Tests

- [ ] T042 [P] [F11-US4] En `tests/unit/work-items.test.ts`, casos de `createWorkItems`:
  - 0 elementos o más de 50 → `VALIDATION_ERROR`.
  - Un elemento sin título → `BATCH_ITEM_INVALID` con su índice, sin crear nada.
  - N válidos → N creados en orden, con números consecutivos (un solo `UPDATE … + N`).
  - Con asignado, registra `assignee_changed` y notifica.
  - Como agente, registra `created`.
  - `createWorkItem` sigue funcionando como un solo elemento.
- [ ] T043 [P] [F11-US4] `tests/unit/mcp-tools.test.ts`:
  - La lista exacta de las 17 herramientas registradas coincide con contracts/mcp-tools.md.
  - Ninguna contiene `invite`, `member_role`, `remove_member`, `transfer`, `delete_project`, `rename_project` ni `leave`.
  - Las anotaciones `readOnlyHint` y `destructiveHint` son correctas.

### Implementation

- [ ] T044 [F11-US4] Crear `lib/work-item-create.ts` (solo servidor): `createWorkItemsInStage(tx, { project, stage, items })`:
  1. Reserva N números con `UPDATE projects SET next_work_item_number = next_work_item_number + N RETURNING`.
  2. Bloquea la columna con `FOR SHARE`.
  3. Inserta en orden al final, con `nextClosedAt` y el evento `closed` si nace cerrado.
  4. Resuelve tags, área e iteración por nombre (reutilizar `resolveCatalogValue` y la resolución de tags).
  5. Aplica prioridad, severidad y fechas.
  6. Asigna con `setAssigneeWithinTx`.
  7. Registra `created` cuando `getActor().agent` existe.
- [ ] T045 [F11-US4] En `lib/actions/work-items.ts`:
  - Nueva Server Action `createWorkItems({ stagePublicId, items })` (contracts/app-changes.md): `requireProjectPermission("workItem:edit")`, validación previa con zod por elemento (título obligatorio, niveles, fechas y su orden) → `BATCH_ITEM_INVALID` con `index`, 1-50 elementos, y una transacción con `createWorkItemsInStage`.
  - `createWorkItem` delega en el mismo camino con un elemento, **sin cambiar su firma**.
  - Registrar `createWorkItems` como `workItem:edit` en `tests/unit/action-permissions.test.ts`.
- [ ] T046 [F11-US4] Crear `lib/mcp/tools/work-items.ts`: `create_work_items`, `update_work_item`, `move_work_item`, `set_parent`, `link_related` y `delete_work_item`, según contracts/mcp-tools.md § Escritura.
  - Cada una resuelve ids con `lib/mcp/resolve.ts` y llama a la Server Action: `createWorkItems`, `updateWorkItem`, `moveWorkItem`, `setWorkItemParent`/`removeWorkItemParent`, `linkRelatedWorkItems`/`unlinkRelatedWorkItems` y `deleteWorkItem`.
  - `move_work_item` sin `position` calcula el final de la columna destino.
  - `update_work_item` mapea `area`→`areaName`, `iteration`→`iterationName`, `tags`→`tagNames` y `assigneeId`→`assigneeUserId`.
  - `delete_work_item` lleva `destructiveHint: true`; las demás, `destructiveHint: false`.
- [ ] T047 [F11-US4] Crear `lib/mcp/tools/columns.ts`: `create_column`, `rename_column`, `reorder_columns`, `set_column_closing` y `delete_column`, llamando a `createStage`, `renameStage`, `reorderStages`, `setStageClosing` y `deleteStage`. `delete_column` lleva `destructiveHint: true`.
- [ ] T048 [F11-US4] Verificar que `revalidatePath` dentro de las Server Actions no falla cuando se llama desde el Route Handler MCP. Si falla, envolverlo en el helper `safeRevalidate` de `lib/`, que lo ignora fuera de un contexto de render.

**Checkpoint**: el agente hace todo lo que la spec permite, con los mismos resultados que la interfaz.

---

## Phase 7: [F11-US5] Ver y revocar los agentes conectados (Priority: P2)

**Goal**: sección "Connected agents" con lista, último uso y revocación inmediata.

**Independent Test**: quickstart.md § 5.

- [ ] T049 [F11-US5] Crear `lib/actions/agents.ts` (`"use server"`), según contracts/app-changes.md:
  - `listConnectedAgents()`: `oauth_consent` del usuario de la sesión, con `LEFT JOIN oauth_client` y `agent_last_used`.
  - `revokeAgent(clientId)`: en una transacción, borra el consentimiento, los tokens de refresco y de acceso del par, y `agent_last_used`, siempre filtrando por `user_id` de la sesión.

  Registrarlas en `tests/unit/action-permissions.test.ts` como acciones de cuenta.
- [ ] T050 [P] [F11-US5] Crear `components/settings/ConnectedAgentsList.tsx` (cliente):
  - Lista con nombre, "Authorized on" y "Last used" con `LocalDate`.
  - Botón **Revoke** con diálogo de confirmación que llama `revokeAgent` y después `router.refresh()`.
  - Estado vacío con la dirección de conexión (`MCP_RESOURCE`), un botón para copiarla y el comando de ejemplo para Claude Code.
- [ ] T051 [F11-US5] Crear `app/(workspace)/settings/agents/page.tsx`, que usa `listConnectedAgents`, y agregar el enlace "Connected agents" en la barra lateral (`components/sidebar/ProjectSidebarClient.tsx`, zona de cuenta).
- [ ] T052 [F11-US5] E2E `tests/e2e/connected-agents.spec.ts`:
  - Sembrar por SQL un `oauth_client` y un `oauth_consent` para el usuario de prueba.
  - La página lo lista.
  - Revocar lo quita, y la fila de `oauth_consent` ya no existe.
  - Estado vacío con la dirección.

  Actualizar `tests/e2e/setup.ts` para truncar las tablas `oauth_*` (excepto `jwks`) y `agent_last_used`.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T053 [P] Actualizar `README.md`:
  - § Project Status: 011 implementado.
  - § Roadmap: Fase 4 → agentes de IA y asignado.
  - Nueva sección **Connecting an AI agent (MCP)**: dirección `https://<instancia>/api/mcp`, comando de Claude Code y qué puede y qué no puede hacer el agente.
  - § Self-hosting: la migración `0005` requiere Postgres ≥15, y para borrar una cuenta a mano primero se borran sus membresías.
- [ ] T054 [P] Actualizar `AGENTS.md` § Current state: 011 implementado, `lib/actor.ts` + `lib/activity.ts` (regla: toda actividad pasa por `logActivity`; `runAsAgent` solo en `app/api/mcp/route.ts`), `lib/mcp/` y la regla de que las herramientas MCP solo llaman Server Actions.
- [ ] T055 Actualizar `app/(legal)/privacy/page.tsx`, si corresponde: la instancia guarda autorizaciones de agentes y quién hizo cada cambio.
- [ ] T056 Correr `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run test:e2e` (base `dev`, desechable). Corregir lo que falle.
- [ ] T057 Validación manual de principio a fin con un cliente MCP real (quickstart.md § 2-7), en local y en Render tras el deploy.

---

## Dependencies & Execution Order

- **Setup (T001-T002)** → **Foundational (T003-T011)**, que bloquea todo lo demás.
  - T005 depende de T003.
  - T008 depende de T006 y T007.
  - T009 depende de T003 y T006.
  - T011 depende de T006.
- **[F11-US1] (T012-T027)** depende solo de Foundational. Es el MVP.
- **[F11-US2] (T028-T036)** depende de Foundational.
- **[F11-US3] (T037-T041)** depende de US2 (servidor y ruta MCP) y de T018 (asignado en las lecturas).
- **[F11-US4] (T042-T048)** depende de US2, de US3 (`resolve.ts`) y de T015 (`setAssigneeWithinTx`).
- **[F11-US5] (T049-T052)** depende de T008 (tablas OAuth) y T032 (`agent_last_used`). Puede ir en paralelo con US3 y US4.
- **Polish (T053-T057)** va al final.

## Parallel Execution Examples

- Foundational: T004 y T010 (tests) en paralelo con T006.
- [F11-US1]: T012, T013 y T014 (tests) juntos. T019 (avatar) y T022 (tarjeta) en paralelo con T015-T018.
- [F11-US3]: T037 y T038 juntos, antes de T039-T041.
- [F11-US4]: T042 y T043 juntos. T046 y T047 en paralelo tras T044-T045.
- [F11-US5]: T050 en paralelo con T049.
- Polish: T053, T054 y T055 en paralelo.

## Implementation Strategy

### MVP First

Phase 1 + Phase 2 + [F11-US1]: el asignado con notificaciones ya entrega valor a la interfaz sin agentes.

### Incremental Delivery

1. [F11-US2] + [F11-US3]: agente de solo lectura.
2. [F11-US4]: agente de escritura.
3. [F11-US5]: gestión de agentes.

### Orden de despliegue

La migración `0005` elimina `stakeholder`. Hay que aplicarla en producción
**inmediatamente antes** del deploy del código de esta rama (data-model.md §
Migración 0005).
