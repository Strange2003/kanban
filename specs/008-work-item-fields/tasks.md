---

description: "Task list for 008-work-item-fields implementation"
---

# Tasks: Campos Extendidos y Fechas de Work Items

**Input**: Design documents from `specs/008-work-item-fields/`
(plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅,
quickstart.md ✅ (todos generados por `/speckit-plan`).

**Tests**: Se incluyen pruebas unitarias y e2e por historia, con el mismo
criterio que [007-roles-permissions/tasks.md](../007-roles-permissions/tasks.md):

- Unitarias: funciones puras de transición y vencido, validación de
  `updateWorkItem`, acciones nuevas y barrido de permisos.
- E2E: un bloque por historia de [quickstart.md](quickstart.md).

El barrido de `tests/unit/action-permissions.test.ts` es la prueba de SC-005
"por fuera de la interfaz".

**Organization**: Tareas agrupadas por historia de usuario de
[spec.md](spec.md). US1, US2 y US3 son P1; US4 es P2. Cada historia usa la
etiqueta `[F8-US<m>]` (`F8` = 008-work-item-fields), siguiendo la convención
de [AGENTS.md](../../AGENTS.md#working-with-tasksmd).

**Nota sobre dependencia entre historias**: las cuatro historias son
incrementos independientes sobre la fase Foundational (esquema migrado y
módulos puros). Todas tocan los mismos archivos compartidos:
`updateWorkItem` en `lib/actions/work-items.ts`, `WorkItemDetailView.tsx`,
`WorkItemCard.tsx` y `tests/e2e/work-item-fields.spec.ts`. Se pueden
desarrollar en paralelo, pero los cambios en esos archivos deben integrarse
con cuidado (mismo criterio que 006 y 007). El orden recomendado es
US1 → US2 → US3 → US4.

**Sin fase de Setup separada**: esta feature no agrega dependencias ni
herramientas (plan.md § Technical Context). Se empieza directo en
Foundational.

**Antes de escribir código Next.js**: [AGENTS.md](../../AGENTS.md) exige leer
la guía relevante de `node_modules/next/dist/docs/` (Server Actions,
`revalidatePath`, `router.refresh` y, para `lib/dates.ts`, hidratación y
componentes cliente). Esta versión de Next.js puede diferir de lo conocido.

**Base de datos**: `npm run db:migrate` y `npm run test:e2e` actúan sobre la
base de `.env.local`, que es la Neon de desarrollo. Los e2e **vacían todas
las tablas**: confirmar con el product owner que es desechable antes de
correrlos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin
  dependencias de tareas incompletas).
- **[Story]**: `[F8-US<m>]` indica a qué historia de esta spec pertenece la
  tarea.
- Cada descripción incluye la ruta exacta de archivo.

## Path Conventions

Mismo monolito Next.js: `app/`, `lib/`, `components/`, `db/` y `tests/` en la
raíz del repositorio (ver plan.md § Project Structure). Las etiquetas de la
interfaz van en inglés, como el resto de la UI actual (Critical / High /
Medium / Low, Area, Iteration, Start date, Target date, Close). Los
identificadores de código y de los enums también.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: El esquema migrado, los módulos puros y de servidor que todas
las historias usan, y la corrección de aislamiento en `moveWorkItem`.

**⚠️ CRITICAL**: ninguna historia de usuario puede empezar hasta completar
esta fase.

- [ ] T001 [P] Crear `lib/work-item-fields.ts` (módulo **puro**: sin imports de `db`, `next/*` ni `lib/auth`, para poder importarlo desde componentes cliente y desde `db/schema.ts`):
  - `export const WORK_ITEM_LEVELS = ["critical", "high", "medium", "low"] as const` (en ese orden, que es el orden de urgencia).
  - `export type WorkItemLevel`.
  - `export const LEVEL_LABELS: Record<WorkItemLevel, string>` con `Critical`, `High`, `Medium`, `Low`.
  - `export function isOverdue(targetDate: string | null, closedAt: Date | string | null, today: string): boolean`, que es `true` solo si `targetDate !== null && closedAt == null && targetDate < today`, comparando strings `"YYYY-MM-DD"`.

  Cubre FR-002, FR-003, FR-004 y FR-010 (contracts/work-item-fields.md § Módulo `lib/work-item-fields.ts`).
- [ ] T002 [P] Crear `lib/work-item-closing.ts` (módulo **puro**) con `nextClosedAt({ fromIsClosing, toIsClosing, currentClosedAt, now })`, que devuelve `ClosingTransition` exactamente como en contracts/work-item-fields.md § Módulo `lib/work-item-closing.ts`. Implementa la tabla de research.md § Estado de cierre derivado:
  - `fromIsClosing === null` (creación) con destino de cierre → `{ closedAt: now, event: "closed" }`.
  - De no cierre a cierre → `closed` con `now`.
  - De cierre a no cierre → `{ closedAt: null, event: "reopened" }`.
  - De cierre a cierre → conserva `currentClosedAt`, `event: null`.
  - De no cierre a no cierre (o creación en columna normal) → `{ closedAt: null, event: null }`.

  Cubre FR-012 y FR-013.
- [ ] T003 [P] Tests unitarios de `isOverdue` en `tests/unit/work-item-fields.test.ts`:
  - `false` sin fecha objetivo.
  - `false` si la fecha objetivo es hoy (vence recién al día siguiente, Edge Cases).
  - `true` si es ayer y el Work Item está abierto.
  - `false` si es ayer pero `closedAt` no es `null`.
  - Acepta `closedAt` como `Date` y como string ISO.
  - `WORK_ITEM_LEVELS` está en el orden `critical, high, medium, low`.
- [ ] T004 [P] Tests unitarios de `nextClosedAt` en `tests/unit/work-item-closing.test.ts`: una prueba por cada fila de la tabla de T002, incluida la que comprueba que moverse entre dos columnas de cierre conserva el `closedAt` original (no `now`) y no emite evento (Edge Cases, SC-006).
- [ ] T005 Modificar `db/schema.ts` según data-model.md (depende de T001):
  - `pgEnum("work_item_priority", WORK_ITEM_LEVELS)` y `pgEnum("work_item_severity", WORK_ITEM_LEVELS)`, importando `WORK_ITEM_LEVELS` de `@/lib/work-item-fields`.
  - Tablas `areas` e `iterations` con la misma forma que `tags`: `id serial PK`, `project_id integer NOT NULL` → `projects.id` `onDelete: "cascade"`, `name text NOT NULL`, e índices únicos `areas_project_lower_name_idx` / `iterations_project_lower_name_idx` sobre `(projectId, lower(name))`. **Declararlas antes de `workItems`**.
  - En `workItems`, todas nullable:
    - `priority` (`work_item_priority`) y `severity` (`work_item_severity`).
    - `areaId` → `areas.id` `onDelete: "set null"` e `iterationId` → `iterations.id` `onDelete: "set null"`.
    - `startDate` y `targetDate`, con `date(..., { mode: "string" })`.
    - `closedAt` (`timestamp with time zone`).
  - En `workItems`, `check("work_items_dates_order_check", sql\`${table.startDate} IS NULL OR ${table.targetDate} IS NULL OR ${table.targetDate} >= ${table.startDate}\`)`.
  - En `stages`, `isClosing: boolean("is_closing").notNull().default(false)`.
  - Comentarios que citen la spec como el resto del archivo. En particular, el de `closedAt` debe enunciar la invariante `closed_at IS NOT NULL ⇔ stages.is_closing` (data-model.md § Invariante de cierre).
- [ ] T006 Generar la migración con `npm run db:generate` → `db/migrations/0004_<nombre>.sql` y su snapshot en `db/migrations/meta/`. Revisar que el SQL contenga **exactamente** lo que dice data-model.md § Migración: 2 `CREATE TYPE`, 2 `CREATE TABLE` con FK en cascada e índices `lower(name)`, 7 `ADD COLUMN` nullable en `work_items`, 2 FK `ON DELETE SET NULL`, el `CHECK` y `ADD COLUMN "is_closing" boolean DEFAULT false NOT NULL` en `stages`. No debe haber ningún `DROP` ni ninguna modificación de columnas existentes.
- [ ] T007 Aplicar la migración a la Neon de desarrollo con `npm run db:migrate`. Correr la consulta de invariante de quickstart.md § 0 (`SELECT count(*) FROM work_items wi JOIN stages s ON s.id = wi.stage_id WHERE s.is_closing <> (wi.closed_at IS NOT NULL);`) y confirmar `0`. Antes, dejar al menos tres Work Items existentes en la base para el bloque 6 de quickstart.md.
- [ ] T008 [P] Crear `lib/work-item-catalogs.ts` (solo servidor, **sin** `"use server"`, con el mismo comentario de advertencia que `lib/work-item-queries.ts`). Depende de T005. Tipos y funciones:
  - `type CatalogKind = "area" | "iteration"`.
  - `listCatalog(kind, projectId): Promise<string[]>`: nombres del catálogo del proyecto, en orden alfabético.
  - `resolveCatalogValue(tx, kind, projectId, name): Promise<{ id: number; name: string }>`:
    1. Recorta el nombre.
    2. Busca `lower(name) = lower(${trimmed})` dentro de `projectId`.
    3. Si no existe, lo inserta con `onConflictDoNothing()` y relee, para cubrir la carrera con el índice único.

  Sin comprobaciones de sesión: quien lo llama ya verificó el acceso (contracts/work-item-fields.md § Módulo `lib/work-item-catalogs.ts`, FR-006, FR-021).
- [ ] T009 [P] Crear `lib/dates.ts`:
  - `useLocalToday(): string | null` con `useSyncExternalStore`: suscripción vacía, snapshot de cliente con la fecha local `"YYYY-MM-DD"` y snapshot de servidor `null`.
  - `formatCalendarDate(date: "YYYY-MM-DD"): string`, que formatea **sin** convertir zona horaria: construye la fecha con componentes locales, no con `new Date("YYYY-MM-DD")`, que es UTC.

  Crear también `components/ui/local-date.tsx` con `<LocalDate value={Date | string} />`, que renderiza el día en la zona del navegador con `Intl.DateTimeFormat` usando el mismo mecanismo de `useSyncExternalStore` (servidor: la fecha UTC). Ver research.md § Fechas y "hoy" sin desajustes de hidratación.
- [ ] T010 Corregir el aislamiento de `moveWorkItem` en `lib/actions/work-items.ts` (research.md § Hallazgo): después de `requireProjectPermission`, cargar la columna destino por `input.toStageId` y lanzar `AppError("NOT_FOUND", "Column not found.")` si no existe o si `stage.projectId !== workItem.projectId`. La comprobación va **antes** de la transacción, así que no se escribe nada.
- [ ] T011 Test unitario en `tests/unit/work-items.test.ts`: `moveWorkItem` hacia una columna cuyo `projectId` difiere del del Work Item devuelve `{ ok: false, error: { code: "NOT_FOUND" } }` y no llama a `db.transaction`. Mismo patrón de mocks de `db.select` en cola que ya usa el archivo.

**Checkpoint**: esquema migrado con la invariante verificada, módulos
puros probados y hueco de `moveWorkItem` cerrado. Las historias pueden
empezar.

---

## Phase 2: [F8-US1] Clasificar un Work Item por prioridad y severidad (Priority: P1) 🎯 MVP

**Goal**: Un Owner o Miembro asigna prioridad y severidad desde el detalle,
la prioridad se ve en la tarjeta y cada cambio queda en el historial.

**Independent Test**: quickstart.md bloque 1. Asignar Priority High y
Severity Medium, recargar, ver "High" en la tarjeta (y la severidad no) y
ver "Priority: None → High" en la actividad.

- [ ] T012 [F8-US1] Extender `updateWorkItem` en `lib/actions/work-items.ts`:
  - Entrada: `priority?: WorkItemLevel | null` y `severity?: WorkItemLevel | null`.
  - Validación en `updateWorkItemSchema`: `z.enum(WORK_ITEM_LEVELS).nullable().optional()`. Un valor fuera del enum da `VALIDATION_ERROR`. `undefined` = no tocar, `null` = vaciar.
  - Solo si cambia, agregar `changedFields.priority` / `changedFields.severity` como `{ from, to }` (valor del enum o `null`) a `updates`. Así entran en el **mismo** evento `fields_edited` (data-model.md § Log de actividad, FR-020).
  - Permiso sin cambios: `workItem:edit` (FR-019).
- [ ] T013 [P] [F8-US1] Tests unitarios en `tests/unit/work-items.test.ts` para `updateWorkItem`:
  - `priority: "urgent"` → `VALIDATION_ERROR` sin escrituras.
  - `priority: "high"` sobre un Work Item sin prioridad escribe `fields_edited` con `{ priority: { from: null, to: "high" } }`.
  - `priority: null` vacía el campo.
  - Enviar el mismo valor que ya tiene no escribe ningún evento.
- [ ] T014 [P] [F8-US1] Crear `components/board/PriorityBadge.tsx`: indicador compacto con **texto** (`LEVEL_LABELS`) y color por nivel. Critical usa el tono destructivo y Low el tono apagado. Nunca solo color (accesibilidad, SC-002). Recibe `level: WorkItemLevel`.
- [ ] T015 [F8-US1] Modificar `components/board/WorkItemCard.tsx`:
  - Debajo del título, renderizar `<PriorityBadge>` si `workItem.priority !== null` (FR-016). La severidad **no** se muestra en la tarjeta.
  - Añadir la prioridad al `aria-label` de la tarjeta (p. ej. `"KAN-3: Title, priority High"`).
- [ ] T016 [F8-US1] Modificar `components/work-items/WorkItemDetailView.tsx`:
  - Nueva sección "Planning" dentro del `<form>`, entre Tags y Relations.
  - Dos `<select>` (`aria-label` "Priority" / "Severity") con la opción `None` (valor vacío → `null`) más `WORK_ITEM_LEVELS` con `LEVEL_LABELS`, usando `selectClassName`.
  - Estado local inicializado desde `workItem.priority` / `workItem.severity` y reiniciado en el bloque `if (workItem.id !== prevWorkItemId)`.
  - Enviados en `handleSave` a `updateWorkItem`.
  - `disabled={!canEdit}` para el Lector.

  Cubre FR-015 y FR-019.
- [ ] T017 [F8-US1] Ampliar `describeActivity` en `components/work-items/WorkItemDetailView.tsx`:
  - Para `fields_edited`, las claves nuevas se muestran con valor anterior y nuevo: `"<Label>: <from> → <to>"`, con `null` → `None` y los niveles con `LEVEL_LABELS`, a través de un mapa `FIELD_LABELS` (`priority` → `Priority`, `severity` → `Severity`, más las claves de US2 y US4 cuando lleguen).
  - Las claves existentes (`title`, `description`, `stakeholder`, `tags`) conservan el formato actual `"Edited …"`.
  - Si un evento mezcla claves nuevas y existentes, se une en una sola línea separada por `; `.

  Cubre FR-020.
- [ ] T018 [F8-US1] Crear `tests/e2e/work-item-fields.spec.ts` con el escenario de quickstart.md bloque 1, reutilizando los helpers de `tests/e2e/helpers.ts`:
  1. Crear proyecto, columna y Work Item.
  2. Asignar High/Medium y guardar.
  3. Recargar y comprobar que persisten.
  4. Volver al tablero: la tarjeta muestra "High" y no muestra "Medium".
  5. La actividad del detalle contiene "Priority: None → High".
  6. Vaciar ambas y comprobar que el badge desaparece.

**Checkpoint**: la prioridad y la severidad se editan, se ven y se auditan.
Es un incremento entregable por sí solo.

---

## Phase 3: [F8-US2] Planificar con fechas (Priority: P1) 🎯 MVP

**Goal**: El detalle muestra Created y Last modified; se editan las fechas
de inicio y objetivo con su regla de orden; la fecha objetivo aparece en la
tarjeta y se marca como vencida según la fecha local de quien mira.

**Independent Test**: quickstart.md bloque 2. El rango inválido se rechaza,
una fecha objetivo de ayer se marca como vencida en la tarjeta y en el
detalle, y reordenar no cambia Last modified.

- [ ] T019 [F8-US2] Extender `updateWorkItem` en `lib/actions/work-items.ts`:
  - Entrada: `startDate?: string | null` y `targetDate?: string | null`. Validación con `z.iso.date().nullable().optional()`; un formato inválido da `VALIDATION_ERROR`.
  - Calcular los valores **resultantes**: el nuevo si llega (`!== undefined`), o el guardado en `workItem` si no. Si ambos existen y `target < start`, lanzar `AppError("INVALID_DATE_RANGE", "The target date can't be before the start date.")` antes de la transacción (FR-009, contracts § `updateWorkItem`).
  - Registrar `changedFields.startDate` / `changedFields.targetDate` con strings `"YYYY-MM-DD"` o `null`.
  - `closedAt` **no** es aceptado como entrada (FR-013).
- [ ] T020 [P] [F8-US2] Tests unitarios en `tests/unit/work-items.test.ts`:
  - `targetDate` anterior al `startDate` guardado → `INVALID_DATE_RANGE` sin escrituras.
  - `startDate` posterior al `targetDate` guardado (solo se cambia el inicio) → `INVALID_DATE_RANGE`.
  - Solo `targetDate` sin inicio es válido.
  - `targetDate: "2026-13-40"` → `VALIDATION_ERROR`.
  - El evento `fields_edited` guarda `{ targetDate: { from: null, to: "2026-10-15" } }`.
- [ ] T021 [F8-US2] Modificar `reorderWorkItemsInStage` en `lib/actions/work-items.ts` para que el `.set(...)` solo escriba `position` y ya no `updatedAt`. Agregar un comentario que cite research.md § `updated_at` deja de cambiar al reordenar.
- [ ] T022 [P] [F8-US2] Crear `components/board/TargetDateChip.tsx`:
  - Props: `targetDate: string` y `closedAt: Date | string | null`.
  - Muestra `formatCalendarDate(targetDate)` con un ícono de calendario de `lucide-react`.
  - Obtiene `today` de `useLocalToday()`. Si `today !== null && isOverdue(targetDate, closedAt, today)`, aplica el estilo destructivo y el texto accesible "Overdue" (visible o `sr-only`). Mientras `today` sea `null` (SSR o hidratación), se renderiza sin marca de vencido.

  Cubre FR-010, FR-016 y research.md § Fechas y "hoy".
- [ ] T023 [F8-US2] Modificar `components/board/WorkItemCard.tsx`: renderizar `<TargetDateChip>` junto a `<PriorityBadge>` si `workItem.targetDate !== null` y añadir "overdue" al `aria-label` cuando corresponda. Usar `useLocalToday()` en la tarjeta para el `aria-label`, con la misma condición `today !== null`.
- [ ] T024 [F8-US2] Modificar `components/work-items/WorkItemDetailView.tsx`:
  - En "Planning", dos `<input type="date">` con `<Label>` (`Start date`, `Target date`):
    - Estado local inicializado desde `workItem.startDate` / `workItem.targetDate` (`""` si `null`) y reiniciado con el cambio de Work Item.
    - Enviados en `handleSave` (`""` → `null`).
    - `readOnly` y `disabled` para el Lector.
    - Indicador "Overdue" en el detalle con `isOverdue` + `useLocalToday()` (FR-010).
  - Nueva sección "Dates" de solo lectura, fuera de los controles editables: `Created` y `Last modified` con `<LocalDate value={workItem.createdAt} />` y `<LocalDate value={workItem.updatedAt} />`.

  Cubre FR-008 y FR-015.
- [ ] T025 [F8-US2] Ampliar `FIELD_LABELS` y el formateo de `describeActivity` en `components/work-items/WorkItemDetailView.tsx`: `startDate` → `Start date` y `targetDate` → `Target date`, con los valores formateados por `formatCalendarDate` y `null` → `None` (FR-020).
- [ ] T026 [F8-US2] Agregar a `tests/e2e/work-item-fields.spec.ts` el escenario de quickstart.md bloque 2:
  1. Rango inválido rechazado con mensaje visible.
  2. Target date = ayer, calculada en el test con la fecha local del navegador de Playwright.
  3. La tarjeta tiene la marca "Overdue", y el detalle también.
  4. El detalle muestra Created y Last modified.

**Checkpoint**: fechas editables y vencimiento visible. Sin US3, todavía no
hay forma de que un Work Item deje de estar vencido al completarse.

---

## Phase 4: [F8-US3] Cerrar Work Items con columnas de cierre (Priority: P1) 🎯 MVP

**Goal**: Owner y Miembros marcan columnas de cierre; mover, crear, marcar y
"Cerrar" mantienen `closed_at` coherente con la columna, bajo concurrencia;
cada transición se audita.

**Independent Test**: quickstart.md bloque 3:

- "Close" está deshabilitado sin columnas de cierre.
- Marcar "Done", arrastrar un Work Item y comprobar el cierre; arrastrarlo
  de vuelta y comprobar la reapertura.
- "Close" desde el detalle.
- Marcar y desmarcar una columna con Work Items.
- La consulta de invariante devuelve 0.

- [ ] T027 [F8-US3] Refactorizar el movimiento en `lib/actions/work-items.ts`:
  - Extraer el cuerpo transaccional de `moveWorkItem` a una función **no exportada** `moveWithinTx(tx, { workItem, fromStage, toStage, toPosition, via, now })`, que hace:
    1. Cierra el hueco en el origen y abre el lugar en el destino.
    2. Actualiza `stageId`, `position`, `closedAt` (de `nextClosedAt`) y `updatedAt`.
    3. Inserta `stage_changed` `{ fromStageId, toStageId }` como hoy.
    4. Si `event` no es `null`, inserta `closed` `{ closedAt: ISO, stageName: toStage.name, via }` o `reopened` `{ stageName: toStage.name, via }`.
  - `moveWorkItem`, dentro de la transacción, relee las filas de las columnas de origen y destino con `.for("share")` (research.md § Concurrencia) y llama a `moveWithinTx` con `via: "move"`.
  - Conserva la comprobación de proyecto de T010.
  - **No exportar** `moveWithinTx`: todo export de este archivo es un endpoint público (AGENTS.md).
- [ ] T028 [F8-US3] Modificar `createWorkItem` en `lib/actions/work-items.ts`: dentro de la transacción, releer la columna con `.for("share")`. Si `stage.isClosing`, insertar el Work Item con `closedAt = now` e insertar el evento `closed` `{ closedAt, stageName: stage.name, via: "created" }` (Edge Cases, FR-013).
- [ ] T029 [F8-US3] Agregar `closeWorkItem(workItemId: number): Promise<Result<void>>` en `lib/actions/work-items.ts`, según contracts/work-item-fields.md § `closeWorkItem`:
  1. `getWorkItemAndProject` y luego `requireProjectPermission(project.publicId, "workItem:edit")`.
  2. En una transacción, leer la columna actual y la primera columna con `isClosing = true` del proyecto (`orderBy(asc(stages.position)).limit(1)`), ambas `.for("share")`.
  3. Si no hay columna de cierre → `AppError("NO_CLOSING_STAGE", "Mark a column as a closing column first.")`. Si la columna actual ya es de cierre → `AppError("ALREADY_CLOSED", "This Work Item is already closed.")`.
  4. Si no, calcular `toPosition` como el máximo de la columna destino + 1 y llamar a `moveWithinTx` con `via: "close_button"`.
  5. `revalidatePath` del tablero.

  Cubre FR-014 y FR-019.
- [ ] T030 [F8-US3] Agregar `setStageClosing({ projectPublicId, stagePublicId, isClosing }): Promise<Result<void>>` en `lib/actions/board.ts`, según contracts § `setStageClosing`:
  1. `requireProjectPermission(projectPublicId, "board:edit")`.
  2. En una transacción, leer la columna por `publicId` + `projectId` con `.for("update")`. Si no existe → `NOT_FOUND`. Si ya tiene ese valor → return sin escribir nada (idempotente).
  3. Actualizar `stages.isClosing`.
  4. Un único `UPDATE work_items SET closed_at = <now | NULL>, updated_at = now WHERE stage_id = …`, con `.returning({ id })`.
  5. Un único `INSERT` en bloque en `work_item_activity`, un evento por Work Item devuelto: `closed` `{ closedAt, stageName, via: "stage_marked" }` o `reopened` `{ stageName, via: "stage_unmarked" }`.
  6. `revalidatePath`.

  Cubre FR-011, FR-013 y FR-020.
- [ ] T031 [F8-US3] Modificar `getWorkItemDetailData` en `lib/actions/work-item-relationships.ts` para que devuelva además:
  - `stage: { name, isClosing }`: la columna actual del Work Item.
  - `hasClosingStage: boolean`: si el proyecto tiene alguna columna de cierre.

  Ambos se leen dentro del mismo `Promise.all`, después de la verificación de membresía existente, sin exportar helpers nuevos (contracts § `getWorkItemDetailData`). Actualizar el tipo `WorkItemDetailData`.
- [ ] T032 [F8-US3] Modificar `tests/unit/action-permissions.test.ts`:
  - Agregar a `CASES` `closeWorkItem` (`workItem:edit`, `run: () => closeWorkItem(1)`, `denied: READ_ONLY_DENIED`, `allowed: EDITORS`) y `setStageClosing` (`board:edit`, `run: () => setStageClosing({ projectPublicId: P, stagePublicId: "stage-1", isClosing: true })`, `denied: READ_ONLY_DENIED`, `allowed: EDITORS`).
  - Importarlas.
  - Asegurar que la fila mock de `stages` incluye `isClosing: false`.
  - Confirmar que el test de completitud pasa (SC-005).
- [ ] T033 [F8-US3] Tests unitarios en `tests/unit/work-items.test.ts`:
  - `closeWorkItem` sin columnas de cierre → `NO_CLOSING_STAGE`.
  - `closeWorkItem` sobre un Work Item cuya columna ya es de cierre → `ALREADY_CLOSED`.
  - En ambos casos no hay escrituras fuera de la transacción.

  Añadir en un archivo nuevo `tests/unit/board.test.ts`: `setStageClosing` con el mismo valor ya guardado no escribe nada, y con una columna de otro proyecto devuelve `NOT_FOUND`. Mismo patrón de mocks que `work-items.test.ts`.
- [ ] T034 [P] [F8-US3] Crear `components/board/ClosingStageToggle.tsx`:
  - Botón pequeño con un ícono de `lucide-react` (p. ej. `CircleCheck`).
  - `aria-pressed={isClosing}` y `aria-label` "Mark as closing column" / "Unmark closing column".
  - Recibe `isClosing` y `onToggle()`.
  - Evita iniciar el drag de la cabecera de la columna, con el mismo criterio que `DeleteStageButton`.
- [ ] T035 [F8-US3] Modificar `components/board/StageColumn.tsx`:
  - Indicador visible de columna de cierre en la cabecera para **todos** los roles cuando `stage.isClosing`: ícono + texto `Closing` con `title` explicativo (FR-011).
  - Con `canEdit`, renderizar `<ClosingStageToggle>` junto a `DeleteStageButton`.
  - Nueva prop `onToggleClosing(stage)` que viene de `Board`.
- [ ] T036 [F8-US3] Modificar `components/board/Board.tsx`:
  - En `handleWorkItemMove`, calcular `closedAt` de forma optimista con `nextClosedAt`, usando el `isClosing` de las columnas de origen y destino en `stagesState`. Así la marca de vencido cambia al instante (Principio I).
  - Nuevo `handleToggleClosing(stage)`:
    1. Actualiza de forma optimista `stagesState` (`isClosing`) y `workItemsState`: `closedAt` = `new Date()` o `null` para los Work Items de esa columna.
    2. Llama a `setStageClosing`.
    3. Si falla, revierte ambos estados, muestra un toast y hace `router.refresh()` ante `isRolePermissionError`.
    4. Si sale bien, hace `router.refresh()` para traer los `closedAt` del servidor.
  - Pasar `onToggleClosing` a `StageColumn`.
- [ ] T037 [F8-US3] Modificar `components/work-items/WorkItemDetailView.tsx`:
  - En la sección "Dates", `Status`: `Open`, o `Closed on <LocalDate value={workItem.closedAt}/> · <stage.name>` si `initialDetail.stage.isClosing` (FR-014).
  - Botón `Close` con `type="button"` (fuera del submit):
    - Visible solo para `canEdit` y si el Work Item está abierto.
    - Deshabilitado con el texto explicativo "Mark a column as a closing column on the board to enable Close." cuando `!initialDetail.hasClosingStage`.
    - Al pulsarlo llama a `closeWorkItem` y luego a `router.refresh()`. Ante un error muestra el mensaje y `router.refresh()`, que cubre `NO_CLOSING_STAGE`, `ALREADY_CLOSED` y `ROLE_NOT_PERMITTED`.
    - No encadena otra Server Action (005 research.md § Hallazgo).
  - Sin botón para el Lector.
  - `describeActivity`:
    - `closed` → `"Closed (moved to <stageName>)"` para `via` `move`/`close_button`, `"Closed (created in <stageName>)"` para `created` y `"Closed: column <stageName> marked as closing"` para `stage_marked`.
    - `reopened` → `"Reopened (moved to <stageName>)"` o `"Reopened: column <stageName> unmarked as closing"`.

  Cubre FR-020.
- [ ] T038 [F8-US3] Agregar a `tests/e2e/work-item-fields.spec.ts` el escenario de quickstart.md bloque 3, pasos 1 a 6 y 8:
  1. `Close` deshabilitado sin columnas de cierre.
  2. Marcar "Done" (el indicador aparece).
  3. Arrastrar un Work Item vencido a "Done": desaparece "Overdue" y el detalle dice "Closed on".
  4. Arrastrarlo de vuelta a "Doing": dice "Open" y la actividad muestra "Reopened".
  5. `Close` desde el detalle deja el Work Item último en "Done".
  6. Marcar y desmarcar una columna con Work Items cierra y reabre todos.
  7. Crear un Work Item en "Done" lo crea cerrado.

  Reutilizar el patrón de drag de `tests/e2e/board.spec.ts`.

**Checkpoint**: MVP de la feature completo (US1 + US2 + US3). Los Work
Items se clasifican, se planifican y se cierran, y SC-006 es verificable con
la consulta de quickstart.md.

---

## Phase 5: [F8-US4] Organizar por área e iteración (Priority: P2)

**Goal**: Área e iteración por Work Item, elegidas de catálogos del proyecto
que se amplían en línea y separados entre sí y entre proyectos.

**Independent Test**: quickstart.md bloques 4 y 5:

- Crear "Frontend" en un Work Item.
- Verlo sugerido en otro Work Item y reutilizarlo al escribir "FRONTEND".
- Una iteración no aparece como área.
- Otro proyecto no ve "Frontend".

- [ ] T039 [F8-US4] Extender `updateWorkItem` en `lib/actions/work-items.ts`:
  - Entrada: `areaName?: string | null` y `iterationName?: string | null`. Una cadena vacía o solo espacios se trata como `null`.
  - Dentro de la transacción, resolver cada nombre con `resolveCatalogValue(tx, "area" | "iteration", project.id, name)` de `@/lib/work-item-catalogs`. Siempre con el `project.id` del Work Item, nunca con un id enviado por el cliente (FR-021).
  - Comparar con el nombre actual, que se obtiene leyendo el valor por `workItem.areaId` / `workItem.iterationId`. Si cambió, actualizar `areaId` / `iterationId` y registrar `changedFields.area` / `changedFields.iteration` con **nombres** `{ from, to }` (`null` si vacío).

  Cubre FR-005, FR-006 y data-model.md § Log de actividad.
- [ ] T040 [F8-US4] Modificar `getWorkItemDetailData` en `lib/actions/work-item-relationships.ts` para que devuelva además `catalogAreas` y `catalogIterations` (con `listCatalog(…, project.id)`), `itemArea` e `itemIteration` (nombres o `null`), dentro del mismo `Promise.all` y después de la verificación de membresía. Actualizar el tipo `WorkItemDetailData`.
- [ ] T041 [P] [F8-US4] Tests unitarios en `tests/unit/work-items.test.ts`:
  - `areaName: "  "` se trata como vaciar el área.
  - `areaName: "FRONTEND"` con "Frontend" ya en el catálogo del proyecto reutiliza su id sin insertar (se verifica el mock de `insert`).
  - La resolución filtra por el `projectId` del Work Item.
  - El evento guarda nombres, no ids.
- [ ] T042 [P] [F8-US4] Crear `components/work-items/CatalogPicker.tsx`: selector de **un** valor, análogo a `TagPicker.tsx`.
  - Props: `catalog: string[]`, `value: string | null`, `onChange(value: string | null)`, `label: string` (accesible), `disabled?: boolean`.
  - Muestra el valor actual con un botón para quitarlo.
  - Tiene un `Input` con sugerencias del catálogo filtradas sin distinguir mayúsculas y la opción `Create "<nombre>"` si el nombre no existe.
  - Si el texto coincide sin distinguir mayúsculas con un valor del catálogo, elige ese valor con su capitalización original.
  - En modo `disabled` solo muestra el valor o "None".
- [ ] T043 [F8-US4] Modificar `components/work-items/WorkItemDetailView.tsx`:
  - En "Planning", dos `<CatalogPicker>` (`Area`, `Iteration`) con `initialDetail.catalogAreas` / `catalogIterations` y estado inicializado desde `itemArea` / `itemIteration`, reiniciado con el cambio de Work Item.
  - Enviar `areaName` / `iterationName` en `handleSave`.
  - `disabled={!canEdit}`.
  - Ampliar `FIELD_LABELS` con `area` → `Area` e `iteration` → `Iteration`.

  Cubre FR-015 y FR-020.
- [ ] T044 [F8-US4] Agregar a `tests/e2e/work-item-fields.spec.ts` los escenarios de quickstart.md bloques 4 y 5:
  1. Crear el área "Frontend".
  2. En otro Work Item aparece como sugerencia; escribir "FRONTEND" reutiliza el valor.
  3. La iteración "Sprint 1" no aparece en Area.
  4. Quitar el área registra "Area: Frontend → None".
  5. En un segundo proyecto, "Frontend" no aparece.

**Checkpoint**: las 4 historias están completas.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Lector de punta a punta, accesibilidad, documentación y
validación completa.

- [ ] T045 Agregar a `tests/e2e/work-item-fields.spec.ts` el escenario de quickstart.md bloque 6.2 y 6.3, usando `inviteAndAccept(…, "viewer")` de `tests/e2e/helpers.ts`:
  - La Lectora ve el badge de prioridad, la fecha objetivo y el indicador de columna de cierre, pero no ve `ClosingStageToggle`.
  - En el detalle, los controles de Planning están deshabilitados y no hay botón `Close` (FR-019, SC-005).
- [ ] T046 [P] Pasada de accesibilidad de los controles nuevos:
  - Todos los `<select>`, `<input type="date">` y `CatalogPicker` tienen etiqueta asociada.
  - `ClosingStageToggle` es operable con teclado y anuncia su estado (`aria-pressed`).
  - "Overdue" y la prioridad no dependen solo del color.
  - El botón `Close` deshabilitado expone su explicación (`aria-describedby`).

  Archivos: `components/board/ClosingStageToggle.tsx`, `components/board/PriorityBadge.tsx`, `components/board/TargetDateChip.tsx`, `components/work-items/CatalogPicker.tsx` y `components/work-items/WorkItemDetailView.tsx`. Mismo criterio que T050 de 007.
- [ ] T047 [P] Actualizar `README.md`:
  - § Project status: Fase 3 "in progress", con [`specs/008-work-item-fields`](specs/008-work-item-fields/) enlazado.
  - § Roadmap: la Fase 3 deja de ser "candidates" (confirmada en alcance: vistas de lista y tabla, sin calendario, y campos extendidos). El punto 9 queda como implementado, con prioridad, severidad, área, iteración, fechas y columnas de cierre, y el punto 8 queda como "next (009)".
  - § Core concepts: mencionar las columnas de cierre y las fechas de un Work Item.
- [ ] T048 [P] Actualizar `AGENTS.md`:
  - Agregar `008-work-item-fields` a la lista de specs (§ Start here) como primera feature de Fase 3.
  - En § "Constitution highlights an agent is likely to violate", añadir que todo código que cambie la columna de un Work Item o la marca `is_closing` de una columna MUST mantener `closed_at` a través de `nextClosedAt` (`lib/work-item-closing.ts`), en la misma transacción y bloqueando las filas de `stages`. La invariante es `closed_at IS NOT NULL ⇔ stages.is_closing`. Añadir también que área e iteración se resuelven siempre por nombre dentro del proyecto del Work Item.
  - Actualizar § Current state of the codebase para mencionar `lib/work-item-fields.ts`, `lib/work-item-closing.ts` y `lib/work-item-catalogs.ts`.
- [ ] T049 [P] Agregar notas de enmienda, sin reescribir el texto histórico:
  - En `specs/003-kanban-board/spec.md`, bajo la entidad Stage/Columna: "Ampliado por [008-work-item-fields](../008-work-item-fields/spec.md) (FR-011): una columna puede marcarse como de cierre".
  - En `specs/004-work-items/spec.md`, bajo FR-005 (mover): "Ampliado por [008-work-item-fields](../008-work-item-fields/spec.md) (FR-013): mover a o desde una columna de cierre cierra o reabre el Work Item" y "Reordenar ya no cambia la fecha de última modificación (008 research.md)".
- [ ] T050 Desde la raíz del repositorio, correr `npm run lint`, `npm run test` y `npx tsc --noEmit`. Corregir cualquier fallo, en particular tipos derivados de `$inferSelect` en mocks de tests existentes que ahora requieren las columnas nuevas (`isClosing`, `closedAt`, etc.).
- [ ] T051 Correr `npm run test:e2e` **solo tras confirmar con el product owner que la base de `.env.local` es desechable**, porque `tests/e2e/setup.ts` trunca todas las tablas. Confirmar que las suites de Fases 1 y 2 siguen en verde (SC-003) y que pasa `tests/e2e/work-item-fields.spec.ts`. Registrar el resultado en esta tarea.
- [ ] T052 Correr manualmente `quickstart.md` de punta a punta (bloques 0 a 7):
  - La consulta de invariante antes y después del bloque 3 (SC-006).
  - Los Work Items anteriores a la migración (bloque 6.1, SC-003).
  - La escala con ≥100 Work Items (bloque 7, SC-002/SC-007).

  Registrar los resultados.

---

## Dependencies & Execution Order

```
Phase 1 (Foundational) ── BLOQUEA todas las historias
    ↓
Phase 2 [F8-US1] Prioridad y severidad          (P1 · MVP) ─┐
Phase 3 [F8-US2] Fechas y vencimiento           (P1 · MVP) ─┤ independientes entre sí; comparten
Phase 4 [F8-US3] Columnas de cierre y "Cerrar"  (P1 · MVP) ─┤ updateWorkItem, WorkItemDetailView,
Phase 5 [F8-US4] Área e iteración               (P2)       ─┘ WorkItemCard y el spec e2e
    ↓
Final Phase (Polish)
```

- **Dentro de Foundational**: T005 requiere T001; T006 requiere T005; T007
  requiere T006; T008 requiere T005; T011 requiere T010.
- **US3** es la historia que más depende del orden interno: T027 (refactor
  con `moveWithinTx`) va antes que T028 y T029. T036 (Board) requiere T030 y
  T035. T037 requiere T029 y T031.
- **US2** usa el `isOverdue` de T001 y, para que el vencido desaparezca al
  cerrar, el `closedAt` que mantiene US3. Por separado se valida con Work
  Items abiertos.
- **Archivos compartidos**: `lib/actions/work-items.ts` (T012, T019, T021,
  T027-T029, T039), `components/work-items/WorkItemDetailView.tsx` (T016,
  T017, T024, T025, T037, T043), `components/board/WorkItemCard.tsx` (T015,
  T023) y `tests/e2e/work-item-fields.spec.ts` (T018, T026, T038, T044, T045).
  En esos archivos, trabajar en el orden de las historias o fusionar con
  cuidado.
- **Polish**: T045 requiere US1, US2 y US3; T050 requiere todas las
  historias; T051 y T052 van al final.

## Parallel Execution Examples

**Dentro de Phase 1**: T001, T002, T003 y T004 son `[P]` entre sí. T008 y T009
son `[P]` entre sí una vez hecho T005. T010 y T011 pueden avanzar en paralelo
con la migración (T006-T007).

**Dentro de `[F8-US1]`**: T013 (tests) y T014 (`PriorityBadge`) son `[P]` con
T012. T015 espera a T014; T016 y T017 tocan el mismo archivo y van en
secuencia.

**Dentro de `[F8-US2]`**: T020 y T022 son `[P]` con T019. T021 toca el mismo
archivo que T019, así que va después.

**Dentro de `[F8-US3]`**: T034 (`ClosingStageToggle`) es `[P]` con todo el
trabajo de servidor (T027-T033). T030 (`board.ts`) y T027-T029
(`work-items.ts`) pueden ir en paralelo por archivos distintos.

**Dentro de `[F8-US4]`**: T041 (tests) y T042 (`CatalogPicker`) son `[P]` con
T039 y T040.

**Entre historias**: con Foundational cerrado, cuatro personas o agentes
pueden tomar una historia cada uno, respetando la nota de archivos
compartidos.

## Implementation Strategy

### MVP First (Phase 1 + Phases 2-4)

1. Completar Phase 1: Foundational (esquema migrado, módulos puros,
   corrección de `moveWorkItem`).
2. Completar `[F8-US1]`: prioridad y severidad visibles y auditadas.
3. Completar `[F8-US2]`: fechas y vencimiento.
4. Completar `[F8-US3]`: columnas de cierre y "Cerrar".
5. **STOP and VALIDATE**: la consulta de invariante devuelve 0 y el barrido
   de permisos incluye las dos acciones nuevas. Los Work Items se clasifican,
   se planifican y se cierran: es el MVP, todavía sin área ni iteración.
6. Continuar con `[F8-US4]`.

### Incremental Delivery

1. Foundational → esquema y módulos listos; hueco de aislamiento cerrado.
2. `[F8-US1]` → prioridad y severidad en detalle y tarjeta.
3. `[F8-US2]` → fechas de planificación, Created y Last modified, vencido.
4. `[F8-US3]` → cierre por columna, botón "Cerrar", fecha de cierre (MVP).
5. `[F8-US4]` → catálogos de área e iteración.
6. Polish → Lector e2e, accesibilidad, README/AGENTS/specs anteriores y
   validación completa.

### Orden de despliegue

`npm run db:migrate` (migración `0004`, aditiva y sin backfill) **antes** de
desplegar el código nuevo, porque el código nuevo lee `is_closing`,
`closed_at` y los campos nuevos. El código anterior sigue funcionando sobre el
esquema nuevo (data-model.md § Migración). Hoy no hay ninguna instancia
desplegada: solo aplica a la Neon de desarrollo.
