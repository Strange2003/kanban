---

description: "Task list for 009-work-item-views implementation"
---

# Tasks: Vistas de Lista y Tabla

**Input**: Design documents from `specs/009-work-item-views/`
(plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅,
quickstart.md ✅ (todos generados por `/speckit-plan`).

**Tests**: Se incluyen pruebas unitarias y e2e por historia, mismo criterio
que [008-work-item-fields/tasks.md](../008-work-item-fields/tasks.md). El
peso está en las unitarias del módulo puro `lib/work-item-view.ts` (orden,
filtros, árbol y dirección), que es donde un error pasaría desapercibido.

**Organization**: Tareas agrupadas por historia de usuario de
[spec.md](spec.md). US1 y US2 son P1; US3 es P2. Cada historia usa la
etiqueta `[F9-US<m>]` (`F9` = 009-work-item-views), siguiendo la convención
de [AGENTS.md](../../AGENTS.md#working-with-tasksmd).

**Nota sobre dependencia entre historias**: US1 (rutas y selector) deja las
dos páginas renderizando una versión mínima de cada vista: una fila por Work
Item con enlace al detalle. US2 convierte la de `/table` en la Tabla
completa y US3 convierte la de `/list` en el árbol. US2 y US3 son
independientes entre sí y comparten solo `ViewFilters.tsx`, que crea US2 y
reutiliza US3.

**Sin fase de Setup separada**: no hay dependencias, herramientas ni
migraciones nuevas (plan.md § Technical Context).

**Antes de escribir código Next.js**: [AGENTS.md](../../AGENTS.md) exige leer
la guía relevante de `node_modules/next/dist/docs/`. Para esta feature:
`01-app/01-getting-started/04-linking-and-navigating.md` § Native History API
(ya leída en el plan) y la referencia de `useSearchParams` en
`01-app/03-api-reference/04-functions/use-search-params.md`, en particular lo
que dice sobre Suspense y el renderizado dinámico.

**Base de datos**: los e2e vacían la base de `.env.local`. El product owner
confirmó el 2026-09-22 que es la base de pruebas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin
  dependencias de tareas incompletas).
- **[Story]**: `[F9-US<m>]` indica a qué historia de esta spec pertenece.
- Cada descripción incluye la ruta exacta de archivo.

## Path Conventions

Mismo monolito Next.js (plan.md § Project Structure). Las etiquetas de la
interfaz van en inglés, como el resto de la UI: Board / List / Table,
Status, Column, Priority, Severity, Area, Iteration, Tags, Stakeholder,
Start date, Target date, Created, Closed, Overdue only, Clear filters,
Expand all, Collapse all.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: El módulo puro de vista (tipos, dirección, filtros, orden y
árbol), la única lectura nueva y el hook que sincroniza la consulta con la
dirección.

**⚠️ CRITICAL**: ninguna historia de usuario puede empezar hasta completar
esta fase.

- [ ] T001 Crear `lib/work-item-view.ts` (módulo **puro**: sin imports de `db`, `next/*` ni `lib/auth`) con:
  - Los tipos `WorkItemViewRow`, `WorkItemViewOptions`, `ViewQuery`, `SortKey` y `WorkItemTreeNode`, exactamente como en data-model.md.
  - `DEFAULT_VIEW_QUERY` (`status: null`, listas vacías, `overdue: false`, `q: ""`, `sort: "id"`, `dir: "asc"`).
  - `parseViewQuery(params: URLSearchParams, validStagePublicIds: ReadonlySet<string>)`: reglas de data-model.md § Consulta de vista. Valores separados por coma; descarta sin error un `status`, `sort`, `dir`, nivel o columna desconocidos; deduplica; recorta `q`. Los niveles aceptan los de `WORK_ITEM_LEVELS` más `"none"`.
  - `serializeViewQuery(query, view)`: sin `?`; omite todo valor por defecto; con `view === "list"` omite `sort` y `dir`; orden de parámetros estable.
  - `hasActiveFilters(query)`: `true` si cualquier filtro difiere del valor por defecto, sin contar `sort`/`dir`.

  Cubre FR-007 y FR-009 (contracts/work-item-views.md § Módulo puro).
- [ ] T002 En `lib/work-item-view.ts`, agregar `filterWorkItems(rows, query, today)` según data-model.md § Semántica de filtros:
  - Distintos filtros se combinan con **Y** y los valores de un mismo filtro con **O**.
  - `"none"` coincide con un campo vacío, y para tags con `tags.length === 0`.
  - Área, iteración y tag se comparan sin distinguir mayúsculas.
  - `status` usa `isClosed`.
  - `overdue` usa `isOverdue` de `@/lib/work-item-fields`.
  - `q` busca en `title` y `displayId` sin distinguir mayúsculas.
  - Con `query.overdue && today === null` devuelve `[]` (research.md § "Vencido").

  Cubre FR-007 y FR-010.
- [ ] T003 En `lib/work-item-view.ts`, agregar `sortWorkItems(rows, sort, dir)`:
  - No muta la entrada.
  - `priority` y `severity` se ordenan por el índice en `WORK_ITEM_LEVELS`.
  - `stage` se ordena por `stagePosition`.
  - `status` va abiertos antes que cerrados en `asc`.
  - Las fechas `"YYYY-MM-DD"` se comparan como strings y los instantes por su valor.
  - Los textos (`title`, `area`, `iteration`, `stakeholder`) usan `localeCompare` con `sensitivity: "base"`.
  - `id` ordena por `displayNumber`.
  - **Los vacíos siempre al final en ambas direcciones.**
  - El desempate es siempre `displayNumber` ascendente.

  Cubre FR-006 y Edge Cases.
- [ ] T004 En `lib/work-item-view.ts`, agregar `buildWorkItemTree(rows, matchingIds)` según research.md § El árbol de la Lista y data-model.md § Nodo de árbol:
  - Son raíces los Work Items sin `parentId` o cuyo padre no está en `rows`.
  - Los hermanos se ordenan por `displayNumber` ascendente.
  - `childCount` cuenta los hijos directos en `rows` completo.
  - Con `matchingIds !== null`, se incluyen solo esos Work Items y todos sus ancestros; los ancestros que no están en el conjunto van con `isContext: true`.
  - Un conjunto de visitados corta ciclos.
  - Cada Work Item aparece como mucho una vez (SC-006).

  Cubre FR-012 y FR-015.
- [ ] T005 [P] Tests unitarios en `tests/unit/work-item-view.test.ts` para `parseViewQuery` y `serializeViewQuery`:
  - La ida y vuelta conserva la consulta.
  - Los defaults se omiten (`serializeViewQuery(DEFAULT_VIEW_QUERY, "table") === ""`).
  - `sort=bogus&dir=up&status=maybe&priority=urgent,high&stage=unknown,<valido>` conserva solo `priority=high` y el stage válido.
  - Los valores repetidos se deduplican.
  - `"list"` omite `sort`/`dir`.
  - Los nombres con espacios y comas se codifican y decodifican bien.
- [ ] T006 [P] Tests unitarios en `tests/unit/work-item-view.test.ts` para `filterWorkItems` y `sortWorkItems`:
  - Cada filtro por separado, incluido `"none"` para prioridad, área y tags.
  - Combinaciones con Y entre filtros y con O dentro de uno.
  - `q` por título y por displayId en minúsculas.
  - `overdue` con un `today` fijo, y `[]` con `today === null`.
  - Orden por prioridad `asc` (Critical…Low y luego vacíos) y `desc` (Low…Critical y luego vacíos, **vacíos siguen al final**).
  - `stage` por posición y no por nombre.
  - Desempate por `displayNumber`.
  - La entrada no se muta.
- [ ] T007 [P] Tests unitarios en `tests/unit/work-item-view.test.ts` para `buildWorkItemTree`:
  - Padre → dos hijos → nieto, más un suelto: forma y orden correctos.
  - Un huérfano cuyo padre no está en `rows` sale como raíz.
  - Con `matchingIds = {nieto}`: nieto con padre y abuelo `isContext: true`, sin hermanos ni suelto.
  - `childCount` refleja los hijos reales aunque el filtro oculte alguno.
  - Un ciclo artificial (A→B→A) no cuelga y cada nodo sale una vez.
  - Con 500 filas encadenadas, todas aparecen exactamente una vez (SC-006).
- [ ] T008 Crear `lib/actions/work-item-views.ts` (`"use server"`, **un solo export**) con `getWorkItemsView(projectPublicId)` según contracts/work-item-views.md:
  1. `requireProjectMember` primero.
  2. Una consulta de `work_items` con `innerJoin(stages)` y `leftJoin(areas)`/`leftJoin(iterations)`, `WHERE work_items.project_id = project.id`.
  3. Una consulta de tags: `work_item_tags ⋈ tags WHERE tags.project_id = project.id`, agrupados en memoria por Work Item y ordenados alfabéticamente.
  4. Las columnas del proyecto por `position` (`publicId`, `name`, `isClosing`).
  5. Los catálogos completos: `listCatalog("area" | "iteration")` de `@/lib/work-item-catalogs`, y los tags del proyecto por nombre.

  Devuelve `{ rows, options, role, totalCount }`. `displayId` es `<workItemPrefix>-<displayNumber>` e `isClosed` es `stages.isClosing`. No expone ids internos de columnas ni catálogos (FR-004, SC-004).
- [ ] T009 [P] Tests unitarios en `tests/unit/work-item-views-action.test.ts`, con el mismo patrón de fake `db` por tabla que `tests/unit/board.test.ts`:
  - Sin sesión → `UNAUTHENTICATED` sin consultas de Work Items.
  - Un no miembro → `FORBIDDEN`.
  - Un miembro recibe filas con `displayId`, `stageName`, `isClosed`, `areaName` y `tags` armados.
  - `totalCount === rows.length`.
- [ ] T010 Modificar `tests/unit/action-permissions.test.ts`:
  - Importar `* as workItemViewsModule from "@/lib/actions/work-item-views"`.
  - Agregarlo a la lista de módulos del test "every exported Server Action is classified".
  - Agregar `"getWorkItemsView"` a `MEMBERSHIP_ONLY_READS`.
- [ ] T011 [P] Crear `components/views/useViewQuery.ts` (hook cliente) que devuelve `[query, setQuery]`:
  - `query` sale de `parseViewQuery(useSearchParams(), validStagePublicIds)`, memoizado.
  - `setQuery(next)` escribe `window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`)` con `serializeViewQuery(next, view)`.

  Recibe `view` y `validStagePublicIds`. Sigue la guía § Native History API (research.md § Filtros y orden en la dirección).

**Checkpoint**: el módulo puro está probado, la lectura es segura y está
registrada en el barrido, y el hook de dirección está listo.

---

## Phase 2: [F9-US1] Cambiar entre tablero, lista y tabla (Priority: P1) 🎯 MVP

**Goal**: Un selector en la cabecera del proyecto lleva a `/list` y
`/table`, recargables y compartibles. Desde cualquier vista se abre el
detalle y "atrás" vuelve a la misma vista. Los no miembros reciben
"no encontrado".

**Independent Test**: quickstart.md bloques 1 y 5.

- [ ] T012 [P] [F9-US1] Crear `components/views/ProjectViewHeader.tsx` (cliente) según contracts § Componentes:
  - Props `projectPublicId`, `role`, `active`.
  - `<nav aria-label="Views">` con tres `Link`: `Board` → `/projects/<id>`, `List` → `/list`, `Table` → `/table`. El activo lleva `aria-current="page"` y estilo de pestaña activa.
  - Los enlaces a List y Table conservan la cadena de consulta actual (`useSearchParams`), sin `sort`/`dir` al ir a List.
  - `ReadOnlyNotice` cuando `!can(role, "board:edit")`.
  - El enlace a Ajustes, igual que hoy en `app/(workspace)/projects/[projectPublicId]/page.tsx` (`aria-label="Project settings"`).

  Cubre FR-001 y FR-002.
- [ ] T013 [F9-US1] Modificar `app/(workspace)/projects/[projectPublicId]/page.tsx`: reemplazar el bloque de cabecera (aviso de solo lectura + enlace a Ajustes) por `<ProjectViewHeader projectPublicId role active="board" />`. El `<Board>` no cambia.
- [ ] T014 [P] [F9-US1] Crear `components/views/ViewEmptyState.tsx`: mensaje "No Work Items yet." (o "This project has no columns yet.") con un enlace "Go to the board" a `/projects/<id>` (Edge Cases). Recibe `projectPublicId` y `reason: "no-items" | "no-columns"`.
- [ ] T015 [F9-US1] Crear `app/(workspace)/projects/[projectPublicId]/table/page.tsx` (Server Component):
  1. `await params`, luego `getWorkItemsView`.
  2. `NOT_FOUND`/`FORBIDDEN` → `notFound()`; otro error → `throw`, igual que la página del tablero (FR-004).
  3. Renderiza `<ProjectViewHeader active="table">` y, si no hay columnas o Work Items, `<ViewEmptyState>`.
  4. Si hay datos, renderiza `<WorkItemsTable rows options projectPublicId />`, envuelto en `<Suspense>` si la guía de `useSearchParams` lo exige.

  Crear `components/views/WorkItemsTable.tsx` en versión mínima: una `<table>` con ID y Title, donde el título es un `Link` a `/projects/<id>/work-items/<displayNumber>` (FR-003). Se completa en US2.
- [ ] T016 [F9-US1] Crear `app/(workspace)/projects/[projectPublicId]/list/page.tsx`, análoga a T015 con `active="list"` y `<WorkItemsList>`. Crear `components/views/WorkItemsList.tsx` en versión mínima: filas en orden por número, con enlace al detalle. Se completa en US3.
- [ ] T017 [F9-US1] Crear `tests/e2e/work-item-views.spec.ts` con quickstart.md bloques 1 y 5, reutilizando `tests/e2e/helpers.ts`:
  1. Desde el tablero, pasar a Table y a List con el selector (URL `/table` y `/list`, `aria-current` en el activo).
  2. Recargar y seguir en la misma vista.
  3. Abrir un Work Item desde la Tabla y volver con `page.goBack()` a `/table`.
  4. Una segunda cuenta sin membresía que abre `/table` y `/list` ve la página de no encontrado.

**Checkpoint**: se navega entre las tres vistas y todas llevan al detalle.

---

## Phase 3: [F9-US2] Tabla ordenable y filtrable (Priority: P1) 🎯 MVP

**Goal**: La Tabla completa: 14 columnas, orden por encabezado, filtros
combinados, contador, vencidos, búsqueda, estado en la dirección y solo
lectura.

**Independent Test**: quickstart.md bloques 2 y 4.

- [ ] T018 [P] [F9-US2] Crear `components/views/ViewFilters.tsx` (cliente) según contracts § Componentes. Props: `query`, `onChange(next: ViewQuery)`, `options`, `shownCount`, `totalCount`. Controles:
  - Búsqueda (`aria-label="Search Work Items"`, se aplica al escribir).
  - Status: All / Open / Closed.
  - Selección múltiple para Column, Priority, Severity, Area, Iteration y Tag. Cada una ofrece la opción `None` salvo Column, y todos los valores del catálogo aunque no se usen. Implementarlas como un popover con casillas y un botón con el nombre del filtro y el número de valores elegidos.
  - Casilla "Overdue only".
  - Texto "`shownCount` of `totalCount`".
  - Botón "Clear filters", visible con `hasActiveFilters(query)`.

  Cubre FR-007 y FR-008.
- [ ] T019 [F9-US2] Completar `components/views/WorkItemsTable.tsx`:
  - Columnas en el orden de FR-005: ID, Title, Column, Status, Priority, Severity, Area, Iteration, Tags, Stakeholder, Start date, Target date, Created, Closed.
  - Encabezados ordenables (todos menos Tags) como `<button>` dentro de `<th scope="col" aria-sort=...>`. El primer clic ordena `asc` y el segundo `desc`; al cambiar de columna vuelve a `asc`.
  - Estado desde `useViewQuery("table", …)` y `useLocalToday()`.
  - `useMemo` para `filterWorkItems` y luego `sortWorkItems`.
  - Celdas:
    - Priority usa `PriorityBadge`.
    - Target date usa `TargetDateChip`, con el mismo indicador de vencido que el tablero (FR-010).
    - Created y Closed usan `LocalDate`.
    - Start date usa `formatCalendarDate`.
    - Tags como chips.
    - Los vacíos como "—".
  - Con `overdue` activo y `today === null`, una fila de carga.
  - Con 0 resultados, un estado vacío "No Work Items match these filters." con "Clear filters".
  - Contenedor con scroll horizontal para pantallas angostas.
  - Sin ningún control de edición (FR-011).
- [ ] T020 [F9-US2] Agregar a `tests/e2e/work-item-views.spec.ts` los escenarios de quickstart.md bloques 2 y 4:
  1. Sembrar por UI un proyecto con prioridades, iteración "Sprint 12", un vencido y uno cerrado (con los helpers de 008: `selectOption` en Priority, Target date, columna de cierre).
  2. Orden por Priority `asc`/`desc` con los vacíos al final.
  3. Orden por Column según el orden del tablero.
  4. Filtros combinados y contador "N of M".
  5. Recargar conserva los filtros.
  6. "Overdue only" muestra solo el vencido.
  7. Búsqueda por displayId en minúsculas.
  8. Estado vacío y "Clear filters".
  9. Con filtros activos, abrir el detalle y volver con `goBack()` los conserva (SC-005).
  10. Una Lectora usa la Tabla y ve el aviso de solo lectura.

**Checkpoint**: la Tabla responde a las preguntas de la Fase 3 (qué es
crítico, qué está vencido, qué hay en una iteración).

---

## Phase 4: [F9-US3] Lista jerárquica (backlog) (Priority: P2)

**Goal**: El árbol padre/hijo de todo el proyecto, plegable, con los mismos
filtros y los ancestros de lo que coincide como contexto.

**Independent Test**: quickstart.md bloque 3.

- [ ] T021 [F9-US3] Completar `components/views/WorkItemsList.tsx`:
  - Estado desde `useViewQuery("list", …)` y `useLocalToday()`.
  - `<ViewFilters>`, el mismo de US2.
  - Con `hasActiveFilters`: `buildWorkItemTree(rows, new Set(filterWorkItems(...).map(r => r.id)))`. Sin filtros: `buildWorkItemTree(rows, null)`.
  - Render recursivo con `role="tree"` / `role="treeitem"`, `aria-level` y `aria-expanded` en los nodos con hijos, y sangría por nivel.
  - Cada fila: botón de plegado (`aria-label="Collapse <displayId>"` / `"Expand <displayId>"`) con `childCount` visible cuando está plegado, ID, título enlazado al detalle, nombre de la columna, `PriorityBadge` y `TargetDateChip`.
  - Los cerrados atenuados y con "Closed" (FR-013).
  - Los nodos `isContext` atenuados (FR-015).
  - Plegado en `useState<Set<number>>` (todo desplegado al cargar) y botones "Expand all" / "Collapse all" (FR-014).
  - Estado vacío con "Clear filters" cuando nada coincide.
  - Sin controles de edición (FR-016).
- [ ] T022 [F9-US3] Agregar a `tests/e2e/work-item-views.spec.ts` el escenario de quickstart.md bloque 3. Sembrar Epic → Child A → Grandchild, Epic → Child B y Loose, con las relaciones del detalle ("Convert into a child of…", `selectRelationOption` de los helpers). Comprobar:
  1. Anidación y orden.
  2. Plegar Epic oculta a sus descendientes y muestra "2".
  3. Expand/Collapse all.
  4. Buscar "Grandchild" muestra Grandchild con Child A y Epic atenuados, y no muestra Loose ni Child B.
  5. Pasar a Table conserva la búsqueda.

**Checkpoint**: las 3 historias están completas.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T023 [P] Pasada de accesibilidad y de pantalla angosta de `components/views/*`:
  - Navegación completa por teclado del selector, los filtros (popovers con Escape y foco de vuelta al botón), los encabezados ordenables y el árbol.
  - `aria-sort` correcto.
  - Etiquetas en todos los controles.
  - La Tabla con scroll horizontal y el selector visibles a 375 px de ancho.
- [ ] T024 [P] Actualizar `README.md`:
  - § Project status: Fase 3 completa, con [`specs/009-work-item-views`](specs/009-work-item-views/) enlazado.
  - § Roadmap: punto 8 marcado como hecho (lista y tabla; calendario diferido).
  - § Core concepts: mencionar las vistas Board / List / Table.
  - Badge de estado "phase 3 complete".
- [ ] T025 [P] Actualizar `AGENTS.md`:
  - Agregar `009-work-item-views` a la lista de specs (§ Start here).
  - En § Current state, indicar que la Fase 3 está implementada.
  - Mencionar `lib/work-item-view.ts` entre los módulos puros compartidos con el cliente.
- [ ] T026 Desde la raíz del repositorio, correr `npm run lint`, `npm run test` y `npx tsc --noEmit`, y corregir cualquier fallo.
- [ ] T027 Correr `npm run test:e2e` (base de pruebas confirmada por el product owner): las suites de Fases 1 y 2, la de 008 y `tests/e2e/work-item-views.spec.ts` deben quedar en verde. Registrar el resultado en esta tarea.
- [ ] T028 Correr manualmente `quickstart.md` de punta a punta (bloques 0 a 6), incluida la escala con ≥500 Work Items (SC-002), y registrar los resultados.

---

## Dependencies & Execution Order

```
Phase 1 (Foundational) ── BLOQUEA todas las historias
    ↓
Phase 2 [F9-US1] Rutas y selector            (P1 · MVP)
    ↓ (las páginas /table y /list ya existen)
Phase 3 [F9-US2] Tabla completa              (P1 · MVP) ─┐ independientes; US3 reutiliza
Phase 4 [F9-US3] Lista jerárquica            (P2)       ─┘ ViewFilters.tsx de US2 (T018)
    ↓
Final Phase (Polish)
```

- **Dentro de Foundational**: T001 → T002 → T003 → T004 (mismo archivo). T005 requiere T001; T006 requiere T002 y T003; T007 requiere T004. T008 requiere T001 (tipos); T009 y T010 requieren T008. T011 requiere T001.
- **US1**: T013 requiere T012. T015 y T016 requieren T012, T014 y T008.
- **US2**: T019 requiere T018 y T011. **US3**: T021 requiere T018, T004 y T011.
- **Archivos compartidos**: `tests/e2e/work-item-views.spec.ts` (T017, T020, T022) se trabaja en secuencia.

## Parallel Execution Examples

**Dentro de Phase 1**: T005, T006 y T007 (el mismo archivo de test, pero en
bloques `describe` separados) pueden escribirse junto con T008 y T011, que
son archivos distintos, una vez hechos T001-T004.

**Dentro de `[F9-US1]`**: T012 y T014 son `[P]` entre sí.

**Entre US2 y US3**: con T018 hecho, T019 (Tabla) y T021 (Lista) tocan
archivos distintos y pueden avanzar en paralelo.

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + Phase 3)

1. Foundational: módulo puro probado, lectura segura, hook de dirección.
2. `[F9-US1]`: selector y rutas.
3. `[F9-US2]`: Tabla completa.
4. **STOP and VALIDATE**: la Tabla responde "qué es crítico, qué está
   vencido, qué hay en una iteración", con filtros compartibles por
   dirección. Es el MVP de la feature.
5. `[F9-US3]`: Lista jerárquica.

### Orden de despliegue

Sin migración: el código se despliega directo. Todavía no hay ninguna
instancia desplegada.
