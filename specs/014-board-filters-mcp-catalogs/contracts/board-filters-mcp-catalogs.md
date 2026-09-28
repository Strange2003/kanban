# Contract: Filtros del Tablero y Catálogos por MCP

Extiende [011-agent-access-mcp/contracts/mcp-tools.md](../../011-agent-access-mcp/contracts/mcp-tools.md)
y [013-project-catalogs/contracts/project-catalogs.md](../../013-project-catalogs/contracts/project-catalogs.md).
Lo que no se menciona aquí no cambia.

## Permisos

Sin claves nuevas en `lib/roles.ts`.

| Operación | Permiso | Quién |
|---|---|---|
| Filtrar el tablero | membresía (`requireProjectMember` en `getBoard`) | Owner, Member, Viewer |
| `list_catalogs` | membresía (`getProjectCatalogs`) | Owner, Member, Viewer |
| `set_tag_color` | `catalog:manage` (`setTagColor`) | Owner, Member |
| Tag nueva con color en `create_work_items` / `update_work_item` | `workItem:edit` (como crear una tag hoy) | Owner, Member |

## Módulos

| Módulo | Cambio |
|---|---|
| `lib/work-item-view.ts` (puro) | NUEVO `matchesAssigneeAndTags(item: { assigneeUserId: string \| null; tagNames: string[] }, query, currentUserId)`; `filterWorkItems` lo usa. `serializeViewQuery(query, "board")` escribe solo `assignee` y `tag`. NUEVO `BOARD_QUERY_KEYS = ["assignee", "tag"]`. |
| `lib/actions/board.ts` | `getBoard` devuelve además `currentUserId`, `members`, `tagCatalog` ([data-model.md](../data-model.md#resultado-de-getboard-ampliado)). |
| `lib/actions/work-items.ts` | `WorkItemFieldsInput.newTagColors?: Record<string, TagColor>`; `applyWorkItemFields` pasa el color a `resolveCatalogValue` al crear. |
| `lib/work-item-catalogs.ts` (servidor) | NUEVO `listWorkItemTags(projectId, workItemIds): Map<number, { name, color }[]>` (solo lectura, filtra por proyecto). |
| `lib/mcp/tools/catalogs.ts` | NUEVO: `list_catalogs`, `set_tag_color`. |
| `lib/mcp/tools/{read,work-items,columns}.ts` | Todas las entradas con `z.strictObject`; `tags` acepta `string \| { name, color }`; respuestas con `tags`. |
| `lib/mcp/server.ts` | Registra `registerCatalogTools`; instrucciones con la frase de catálogos. |

## Herramientas MCP

### Nuevas

| Herramienta | Entrada | Salida | Reutiliza | FR |
|---|---|---|---|---|
| 🔍 `list_catalogs` | `{ projectId }` | `{ tags: [{ name, color, workItemCount }], areas: [{ name, workItemCount }], sizes: [{ name, workItemCount }], colors: TagColor[] }`, cada lista en orden manual | `getProjectCatalogs` | FR-015 |
| ✏️ `set_tag_color` | `{ projectId, tag: string, color: TagColor }` | `{ name, color }` | `setTagColor` | FR-018 |

`set_tag_color` lleva `idempotentHint: true` (repetirla deja el mismo estado).
Errores: tag inexistente → `NOT_FOUND`; Viewer → `ROLE_NOT_PERMITTED`; color
fuera de la paleta → error de validación con los colores válidos.

### Modificadas

| Herramienta | Cambio | FR |
|---|---|---|
| ✏️ `create_work_items` | `items[].tags?: (string \| { name, color })[]`. Salida: `created: [{ workItemId, title, tags: [{ name, color }] }]`. | FR-016, FR-017 |
| ✏️ `update_work_item` | `tags?: (string \| { name, color })[]`. Salida: `{ workItemId, title, tags: [{ name, color }] }`. | FR-016, FR-017 |
| Todas | Entradas estrictas: un campo desconocido, en la raíz o en un objeto anidado, rechaza la llamada. | FR-021 |

Semántica de `{ name, color }`:

1. La tag se busca por nombre en el proyecto sin distinguir mayúsculas.
2. Si existe, se asigna tal cual; el `color` enviado se ignora y la respuesta
   muestra el color real.
3. Si no existe, se crea al final del catálogo con ese color (gris si se envió
   solo el nombre).
4. Si el mismo nombre aparece más de una vez en la lista, se asigna una vez y,
   si se crea, usa el primer color indicado.

### Error por campo desconocido

Lo produce el SDK antes de ejecutar la herramienta, así que no se ejecuta
ninguna acción:

```json
{ "isError": true, "content": [{ "type": "text",
  "text": "Input validation error: Invalid arguments for tool update_work_item: Unrecognized key: \"colour\"" }] }
```

Dentro de una lista, el texto incluye la ruta (`items.0: Unrecognized key: "foo"`).
El JSON Schema publicado en `tools/list` lleva `additionalProperties: false`
en todos los objetos.

### Siguen excluidas (FR-020)

No hay herramientas para crear un valor de catálogo suelto, ni para
renombrarlo, reordenarlo o eliminarlo. Tampoco cambia nada de la lista de
exclusiones de FR-023 de 011.

### Instrucciones del servidor

Se agrega: *"Before assigning tags, areas or sizes, call list_catalogs and
reuse existing values instead of creating variants."*

## Invariantes (verificadas por test)

1. `tools/list` devuelve exactamente las 18 herramientas (las 16 de antes + `list_catalogs` + `set_tag_color`)
   con sus anotaciones (`tests/unit/mcp-route.test.ts`).
2. Todo objeto del JSON Schema de entrada de toda herramienta tiene
   `additionalProperties: false`.
3. `set_tag_color` escribe solo a través de `setTagColor`; las herramientas
   nuevas no escriben con `db`.
4. `matchesAssigneeAndTags` y `filterWorkItems` dan el mismo resultado para
   asignado y tags (tests de tabla en `tests/unit/work-item-view.test.ts`).

## UI

| Componente | Cambio |
|---|---|
| `components/board/BoardFilters.tsx` | NUEVO: filtros Assignee y Tags (reusa `MultiSelectFilter` exportado de `ViewFilters.tsx`), etiquetas de filtros activos y "Clear filters". |
| `components/views/ViewFilters.tsx` | Exporta `MultiSelectFilter` y el armado de opciones de asignado. |
| `components/views/useViewQuery.ts` | Acepta `"board"`. |
| `components/board/Board.tsx` | Lee la query, filtra, pasa visibles y total a cada columna, reorden por teclado entre visibles, guarda la query en `sessionStorage`, aviso de creación oculta. |
| `components/board/StageColumn.tsx` | Contador `visibles/total` con filtro activo; mensaje "Hidden by filters" cuando no queda ninguna visible. |
| `components/board/AddWorkItemButton.tsx` | Callback opcional `isHiddenByFilters` → toast. |
| `components/views/ProjectViewHeader.tsx` | Conserva `assignee`/`tag` al cambiar de vista en ambos sentidos. |
| `components/work-items/WorkItemDetailView.tsx` | "Back to board" y la redirección tras eliminar agregan la query guardada. |
| `app/(workspace)/projects/[projectPublicId]/page.tsx` | Pasa `currentUserId`, `members`, `tagCatalog` al `Board`; `Suspense` alrededor del `Board` (usa `useSearchParams`). |
