# Contratos: Proyectos y Espacios

Cubre [002-project-spaces](../../002-project-spaces/spec.md).

## `createProject(input): Result<Project>`

**Cubre**: FR-001, FR-002, FR-003.

- **Input**: `{ name: string, description?: string }`
- **Auth**: sesión requerida.
- **Reglas**: `name` requerido (si vacío, error `NAME_REQUIRED`). Genera
  `publicId` (nanoid) y `workItemPrefix` (ver research.md, con
  desambiguación si colisiona con otro proyecto del mismo usuario). Crea
  `project_members` con el creador como `role='owner'`.
- **Output**: el proyecto creado (clasificado "Personal" por tener 1
  miembro — campo derivado, no almacenado).

## `listMyProjects(query?: { search?: string }): { personal: Project[], shared: Project[] }`

**Cubre**: FR-004, FR-010, FR-011 (buscador).

- **Auth**: sesión requerida.
- Devuelve los proyectos donde el usuario es miembro, agrupados por
  cantidad de miembros (1 → `personal`, 2+ → `shared`), filtrados por
  coincidencia de `search` en `name` si se provee.

## `renameProject(input): Result<Project>`

**Cubre**: FR-005.

- **Input**: `{ projectId: string (publicId), name: string }`
- **Auth**: sesión requerida; MUST ser `owner` (FR-008) → si no, `FORBIDDEN`.

## `updateProjectDescription(input): Result<Project>`

**Cubre**: FR-009.

- **Input**: `{ projectId: string (publicId), description: string }`
- **Auth**: owner únicamente (mismo modelo v1 que renombrar).

## `deleteProject(projectId): Result<void>`

**Cubre**: FR-006, FR-007.

- **Auth**: owner únicamente → si no, `FORBIDDEN`.
- Requiere confirmación en el cliente antes de invocar (UI), no a nivel de
  este contrato. Elimina en cascada `project_members`, `invitations`,
  `stages`, `work_items`, `tags` (ver data-model.md).

## `removeMember(input): Result<void>`

**Cubre**: FR-012, FR-014.

- **Input**: `{ projectId: string (publicId), userId: string }`
- **Auth**: MUST ser `owner`; si `userId` es el propio owner, error
  `CANNOT_REMOVE_OWNER` (FR-014).
- Elimina la fila de `project_members`. Si el proyecto queda con un único
  miembro, no requiere acción adicional: la clasificación Personal es
  derivada (se recalcula en cada lectura).

## `leaveProject(projectId): Result<void>`

**Cubre**: FR-013, FR-014.

- **Auth**: sesión requerida; MUST ser miembro, MUST NOT ser el `owner`
  (si lo es, error `OWNER_CANNOT_LEAVE` — debe eliminar el proyecto en su
  lugar).
- Elimina la propia membresía.
