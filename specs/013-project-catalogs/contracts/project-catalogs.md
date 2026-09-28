# Contract: Catálogos por Proyecto

Server Actions, módulos puros y contratos de UI de 013. Todo archivo
`"use server"` es un endpoint público: cada acción valida la entrada con zod,
resuelve el proyecto por `publicId` y comprueba permiso **antes** de leer o
escribir. Los errores siguen `Result<T>` de `lib/errors.ts`.

## Permisos

| Acción | Clave | Roles |
|---|---|---|
| `getProjectCatalogs` | — (`requireProjectMember`) | Owner, Member, Viewer |
| `createCatalogValue` | `catalog:manage` (**nueva**) | Owner, Member |
| `renameCatalogValue` | `catalog:manage` | Owner, Member |
| `setTagColor` | `catalog:manage` | Owner, Member |
| `reorderCatalog` | `catalog:manage` | Owner, Member |
| `deleteCatalogValue` | `catalog:manage` | Owner, Member |
| `updateWorkItem` (asignar tags/área/size) | `workItem:edit` (sin cambio) | Owner, Member |

Un rol rechazado devuelve `ROLE_NOT_PERMITTED`. Todas las acciones nuevas se
clasifican en `tests/unit/action-permissions.test.ts`.

## Módulos puros

### `lib/tag-colors.ts` (nuevo)

- `TAG_COLORS`: tupla `as const` de las 10 claves; fuente del enum.
- `type TagColor`.
- `TAG_COLOR_STYLES: Record<TagColor, { label: string; chip: string; bar: string }>`
  — clases literales de Tailwind (fondo + texto del chip en claro/oscuro, y
  color del tramo de la línea).
- `DEFAULT_TAG_COLOR = "gray"`.

### `lib/work-item-catalogs.ts` (modificado; servidor, sin `"use server"`)

- `CatalogKind = "tag" | "area" | "size"` (antes `"area" | "iteration"`).
- `listCatalog(kind, projectId)` → nombres en orden `(position, id)`.
- `resolveCatalogValue(tx, kind, projectId, name, { create })` → valor
  existente (sin distinguir mayúsculas) o, si `create`, lo crea al final
  (`max(position) + 1`); si no, devuelve `null`. Para `kind = "tag"` reemplaza
  el alta inline que hoy vive en `updateWorkItem`.

### `lib/work-item-view.ts` (modificado)

- `iterationName` → `sizeName`; `ViewData.iterations` → `sizes`;
  `ViewData.tags` pasa a `{ name, color }[]`; parámetro de URL `iteration` →
  `size`.
- El orden por `area` y `size` usa el índice del valor en el catálogo
  (orden manual), no `localeCompare`; los vacíos al final.

### `lib/work-item-activity.ts` (modificado)

- `FIELD_LABELS`: `iteration` y `size` → "Size".
- `fields_edited` con `reason: "catalog_value_deleted"` agrega " (value deleted)".

## Server Actions nuevas — `lib/actions/project-catalogs.ts`

```ts
type CatalogValue = { name: string; usage: number };            // usage = Work Items que lo usan
type TagValue = CatalogValue & { color: TagColor };

getProjectCatalogs(projectPublicId: string): Result<{
  role: ProjectRole;
  tags: TagValue[];      // en orden manual
  areas: CatalogValue[];
  sizes: CatalogValue[];
}>

createCatalogValue(input: { projectPublicId; kind: CatalogKind; name: string; color?: TagColor }):
  Result<{ name: string; color?: TagColor }>
  // Si ya existe (sin distinguir mayúsculas) devuelve el existente sin error:
  // el pop-up del Work Item lo asigna (FR-013). La pantalla muestra el aviso
  // "already exists" comparando el nombre devuelto.
  // color solo se acepta con kind = "tag"; por defecto "gray".

renameCatalogValue(input: { projectPublicId; kind; name: string; newName: string }): Result<void>
  // NOT_FOUND si `name` no existe; CATALOG_NAME_TAKEN si `newName` choca con OTRO valor.

setTagColor(input: { projectPublicId; name: string; color: TagColor }): Result<void>

reorderCatalog(input: { projectPublicId; kind; orderedNames: string[] }): Result<void>
  // CONFLICT si orderedNames no es exactamente el conjunto actual (sin distinguir mayúsculas).

deleteCatalogValue(input: { projectPublicId; kind; name: string }): Result<{ affectedWorkItems: number }>
  // Una transacción: FOR UPDATE del valor → quitar de los Work Items (updated_at) →
  // logActivity en bloque (fields_edited, reason "catalog_value_deleted") → DELETE.
```

Todas llaman `revalidatePath` del proyecto (tablero, list, table y catálogos).

## Server Actions modificadas

- **`updateWorkItem`** (`lib/actions/work-items.ts`): `iterationName` →
  `sizeName`; opción nueva `createMissingCatalogValues?: boolean` (default
  `true`). Con `false`, un nombre de tag/área/size que no existe devuelve
  `CATALOG_VALUE_NOT_FOUND` con el nombre en el mensaje, sin cambiar nada.
  El historial usa la clave `size`.
- **`createWorkItems`**: igual renombre `iterationName` → `sizeName`.
- **`getBoard`** (`lib/actions/board.ts`): cada `BoardWorkItem` suma
  `tags: { name, color }[]` (orden alfabético), con una consulta extra por
  tablero.
- **`getWorkItemDetailData`** (`lib/actions/work-item-relationships.ts`):
  `catalogIterations`/`itemIteration` → `catalogSizes`/`itemSize`; los
  catálogos vienen en orden manual; `catalogTags` e `itemTags` traen color.
- **`listProjectWorkItems`** (`lib/actions/work-item-views.ts`): ídem para
  List/Table.
- **`listProjectTags`**: orden manual y color.

## MCP (`lib/mcp/tools/`)

- `create_work_items` / `update_work_item`: parámetro `iteration` → `size`
  ("Size name; created if new; null clears it.").
- `get_work_item` / `get_board`: `iteration` → `size`; `tags` →
  `{ name, color }[]`.
- Sin herramientas nuevas; la lista fijada en `tests/unit/mcp-route.test.ts`
  no cambia.

## Contratos de UI

- **Sidebar** (`ProjectSidebarClient`): bajo el proyecto activo, lista de
  opciones anidadas (hoy solo "Tags" → `/projects/{id}/settings/catalogs`),
  con `aria-current` cuando está activa.
- **Página de catálogos** (`app/(workspace)/projects/[projectPublicId]/settings/catalogs/page.tsx`):
  "← Back to settings", tres `<section>` con `id="tags" | "areas" | "sizes"`,
  cada una un `<CatalogSection>`; la página de ajustes existente enlaza aquí.
- **`CatalogSection`** (`components/settings/CatalogSection.tsx`, cliente):
  lista en orden; por fila, nombre (renombrar inline con Enter/Escape), en
  tags un botón de color que abre `TagColorPicker`, botones "Move up"/"Move
  down" con `aria-label` que nombra el valor, y "Delete" que abre un
  `Dialog` de confirmación con "Used by N Work Items". Campo "Add …" al pie.
  Para el Viewer: solo lectura, sin controles. Estado vacío con invitación a
  crear. Actualización optimista con reversión, como el tablero.
- **`TagColorPicker`** (`components/ui/tag-color-picker.tsx`): `radiogroup`
  de muestras con nombre accesible por color ("Blue").
- **`TagChip`** (`components/ui/tag-chip.tsx`): chip con fondo del color;
  usado por `TagPicker` y en el detalle.
- **`TagColorBar`** (`components/board/TagColorBar.tsx`): línea de `h-1` al
  pie de `WorkItemCard` y `WorkItemCardPreview`, un tramo por tag,
  `aria-hidden`; el `aria-label` de la tarjeta suma las tags.
- **`CreateCatalogValueDialog`** (`components/work-items/CreateCatalogValueDialog.tsx`):
  `Dialog dismissible`, campo "Name" precargado, `TagColorPicker` solo para
  tags, botones "Cancel"/"Create". Al confirmar llama `createCatalogValue` y
  devuelve el nombre al picker.
- **`TagPicker` / `CatalogPicker`**: opciones en orden de catálogo, filtradas
  por contenido; si no hay coincidencia exacta, opción "Create new "<texto>""
  que abre el diálogo; Enter sobre una coincidencia exacta la asigna.
- **Detalle del Work Item**: el campo "Iteration" pasa a "Size".
- **List/Table**: columna, filtro y orden "Size"; filtros de tags muestran el
  color.
