# Data Model: Campos Extendidos y Fechas de Work Items

Extiende el esquema documentado en
[001-accounts-invitations/data-model.md](../001-accounts-invitations/data-model.md),
con sus ampliaciones en
[005-work-item-relationships/data-model.md](../005-work-item-relationships/data-model.md)
y [007-roles-permissions/data-model.md](../007-roles-permissions/data-model.md).
Aquí solo se documenta lo nuevo o modificado: dos enums, dos tablas de
catálogo, columnas nuevas en `work_items` y en `stages`, y dos tipos de evento
de actividad. Todo es aditivo y nullable (o con default), así que las filas
existentes siguen siendo válidas sin backfill (FR-018, SC-003).

## Enums nuevos

| Enum | Valores (en este orden) | Notas |
|---|---|---|
| `work_item_priority` | `critical`, `high`, `medium`, `low` | FR-002. El orden de declaración es el orden de urgencia, así que `ORDER BY priority` pone lo más urgente primero (research.md § Prioridad y severidad). |
| `work_item_severity` | `critical`, `high`, `medium`, `low` | FR-003. Es independiente de la prioridad. |

Etiquetas visibles: Crítica/Alta/Media/Baja en la spec. La interfaz, que está
en inglés como el resto de la app, usa Critical/High/Medium/Low. Viven en
`lib/work-item-fields.ts`, no en la base de datos.

## Área (`areas`) — tabla nueva

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `serial` PK | Interno. Nunca sale del servidor como identificador: el cliente usa el nombre. |
| `project_id` | `integer NOT NULL` → `projects.id`, `onDelete: cascade` | Catálogo por proyecto (Clarifications P2, FR-005). |
| `name` | `text NOT NULL` | Se guarda recortado (trim) y conserva las mayúsculas con que se creó. |

Índice único `areas_project_lower_name_idx` sobre `(project_id, lower(name))`:
un nombre repetido sin distinguir mayúsculas reutiliza el existente (FR-006).
Es la misma forma que `tags`.

## Iteración (`iterations`) — tabla nueva

Idéntica a `areas`, con su propio índice único
`iterations_project_lower_name_idx`. Es un catálogo separado: un valor creado
como iteración no aparece como área (Edge Cases). En esta feature una
iteración es solo un nombre, sin fechas (Assumptions, fuera de alcance).

## Work Item (`work_items`) — columnas añadidas

| Campo | Tipo | Notas |
|---|---|---|
| `priority` | `work_item_priority` nullable | `NULL` = sin prioridad. |
| `severity` | `work_item_severity` nullable | `NULL` = sin severidad. |
| `area_id` | `integer` nullable → `areas.id`, `onDelete: set null` | Máximo un área (FR-005). Debe pertenecer al mismo proyecto, lo que se garantiza al resolver el nombre dentro del proyecto del Work Item (FR-021). |
| `iteration_id` | `integer` nullable → `iterations.id`, `onDelete: set null` | Igual que `area_id`. |
| `start_date` | `date` nullable (Drizzle `mode: "string"`) | Día de calendario, sin hora (FR-009). |
| `target_date` | `date` nullable (Drizzle `mode: "string"`) | Día de calendario. Es la base de la marca de vencido (FR-010). |
| `closed_at` | `timestamptz` nullable | Momento del cierre. Lo escribe **solo** el sistema (FR-013). Ver la invariante abajo. |

Columnas existentes que ahora se muestran:

| Campo | Cambio |
|---|---|
| `created_at` | Ninguno. Se muestra como "Created" (FR-008). |
| `updated_at` | Se muestra como "Last modified" (FR-008). `reorderWorkItemsInStage` deja de escribirlo (research.md § `updated_at`). Lo siguen escribiendo editar campos, mover, cerrar/reabrir y el efecto de marcar o desmarcar una columna de cierre. |

Restricción nueva:
`CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date)`
(`work_items_dates_order_check`) — FR-009. La aplicación la valida antes con
un mensaje claro (`INVALID_DATE_RANGE`).

No se agregan índices sobre `area_id`, `iteration_id`, `priority` ni
`target_date` en esta feature. Ninguna consulta de 008 filtra ni ordena por
ellos: el tablero ya carga todos los Work Items del proyecto por
`work_items_project_id_idx`. Si 009 los necesita para ordenar o filtrar, los
agregará con evidencia (Principio VI).

## Stage/Columna (`stages`) — columna añadida

| Campo | Tipo | Notas |
|---|---|---|
| `is_closing` | `boolean NOT NULL DEFAULT false` | FR-011. Todas las columnas existentes quedan como "no de cierre", así que ningún Work Item existente pasa a estar cerrado (Edge Cases: proyectos existentes). |

## Invariante de cierre

```
work_items.closed_at IS NOT NULL  ⇔  stages.is_closing = true   (para la columna del Work Item)
```

- "El Work Item está cerrado" no se guarda: se deriva de `stages.is_closing`
  (FR-012).
- La mantienen, en la misma transacción, todas las acciones que cambian la
  columna de un Work Item o la marca de una columna. Todas pasan por la
  función pura `nextClosedAt` (research.md § Estado de cierre derivado) y
  bloquean las filas de `stages` afectadas (research.md § Concurrencia).
- Se verifica con esta consulta, que debe devolver 0 (SC-006):

```sql
SELECT count(*) FROM work_items wi JOIN stages s ON s.id = wi.stage_id
WHERE s.is_closing <> (wi.closed_at IS NOT NULL);
```

### Transiciones de estado de un Work Item

```
                 mover a columna de cierre / "Cerrar" /
                 crear en columna de cierre / su columna se marca
   ┌─────────┐  ─────────────────────────────────────────────▶  ┌──────────┐
   │ Abierto │                                                   │ Cerrado  │
   │closed_at│  ◀─────────────────────────────────────────────   │closed_at │
   │ = NULL  │    mover a columna que no es de cierre /          │ = now()  │
   └─────────┘    su columna se desmarca                         └──────────┘
                                                                 ▲        │
                                   mover entre columnas de cierre └────────┘
                                   (closed_at sin cambios, sin evento de cierre)
```

## Log de actividad (`work_item_activity`) — tipos de evento

Sin cambios de esquema: `type` es texto libre y `payload` es `jsonb`.

| `type` | Estado | `payload` | Cuándo |
|---|---|---|---|
| `fields_edited` | existente, **claves nuevas** | `{ fields: { <campo>: { from, to } } }`. Campos nuevos: `priority`, `severity` (valor del enum o `null`), `area`, `iteration` (**nombre** o `null`), `startDate`, `targetDate` (`"YYYY-MM-DD"` o `null`) | `updateWorkItem` cambia cualquiera de ellos, en el mismo evento que título, descripción, stakeholder y tags. |
| `stage_changed` | existente, sin cambios | `{ fromStageId, toStageId }` | Todo movimiento de columna, incluido el que hace "Cerrar". |
| `closed` | **nuevo** | `{ closedAt: ISO string, stageName: string, via: "move" \| "close_button" \| "created" \| "stage_marked" }` | El Work Item pasa de abierto a cerrado. |
| `reopened` | **nuevo** | `{ stageName: string, via: "move" \| "stage_unmarked" }` | El Work Item pasa de cerrado a abierto. `stageName` es la columna **destino** (o la desmarcada). |

Se guardan nombres, no ids, para que el historial se lea sin joins y siga
siendo correcto aunque la columna se renombre o se elimine después
(research.md § Auditoría legible).

## Migración

Se genera con `npm run db:generate` como `db/migrations/0004_<nombre>.sql` y
debe contener exactamente:

1. `CREATE TYPE work_item_priority AS ENUM ('critical','high','medium','low')`
   y lo mismo para `work_item_severity`.
2. `CREATE TABLE areas (…)` y `CREATE TABLE iterations (…)`, con sus FK en
   cascada e índices únicos `lower(name)`.
3. `ALTER TABLE work_items ADD COLUMN` para `priority`, `severity`, `area_id`,
   `iteration_id`, `start_date`, `target_date` y `closed_at` (todas
   nullable), las dos FK con `ON DELETE SET NULL` y el `CHECK` de orden de
   fechas.
4. `ALTER TABLE stages ADD COLUMN is_closing boolean DEFAULT false NOT NULL`.

No hay migración de datos: todas las columnas nuevas nacen en `NULL` o
`false`, y la invariante de cierre se cumple desde el primer momento (ninguna
columna es de cierre y ningún Work Item tiene `closed_at`). La migración va
**antes** del código nuevo en el despliegue, porque el código nuevo lee las
columnas nuevas. El código viejo funciona igual sobre el esquema nuevo porque
todo es aditivo.
