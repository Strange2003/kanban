# Contratos: Relaciones entre Work Items

Cubre [005-work-item-relationships](../spec.md). Sigue el mismo patrón de
`lib/actions/work-items.ts` documentado en
[001-accounts-invitations/contracts/work-items.md](../../001-accounts-invitations/contracts/work-items.md).

> **Nota de implementación**: las cuatro acciones que mutan una relación
> (`setWorkItemParent`, `removeWorkItemParent`, `linkRelatedWorkItems`,
> `unlinkRelatedWorkItems`) devuelven `Result<WorkItemRelations>` — las
> relaciones ya frescas del Work Item activo, calculadas en el mismo
> round-trip — en vez de `Result<void>`. Encadenar una segunda llamada a
> `getWorkItemRelations` desde el cliente justo después de cada mutación
> (el diseño original de este contrato) resultó colgarse de forma
> intermitente en el modo dev de Next.js (Server Actions consecutivas +
> `revalidatePath`); devolver las relaciones directamente elimina esa
> segunda llamada en vez de parchear el síntoma en el cliente.

## `setWorkItemParent(input): Result<WorkItemRelations>`

**Cubre**: FR-001, FR-002, FR-004, FR-007.

- **Input**: `{ workItemId: string (displayId o id público), parentWorkItemId: string }`
- **Auth**: cualquier miembro del proyecto dueño de ambos Work Items.
- **Reglas**:
  - Rechaza con `DIFFERENT_PROJECT` si `workItemId` y `parentWorkItemId` no
    pertenecen al mismo proyecto (FR-007).
  - Rechaza con `SELF_PARENT` si `parentWorkItemId === workItemId`.
  - Rechaza con `ALREADY_HAS_PARENT` si el Work Item ya tiene un
    `parentWorkItemId` distinto de `null` (FR-002) — el cliente debe llamar
    primero a `removeWorkItemParent` para reemplazarlo.
  - Rechaza con `CYCLE_DETECTED` si `workItemId` aparece en la cadena de
    ancestros de `parentWorkItemId` (recorrida vía `WITH RECURSIVE`, ver
    [research.md](../research.md)) o es el propio `parentWorkItemId`
    (FR-004).
  - Si pasa las validaciones, hace `UPDATE work_items SET
    parentWorkItemId = :parentWorkItemId WHERE id = :workItemId` y registra
    una fila en `work_item_activity` (`type='parent_linked'`,
    `payload={ parentWorkItemId }`) en la misma transacción (FR-014).
- **Output**: las relaciones actualizadas de `workItemId` (mismo shape que
  `getWorkItemRelations`).

## `removeWorkItemParent(workItemId): Result<WorkItemRelations>`

**Cubre**: FR-008 (lado padre/hijo).

- **Auth**: cualquier miembro del proyecto.
- Pone `parentWorkItemId = null`; si ya era `null`, no hace nada (idempotente).
- Registra una fila en `work_item_activity` (`type='parent_unlinked'`,
  `payload={ previousParentWorkItemId }`) solo si había un padre que quitar
  (FR-014).
- **Output**: las relaciones actualizadas de `workItemId`.

## `linkRelatedWorkItems(input): Result<WorkItemRelations>`

**Cubre**: FR-005, FR-006, FR-007.

- **Input**: `{ workItemIdX: string, workItemIdY: string }`
- **Auth**: cualquier miembro del proyecto dueño de ambos Work Items.
- **Reglas**:
  - Rechaza con `DIFFERENT_PROJECT` si no pertenecen al mismo proyecto
    (FR-007).
  - Rechaza con `SELF_RELATION` si `workItemIdX === workItemIdY` (FR-006).
  - Ordena los dos IDs (`workItemIdA = min(...)`, `workItemIdB = max(...)`,
    ver [data-model.md](../data-model.md)) y hace `INSERT ... ON CONFLICT
    (workItemIdA, workItemIdB) DO NOTHING` — si el vínculo ya existía, no lo
    duplica (FR-006) y no vuelve a registrar actividad.
  - Si el `INSERT` sí crea una fila nueva, registra una fila en
    `work_item_activity` para **cada** Work Item involucrado
    (`type='related_linked'`, `payload={ relatedWorkItemId }`) en la misma
    transacción (FR-014).
- **Output**: las relaciones actualizadas de `workItemIdX`.

## `unlinkRelatedWorkItems(input): Result<WorkItemRelations>`

**Cubre**: FR-008 (lado "relacionado con").

- **Input**: `{ workItemIdX: string, workItemIdY: string }`
- **Auth**: cualquier miembro del proyecto.
- Ordena los IDs igual que `linkRelatedWorkItems` y borra la fila
  correspondiente de `work_item_related_links`; si no existía, no hace nada
  (idempotente).
- Registra una fila en `work_item_activity` para cada Work Item involucrado
  (`type='related_unlinked'`, `payload={ relatedWorkItemId }`), solo si
  efectivamente había un vínculo que borrar (FR-014).
- **Output**: las relaciones actualizadas de `workItemIdX`.

## `getWorkItemRelations(workItemId): WorkItemRelations`

**Cubre**: FR-009, FR-010; datos base para la futura vista de detalle
dedicada (ver [data-model.md](../data-model.md#datos-expuestos-para-la-futura-vista-de-detalle-dedicada)).

- **Auth**: cualquier miembro del proyecto.
- **Output**:
  ```text
  {
    parent: { displayId: string, title: string } | null,
    children: Array<{ displayId: string, title: string }>,
    related: Array<{ displayId: string, title: string }>
  }
  ```
- Cada elemento (`parent`, cada `children[i]`, cada `related[i]`) MUST ser
  suficiente para navegar directamente al Work Item correspondiente
  (FR-010) sin una consulta adicional.
