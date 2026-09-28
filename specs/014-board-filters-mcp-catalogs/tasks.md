# Tasks: Filtros del Tablero y Catálogos por MCP

**Input**: Design documents from `specs/014-board-filters-mcp-catalogs/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/board-filters-mcp-catalogs.md](contracts/board-filters-mcp-catalogs.md), [quickstart.md](quickstart.md)

**Tests**: incluidos — la convención del repo (plan.md § Testing) es cubrir cada regla pura y cada herramienta MCP con Vitest y cada historia de UI con Playwright.

**Organization**: por historia de usuario. Orden de prioridad: US1 (P1), US4 (P1), US2 (P2), US3 (P2), US5 (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (otro archivo, sin dependencias pendientes)
- **[Story]**: historia de spec.md (US1…US5)

---

## Phase 1: Setup

- [x] T001 Leer en `node_modules/next/dist/docs/` la guía de `useSearchParams` y la sección "Native History API" de `01-getting-started/04-linking-and-navigating.md` (AGENTS.md: esta versión de Next.js difiere); no produce archivos, solo confirma que `window.history.replaceState` sigue sincronizando `useSearchParams` y si `useSearchParams` exige `<Suspense>` en `app/(workspace)/projects/[projectPublicId]/page.tsx`

---

## Phase 2: Foundational (bloquea US1, US2 y US3)

- [x] T002 En `lib/work-item-view.ts` (módulo puro), extraer de `filterWorkItems` el predicado exportado `matchesAssigneeAndTags(item: { assigneeUserId: string | null; tagNames: string[] }, query: Pick<ViewQuery, "assignees" | "tags">, currentUserId: string | null): boolean` con las reglas actuales (O dentro de un filtro, Y entre ambos, tags sin distinguir mayúsculas, `none` = sin tags / sin asignado, `me` = `currentUserId`), y hacer que `filterWorkItems` lo use para esos dos filtros sin cambiar su comportamiento
- [x] T003 En `lib/work-item-view.ts`, ampliar `serializeViewQuery(query, view)` a `view: "list" | "table" | "board"`; con `"board"` solo escribe `assignee` y `tag` (research.md § El filtro vive en la URL). Exportar `BOARD_QUERY_KEYS = ["assignee", "tag"] as const`
- [x] T004 [P] Tests de tabla en `tests/unit/work-item-view.test.ts`: `matchesAssigneeAndTags` (dos asignados → O; asignado + tag → Y; `me` con y sin `currentUserId`; `none` en ambos; "ui" coincide con "UI"; filtros vacíos → true) y que `filterWorkItems` da el mismo resultado que antes para asignado y tags; `serializeViewQuery(…, "board")` omite `priority`, `status`, `q`, `sort`
- [x] T005 En `components/views/useViewQuery.ts`, aceptar `view: "list" | "table" | "board"` (depende de T003)
- [x] T006 En `lib/actions/board.ts`, `getBoard` devuelve además `currentUserId: string` (de `actor.userId` de `requireProjectMember`), `members: AssigneeView[]` (miembros actuales del proyecto, orden por nombre, misma consulta que usa `getWorkItemsView` en `lib/actions/work-item-views.ts`) y `tagCatalog: { name: string; color: TagColor }[]` vía `listTagCatalog(project.id)` (orden `(position, id)`); las lecturas nuevas en `Promise.all`
- [x] T007 [P] En `tests/unit/board.test.ts`, cubrir los tres campos nuevos de `getBoard` (catálogo en orden manual, no alfabético; `currentUserId` del actor)

**Checkpoint**: reglas y datos listos; la UI del tablero puede empezar.

---

## Phase 3: User Story 1 — Filtrar el tablero por asignado y por tags (P1) 🎯 MVP

**Goal**: filtros Assignee y Tags en el tablero, con columnas siempre visibles y contadores `visibles/total`.

**Independent Test**: quickstart.md § 2.

- [x] T008 [US1] En `components/views/ViewFilters.tsx`, exportar `MultiSelectFilter`, el tipo `Choice` y un helper `assigneeChoices(members)` (`Assigned to me`, cada miembro, `Unassigned`) que `ViewFilters` pasa a usar, sin cambiar su comportamiento
- [x] T009 [US1] Crear `components/board/BoardFilters.tsx` ("use client"): barra sobre las columnas con `MultiSelectFilter` "Assignee" (`assigneeChoices`) y "Tags" (tags de `tagCatalog` con su `color`, en su orden, más `{ value: NONE, label: "None" }`), etiquetas de filtros activos removibles (mismo estilo que `ViewFilters`; un valor desconocido se muestra con su texto crudo) y botón "Clear filters" si hay alguno; recibe `query`, `onChange`, `members`, `tagCatalog`; `data-testid="board-filters"`; textos en inglés (FR-001, FR-002, FR-003, FR-006, FR-025)
- [x] T010 [US1] En `components/board/Board.tsx`: nuevas props `currentUserId`, `members`, `tagCatalog`; leer la query con `useViewQuery("board", new Set())` (memoizado); calcular con `useMemo` las tarjetas visibles con `matchesAssigneeAndTags({ assigneeUserId: wi.assignee?.userId ?? null, tagNames: wi.tags.map(t => t.name) }, query, currentUserId)`; renderizar `<BoardFilters>` arriba (también para Viewer, FR-007); pasar a cada `StageColumn` las visibles de la columna y `totalCount`; si hay filtros y ninguna tarjeta visible en todo el tablero, mostrar un aviso con "Clear filters" (Edge Cases)
- [x] T011 [US1] En `components/board/StageColumn.tsx`: prop `totalCount?: number` y `filtersActive: boolean`; con filtros activos el contador muestra `{visibles}/{total}` (con `aria-label` "N of M Work Items shown"); si no queda ninguna visible pero `totalCount > 0`, mostrar "Hidden by filters" en lugar del estado vacío (FR-005, FR-006)
- [x] T012 [US1] En `app/(workspace)/projects/[projectPublicId]/page.tsx`: pasar `currentUserId`, `members` y `tagCatalog` de `getBoard` al `Board` y envolverlo en `<Suspense fallback={<BoardSkeleton />}>` (usa `useSearchParams`, según T001)
- [x] T013 [US1] Crear `tests/e2e/board-filters.spec.ts` con quickstart.md § 2: opciones de ambos filtros (colores en orden de catálogo, "None", "Assigned to me", "Unassigned"), O dentro y Y entre filtros, contador `visibles/total`, "Hidden by filters", quitar etiqueta y "Clear filters", Viewer puede filtrar (reusar helpers de `tests/e2e/helpers.ts`)

**Checkpoint**: US1 usable sola (sin persistencia más allá de la URL de la pestaña).

---

## Phase 4: User Story 4 — Un agente de IA conoce y reutiliza los catálogos (P1)

**Goal**: `list_catalogs`, tags `{ name, color }` y `set_tag_color`.

**Independent Test**: quickstart.md § 5, pasos 1 a 5 y 7.

- [x] T014 [P] [US4] En `lib/actions/work-items.ts`: agregar a `workItemFieldsSchema` y `WorkItemFieldsInput` el campo opcional `newTagColors: Record<string, TagColor>` (`z.record(z.string(), z.enum(TAG_COLORS))`), con claves normalizadas a minúsculas y recortadas; en el bloque de tags de `applyWorkItemFields`, pasar `{ create: createMissing, color: newTagColors?.[name.toLowerCase()] }` a `resolveCatalogValue` — el color solo se usa si la tag se crea (`resolveCatalogValue` devuelve la existente sin tocarla) (research.md § Color al crear tags)
- [x] T015 [P] [US4] En `lib/work-item-catalogs.ts` (servidor, no `"use server"`), agregar `listWorkItemTags(projectId: number, workItemIds: number[]): Promise<Map<number, { name: string; color: TagColor }[]>>`: una sola consulta `work_item_tags ⋈ tags` filtrada por `tags.project_id = projectId` y `workItemId IN (…)`, ordenada por nombre como `getBoard`; con lista vacía no consulta
- [x] T016 [US4] En `lib/mcp/tools/work-items.ts`: `tags` pasa a `z.array(z.union([z.string().min(1), z.strictObject({ name: z.string().min(1), color: z.enum(TAG_COLORS) })]))` con descripción que explique que el color solo aplica a tags nuevas y apunte a `list_catalogs`/`set_tag_color`; `toActionFields` produce `tagNames` y `newTagColors` (primer color gana si el nombre se repite, sin distinguir mayúsculas); `create_work_items` devuelve `created: [{ workItemId, title, tags }]` y `update_work_item` `{ workItemId, title, tags }` usando `listWorkItemTags` (FR-016, FR-017; depende de T014, T015)
- [x] T017 [US4] Crear `lib/mcp/tools/catalogs.ts` con `registerCatalogTools(server)`: `list_catalogs` (READ_ONLY; entrada `z.strictObject({ projectId })`; llama `getProjectCatalogs`; salida `{ tags: [{ name, color, workItemCount }], areas: [{ name, workItemCount }], sizes: [{ name, workItemCount }], colors: TAG_COLORS }`) y `set_tag_color` (anotaciones `{ ...WRITE, idempotentHint: true }`; entrada `z.strictObject({ projectId, tag: z.string().min(1), color: z.enum(TAG_COLORS) })` con descripción que liste la paleta; llama `setTagColor`, luego lee el nombre con la escritura del catálogo con `findCatalogValue` y devuelve `{ name, color }`); ninguna escribe con `db` (FR-015, FR-018, FR-019)
- [x] T018 [US4] En `lib/mcp/server.ts`, registrar `registerCatalogTools` y sumar a `MCP_SERVER_INSTRUCTIONS`: "Before assigning tags, areas or sizes, call list_catalogs and reuse existing values instead of creating variants." (FR-023)
- [x] T019 [P] [US4] En `tests/unit/work-items.test.ts`: `newTagColors` crea la tag con ese color; una tag existente con otro color conserva el suyo; un color fuera de la paleta → `VALIDATION_ERROR` sin escribir nada
- [x] T020 [US4] Crear `tests/unit/mcp-catalogs.test.ts` (mismo patrón de mocks que `tests/unit/mcp-route.test.ts`): `list_catalogs` en orden manual y para un Viewer; `set_tag_color` llama a `setTagColor`, `NOT_FOUND` con tag inexistente, `ROLE_NOT_PERMITTED` con Viewer, color inválido rechazado; create/update con `{ name, color }` pasan `newTagColors` correctos (primer color gana) y devuelven `tags`
- [x] T021 [US4] En `tests/unit/mcp-route.test.ts`, agregar `list_catalogs` y `set_tag_color` a `EXPECTED_TOOLS` (18) y sus anotaciones esperadas

**Checkpoint**: un agente reconectado ve y usa los catálogos.

---

## Phase 5: User Story 2 — Filtros que se conservan y se comparten (P2)

**Goal**: la URL y el cambio de vista conservan asignado y tags; volver del detalle también.

**Independent Test**: quickstart.md § 3.

- [x] T022 [US2] En `components/views/ProjectViewHeader.tsx`, `hrefFor`: de List/Table a Board conservar solo `BOARD_QUERY_KEYS`; de Board a List/Table pasar los parámetros actuales del tablero (hoy se descartan) (FR-010)
- [x] T023 [US2] En `components/board/Board.tsx`, guardar la query serializada del tablero en `sessionStorage["kanban:board-query:{projectPublicId}"]` cada vez que cambia (también al abrir un enlace filtrado) y borrarla si queda vacía; todo acceso en `try/catch` (research.md § Volver del detalle)
- [x] T024 [US2] En `components/work-items/WorkItemDetailView.tsx`, el enlace "← Back to board" y el `router.push` tras eliminar usan `/projects/{id}` más la query guardada (leída en un `useEffect` tras montar para no romper la hidratación; en `try/catch`)
- [x] T025 [US2] Ampliar `tests/e2e/board-filters.spec.ts` con quickstart.md § 3: recargar conserva, "Back to board" conserva, Board → Table → Board conserva tag y descarta `priority`, `?tag=NoExiste` no falla y se puede quitar

---

## Phase 6: User Story 3 — Trabajar en el tablero con un filtro activo (P2)

**Goal**: mover, reordenar y crear con tarjetas ocultas sin desordenarlas.

**Independent Test**: quickstart.md § 4.

- [x] T026 [US3] En `components/board/Board.tsx`, `reorderWorkItemByStep` busca la vecina entre las tarjetas **visibles** de la columna y reordena sobre la lista completa con `handleWorkItemReorder` (FR-013); `canMoveUp/canMoveDown` de `StageColumn` quedan calculados sobre las visibles; verificar que arrastrar sobre una tarjeta visible y a otra columna siguen usando la lista completa (research.md § Mover y reordenar con tarjetas ocultas)
- [x] T027 [US3] En `components/board/AddWorkItemButton.tsx`, prop opcional `isHiddenByFilters?: (item: { assigneeUserId: null; tagNames: [] }) => boolean`; tras crear, si devuelve `true`, `toast("{displayId} was created but is hidden by the active filters.")` no destructivo; `Board`/`StageColumn` se la pasan con `matchesAssigneeAndTags` negado (FR-014)
- [x] T028 [US3] Ampliar `tests/e2e/board-filters.spec.ts` con quickstart.md § 4: con filtro activo, reordenar por teclado entre visibles y comprobar al quitar el filtro que las ocultas conservan su orden relativo (SC-004); crear un Work Item oculto muestra el aviso

---

## Phase 7: User Story 5 — Errores claros ante campos desconocidos (P2)

**Goal**: toda herramienta rechaza campos desconocidos nombrándolos.

**Independent Test**: quickstart.md § 5, paso 6.

- [x] T029 [P] [US5] En `lib/mcp/tools/read.ts`, `lib/mcp/tools/columns.ts` y `lib/mcp/tools/work-items.ts`, reemplazar todo `z.object(` de entradas (raíz y anidados, incluido `z.object({})` de `list_projects` y los elementos de `create_work_items`) por `z.strictObject(` (FR-021)
- [x] T030 [US5] En `tests/unit/mcp-route.test.ts`: (1) recorrer recursivamente el `inputSchema` de cada herramienta de `tools/list` y exigir `additionalProperties: false` en todo nodo `type: "object"`; (2) `tools/call` de `update_work_item` con `"colour": "red"` → `isError: true`, texto que contiene `colour`, y la acción `updateWorkItem` no se llamó; (3) `create_work_items` con un campo extra en `items[0]` → el texto contiene `items.0` (FR-021, SC-006)

---

## Phase 8: Polish & Cross-Cutting

- [x] T031 [P] En `README.md`: § Features/Board mencionar los filtros por asignado y tags (en la URL, compartidos con List/Table); § AI agents (MCP) listar `list_catalogs` y `set_tag_color`, tags con color, entradas estrictas y la nota de que tras actualizar la instancia hay que reconectar el conector para ver herramientas nuevas; § Project Status con 014 (FR-024)
- [x] T032 [P] En `specs/011-agent-access-mcp/contracts/mcp-tools.md` § Excluidas a propósito, agregar una nota que remita a `specs/014-board-filters-mcp-catalogs/contracts/board-filters-mcp-catalogs.md` por `list_catalogs` y `set_tag_color`; y en `AGENTS.md` § Current state mencionar 014 en la lista de Phase 4
- [x] T033 Correr `npm run test`, `npx tsc --noEmit` y `npm run lint` y dejarlos en verde (no correr `prettier --write` sobre archivos existentes)
- [x] T034 Correr `npm run test:e2e` contra la rama Neon `dev` de `.env.local` (confirmar antes con el usuario: trunca todas las tablas) y dejarlo en verde — 2026-09-28: 70/71 verdes; la única falla (`work-item-discussion.spec.ts` › "owner saves an estimate…", el comentario no está tras `reload`) falla igual en `main` sin los cambios de 014: es previa
- [ ] T035 Pasada manual de quickstart.md completo, incluido § 5 con el conector MCP reconectado

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T007)** → historias.
- **US1 (T008–T013)** depende de T002, T003, T005, T006.
- **US4 (T014–T021)** no depende de la UI: puede ir en paralelo con US1 tras T001. T016 depende de T014 y T015; T017 y T018 van juntos; T020 y T021 después de T016–T018.
- **US2 (T022–T025)** depende de US1 (T010).
- **US3 (T026–T028)** depende de US1 (T010, T011).
- **US5 (T029–T030)** toca los mismos archivos de herramientas que US4: hacerlo después de T016–T017 (y T030 después de T021, mismo archivo de test).
- **Polish (T031–T035)** al final; T034 requiere confirmación del usuario.

## Parallel Execution Examples

- Foundational: T004 y T007 (tests) en paralelo una vez escritos T002/T003 y T006.
- US4 en paralelo con US1: T014, T015 y T019 a la vez; luego T016 → T017 → T018.
- Polish: T031 y T032 en paralelo.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 → el tablero ya se puede filtrar.
2. US4 → los agentes ven y colorean catálogos (independiente de la UI).
3. US2 y US3 → persistencia y trabajo cómodo con filtros.
4. US5 → entradas estrictas.
5. Polish, e2e y pasada manual; luego merge a `main` y deploy (sin migración: no hay que migrar producción antes del push).
