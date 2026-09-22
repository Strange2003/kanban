# Contratos: Campos Extendidos y Fechas de Work Items

Cubre [008-work-item-fields](../spec.md). Sigue el patrón de Server Actions con
`Result<T>` documentado en
[001-accounts-invitations/contracts/](../../001-accounts-invitations/contracts/)
y las claves de permiso de
[007-roles-permissions/contracts/roles-permissions.md](../../007-roles-permissions/contracts/roles-permissions.md).
Esta feature no expone endpoints HTTP nuevos. Todos los contratos son
funciones exportadas de `lib/actions/**`, más módulos puros o de servidor sin
`"use server"`.

> **Nota de implementación** (lección de
> [005 research.md § Hallazgo](../../005-work-item-relationships/research.md)):
> ninguna acción de este contrato obliga al cliente a encadenar una segunda
> Server Action. Tras `closeWorkItem` o `setStageClosing`, el cliente refresca
> con `router.refresh()`.

## Permisos

**No hay claves nuevas** (FR-019). Se agrega una fila a la matriz de 007 solo
como documentación:

| Acción | Clave de permiso | Owner | Miembro | Lector |
|---|---|:-:|:-:|:-:|
| Editar prioridad, severidad, área, iteración, fechas; crear valores de área/iteración | `workItem:edit` | ✔ | ✔ | ✘ |
| "Cerrar" un Work Item | `workItem:edit` | ✔ | ✔ | ✘ |
| Marcar/desmarcar una columna como de cierre | `board:edit` | ✔ | ✔ | ✘ |
| Ver todos los campos nuevos, el estado de cierre y qué columnas son de cierre | *(sin clave: `requireProjectMember`)* | ✔ | ✔ | ✔ |

`tests/unit/action-permissions.test.ts` MUST incluir `closeWorkItem` y
`setStageClosing` en `CASES`. El test "every action is covered" falla si
falta alguna.

## Módulo `lib/work-item-fields.ts` (nuevo, puro, importable desde cliente y servidor)

```ts
export const WORK_ITEM_LEVELS = ["critical", "high", "medium", "low"] as const;
export type WorkItemLevel = (typeof WORK_ITEM_LEVELS)[number];   // prioridad y severidad
export const LEVEL_LABELS: Record<WorkItemLevel, string>;        // Critical / High / Medium / Low
export function isOverdue(targetDate: string | null, closedAt: Date | string | null, today: string): boolean;
// true si targetDate < today (comparando "YYYY-MM-DD") y closedAt es null — FR-010
```

`db/schema.ts` construye los dos `pgEnum` a partir de `WORK_ITEM_LEVELS`, así
los valores se declaran en un solo lugar.

## Módulo `lib/work-item-closing.ts` (nuevo, puro)

```ts
type ClosingTransition =
  | { closedAt: Date | null; event: null }                     // sin cambio de estado
  | { closedAt: Date; event: "closed" }
  | { closedAt: null; event: "reopened" };

export function nextClosedAt(input: {
  fromIsClosing: boolean | null;   // null = el Work Item se está creando
  toIsClosing: boolean;
  currentClosedAt: Date | null;
  now: Date;
}): ClosingTransition;
```

Es la única implementación de la tabla de transiciones de
[research.md § Estado de cierre derivado](../research.md). Tiene tests
unitarios tabla por tabla.

## Módulo `lib/work-item-catalogs.ts` (nuevo, solo servidor, **sin** `"use server"`)

No hace ninguna verificación de sesión ni de membresía: quien lo llama ya la
hizo, igual que `lib/work-item-queries.ts`.

```ts
type CatalogKind = "area" | "iteration";
listCatalog(kind: CatalogKind, projectId: number): Promise<string[]>;            // nombres, orden alfabético
resolveCatalogValue(tx, kind: CatalogKind, projectId: number, name: string): Promise<{ id: number; name: string }>;
// Reutiliza sin distinguir mayúsculas, o inserta. Ante una carrera con el índice único,
// hace `ON CONFLICT DO NOTHING` y relee.
```

## Acciones modificadas

### `updateWorkItem` (`lib/actions/work-items.ts`) — campos añadidos

```ts
updateWorkItem(input: {
  workItemId: number;
  title?: string; description?: string; stakeholder?: string; tagNames?: string[];   // existentes
  priority?: WorkItemLevel | null;
  severity?: WorkItemLevel | null;
  areaName?: string | null;        // "" o solo espacios se trata como null
  iterationName?: string | null;
  startDate?: string | null;       // "YYYY-MM-DD"
  targetDate?: string | null;      // "YYYY-MM-DD"
}): Promise<Result<WorkItemWithDisplayId>>;
```

- `undefined` significa no tocar el campo, y `null` significa vaciarlo.
- Permiso: `workItem:edit`, igual que hoy.
- Valida con zod: enum de nivel y `z.iso.date()`. El orden de fechas se
  comprueba contra el valor **resultante**: el nuevo si llega, o el guardado
  si no. Así se detecta el caso "solo cambio el inicio y queda después del
  objetivo".
- `closed_at` **no** es un campo de entrada (FR-013).
- Todos los cambios reales van en un único evento `fields_edited`
  ([data-model.md § Log de actividad](../data-model.md)). Si nada cambió, no
  escribe nada.

| Código | Cuándo |
|---|---|
| `VALIDATION_ERROR` | Nivel fuera del enum, fecha con formato inválido o nombre de catálogo vacío tras recortar (existente). |
| `INVALID_DATE_RANGE` | **nuevo**. Fecha objetivo anterior a la de inicio (FR-009). |

### `moveWorkItem` (`lib/actions/work-items.ts`)

La firma no cambia. Dentro de la transacción:

1. Lee las columnas de origen y destino con `FOR SHARE`.
2. **Nuevo**: rechaza con `NOT_FOUND` si la columna destino no pertenece al
   proyecto del Work Item (research.md § Hallazgo).
3. Aplica `nextClosedAt` y escribe `closed_at` junto con `stage_id` y
   `position`.
4. Registra `stage_changed` (existente) y, si corresponde, `closed` o
   `reopened` con `via: "move"`.

### `createWorkItem` (`lib/actions/work-items.ts`)

La firma no cambia. Lee su columna con `FOR SHARE`. Si es de cierre, el Work
Item nace con `closed_at = now()` y se registra `closed` con
`via: "created"` (Edge Cases).

### `reorderWorkItemsInStage` (`lib/actions/work-items.ts`)

La firma no cambia. Deja de escribir `updated_at` (research.md §
`updated_at`).

### `getBoard` (`lib/actions/board.ts`)

La firma no cambia. `StageWithCount` incluye `isClosing` y
`WorkItemWithDisplayId` incluye las columnas nuevas, porque ambos tipos se
derivan de `$inferSelect`. No hacen falta joins nuevos: la tarjeta solo
necesita `priority`, `targetDate` y `closedAt` (FR-016).

### `getWorkItemDetailData` (`lib/actions/work-item-relationships.ts`)

Devuelve además:

```ts
{
  // …existentes: catalogTags, itemTags, activity, relations, pickableWorkItems, role
  catalogAreas: string[];
  catalogIterations: string[];
  itemArea: string | null;
  itemIteration: string | null;
  stage: { name: string; isClosing: boolean };   // columna actual; isClosing ⇒ cerrado (FR-012/FR-014)
  hasClosingStage: boolean;                      // habilita "Cerrar" (FR-014)
}
```

## Acciones nuevas

### `closeWorkItem(workItemId: number): Promise<Result<void>>` (`lib/actions/work-items.ts`)

FR-014. Permiso: `workItem:edit`.

1. `getWorkItemAndProject`, luego `requireProjectPermission(project.publicId, "workItem:edit")`.
2. En una transacción: lee la columna actual y la primera columna de cierre
   del proyecto (`ORDER BY position LIMIT 1`), ambas con `FOR SHARE`.
3. Si no hay columna de cierre, devuelve `NO_CLOSING_STAGE`. Si la columna
   actual ya es de cierre, devuelve `ALREADY_CLOSED`.
4. Si no, mueve el Work Item al final de esa columna. El algoritmo de
   posiciones es el mismo que en `moveWorkItem` y se comparte en un helper
   **no exportado** del mismo archivo. Pone `closed_at = now()` y registra
   `stage_changed` + `closed` con `via: "close_button"`.
5. `revalidatePath` del tablero.

| Código | Cuándo | Reacción de la UI |
|---|---|---|
| `NO_CLOSING_STAGE` | El proyecto no tiene columnas de cierre (p. ej. se desmarcaron mientras el detalle estaba abierto). | Mostrar el mensaje y `router.refresh()`: el botón queda deshabilitado con su explicación. |
| `ALREADY_CLOSED` | Alguien ya lo cerró o movió a una columna de cierre. | `router.refresh()`. El detalle muestra "Closed". |
| `ROLE_NOT_PERMITTED` | Lector (existente, 007). | Igual que el resto: mensaje + `router.refresh()`. |

### `setStageClosing(input): Promise<Result<void>>` (`lib/actions/board.ts`)

```ts
setStageClosing(input: { projectPublicId: string; stagePublicId: string; isClosing: boolean }): Promise<Result<void>>;
```

FR-011 y FR-013. Permiso: `board:edit`.

1. `requireProjectPermission(projectPublicId, "board:edit")`.
2. En una transacción: lee la columna (`publicId` + `projectId`) con
   `FOR UPDATE`. Si no existe en el proyecto, devuelve `NOT_FOUND`. Si
   `is_closing` ya tiene ese valor, no hace nada (idempotente, sin eventos).
3. Actualiza `stages.is_closing`.
4. Actualiza **todos** los Work Items de la columna: con
   `isClosing = true`, `closed_at = now()`; con `false`, `closed_at = NULL`.
   En ambos casos también `updated_at`. Inserta en bloque un evento por Work
   Item: `closed` con `via: "stage_marked"` o `reopened` con
   `via: "stage_unmarked"`.
5. `revalidatePath` del tablero.

La interfaz aplica el cambio de forma optimista sobre la columna y sus
tarjetas, y lo revierte si falla, igual que al reordenar columnas
(Principio I).

## Interfaz (resumen de contratos de componentes)

| Componente | Contrato |
|---|---|
| `components/board/WorkItemCard.tsx` | Muestra `<PriorityBadge>` si `priority` no es `null` y `<TargetDateChip>` si `targetDate` no es `null`. El chip usa estilo de vencido cuando `isOverdue(targetDate, closedAt, today)` y `today` (de `useLocalToday()`) no es `null`. `aria-label` de la tarjeta: agrega la prioridad y "overdue" cuando corresponda (accesibilidad de SC-002). |
| `components/board/StageColumn.tsx` | Indicador visible de columna de cierre para todos los roles (FR-011). Con `canEdit`, muestra `<ClosingStageToggle>` en la cabecera. |
| `components/board/ClosingStageToggle.tsx` (nuevo) | Botón con `aria-pressed` y `aria-label` "Mark as closing column" / "Unmark closing column". Llama a `setStageClosing` a través de un callback optimista de `Board`. |
| `components/board/Board.tsx` | Mover una tarjeta calcula `closedAt` de forma optimista con `nextClosedAt`, así la marca de vencido desaparece al instante. Maneja el cambio de marca de una columna de forma optimista, con reversión. |
| `components/work-items/WorkItemDetailView.tsx` | Nueva sección "Planning": selects de prioridad y severidad (con opción "None"), `<CatalogPicker>` de área e iteración, y dos `<input type="date">` que se guardan con el botón "Save" existente. Nueva sección "Dates" de solo lectura: Created, Last modified, Status (Open, o Closed on `<fecha>` · `<columna>`). Botón "Close" fuera del submit del formulario, siguiendo FR-014. En modo Lector todo es de solo lectura y no hay botón "Close". `describeActivity` extendido para los campos nuevos, `closed` y `reopened`. |
| `components/work-items/CatalogPicker.tsx` (nuevo) | Selector de **un** valor con sugerencias del catálogo y la opción `Create "<nombre>"`. Comportamiento y prop `disabled` análogos a `TagPicker`, pero con selección única y un botón para quitar el valor. |
| `components/ui/local-date.tsx` (nuevo) | `<LocalDate value={Date \| string} />`. Renderiza la fecha en la zona local del navegador sin desajuste de hidratación (research.md § Fechas y "hoy"). |
| `lib/dates.ts` (nuevo) | `useLocalToday(): string \| null`, con `useSyncExternalStore`. `formatCalendarDate("YYYY-MM-DD")` sin conversión de zona horaria. |
