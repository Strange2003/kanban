---

description: "Task list for 013-project-catalogs implementation"
---

# Tasks: Catálogos por Proyecto — Tags con Color, Áreas y Tamaño

**Input**: Design documents from `specs/013-project-catalogs/`
(plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅,
contracts/ ✅, quickstart.md ✅.

**Tests**: se incluyen pruebas unitarias y e2e por historia, con el mismo
criterio que 008 y 009:

- Unitarias: módulos puros, acciones nuevas, barrido de permisos.
- E2E: un bloque de [quickstart.md](quickstart.md) por historia.

El barrido de `tests/unit/action-permissions.test.ts` prueba SC-006 "por
fuera de la interfaz".

**Organization**: tareas agrupadas por historia de [spec.md](spec.md). US1 y
US2 son P1; US3 y US4 son P2. Etiqueta `[F13-US<m>]` (`F13` =
013-project-catalogs), según [AGENTS.md](../../AGENTS.md#working-with-tasksmd).

**Dependencia entre historias**: todas dependen de Foundational (esquema
migrado y renombre mecánico Iteration → Size, sin el cual el código no
compila). US2 usa `CatalogSection` de US1 para la fila de color, y US3 usa
`TagColorPicker` y `TagChip` de US2. El orden recomendado es US1 → US2 → US3
→ US4. US4 es independiente de las otras tres una vez hecha Foundational.

**Sin fase de Setup**: no hay dependencias ni herramientas nuevas (plan.md §
Technical Context).

**Antes de escribir código Next.js**: [AGENTS.md](../../AGENTS.md) exige leer
la guía que corresponda en `node_modules/next/dist/docs/`: rutas anidadas,
Server Actions, `revalidatePath`.

**Base de datos**: `npm run db:migrate` y `npm run test:e2e` actúan sobre la
base de `.env.local` (Neon `dev`). Los e2e **vacían todas las tablas**:
confirmar con el product owner antes de correrlos. La migración se aplica en
producción **antes** de hacer push del código (AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias
  de tareas incompletas).
- **[Story]**: `[F13-US<m>]` indica la historia de esta spec.

## Path Conventions

Mismo monolito Next.js (plan.md § Project Structure). La interfaz va en
inglés: "Tags", "Areas", "Size", "Create new", "Used by N Work Items",
"Move up", "Move down", "Delete", "Cancel", "Create".

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: la paleta, la clave de permiso, el esquema migrado, el renombre
mecánico Iteration → Size en todo el código, y el helper de catálogos
unificado.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase.

- [X] T001 [P] Crear `lib/tag-colors.ts` (módulo **puro**: sin imports de `db`, `next/*` ni `lib/auth`):
  - `export const TAG_COLORS = ["gray", "red", "orange", "amber", "green", "teal", "blue", "indigo", "violet", "pink"] as const`, `export type TagColor`, `export const DEFAULT_TAG_COLOR: TagColor = "gray"`.
  - `export const TAG_COLOR_STYLES: Record<TagColor, { label: string; chip: string; bar: string; swatch: string }>`: `label` en inglés ("Gray", "Blue"…); `chip` = clases **literales** de Tailwind con fondo + texto para claro y `dark:`; `bar` = clase de fondo del tramo de la línea; `swatch` = clase de la muestra del selector.
  - Junto a cada color, documentar en un objeto `TAG_COLOR_HEX` los hex de fondo y texto del chip en claro y oscuro (los usa el test de contraste).
  Cubre FR-008 y FR-009 (contracts § `lib/tag-colors.ts`).
- [X] T002 [P] Crear `tests/unit/tag-colors.test.ts`: `TAG_COLORS` tiene 10 claves únicas e incluye `"gray"`; `TAG_COLOR_STYLES` y `TAG_COLOR_HEX` cubren todas; el contraste WCAG de texto sobre fondo de cada chip es ≥ 4.5 en claro y oscuro (calcular luminancia relativa en el test). Cubre SC-003.
- [X] T003 [P] Agregar `"catalog:manage"` a `Permission` y a `PERMISSIONS` en `lib/roles.ts` con `["owner", "member"]`, con un comentario que cite FR-007 de 013; actualizar `tests/unit/roles.test.ts` para que el Viewer no la tenga (research.md § Permiso `catalog:manage`).
- [X] T004 Modificar `db/schema.ts` según data-model.md (depende de T001):
  - `export const tagColorEnum = pgEnum("tag_color", TAG_COLORS)` importando de `@/lib/tag-colors`.
  - `tags`: `color: tagColorEnum("color").notNull().default("gray")` y `position: integer("position").notNull()`.
  - `areas`: `position: integer("position").notNull()`.
  - Renombrar la tabla `iterations` → `sizes` (`pgTable("sizes", …)`, export `sizes`), índice `sizes_project_lower_name_idx`, y `position: integer("position").notNull()`.
  - `workItems.iterationId` → `sizeId: integer("size_id").references(() => sizes.id, { onDelete: "set null" })`; actualizar el comentario (`set null` es defensivo: `deleteCatalogValue` pone `NULL` y registra historial antes de borrar).
- [X] T005 Crear la migración `0008` escrita a mano (research.md § Migración `0008`, data-model.md § Migración `0008`): `npx drizzle-kit generate --custom --name project_catalogs`, y escribir en el `.sql`, en este orden y con `--> statement-breakpoint` entre sentencias:
  1. `CREATE TYPE "public"."tag_color" AS ENUM('gray','red','orange','amber','green','teal','blue','indigo','violet','pink');`
  2. `ALTER TABLE "tags" ADD COLUMN "color" "tag_color" DEFAULT 'gray' NOT NULL;`
  3. `ALTER TABLE "iterations" RENAME TO "sizes";`, `ALTER SEQUENCE "iterations_id_seq" RENAME TO "sizes_id_seq";`, `ALTER TABLE "sizes" RENAME CONSTRAINT "iterations_pkey" TO "sizes_pkey";`, `… RENAME CONSTRAINT "iterations_project_id_projects_id_fk" TO "sizes_project_id_projects_id_fk";`, `ALTER INDEX "iterations_project_lower_name_idx" RENAME TO "sizes_project_lower_name_idx";`
  4. `ALTER TABLE "work_items" RENAME COLUMN "iteration_id" TO "size_id";` y `ALTER TABLE "work_items" RENAME CONSTRAINT "work_items_iteration_id_iterations_id_fk" TO "work_items_size_id_sizes_id_fk";`
  5. Para `tags`, `areas` y `sizes`: `ADD COLUMN "position" integer;`, `UPDATE … SET position = r.rn FROM (SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY lower(name), id) - 1 AS rn FROM …) r WHERE ….id = r.id;` y `ALTER COLUMN "position" SET NOT NULL;`
  Luego asegurar que el snapshot de `db/migrations/meta/` refleje `schema.ts`: correr `npm run db:generate` y confirmar que **no** propone cambios. Si los propone, ajustar el snapshot `0008` (nombres de restricciones o índices) hasta que no los haya. Sin ningún `DROP`.
- [X] T006 Aplicar la migración a Neon `dev` con `npm run db:migrate` y verificar con SQL: `sizes` contiene las filas que tenía `iterations`; `SELECT count(*) FROM work_items WHERE size_id IS NOT NULL` es igual al conteo previo de `iteration_id`; todas las tags tienen `color = 'gray'`; `position` no tiene `NULL` y es `0..n-1` por proyecto en los tres catálogos.
- [X] T007 Modificar `lib/work-item-catalogs.ts` (sigue siendo solo servidor, **sin** `"use server"`):
  - `CatalogKind = "tag" | "area" | "size"`; `tableFor` mapea `tag → tags`, `area → areas`, `size → sizes`.
  - `listCatalog(kind, projectId)` ordena por `(position, id)` (ya no alfabético).
  - `resolveCatalogValue(tx, kind, projectId, name, { create = true, color }?)`: busca sin distinguir mayúsculas dentro de `projectId`; si no existe y `create`, inserta con `position = (SELECT coalesce(max(position), -1) + 1 FROM <tabla> WHERE project_id = $1)` y, para `tag`, `color ?? DEFAULT_TAG_COLOR`, con `onConflictDoNothing()` y relectura como hoy; si no existe y `!create`, devuelve `null`.
  - `export async function catalogUsage(kind, projectId): Promise<Map<number, number>>`: cantidad de Work Items por valor (un `count` agrupado).
  Cubre FR-003a, FR-004 y FR-020.
- [X] T008 Renombre mecánico Iteration → Size en el código de servidor para que compile con el esquema nuevo (sin cambio de comportamiento; los textos de UI y el historial van en US4):
  - `lib/actions/work-items.ts`: `iterationName` → `sizeName` en `workItemFieldsSchema` y tipos; `iterations` → `sizes`; clave `changedFields.size` (antes `iteration`); `catalogNameById` con `"size"`.
  - `lib/actions/work-item-relationships.ts`: `catalogIterations`/`itemIteration` → `catalogSizes`/`itemSize`.
  - `lib/actions/work-item-views.ts` y `lib/work-item-view.ts`: `iterationName` → `sizeName`, `ViewData.iterations` → `sizes`, `ViewQuery.iterations` → `sizes`, clave de orden `"iteration"` → `"size"`, parámetro de URL `iteration` → `size`.
  - `lib/mcp/tools/work-items.ts` y `lib/mcp/tools/read.ts`: parámetro y campo `iteration` → `size` (descripción: "Size name; created if new; null clears it.").
  - Componentes que consumen esos tipos (`components/work-items/WorkItemDetailView.tsx`, `components/views/WorkItemsTable.tsx`, `components/views/ViewFilters.tsx`): solo los nombres de propiedades; las etiquetas visibles se cambian en T039.
  - Tests unitarios que usan esos nombres (`tests/unit/work-items.test.ts`, `work-item-view.test.ts`, `work-item-views-action.test.ts`, `mcp-search.test.ts`, `action-permissions.test.ts`): actualizar nombres.
  Verificar con `npx tsc --noEmit` y `npx vitest run`.
- [X] T009 [P] Actualizar `tests/e2e/setup.ts`: en el `TRUNCATE`, `iterations` → `sizes`.
- [X] T010 Modificar `updateWorkItem` en `lib/actions/work-items.ts` (research.md § No recrear en silencio):
  - Resolver tags con `resolveCatalogValue(tx, "tag", …)` en lugar del alta inline actual (las tags nuevas quedan grises y al final del catálogo).
  - Opción nueva `createMissingCatalogValues?: boolean` (default `true`) en la entrada, pasada como `{ create }` a `resolveCatalogValue` para tags, área y size. Con `false`, si algún nombre no existe, lanzar `AppError("CATALOG_VALUE_NOT_FOUND", '"<nombre>" no longer exists in this project.')` **antes** de escribir nada.
  - `createWorkItems` sigue creando (`create: true`).
  Cubre el edge case de la spec "Un miembro edita un Work Item mientras otro elimina una de sus tags".
- [X] T011 [P] Tests unitarios en `tests/unit/work-items.test.ts`: `sizeName` escribe `fields_edited` con clave `size`; `createMissingCatalogValues: false` con una tag inexistente → `CATALOG_VALUE_NOT_FOUND` sin transacción de escritura; con `true` (default) la crea como hoy.

**Checkpoint**: esquema migrado en `dev`, todo compila, las pruebas pasan y el
comportamiento visible es el mismo de antes (salvo que las tags nuevas
entran al final del catálogo).

---

## Phase 2: [F13-US1] Gestionar los catálogos del proyecto (Priority: P1) 🎯 MVP

**Goal**: pantalla de catálogos con Tags, Areas y Size, a la que se llega
desde "Tags" en el sidebar: crear, renombrar, reordenar y eliminar (con
historial), y ese orden manual rige en pickers, filtros y orden de la Table.

**Independent Test**: quickstart.md bloque 2.

- [X] T012 [F13-US1] Crear `lib/actions/project-catalogs.ts` (`"use server"`; **solo** exportar las acciones del contrato) con, por ahora, `getProjectCatalogs`, `createCatalogValue`, `renameCatalogValue`, `reorderCatalog` y `deleteCatalogValue` (contracts § Server Actions nuevas):
  - Entradas validadas con zod: `kind` ∈ `["tag", "area", "size"]`; nombres con `trim`, "no vacío" y "máx. 50 caracteres al crear o renombrar" (data-model.md § Reglas de validación); `color` ∈ `TAG_COLORS` y solo con `kind = "tag"`.
  - `getProjectCatalogs`: `requireProjectMember`; devuelve `role` y los tres catálogos en orden `(position, id)` con `usage` (`catalogUsage`) y, en tags, `color`.
  - Escrituras: `requireProjectPermission(projectPublicId, "catalog:manage")`.
  - `createCatalogValue`: `resolveCatalogValue(..., { create: true, color })`; si ya existía lo devuelve sin error.
  - `renameCatalogValue`: `NOT_FOUND` si `name` no existe en el proyecto; `CATALOG_NAME_TAKEN` si `newName` coincide (sin distinguir mayúsculas) con **otro** valor; cambiar solo mayúsculas del mismo valor está permitido. Sin historial (FR-005).
  - `reorderCatalog`: si `orderedNames` (comparados en minúsculas) no es exactamente el conjunto actual → `CONFLICT`; si lo es, reescribe `position = índice` en una transacción, como `reorderStages`. Sin historial.
  - `deleteCatalogValue`, en una transacción (research.md § Eliminar un valor en uso):
    1. `SELECT … FOR UPDATE` del valor (`NOT_FOUND` si no está).
    2. Leer los Work Items afectados, y en tags sus nombres de tags actuales.
    3. Para área/size, `UPDATE work_items SET area_id|size_id = NULL, updated_at = now()`; para tags, `DELETE FROM work_item_tags` de esa tag y `updated_at` de esos Work Items.
    4. `logActivity(tx, [...])` en bloque con un `fields_edited` por Work Item: `{ fields: { area|size: { from: "<nombre>", to: null } }, reason: "catalog_value_deleted" }` o `{ fields: { tags: { from: [...], to: [...] } }, reason: "catalog_value_deleted" }`.
    5. `DELETE` del valor.
    Devuelve `{ affectedWorkItems }`.
  - Todas: `revalidatePath` de `/projects/{id}` (layout) para tablero, list, table y catálogos.
  Cubre FR-001, FR-003, FR-003a, FR-004, FR-005, FR-006, FR-007 y FR-020.
- [X] T013 [F13-US1] En `lib/work-item-activity.ts`, si un `fields_edited` trae `reason: "catalog_value_deleted"`, agregar " (value deleted)" al final de la descripción. Agregar el caso en `tests/unit/work-item-fields.test.ts` o en un `tests/unit/work-item-activity.test.ts` nuevo.
- [X] T014 [P] [F13-US1] Crear `tests/unit/project-catalogs.test.ts` con el patrón de mocks de `tests/unit/work-items.test.ts`:
  - crear reutiliza el existente sin distinguir mayúsculas y entra al final;
  - renombrar → `CATALOG_NAME_TAKEN` y solo mayúsculas OK;
  - reordenar con lista desactualizada → `CONFLICT` sin escrituras;
  - eliminar un tamaño usado por 2 Work Items → un `logActivity` con 2 eventos `reason: "catalog_value_deleted"` y el `DELETE` al final;
  - eliminar una tag deja `to` sin esa tag;
  - un nombre de otro proyecto → `NOT_FOUND`;
  - nombre de 51 caracteres → `VALIDATION_ERROR`.
- [X] T015 [P] [F13-US1] Clasificar las 5 acciones de T012 en `tests/unit/action-permissions.test.ts`: `getProjectCatalogs` como lectura de miembro; las demás como `catalog:manage` (el Viewer recibe `ROLE_NOT_PERMITTED`).
- [X] T016 [F13-US1] Orden manual en List/Table (FR-017): en `lib/work-item-view.ts`, el orden por `area` y `size` usa el índice del valor en `data.areas` / `data.sizes` (que ya llegan en orden de catálogo) mediante un `Map<nombre, índice>`, no `localeCompare`; los vacíos siguen al final; sacar `area` y `size` de `TEXT_KEYS`. En `lib/actions/work-item-views.ts`, los catálogos (incluidas las tags) vienen de `listCatalog`, en orden manual. Tests en `tests/unit/work-item-view.test.ts`: con catálogo `["S", "M", "L", "XL"]`, ascendente da S, M, L, XL y luego vacíos; descendente da XL, L, M, S y luego vacíos.
- [X] T017 [P] [F13-US1] En `lib/actions/work-item-relationships.ts` (`getWorkItemDetailData`) y en `listProjectTags` de `lib/actions/work-items.ts`, leer los catálogos con `listCatalog` (orden manual) en lugar de ordenar por nombre.
- [X] T018 [F13-US1] Crear `components/settings/CatalogSection.tsx` (cliente, contracts § Contratos de UI):
  - Props: `projectPublicId`, `kind`, `title`, valores iniciales, `canManage`.
  - Lista en orden; por fila: nombre, "Used by N" discreto, botón para renombrar (input inline: Enter guarda, Escape cancela), "Move up"/"Move down" (`aria-label` "Move <name> up"; deshabilitados en los extremos) y "Delete".
  - "Delete" abre `Dialog` de confirmación: "Delete "<name>"? Used by N Work Items. It will be removed from them." (o "Not used by any Work Item."), con "Cancel" y "Delete".
  - Campo "Add tag…/Add area…/Add size…" al pie, que llama `createCatalogValue`; si devuelve un valor ya existente, mostrar "<name> already exists".
  - Renombrar y reordenar son optimistas, con reversión y mensaje de error. Un `CONFLICT` o `NOT_FOUND` hace `router.refresh()`.
  - Sin `canManage`: solo la lista, sin controles. Estado vacío: "No tags yet." (+ el campo si `canManage`).
- [X] T019 [F13-US1] Crear `app/(workspace)/projects/[projectPublicId]/settings/catalogs/page.tsx` (Server Component): `requireProjectMember`, `getProjectCatalogs`, `can(role, "catalog:manage")`; encabezado "<Project> — Tags, areas & sizes", enlace "← Back to settings", y tres `<section>` con `id="tags" | "areas" | "sizes"`, cada una con `<CatalogSection>`. Mismo contenedor y estilos que `settings/page.tsx`.
- [X] T020 [F13-US1] En `app/(workspace)/projects/[projectPublicId]/settings/page.tsx`, agregar una sección "Tags, areas & sizes" con un enlace a `/projects/{id}/settings/catalogs` (visible para todos los roles).
- [X] T021 [F13-US1] Modificar `components/sidebar/ProjectSidebarClient.tsx` (research.md § Opción anidada en el sidebar): bajo el proyecto **activo** (el de `pathname`), renderizar una lista anidada a partir de un arreglo `const PROJECT_LINKS = [{ label: "Tags", path: "/settings/catalogs" }]`, indentada, con `aria-current="page"` cuando `pathname` coincide. El nombre del proyecto sigue llevando al tablero. Revisar que funcione también en el drawer móvil.
- [X] T022 [F13-US1] Crear `tests/e2e/project-catalogs.spec.ts` con el bloque 2 de quickstart.md: navegar desde "Tags" del sidebar; crear S, M, XL, L en Size y reordenar a S, M, L, XL; recargar y verificar el orden en la pantalla, en el selector Size del detalle y al ordenar la Table; renombrar una tag y verla en el tablero y el detalle; nombre duplicado → mensaje; eliminar un tamaño usado → el diálogo dice "Used by 1 Work Item" y la pestaña History del Work Item muestra "(value deleted)".

**Checkpoint**: los catálogos se administran por completo. Es entregable por
sí solo.

---

## Phase 3: [F13-US2] Tags con color en tablero y detalle (Priority: P1) 🎯 MVP

**Goal**: cada tag tiene un color de la paleta, visible como línea al pie de
la tarjeta y como fondo de chip en el detalle.

**Independent Test**: quickstart.md bloque 3.

- [X] T023 [F13-US2] Agregar `setTagColor({ projectPublicId, name, color })` a `lib/actions/project-catalogs.ts`: `catalog:manage`, `color` validado con `z.enum(TAG_COLORS)`, `NOT_FOUND` si no existe, sin historial, `revalidatePath`. Clasificarla en `tests/unit/action-permissions.test.ts` y probar en `tests/unit/project-catalogs.test.ts` un color inválido → `VALIDATION_ERROR`.
- [X] T024 [P] [F13-US2] Crear `components/ui/tag-color-picker.tsx`: `role="radiogroup"` con `aria-label="Tag color"`; una muestra por color de `TAG_COLORS` (`role="radio"`, `aria-checked`, `aria-label` = `TAG_COLOR_STYLES[c].label`), con navegación por flechas y check visible en la seleccionada. Props `value`, `onChange`, `disabled`.
- [X] T025 [P] [F13-US2] Crear `components/ui/tag-chip.tsx`: `<TagChip name color onRemove?>` con las clases `chip` del color; si hay `onRemove`, un botón X con `aria-label="Remove tag <name>"`.
- [X] T026 [F13-US2] En `components/settings/CatalogSection.tsx`, para `kind = "tag"`: mostrar cada tag como `<TagChip>` y un botón "Color" (`aria-label="Change color of <name>"`) que abre un popover o `Dialog` con `<TagColorPicker>`; al elegir, `setTagColor` optimista con reversión. El Viewer ve los chips con color, sin botón.
- [X] T027 [F13-US2] `getBoard` en `lib/actions/board.ts`: una consulta extra `SELECT work_item_id, tags.name, tags.color FROM work_item_tags JOIN tags … WHERE tags.project_id = $1`, agrupada en memoria; cada `BoardWorkItem` suma `tags: { name: string; color: TagColor }[]` ordenadas alfabéticamente por nombre. Ajustar `tests/unit/board.test.ts` con el mock de la consulta nueva.
- [X] T028 [P] [F13-US2] Crear `components/board/TagColorBar.tsx`: `aria-hidden` y, si no hay tags, `null`; si las hay, un `div` `flex h-1 overflow-hidden rounded-b-md` con un `span flex-1` por tag y la clase `bar` de su color.
- [X] T029 [F13-US2] En `components/board/WorkItemCard.tsx`, renderizar `<TagColorBar tags={workItem.tags}>` pegado al borde inferior, en la tarjeta y en `WorkItemCardPreview`; agregar `tags: A, B` al `aria-label` (FR-010). Mantener la tarjeta sin tags igual que hoy. Actualizar `components/board/Board.tsx` si algún estado optimista crea `BoardWorkItem` sin `tags` (default `[]`).
- [X] T030 [F13-US2] Color en el detalle y las vistas:
  - `getWorkItemDetailData` devuelve `catalogTags` e `itemTags` como `{ name, color }[]` (catálogo en orden manual).
  - `listProjectWorkItems` / `ViewData.tags` también como `{ name, color }[]`.
  - `components/work-items/TagPicker.tsx` muestra las seleccionadas con `<TagChip>` y las sugerencias con una muestra de color.
  - `components/views/ViewFilters.tsx` muestra el color junto a cada tag del filtro, y `WorkItemsTable.tsx` las tags con `<TagChip>`.
- [X] T031 [P] [F13-US2] MCP: en `lib/mcp/tools/read.ts`, `get_work_item` y `get_board` devuelven `tags` como `{ name, color }[]`. Actualizar los tests MCP que afirmen la forma de `tags`. `tests/unit/mcp-route.test.ts` (lista de herramientas) no cambia.
- [X] T032 [F13-US2] E2E en `tests/e2e/project-catalogs.spec.ts`, bloque 3 de quickstart.md: poner colores a tres tags, asignarlas a un Work Item, verificar en la tarjeta los tres tramos (por clase o estilo computado, en orden alfabético), el `aria-label` con las tags, los chips del detalle, y que cambiar un color se refleja tras recargar.

**Checkpoint**: tags con color en el tablero y el detalle.

---

## Phase 4: [F13-US3] Buscar o crear un valor desde el Work Item (Priority: P2)

**Goal**: los tres campos filtran mientras se escribe y ofrecen "Create new",
que abre un pop-up (con color en tags) y crea el valor sin salir del Work
Item.

**Independent Test**: quickstart.md bloques 4 y 6.

- [X] T033 [F13-US3] Crear `components/work-items/CreateCatalogValueDialog.tsx`: `<Dialog dismissible>` con título "New tag" / "New area" / "New size", campo "Name" precargado y editable, `<TagColorPicker>` solo para tags (gris preseleccionado), y botones "Cancel" y "Create". Al confirmar llama `createCatalogValue` y devuelve `{ name, color? }` por `onCreated`; si falla, muestra el error dentro del diálogo; si cancela, no llama nada.
- [X] T034 [F13-US3] Modificar `components/work-items/TagPicker.tsx` y `components/work-items/CatalogPicker.tsx`:
  - Las sugerencias respetan el orden del catálogo recibido y filtran por contenido sin distinguir mayúsculas (ya existe; conservar).
  - Si el texto no coincide exactamente (sin mayúsculas) con un valor, agregar al final la opción "Create new "<texto>"", que abre `CreateCatalogValueDialog` con el texto; Enter sobre un texto sin coincidencia exacta abre el diálogo en lugar de crear.
  - Con coincidencia exacta, Enter asigna el valor existente con su escritura original y no se ofrece "Create new" (FR-013).
  - Al crear: agregar el valor al catálogo local (al final) y seleccionarlo.
  - Nueva prop `projectPublicId` (y `kind` en `CatalogPicker`) para el diálogo.
  - Sin permiso (`disabled`), nunca se ofrece "Create new".
- [X] T035 [F13-US3] En `components/work-items/WorkItemDetailView.tsx`: pasar `projectPublicId`/`kind` a los pickers, enviar `createMissingCatalogValues: false` en `handleSave`, y ante `CATALOG_VALUE_NOT_FOUND` mostrar el mensaje y `router.refresh()` para cargar el catálogo actual.
- [X] T036 [F13-US3] Actualizar `tests/e2e/work-item-fields.spec.ts`: donde hoy se crea un área o iteración escribiendo y pulsando Enter, pasar por "Create new" y el diálogo.
- [X] T037 [F13-US3] E2E en `tests/e2e/project-catalogs.spec.ts`, bloques 4 y 6 de quickstart.md: filtrar "ba"; crear "Mobile" en verde desde el Work Item y verla en la pantalla de catálogos al final; crear un área y un size (sin paleta); cancelar no crea; "BACKEND" ofrece "Backend" y no "Create new"; y el caso concurrente con dos pestañas, donde al guardar aparece el aviso de que la tag ya no existe y no se recrea.

**Checkpoint**: creación rápida con confirmación y color.

---

## Phase 5: [F13-US4] Size en lugar de Iteration (Priority: P2)

**Goal**: la palabra Iteration desaparece de la interfaz, las vistas, las
herramientas MCP y la documentación; el historial antiguo se lee como Size.

**Independent Test**: quickstart.md bloque 1.

- [X] T038 [P] [F13-US4] En `lib/work-item-activity.ts`, `FIELD_LABELS`: `iteration: "Size"` y `size: "Size"`. Test: un `fields_edited` antiguo `{ iteration: { from: null, to: "Sprint 1" } }` se describe "Size: None → Sprint 1" (FR-016).
- [X] T039 [F13-US4] Etiquetas visibles: "Iteration" → "Size" en `components/work-items/WorkItemDetailView.tsx` (label, `id` del input `wi-size`), `components/views/WorkItemsTable.tsx` (encabezado de columna y orden) y `components/views/ViewFilters.tsx` (filtro). Buscar con `grep -rni iteration app components lib` y confirmar que no queda texto visible.
- [X] T040 [P] [F13-US4] Documentación: `app/(legal)/privacy/page.tsx` ("iterations" → "sizes"; revisar `tests/unit/legal.test.ts`); `README.md`: campos (línea de "area and iteration"), flujo de trabajo, el roadmap de Phase 3 queda como histórico, y el candidato "Managing catalogs" se reemplaza por la entrada de 013 en Phase 4.
- [X] T041 [F13-US4] Actualizar `tests/e2e/work-item-views.spec.ts` y el resto de los e2e que mencionan Iteration (`grep -rn -i iteration tests/e2e`) a Size, incluido el parámetro de URL `size`.
- [X] T042 [F13-US4] E2E del bloque 1 de quickstart.md en `tests/e2e/project-catalogs.spec.ts`, en la medida en que se pueda sin datos previos a la migración: asignar un Size, verlo en el detalle, la Table (columna, filtro y orden) y el History como "Size: None → M", y comprobar que "Iteration" no aparece en el detalle ni en la Table.

**Checkpoint**: Iteration no existe más para el usuario ni para los agentes.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T043 `npx tsc --noEmit`, `npm run lint` y `npx vitest run` en verde; revisar el diff para que no se hayan formateado archivos enteros (memoria del repo: nunca Prettier sobre archivos completos).
- [X] T044 Correr `npm run test:e2e` **solo tras confirmar con el product owner** que la base de `.env.local` es la Neon `dev` desechable.
- [ ] T045 Revisión manual de UX en escritorio y a 390 px: sidebar con "Tags" anidado (también en el drawer móvil), pantalla de catálogos, línea de colores en modo claro y oscuro, y el pop-up.
- [X] T046 Actualizar `AGENTS.md` § Current state of the codebase y `README.md` § Project Status con 013 (catálogos gestionables, color de tags, Size en lugar de Iteration, clave `catalog:manage`, y que las tags ya no se crean inline en `updateWorkItem` desde la UI).
- [X] T047 Deploy (AGENTS.md): aplicar `0008` a la rama Neon de **producción** con confirmación del product owner, **antes** de hacer push a `main`; luego merge y push, y verificar el deploy de Render. Ventana corta de errores aceptada por el product owner (research.md § Migración `0008`).
- [ ] T048 Pasada manual completa de [quickstart.md](quickstart.md), bloques 1 a 6.

---

## Dependencies & Execution Order

- **Foundational (T001–T011)** bloquea todo. T001, T002, T003 y T009 en
  paralelo; T004 → T005 → T006; T007 y T008 después de T004 (T008 también
  toca tests); T010 → T011.
- **US1 (T012–T022)**: T012 → T013/T014/T015; T016 y T017 en paralelo con
  T012; T018 → T019 → T020/T021; T022 al final.
- **US2 (T023–T032)**: T023 tras T012; T024, T025 y T028 en paralelo; T026
  tras T018, T024 y T025; T027 → T029; T030 tras T025; T031 en paralelo;
  T032 al final.
- **US3 (T033–T037)**: tras T024 (paleta) y T012 (`createCatalogValue`);
  T033 → T034 → T035 → T036/T037.
- **US4 (T038–T042)**: solo depende de Foundational; puede ir en paralelo con
  US1–US3 si se coordinan `WorkItemDetailView.tsx` y los e2e compartidos.
- **Polish (T043–T048)**: después de todas las historias; T047 requiere
  confirmación explícita del product owner.

## Parallel Execution Examples

- Foundational: T001 (`lib/tag-colors.ts`), T003 (`lib/roles.ts`) y T009
  (`tests/e2e/setup.ts`) a la vez; luego T002 con la paleta lista.
- US1: T014 (`project-catalogs.test.ts`), T015 (`action-permissions.test.ts`)
  y T016 (`lib/work-item-view.ts`) una vez escrito T012.
- US2: T024 (`tag-color-picker.tsx`), T025 (`tag-chip.tsx`), T028
  (`TagColorBar.tsx`) y T031 (MCP) a la vez.
- US4: T038 (`work-item-activity.ts`) y T040 (docs) a la vez.

## Implementation Strategy

1. **MVP**: Foundational + US1. Deja los catálogos administrables y el orden
   manual; ya resuelve el problema de fondo (valores con errores o
   obsoletos que no se podían corregir).
2. **+ US2**: color en tablero y detalle, que es la mejora más visible.
3. **+ US3**: creación rápida con confirmación y color.
4. **+ US4**: limpieza final del nombre Iteration en textos, docs y e2e (el
   renombre de datos ya ocurrió en Foundational).
5. Polish, e2e con confirmación, y deploy con la migración primero.
