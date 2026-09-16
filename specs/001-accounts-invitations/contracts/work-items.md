# Contratos: Work Items

Cubre [004-work-items](../../004-work-items/spec.md).

## `createWorkItem(input): Result<WorkItem>`

**Cubre**: FR-001, FR-002, FR-003, FR-004.

- **Input**: `{ stageId: string (publicId), title: string }`
- **Auth**: cualquier miembro del proyecto dueño del stage.
- **Reglas**: `title` requerido (si vacío, `TITLE_REQUIRED`). Si el
  proyecto no tiene ningún stage todavía, esta acción no es alcanzable
  desde la UI (no hay a dónde crear el item) — ver Edge Case de
  [004](../../004-work-items/spec.md). `displayNumber` = incremento
  atómico de `projects.nextWorkItemNumber`. `position` = máximo actual en
  ese stage + 1.
- **Output**: el Work Item creado, con `displayId` calculado
  (`workItemPrefix-displayNumber`).

## `moveWorkItem(input): Result<void>`

**Cubre**: FR-005.

- **Input**: `{ workItemId: string, toStageId: string, toPosition: number }`
- **Auth**: cualquier miembro del proyecto.
- Actualiza `stageId` y `position`; reordena las posiciones afectadas tanto
  en el stage de origen como en el de destino.
- Registra una fila en `work_item_activity` (`type='stage_changed'`,
  `payload={ fromStageId, toStageId }`) en la misma transacción —
  Estándares de Producto y Datos § Auditoría de la constitución.

## `reorderWorkItemsInStage(input): Result<void>`

**Cubre**: FR-006.

- **Input**: `{ stageId: string, orderedWorkItemIds: string[] }`
- **Auth**: cualquier miembro del proyecto.

## `updateWorkItem(input): Result<WorkItem>`

**Cubre**: FR-007, FR-008, FR-009, FR-012, FR-013.

- **Input**: `{ workItemId: string, title?: string, description?: string, stakeholder?: string, tagNames?: string[] }`
- **Auth**: cualquier miembro del proyecto.
- **Reglas**:
  - `description` se guarda como texto plano (sin sanitizar/parsear
    markdown — FR-013).
  - `tagNames`: por cada nombre que no exista ya en el catálogo del
    proyecto (`tags`, comparación case-insensitive), se crea (FR-012); los
    existentes se reutilizan. Se reemplaza el set de `work_item_tags` del
    Work Item por los tags resueltos.
  - Registra una fila en `work_item_activity` (`type='fields_edited'`,
    `payload={ fields: [...campos que cambiaron con su valor anterior/nuevo] }`)
    en la misma transacción — Estándares de Producto y Datos § Auditoría de
    la constitución.

## `listWorkItemActivity(workItemId): WorkItemActivity[]`

**Cubre**: Estándares de Producto y Datos § Auditoría de la constitución
(no mapea a un FR de 004, es una obligación transversal de la
constitución).

- **Auth**: cualquier miembro del proyecto.
- Devuelve las filas de `work_item_activity` del Work Item, más recientes
  primero, para mostrarse en `WorkItemDetailPanel`.

## `deleteWorkItem(workItemId): Result<void>`

**Cubre**: FR-010, FR-011.

- **Auth**: cualquier miembro del proyecto.
- Requiere confirmación en el cliente antes de invocar (UI).

## `listProjectTags(projectId): Tag[]`

**Cubre**: soporte para el selector de tags de `updateWorkItem`.

- **Auth**: cualquier miembro del proyecto.
