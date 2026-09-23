# Data Model: Vistas de Lista y Tabla

**Sin cambios de esquema.** Esta feature no agrega tablas, columnas, índices
ni migraciones (research.md § Sin cambios de esquema). Lee lo que ya existe:

- `work_items`: con los campos de 004, el padre de 005 y los campos de 008.
- `stages`: nombre, posición e `is_closing`.
- `areas` e `iterations`: los catálogos de 008.
- `tags` y `work_item_tags`: de 004.

Lo que sí se define aquí son los **modelos de vista**: las formas de dato que
viajan del servidor al cliente y el estado de filtros y orden que vive en la
dirección.

## Fila de vista (`WorkItemViewRow`)

Un Work Item "aplanado" para mostrar, sin ids internos salvo el del Work Item
(que el tablero y el detalle ya envían al cliente).

| Campo | Tipo | Origen | Uso |
|---|---|---|---|
| `id` | `number` | `work_items.id` | Clave de fila y del árbol. |
| `displayNumber` | `number` | `work_items.display_number` | Enlace al detalle (`/work-items/<n>`), desempate del orden, búsqueda. |
| `displayId` | `string` | `<prefijo>-<n>` | Columna ID y búsqueda (FR-005). |
| `title` | `string` | `work_items.title` | Columna título y búsqueda. |
| `parentId` | `number \| null` | `work_items.parent_work_item_id` | Árbol de la Lista (FR-012). |
| `stagePublicId` | `string` | `stages.public_id` | Filtro por columna (en la dirección). |
| `stageName` | `string` | `stages.name` | Columna "Column". |
| `stagePosition` | `number` | `stages.position` | Ordenar por columna del tablero (FR-006). |
| `isClosed` | `boolean` | `stages.is_closing` | Estado abierto/cerrado (derivado, FR-012 de 008). |
| `priority`, `severity` | `WorkItemLevel \| null` | `work_items` | Columnas, orden por nivel y filtros. |
| `areaName`, `iterationName` | `string \| null` | `LEFT JOIN areas/iterations` | Columnas y filtros. |
| `tags` | `string[]` (orden alfabético) | `work_item_tags ⋈ tags` | Columna y filtro (no ordenable). |
| `stakeholder` | `string \| null` | `work_items` | Columna. |
| `startDate`, `targetDate` | `string \| null` (`"YYYY-MM-DD"`) | `work_items` | Columnas, orden y vencido. |
| `createdAt` | `Date` | `work_items.created_at` | Columna y orden. |
| `closedAt` | `Date \| null` | `work_items.closed_at` | Columna, orden y vencido. |

## Opciones de filtro (`WorkItemViewOptions`)

| Campo | Tipo | Notas |
|---|---|---|
| `stages` | `{ publicId, name, isClosing }[]` | En orden del tablero. |
| `areas`, `iterations`, `tags` | `string[]` | Catálogos **completos** del proyecto, aunque un valor no se use (Edge Cases). |

## Consulta de vista (`ViewQuery`, en la dirección)

Estado derivado de los parámetros de la dirección (research.md § Filtros y
orden en la dirección). Nunca se guarda.

| Campo | Tipo | Parámetro | Por defecto |
|---|---|---|---|
| `status` | `"open" \| "closed" \| null` | `status` | `null` (todos) |
| `stages` | `string[]` (publicIds) | `stage` | `[]` (sin filtro) |
| `priorities`, `severities` | `(WorkItemLevel \| "none")[]` | `priority`, `severity` | `[]` |
| `areas`, `iterations`, `tags` | `string[]` (nombres; `"none"` = sin valor) | `area`, `iteration`, `tag` | `[]` |
| `overdue` | `boolean` | `overdue=1` | `false` |
| `q` | `string` (recortado) | `q` | `""` |
| `sort` | `SortKey` | `sort` | `"id"` |
| `dir` | `"asc" \| "desc"` | `dir` | `"asc"` |

`SortKey` es uno de: `id`, `title`, `stage`, `status`, `priority`,
`severity`, `area`, `iteration`, `stakeholder`, `startDate`, `targetDate`,
`createdAt` o `closedAt`. `tags` no es ordenable (FR-006).

Reglas de validación de `parseViewQuery`:

- Un valor desconocido de `status`, `sort`, `dir`, nivel o columna se
  descarta sin error, y el resto de la consulta sigue aplicándose (Edge
  Cases).
- Área, iteración y tag no se validan contra el catálogo al parsear: un
  nombre que no existe no coincide con ninguna fila y el resultado queda
  vacío, lo mismo que "filtro de un valor que ya no se usa".
- Las comparaciones de nombres de área, iteración y tag no distinguen
  mayúsculas, igual que los catálogos de 004 y 008.
- Los valores repetidos se deduplican.
- Los filtros de varios valores repiten el parámetro (`tag=a&tag=b`); no se separan por comas, porque los nombres pueden contenerlas.

Semántica de filtros (FR-007):

- Distintos filtros se combinan con **Y**.
- Dentro de un mismo filtro, los valores se combinan con **O**.
- `"none"` coincide con un campo vacío. Para tags, coincide con un Work Item
  sin ningún tag.
- `overdue` usa `isOverdue(targetDate, closedAt, today)` de 008.
- `q` busca en `title` y `displayId` sin distinguir mayúsculas.

## Nodo de árbol (`WorkItemTreeNode`, Lista)

| Campo | Tipo | Notas |
|---|---|---|
| `row` | `WorkItemViewRow` | |
| `children` | `WorkItemTreeNode[]` | Hermanos por `displayNumber` ascendente (FR-012). |
| `isContext` | `boolean` | `true` si el Work Item solo está como ancestro de uno que cumple el filtro. Se muestra atenuado (FR-015). |
| `childCount` | `number` | Hijos directos **en el proyecto**, para el indicador de plegado (FR-014). Puede ser mayor que `children.length` cuando un filtro oculta hijos. |

Invariantes (SC-006): cada Work Item del conjunto mostrado aparece
**exactamente una vez**, bajo su padre real, o como raíz si no tiene padre o
su padre no está en el proyecto. Un ciclo, que 005 impide, no puede colgar el
armado: se corta con un conjunto de visitados.
