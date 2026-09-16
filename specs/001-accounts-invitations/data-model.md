# Data Model: Fase 1 (Cuentas, Proyectos, Tablero, Work Items)

Cubre las entidades de las 4 specs del núcleo. Sigue la jerarquía exigida por
el Principio III de la constitución: Cuenta → Proyecto → Stage/Columna →
Work Item. Todas las tablas propias de la app usan `onDelete: cascade` en
sus foreign keys hacia el proyecto (Principio IV).

## Cuenta (gestionada por Better Auth)

La identidad de la persona (email, verificación, métodos de auth) la posee
Better Auth, self-hosted dentro de la misma app (ver research.md §
Autenticación) — no un servicio externo. Better Auth crea y administra sus
propias tablas en el mismo Postgres de Neon, generadas por su propio CLI
(`npx @better-auth/cli generate`), sin que nosotros las definamos a mano en
`db/schema.ts`:

| Tabla (de Better Auth) | Contenido relevante |
|---|---|
| `user` | `id` (uuid/text), `email` (unique), `emailVerified` (boolean), `name` |
| `session` | token de sesión, `userId`, expiración |
| `account` | credenciales por proveedor (password hash, o tokens de Google OAuth) por `userId` |
| `verification` | tokens de verificación de email / reset de contraseña, con expiración |

El resto de las tablas de la app (`project_members`, `invitations`,
`notifications`, etc.) referencian `user.id` como foreign key externa —
misma relación que antes, solo que ahora apunta a una tabla que vive en
nuestro propio esquema en vez de en un servicio gestionado.

## Proyecto (`projects`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | serial, PK | interno, nunca expuesto (Principio IV) |
| `publicId` | text, unique | nanoid corto, usado en URLs |
| `name` | text, not null | FR-001/002 de [002](../002-project-spaces/spec.md) |
| `description` | text, nullable | FR-009 de 002 |
| `workItemPrefix` | text, not null | prefijo correlativo (ver research.md), inmutable |
| `ownerId` | uuid, FK → Cuenta | FR-008 de 002, FR-009 de 001 |
| `createdAt` / `updatedAt` | timestamptz | — |

Derivado, no almacenado: clasificación Personal/Compartido = `count(members) > 1`
(Principio II — nunca un campo editable).

## Membresía (`project_members`)

| Campo | Tipo | Notas |
|---|---|---|
| `projectId` | FK → projects, cascade | PK compuesta con `userId` |
| `userId` | uuid, FK → Cuenta | — |
| `role` | enum('owner','member') | FR-009 (001), FR-008 (002) |
| `joinedAt` | timestamptz | — |

Regla: exactamente un `owner` por proyecto en todo momento (FR-014 de 002).

## Invitación (`invitations`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | serial, PK | interno |
| `publicId` | text, unique | nanoid |
| `projectId` | FK → projects, cascade | — |
| `invitedEmail` | text, not null | FR-005 (001) |
| `invitedByUserId` | uuid, FK → Cuenta | solo owner, FR-009 (001) |
| `status` | enum('pending','accepted','rejected','cancelled') | FR-007/010/011 (001) |
| `createdAt` / `respondedAt` | timestamptz | — |

Restricción: único `(projectId, invitedEmail)` con `status='pending'`
(FR-012 de 001, evita duplicados).

## Notificación (`notifications`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | serial, PK | — |
| `userId` | uuid, FK → Cuenta | destinatario |
| `type` | enum('invitation', ...) | extensible a futuro |
| `payload` | jsonb | referencia a `invitationId`, nombre de proyecto, quién invitó |
| `readAt` | timestamptz, nullable | — |
| `createdAt` | timestamptz | — |

## Stage/Columna (`stages`)

Entidad única (Principio III: stage y columna son la misma fila, nunca
existen por separado).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | serial, PK | interno |
| `publicId` | text, unique | nanoid |
| `projectId` | FK → projects, cascade | — |
| `name` | text, not null | FR-002/004 (003) |
| `position` | integer, not null | orden horizontal, FR-005 (003) |
| `createdAt` | timestamptz | — |

Restricción de aplicación (no de DB): no se permite `DELETE` si existen
`work_items` con `stageId` apuntando a esta fila (FR-007 de 003) — se
valida en la Server Action antes del delete, no vía FK restrictiva, para
poder devolver un mensaje de error claro en vez de un error de constraint.

## Work Item (`work_items`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | serial, PK | interno, nunca expuesto |
| `projectId` | FK → projects, cascade | denormalizado desde `stageId` para queries de conteo/prefijo sin join |
| `displayNumber` | integer, not null | correlativo por proyecto (contador propio, no el `id`) |
| `stageId` | FK → stages, cascade | FR-004 (004) |
| `title` | text, not null | FR-001/002 (004) |
| `description` | text, nullable | texto plano (FR-013 de 004) |
| `stakeholder` | text, nullable | texto libre (FR-009 de 004) |
| `position` | integer, not null | orden dentro de la columna, FR-006 (004) |
| `createdAt` / `updatedAt` | timestamptz | — |

Identificador visible = `projects.workItemPrefix || '-' || work_items.displayNumber`
(ej. "KAN-42"), calculado en la capa de presentación o como columna
generada; `displayNumber` se asigna con un contador atómico por proyecto
(`projects.nextWorkItemNumber`, incrementado en la misma transacción de
inserción).

## Log de Actividad de Work Item (`work_item_activity`)

Requerido por la constitución (Estándares de Producto y Datos § Auditoría):
"todo cambio relevante sobre un Work Item (cambio de stage, edición de
campos, cambios de relación) MUST registrarse en un log de actividad
modelado como tabla de eventos (`type`, `payload`, `createdAt`), visible
desde la vista de detalle del Work Item."

| Campo | Tipo | Notas |
|---|---|---|
| `id` | serial, PK | interno |
| `workItemId` | FK → work_items, cascade | — |
| `type` | text, not null | ej. `stage_changed` (FR-005 de 004), `fields_edited` (FR-007 de 004) |
| `payload` | jsonb, not null | detalle del cambio (valores anterior/nuevo, según `type`) |
| `createdAt` | timestamptz, not null | — |

Se escribe una fila en cada `moveWorkItem` y `updateWorkItem` (ver
contracts/work-items.md); se lee en orden `createdAt desc` para mostrarse en
`WorkItemDetailPanel`.

## Tag (`tags`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | serial, PK | — |
| `projectId` | FK → projects, cascade | catálogo por proyecto (FR-008 de 004) |
| `name` | text, not null | único por proyecto, case-insensitive (FR-012, Assumptions de 004) |

Restricción: único `(projectId, lower(name))`.

## WorkItemTag (`work_item_tags`)

Tabla de unión N:N.

| Campo | Tipo | Notas |
|---|---|---|
| `workItemId` | FK → work_items, cascade | PK compuesta con `tagId` |
| `tagId` | FK → tags, cascade | — |

## Diagrama de relaciones (resumen)

```
Cuenta (Better Auth) ──┬── project_members ──── projects ──┬── stages ──── work_items ──┬── work_item_tags ──── tags
                     │                                     │                          └── work_item_activity
                     └── invitations ───────────────────────┘
                     └── notifications
```

## Reglas de validez transversales (de la constitución y las specs)

- Toda query de lectura/escritura sobre `projects`, `stages`, `work_items`,
  `tags` MUST filtrar primero por membresía del usuario autenticado en
  `project_members` (Principio IV).
- Todo `DELETE` en `projects` MUST cascadear a `project_members`,
  `invitations`, `stages`, `work_items`, `tags`, `work_item_activity`
  (Principio IV).
- `projects.publicId`, `stages.publicId`, `invitations.publicId` MUST ser
  los únicos identificadores usados en URLs/API — nunca el `id` serial
  (Principio IV). `work_items` es la excepción documentada en research.md.
