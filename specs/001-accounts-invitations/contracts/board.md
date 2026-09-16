# Contratos: Tablero Kanban (Stages/Columnas)

Cubre [003-kanban-board](../../003-kanban-board/spec.md).

## `getBoard(projectId): { stages: (Stage & { workItemCount: number })[] }`

**Cubre**: FR-001.

- **Auth**: sesión requerida; MUST ser miembro del proyecto → si no,
  `FORBIDDEN`.
- Devuelve los stages ordenados por `position`.

## `createStage(input): Result<Stage>`

**Cubre**: FR-002, FR-003, FR-004.

- **Input**: `{ projectId: string (publicId), name: string }`
- **Auth**: cualquier miembro del proyecto.
- **Reglas**: `name` requerido (si vacío, `NAME_REQUIRED`). `position` =
  máximo actual + 1 (se agrega al final). Crear el stage ES crear la
  columna — una sola fila, una sola operación (Principio III).

## `reorderStages(input): Result<void>`

**Cubre**: FR-005, FR-011.

- **Input**: `{ projectId: string (publicId), orderedStageIds: string[] (publicId) }`
- **Auth**: cualquier miembro del proyecto.
- Reescribe `position` de cada stage según el índice en `orderedStageIds`,
  en una transacción. Si la transacción falla, el cliente MUST revertir su
  estado local al último orden confirmado y mostrar un error (comportamiento
  de cliente, no de este contrato — ver quickstart.md).

## `renameStage(input): Result<Stage>`

**Cubre**: FR-008.

- **Input**: `{ stageId: string (publicId), name: string }`
- **Auth**: cualquier miembro del proyecto dueño del stage.

## `deleteStage(stageId): Result<void>`

**Cubre**: FR-006, FR-007.

- **Auth**: cualquier miembro del proyecto dueño del stage.
- **Regla**: si existen `work_items` con `stageId` = este stage, error
  `STAGE_NOT_EMPTY` (no se permite el delete — FR-007). El cliente MUST
  mostrar el mensaje indicando mover/eliminar los Work Items primero.
