# Data Model: Filtros del Tablero y Catálogos por MCP

**Sin cambios de esquema ni migración.** Esta feature no agrega tablas,
columnas ni tipos de evento. Todo lo que sigue son formas de datos en memoria o
de entrada/salida.

## Filtro del tablero (en la URL)

Subconjunto de `ViewQuery` (`lib/work-item-view.ts`, 009-work-item-views):

| Campo | Parámetro | Valores | Regla |
|---|---|---|---|
| `assignees` | `assignee` (repetido) | user id de un miembro, `me`, `none` | O entre valores; `me` = el usuario actual; `none` = sin asignado |
| `tags` | `tag` (repetido) | nombre de tag, `none` | O entre valores; sin distinguir mayúsculas; `none` = sin tags |

- Ambos filtros se combinan con Y.
- Un valor desconocido no coincide con nada y se muestra como filtro activo
  removible (mismo comportamiento que List/Table).
- Los demás campos de `ViewQuery` se parsean pero el tablero los ignora y no
  los vuelve a escribir.
- Copia por pestaña en `sessionStorage["kanban:board-query:{projectPublicId}"]`
  (cadena de query sin `?`), solo para el enlace "Back to board"
  ([research.md](research.md#decisión-volver-del-detalle-al-tablero-conserva-el-filtro)).

## Resultado de `getBoard` (ampliado)

```ts
{
  stages: StageWithCount[];          // sin cambios
  workItems: BoardWorkItem[];        // sin cambios
  role: ProjectRole;                 // sin cambios
  projectName: string;               // sin cambios
  currentUserId: string;             // NUEVO — resuelve "me"
  members: AssigneeView[];           // NUEVO — miembros actuales, por nombre
  tagCatalog: { name: string; color: TagColor }[]; // NUEVO — orden manual (position, id)
}
```

## Entrada de tags de las herramientas MCP

```ts
type ToolTag = string | { name: string; color: TagColor }; // objeto estricto
```

Se traduce a la Server Action como:

| Campo de `WorkItemFieldsInput` | Tipo | Nota |
|---|---|---|
| `tagNames` | `string[]` | sin cambios: la lista completa de tags |
| `newTagColors` | `Record<string, TagColor>` (opcional) | NUEVO. Clave = nombre en minúsculas. Solo se usa si la tag se **crea**; el primer color gana si se repite. Validado con `z.enum(TAG_COLORS)` |

## Salida nueva de las herramientas

- `list_catalogs`:
  `{ tags: { name, color, workItemCount }[], areas: { name, workItemCount }[], sizes: { name, workItemCount }[], colors: TagColor[] }`
- `set_tag_color`: `{ name, color }` (nombre con la escritura del catálogo).
- `create_work_items`: cada elemento de `created` suma `tags: { name, color }[]`.
- `update_work_item`: suma `tags: { name, color }[]`.

## Reglas de validación

- Color fuera de `TAG_COLORS` → error de validación con la lista de colores
  válidos (FR-019).
- Campo desconocido en cualquier objeto de entrada de una herramienta → error
  de validación que nombra el campo y su ruta (FR-021).
- `set_tag_color` con un nombre que no existe en el proyecto → `NOT_FOUND`
  (FR-018, escenario 8 de US4); con rol Viewer → `ROLE_NOT_PERMITTED`.

## Auditoría

- Filtrar no escribe nada.
- Crear una tag con color al asignarla registra el mismo `fields_edited` de
  siempre (cambio de `tags` del Work Item).
- `set_tag_color` es un cambio del catálogo: sin entrada de historial en los
  Work Items (igual que FR-003/FR-005 de 013).
