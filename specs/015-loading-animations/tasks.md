# Tasks: Animaciones de Carga y un Esqueleto por Página

**Input**: Design documents from `specs/015-loading-animations/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/loading-states.md](contracts/loading-states.md), [quickstart.md](quickstart.md)

**Tests**: incluidos (plan.md § Testing): dos suites Vitest y una Playwright.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes)
- **[Story]**: US1 = tablero que se arma, US2 = un esqueleto por página, US3 = sin parpadeo ni movimiento no deseado

---

## Phase 1: Setup

- [x] T001 Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` y la referencia de `useParams` (AGENTS.md: esta versión de Next.js difiere); no produce archivos, confirma que un `loading.tsx` anidado reemplaza al del segmento padre y que `useParams` funciona dentro del fallback de `app/(workspace)/projects/[projectPublicId]/loading.tsx`

---

## Phase 2: Foundational (bloquea US1, US2 y US3)

- [x] T002 En `app/globals.css`, añadir las animaciones kb-* de contracts/loading-states.md: `.kb-skeleton` (invisible 150 ms y fundido de 180 ms, `animation: kb-appear 180ms ease-out 150ms backwards`, también con "reducir movimiento"); y dentro de `@media (prefers-reduced-motion: no-preference)`: `.kb-fall` (bucle `kb-fall` 2.6 s: cae con `translate`, se asienta, se desvanece), `.kb-fall-in` (cae una vez y luego respira suavemente en bucle), y `.kb-board-entering :is([data-kb-land])` con `kb-land` 260 ms `backwards` (`translate: 0 -14px` y opacidad 0 → reposo); todos con `animation-delay: var(--kb-delay, 0ms)`. Usar la propiedad `translate`, nunca `transform` (research.md § 5)
- [x] T003 [P] Crear `components/loading/Skeleton.tsx` con `SkeletonFrame({ label, className, children })` (raíz con `role="status"`, `aria-busy="true"`, `kb-skeleton`, y `<span className="sr-only">{label}</span>`) y `Bone({ className, delay, fall })` (`div` `aria-hidden` con `bg-muted rounded`, `kb-fall-in` si `fall`, y `--kb-delay` = `delay` ms inline)

---

## Phase 3: User Story 1 — El tablero "se arma" mientras carga (P1) 🎯 MVP

**Goal**: el esqueleto del tablero muestra las columnas reales recordadas con siluetas que caen, y las tarjetas aterrizan al llegar.

**Independent Test**: quickstart.md § 1.

- [x] T004 [P] [US1] Crear `lib/board-column-memory.ts` (sin `"use client"`, sin imports de servidor): `DEFAULT_BOARD_COLUMNS = 3`, `MAX_SKELETON_COLUMNS = 8`, `boardColumnsKey(projectPublicId)` → `kanban:board-columns:<projectPublicId>`, `clampSkeletonColumns(value: unknown): number` ("ausente, no numérico, `≤ 0` → `3`; `> 8` → `8`; decimales → parte entera"), `readBoardColumns(storage: Storage | null | undefined, projectPublicId)` y `writeBoardColumns(storage, projectPublicId, count)` ("`0` no se guarda"); cualquier excepción del `Storage` se ignora (lectura → 3, escritura → nada)
- [x] T005 [P] [US1] Tests en `tests/unit/board-column-memory.test.ts` con un `Storage` falso en memoria: clave por proyecto; acotado (undefined, "abc", "0", "-2", "2.7" → 2, "12" → 8); ida y vuelta de escribir/leer; escribir 0 conserva el valor anterior; un `Storage` cuyos métodos lanzan → `readBoardColumns` devuelve 3 y `writeBoardColumns` no lanza; `null` como storage
- [x] T006 [US1] Reescribir `components/board/BoardSkeleton.tsx` como Client Component: `projectPublicId` con `useParams()`; número de columnas con `useSyncExternalStore(subscribe al evento "storage", () => readBoardColumns(localStorage, id), () => DEFAULT_BOARD_COLUMNS)` (acceso a `localStorage` dentro de `try`); N columnas con la forma de `StageColumn` (`w-72`, borde discontinuo, encabezado `Bone`) y 3 siluetas `kb-fall` por columna con `--kb-delay = col·140 + i·260 ms`; raíz `SkeletonFrame` con `label="Loading board…"`
- [x] T007 [US1] En `app/(workspace)/projects/[projectPublicId]/loading.tsx`, sustituir la barra vacía por un esqueleto de la cabecera de vista (nombre del proyecto y selector Board/List/Table, reutilizando `ViewHeaderSkeleton` de T012 si ya existe o un `Bone` equivalente) y mantener `BoardSkeleton` debajo
- [x] T008 [US1] En `components/board/Board.tsx`: (a) `useEffect` que llama `writeBoardColumns(window.localStorage, projectPublicId, stagesState.length)` cuando cambia el número de columnas (acceso a `localStorage` dentro de `try`); (b) estado `entering` inicial `true`, puesto a `false` con `setTimeout` de 600 ms en un `useEffect` de montaje (limpiar el timer), y la clase `kb-board-entering` en el contenedor de columnas mientras sea `true`; (c) pasar `columnIndex` a cada `StageColumn`
- [x] T009 [US1] En `components/board/StageColumn.tsx`, aceptar `columnIndex?: number`; marcar el encabezado de la columna con `data-kb-land` y `--kb-delay = min(columnIndex·40, 200) ms`, y pasar a cada `WorkItemCard` un `landDelayMs = min(columnIndex·40 + index·30, 200)`
- [x] T010 [US1] En `components/board/WorkItemCard.tsx`, aceptar `landDelayMs?: number` y ponerlo como `--kb-delay` junto con `data-kb-land` en la raíz de la tarjeta, combinando el `style` con el `transform`/`transition` de `useSortable` sin reemplazarlos

**Checkpoint**: el tablero recuerda sus columnas y entra con aterrizaje; nada lo repite al arrastrar, crear o filtrar.

---

## Phase 4: User Story 2 — Cada página carga con su propia forma (P1)

**Goal**: ninguna página hereda el esqueleto del tablero.

**Independent Test**: quickstart.md § 2.

- [x] T011 [P] [US2] Test en `tests/unit/loading-states.test.ts`: para cada uno de los 8 segmentos de contracts/loading-states.md (`projects/[projectPublicId]`, `…/work-items/[displayNumber]`, `…/list`, `…/table`, `…/settings`, `…/settings/catalogs`, `my-work`, `settings/agents`, bajo `app/(workspace)/`) existe `loading.tsx`; y cada `page.tsx` bajo `app/(workspace)/` excepto la raíz `page.tsx` tiene un `loading.tsx` en su propia carpeta (así una página nueva no vuelve a heredar el del tablero)
- [x] T012 [US2] Crear `components/loading/PageSkeletons.tsx` (Server Components, sin `"use client"`) con `ViewHeaderSkeleton` y los 7 esqueletos de contracts/loading-states.md, cada uno con su `SkeletonFrame` y label: `WorkItemDetailSkeleton` ("Loading Work Item…"; cabecera con volver, ID + 2 chips, título, pestañas; debajo `lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]` con campos a la izquierda y descripción/checklist/comentarios a la derecha), `ListSkeleton` ("Loading list…"; cabecera, barra de filtros, 8 filas), `TableSkeleton` ("Loading table…"; cabecera, filtros, encabezados, 8 filas de celdas), `ProjectSettingsSkeleton` ("Loading settings…"), `CatalogsSkeleton` ("Loading tags, areas and sizes…"; 3 secciones × 3 filas), `MyWorkSkeleton` ("Loading your work…"; barra de título + 2 grupos × 3 filas), `ConnectedAgentsSkeleton` ("Loading connected agents…"); los bloques usan `Bone fall` con `delay` escalonado (≈ 40 ms por fila, tope 400 ms) y reproducen los contenedores y anchos de cada página real
- [x] T013 [P] [US2] Crear `app/(workspace)/projects/[projectPublicId]/work-items/[displayNumber]/loading.tsx` que devuelve `<WorkItemDetailSkeleton />`
- [x] T014 [P] [US2] Crear `app/(workspace)/projects/[projectPublicId]/list/loading.tsx` (`ListSkeleton`) y `app/(workspace)/projects/[projectPublicId]/table/loading.tsx` (`TableSkeleton`)
- [x] T015 [P] [US2] Crear `app/(workspace)/projects/[projectPublicId]/settings/loading.tsx` (`ProjectSettingsSkeleton`) y `app/(workspace)/projects/[projectPublicId]/settings/catalogs/loading.tsx` (`CatalogsSkeleton`)
- [x] T016 [P] [US2] Crear `app/(workspace)/my-work/loading.tsx` (`MyWorkSkeleton`) y `app/(workspace)/settings/agents/loading.tsx` (`ConnectedAgentsSkeleton`)

**Checkpoint**: cada página muestra su propia forma al cargar.

---

## Phase 5: User Story 3 — Sin parpadeos ni movimiento no deseado (P2)

**Goal**: sin destellos en cargas rápidas y sin movimiento con "reducir movimiento".

**Independent Test**: quickstart.md § 3.

- [x] T017 [US3] Revisar `app/globals.css` contra FR-008/FR-009: con `prefers-reduced-motion: reduce` ningún `kb-fall`, `kb-fall-in` ni `kb-land` corre y los bloques quedan con opacidad plena; `.kb-skeleton` conserva solo el fundido diferido; ajustar lo que falte
- [x] T018 [US3] Crear `tests/e2e/loading-states.spec.ts` (helpers de `tests/e2e/helpers.ts`). Un esqueleto solo se ve si la navegación es lenta, y contra `next dev` no se puede forzar sin tocar la app, así que un `MutationObserver` registra en la página los esqueletos (`role="status"`) que aparecen y la animación de las tarjetas al montarse el tablero: (a) tras crear 5 columnas, `localStorage["kanban:board-columns:<publicId>"]` es `"5"`; (b) al llegar al tablero desde My work las tarjetas y encabezados corren `kb-land`, una tarjeta creada después no, y abrir un Work Item nunca muestra "Loading board…" (solo, si acaso, "Loading Work Item…"); (c) con `page.emulateMedia({ reducedMotion: "reduce" })` la animación es `none`

---

## Phase 6: Polish & Cross-Cutting

- [x] T019 Actualizar `README.md` § Project Status y `AGENTS.md` § Current state con 015-loading-animations (un `loading.tsx` por página, memoria local de columnas `kanban:board-columns:<publicId>`, animaciones solo CSS bajo `prefers-reduced-motion`)
- [x] T020 Ejecutar `npx tsc --noEmit`, `npx eslint . --ignore-pattern '.claude/**'` y `npm run test`; corregir lo que falle
- [x] T021 Ejecutar `tests/e2e/loading-states.spec.ts` y la suite e2e completa contra la rama Neon `dev`; comprobar en el navegador (throttling) el tablero, el detalle, List y My work en tema claro y oscuro
- [ ] T022 Pasada manual de quickstart.md con el product owner (SC-006)

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002-T003)** → historias.
- **US1**: T004 → T006 (y T008); T005 en paralelo con T006; T008 → T009 → T010. T007 usa `ViewHeaderSkeleton` de T012 si ya existe.
- **US2**: T012 antes de T013-T016; T011 en cualquier momento (falla hasta T016).
- **US3**: T017 tras T002; T018 tras US1 y US2.
- **Polish**: T019-T022 al final; T022 lo hace el usuario.

## Parallel Execution Examples

- Tras T002: T003 y T004 a la vez; luego T005 con T006.
- Tras T012: T013, T014, T015 y T016 a la vez (archivos distintos), con T011.

## Implementation Strategy

1. **MVP**: Phases 1-3 (tablero con "tarjetas que caen" y memoria de columnas).
2. **Incremento 2**: Phase 4 corrige el bug reportado (el detalle mostraba el tablero).
3. **Incremento 3**: Phase 5 y Polish; commit y merge a `main` sin migración.
