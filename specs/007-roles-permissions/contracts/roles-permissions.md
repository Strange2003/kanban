# Contratos: Roles y Permisos

Cubre [007-roles-permissions](../spec.md). Sigue el mismo patrón de Server
Actions con `Result<T>` documentado en
[001-accounts-invitations/contracts/](../../001-accounts-invitations/contracts/).
Esta feature no expone endpoints HTTP nuevos: todos los contratos son
funciones exportadas de `lib/actions/**` y del módulo `lib/roles.ts`.

> **Nota de implementación** (lección de
> [005 research.md § Hallazgo](../../005-work-item-relationships/research.md)):
> ninguna acción de este contrato requiere que el cliente encadene una
> segunda Server Action tras la primera. Las mutaciones devuelven
> `Result<void>` y el cliente refresca con `router.refresh()`, igual que
> `removeMember` y el resto de mutaciones existentes.

## Módulo `lib/roles.ts` (nuevo, puro, importable desde cliente y servidor)

```ts
type ProjectRole = "owner" | "member" | "viewer";

type Permission =
  | "project:edit" | "project:delete" | "project:leave" | "project:transferOwnership"
  | "member:remove" | "member:changeRole"
  | "invitation:send" | "invitation:viewPending" | "invitation:cancelAny" | "invitation:cancelOwn"
  | "board:edit" | "workItem:edit" | "relationship:edit";

can(role: ProjectRole, permission: Permission): boolean;
```

### Matriz de permisos → claves

Traducción 1:1 de la [matriz de la spec](../spec.md#matriz-de-permisos). Es la
única definición: la interfaz y todas las Server Actions consultan `can`.

| Fila de la spec | Clave de permiso | Owner | Miembro | Lector |
|---|---|:-:|:-:|:-:|
| Ver proyecto/tablero/detalle/relaciones/tags/actividad/miembros | *(sin clave: solo `requireProjectMember`)* | ✔ | ✔ | ✔ |
| Ver invitaciones pendientes | `invitation:viewPending` | ✔ | ✔ | ✘ |
| Renombrar, editar descripción | `project:edit` | ✔ | ✘ | ✘ |
| Eliminar el proyecto | `project:delete` | ✔ | ✘ | ✘ |
| Salir del proyecto | `project:leave` | ✘ | ✔ | ✔ |
| Remover a otro miembro | `member:remove` | ✔ | ✘ | ✘ |
| Cambiar el rol de otro miembro | `member:changeRole` | ✔ | ✘ | ✘ |
| Transferir la propiedad | `project:transferOwnership` | ✔ | ✘ | ✘ |
| Enviar invitación | `invitation:send` | ✔ | ✔ | ✘ |
| Cancelar cualquier invitación pendiente | `invitation:cancelAny` | ✔ | ✘ | ✘ |
| Cancelar una invitación propia pendiente | `invitation:cancelOwn` | ✔ | ✔ | ✘ |
| Columnas: crear/renombrar/eliminar/reordenar | `board:edit` | ✔ | ✔ | ✘ |
| Work Items: crear/editar/mover/reordenar/eliminar, tags | `workItem:edit` | ✔ | ✔ | ✘ |
| Relaciones padre/hijo y "relacionado con" | `relationship:edit` | ✔ | ✔ | ✘ |

## Helper `requireProjectPermission(projectPublicId, permission)` (`lib/permissions.ts`)

Reemplaza a `requireProjectOwner` (que se elimina) y complementa a
`requireProjectMember` (que se conserva para las lecturas).

- Hace lo mismo que `requireProjectMember`: `UNAUTHENTICATED` sin sesión,
  `NOT_FOUND` si el proyecto no existe, `FORBIDDEN` si el usuario no es
  miembro.
- Además lanza `ROLE_NOT_PERMITTED` si `can(membership.role, permission)` es
  falso, con un mensaje que nombra el rol del usuario.
- Devuelve `{ session, project, membership }` (mismo shape que hoy).
- El rol se lee de `project_members` en cada llamada (nunca de la sesión).

## Catálogo de códigos de error (nuevos)

| Código | Cuándo | Reacción esperada de la UI |
|---|---|---|
| `ROLE_NOT_PERMITTED` | El usuario **es** miembro pero su rol no permite la acción (FR-003/FR-004). | Mostrar el mensaje y `router.refresh()` para reflejar el modo lectura si el rol cambió (`isRolePermissionError`). |
| `INVALID_ROLE` | `role` fuera de `member \| viewer` en `sendInvitation` / `changeMemberRole` (incluye intentar `owner`, FR-002). | Error en línea en el formulario. |
| `CANNOT_CHANGE_OWNER_ROLE` | `changeMemberRole` sobre el owner (incluido el propio owner, edge case de la spec). | Mensaje: para dejar de ser owner, transferir la propiedad. |
| `NOT_A_MEMBER` | El destino de `changeMemberRole` / `transferOwnership` no es (o ya no es) miembro (edge case: salió o fue removido a la vez). | Mensaje y `router.refresh()`. |
| `CANNOT_TRANSFER_TO_SELF` | `transferOwnership` cuyo destinatario es el propio owner. | Mensaje en el diálogo. |

Se reutilizan sin cambio: `UNAUTHENTICATED`, `NOT_FOUND`, `FORBIDDEN` (solo
"no eres miembro"), `ALREADY_MEMBER`, `ALREADY_INVITED`, `INVALID_EMAIL`,
`RATE_LIMITED`, `INVITATION_NOT_PENDING`, `CANNOT_REMOVE_OWNER`,
`OWNER_CANNOT_LEAVE`.

## Acciones nuevas

### `changeMemberRole(input): Result<void>` (`lib/actions/projects.ts`)

**Cubre**: FR-006, FR-002, Historia 1.

- **Input**: `{ projectPublicId: string, userId: string, role: "member" | "viewer" }`
- **Auth**: `requireProjectPermission(projectPublicId, "member:changeRole")`.
- **Reglas** (dentro de `db.transaction`, tras bloquear la fila del proyecto
  y re-verificar que el actor sigue siendo owner — ver
  [research.md](../research.md#decisión-invariante-un-solo-owner-y-concurrencia)):
  - Rechaza con `INVALID_ROLE` si `role` no es `member` ni `viewer` (zod).
  - Rechaza con `CANNOT_CHANGE_OWNER_ROLE` si `userId` es el owner
    (`projects.ownerId`), incluido el propio actor.
  - Rechaza con `NOT_A_MEMBER` si `userId` no es miembro.
  - `UPDATE project_members SET role = :role WHERE project_id = :p AND
    user_id = :u AND role <> 'owner'`; 0 filas afectadas ⇒ rechaza con
    `NOT_A_MEMBER` (el estado esperado ya no existe).
  - Idempotente: si el rol ya es el pedido, no hay error ni efecto.
- **Efectos**: `revalidatePath(/projects/:id/settings)`. No requiere aviso a
  la persona afectada (fuera de alcance): ve el nuevo rol al refrescar o al
  ser rechazada una acción.

### `transferOwnership(input): Result<void>` (`lib/actions/projects.ts`)

**Cubre**: FR-011, FR-012, FR-013, Historia 4.

- **Input**: `{ projectPublicId: string, newOwnerUserId: string }`
- **Auth**: `requireProjectPermission(projectPublicId, "project:transferOwnership")`.
- **Reglas** (una única `db.transaction`, tras bloquear la fila del proyecto
  y re-verificar que el actor sigue siendo owner):
  1. Rechaza con `CANNOT_TRANSFER_TO_SELF` si `newOwnerUserId` es el actor.
  2. `UPDATE project_members SET role = 'member' WHERE project_id = :p AND
     user_id = :actor AND role = 'owner'` — 0 filas ⇒ `ROLE_NOT_PERMITTED`
     (el actor ya no es owner).
  3. `UPDATE project_members SET role = 'owner' WHERE project_id = :p AND
     user_id = :newOwner` — 0 filas ⇒ `NOT_A_MEMBER` y la transacción se
     revierte completa (el proyecto conserva a su owner original).
  4. `UPDATE projects SET owner_id = :newOwner` (y `updated_at`).
  El orden (bajar antes de subir) respeta el índice único parcial de un solo
  owner.
- **Confirmación explícita** (FR-011): la exige la interfaz
  (`TransferOwnershipDialog` con la advertencia de pérdida de permisos); la
  acción es una operación de un solo paso, sin estado "pendiente de aceptar".
- **Efectos**: `revalidatePath(/projects/:id/settings)` y `revalidatePath("/")`
  (la barra lateral no muestra el rol, pero el owner anterior ya puede salir).

## Acciones modificadas

### `sendInvitation(input)` (`lib/actions/accounts-invitations.ts`)

**Cubre**: FR-008, FR-009.

- **Input**: `{ projectPublicId, email, role: "member" | "viewer" }` (antes
  solo `projectPublicId` y `email`).
- **Auth**: `requireProjectPermission(projectPublicId, "invitation:send")`
  (antes `requireProjectOwner`) — Owner y Miembro; el Lector recibe
  `ROLE_NOT_PERMITTED`.
- Valida `role` con zod (`INVALID_ROLE`; `owner` nunca es válido) y lo guarda
  en `invitations.role`.
- Sin cambios en: rate limit por cuenta, `ALREADY_MEMBER`, `ALREADY_INVITED`,
  notificación si la cuenta existe y está verificada (001, FR-005…FR-017).

### `respondToInvitation(input)` (`lib/actions/accounts-invitations.ts`)

**Cubre**: FR-008.

- Al aceptar, inserta en `project_members` con `role: invitation.role` en
  lugar del `"member"` fijo de hoy. Sin más cambios (rechazar, validaciones
  de destinatario/estado).

### `cancelInvitation(input)` (`lib/actions/accounts-invitations.ts`)

**Cubre**: FR-010.

- **Auth**: `requireProjectPermission(projectPublicId, "invitation:cancelOwn")`
  (rechaza al Lector). Después: si `can(role, "invitation:cancelAny")` (owner)
  cancela cualquiera; si no, solo la que envió el propio usuario
  (`invitedByUserId`); en otro caso `ROLE_NOT_PERMITTED` (antes `FORBIDDEN`).
- Sin cambios en: `INVITATION_NOT_PENDING`, marcar la notificación como leída.

### `listPendingInvitations(projectPublicId)` (`lib/actions/accounts-invitations.ts`)

**Cubre**: FR-018.

- **Auth**: `requireProjectPermission(projectPublicId, "invitation:viewPending")`
  (antes cualquier miembro): un Lector recibe `ROLE_NOT_PERMITTED` y **ninguna
  fila** — la información no se devuelve por ninguna vía.
- **Output**: `PendingInvitation` gana `role` y `invitedByUserId` (para que la
  UI decida si un Miembro puede cancelar esa invitación). La página de ajustes
  ni siquiera llama a esta acción para un Lector.

### `removeMember`, `renameProject`, `updateProjectDescription`, `deleteProject` (`lib/actions/projects.ts`)

- `requireProjectOwner(...)` → `requireProjectPermission(..., "member:remove" |
  "project:edit" | "project:delete")`. Comportamiento y códigos de error
  actuales sin cambio (`CANNOT_REMOVE_OWNER`, etc.), salvo que un no-owner
  recibe `ROLE_NOT_PERMITTED` en lugar de `FORBIDDEN`.

### `leaveProject(projectPublicId)` (`lib/actions/projects.ts`)

- `requireProjectPermission(projectPublicId, "project:leave")`: Miembro y
  Lector pueden; el owner recibe `ROLE_NOT_PERMITTED`. Se conserva el mensaje y
  el código `OWNER_CANNOT_LEAVE` actuales para el owner (mensaje: transferir la
  propiedad o eliminar el proyecto).

### `listProjectMembers(projectPublicId)` (`lib/actions/projects.ts`)

- Sin cambio de permiso (cualquier miembro, incluido el Lector, ve la lista de
  miembros con su rol). `ProjectMemberWithUser.role` pasa a ser
  `"owner" | "member" | "viewer"`.

### Board — `lib/actions/board.ts`

- `createStage`, `reorderStages`, `renameStage`, `deleteStage`:
  `requireProjectMember` → `requireProjectPermission(..., "board:edit")`.
- `getBoard(projectPublicId)`: sigue exigiendo solo membresía y ahora
  devuelve además `role: ProjectRole` (el rol vigente del usuario en ese
  proyecto), para que la página decida el modo lectura.

### Work Items — `lib/actions/work-items.ts`

- `createWorkItem`, `moveWorkItem`, `reorderWorkItemsInStage`,
  `updateWorkItem` (incluye la creación inline de tags),
  `deleteWorkItem`: `requireProjectMember` →
  `requireProjectPermission(..., "workItem:edit")`.
- Lecturas (`getWorkItemByDisplayNumber`, `listProjectTags`,
  `getWorkItemTags`, `listWorkItemActivity`): sin cambio (solo membresía).

### Relaciones — `lib/actions/work-item-relationships.ts`

- `setWorkItemParent`, `removeWorkItemParent`, `linkRelatedWorkItems`,
  `unlinkRelatedWorkItems`: `requireProjectMember` →
  `requireProjectPermission(..., "relationship:edit")`.
- `getWorkItemDetailData(workItemId, projectPublicId)`: solo membresía; ahora
  devuelve además `role: ProjectRole`. `getWorkItemRelations` y
  `listProjectWorkItems` (lecturas) no cambian.

## Lo que NO cambia

- Firmas y comportamiento de las lecturas existentes (salvo `role` añadido a
  los dos resultados anteriores y el permiso de `listPendingInvitations`).
- Estructura del log de actividad de Work Items (constitución § Auditoría).
- Cualquier regla de invitación de 001 distinta del permiso y del rol
  (duplicados, ya-miembro, rate limit, aplicación al verificar email).
- Reglas de 002: quién renombra/elimina, `CANNOT_REMOVE_OWNER`, reclasificación
  Personal/Compartido.
