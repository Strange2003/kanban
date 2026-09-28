# Data Model: Catálogos por Proyecto

Cambios sobre el esquema de 008-work-item-fields
([data-model.md](../008-work-item-fields/data-model.md)). Decisiones y
alternativas en [research.md](research.md).

## Enum nuevo: `tag_color`

`gray | red | orange | amber | green | teal | blue | indigo | violet | pink`,
generado desde `TAG_COLORS` de `lib/tag-colors.ts` (puro, compartido con el
cliente), igual que `WORK_ITEM_LEVELS` en 008.

## `tags` (modificada)

| Columna | Tipo | Notas |
|---|---|---|
| `color` | `tag_color NOT NULL DEFAULT 'gray'` | **Nueva.** Las filas existentes quedan en gris (FR-009). |
| `position` | `integer NOT NULL` | **Nueva.** Orden manual dentro del proyecto (FR-003a). |

Sin cambios: `id`, `project_id` (cascade), `name`, índice único
`(project_id, lower(name))`.

## `areas` (modificada)

| Columna | Tipo | Notas |
|---|---|---|
| `position` | `integer NOT NULL` | **Nueva.** Igual que en `tags`. |

## `sizes` (antes `iterations`, renombrada)

Misma forma que `areas`: `id`, `project_id` (cascade), `name`, índice único
`sizes_project_lower_name_idx (project_id, lower(name))`, y `position integer
NOT NULL` nueva. Conserva ids y filas de `iterations` (FR-016).

## `work_items` (modificada)

- `iteration_id` → **`size_id`** (renombrada), FK a `sizes.id` `ON DELETE SET
  NULL` (defensivo: `deleteCatalogValue` pone `NULL` explícitamente y registra
  historial antes de borrar).
- Sin columnas nuevas.

## Reglas de validación

- Nombre: `trim`, no vacío, único por proyecto sin distinguir mayúsculas, y
  máx. 50 caracteres al crear o renombrar desde las acciones de catálogo
  (hoy no hay límite; los valores existentes más largos se conservan).
  Colisión al crear/renombrar desde la pantalla → `CATALOG_NAME_TAKEN`.
  Renombrar cambiando solo mayúsculas del mismo valor está permitido.
- `color` ∈ `TAG_COLORS`; solo aplica a `kind = "tag"`.
- `position`: la escribe solo el sistema (alta = `max + 1`, reordenar = índice
  de la lista). El cliente nunca la envía como número.
- Lecturas de catálogo: `ORDER BY position, id`.
- Orden de las tags de un Work Item: alfabético (sin cambio).

## Eventos de historial

Sin tipos nuevos. Todos pasan por `logActivity`.

- **Eliminar un valor en uso**: un `fields_edited` por Work Item afectado,
  en la misma transacción que el borrado:
  - área/size: `{ fields: { area | size: { from: "<nombre>", to: null } }, reason: "catalog_value_deleted" }`
  - tag: `{ fields: { tags: { from: [...], to: [...] } }, reason: "catalog_value_deleted" }`
- **Asignar Size**: `fields_edited` con clave `size` (antes `iteration`).
- **Lectura del historial antiguo**: `describeWorkItemActivity` muestra las
  claves `iteration` y `size` como "Size"; con `reason:
  "catalog_value_deleted"` agrega "(value deleted)".
- Renombrar, cambiar color y reordenar **no** escriben historial (FR-005,
  FR-003a).

## Migración `0008`

Escrita a mano (`drizzle-kit generate --custom`, ver research.md). Orden:

1. `CREATE TYPE "tag_color" AS ENUM (...)`.
2. `ALTER TABLE "tags" ADD COLUMN "color" "tag_color" DEFAULT 'gray' NOT NULL`.
3. Renombrar `iterations` → `sizes`: tabla, secuencia `iterations_id_seq`,
   PK `iterations_pkey`, FK `iterations_project_id_projects_id_fk` e índice
   `iterations_project_lower_name_idx` a sus nombres `sizes_*`.
4. `ALTER TABLE "work_items" RENAME COLUMN "iteration_id" TO "size_id"` y
   renombrar la FK `work_items_iteration_id_iterations_id_fk` →
   `work_items_size_id_sizes_id_fk`.
5. En `tags`, `areas` y `sizes`: `ADD COLUMN "position" integer`, llenarla con
   `row_number() OVER (PARTITION BY project_id ORDER BY lower(name), id) - 1`,
   y luego `SET NOT NULL`.

Los nombres de restricciones e índices deben coincidir con los que genera
drizzle para `schema.ts`, para que el snapshot quede alineado. Se aplica en
`dev` primero y en producción antes de hacer push del código.

## Integridad y aislamiento

- Todo acceso resuelve el catálogo **dentro del proyecto** de la ruta o del
  Work Item (`project_id = ?` en cada consulta); ningún id interno sale del
  servidor (FR-020).
- `tags`, `areas` y `sizes` siguen borrándose en cascada con el proyecto;
  `work_item_tags` en cascada con la tag.
