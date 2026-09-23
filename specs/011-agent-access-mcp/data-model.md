# Data Model: Acceso para Agentes de IA y Asignación de Work Items

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md) | **Date**: 2026-09-22

Este documento cubre solo los cambios sobre el modelo existente. El modelo
base está en [001-accounts-invitations/data-model.md](../001-accounts-invitations/data-model.md),
y los campos de 008 en [008-work-item-fields/data-model.md](../008-work-item-fields/data-model.md).

## Work Item (`work_items`): modificado

| Campo | Cambio | Tipo | Notas |
|---|---|---|---|
| `stakeholder` | **ELIMINADO** | — | FR-002/FR-003. Se descarta sin traspaso: no hay valores en uso (spec § Clarifications). |
| `assignee_user_id` | **NUEVO** | `text`, nullable | FR-001. `NULL` significa "Sin asignar". Es un `user.id` de Better Auth, del mismo tipo `text` que `project_members.user_id`. |

**Restricciones nuevas**:

- **FK compuesta** `work_items_assignee_member_fk`:
  `(project_id, assignee_user_id) → project_members(project_id, user_id)`
  `ON DELETE SET NULL (assignee_user_id)`.
  - Garantiza FR-005: solo se puede asignar a un miembro **actual** de ese
    mismo proyecto.
  - Garantiza FR-006 y SC-004: al borrarse la membresía, el Work Item queda
    sin asignar.
  - Con `assignee_user_id` en `NULL`, la FK no se evalúa (semántica
    `MATCH SIMPLE`).
  - La lista de columnas en `SET NULL` requiere Postgres ≥15. Se edita a mano
    en la migración (research.md § Persona asignada).
- **Índice** `work_items_assignee_idx` en `(project_id, assignee_user_id)`.
  Sirve al filtro "Asignados a mí" y a la búsqueda del agente, al `SELECT`
  de Work Items asignados cuando un miembro sale, y al chequeo de la FK
  cuando se borra una fila de `project_members`.

**Validación en aplicación** (antes de llegar a la FK, con mensajes claros):

- `updateWorkItem` y `createWorkItems` verifican que `assigneeUserId`, si no
  es `null`, sea miembro del proyecto. Si no lo es, responden `NOT_A_MEMBER`.
- Si la FK igual falla por una carrera (la persona salió entre el chequeo y
  el `UPDATE`), el error de Postgres `23503` se traduce a `NOT_A_MEMBER` y
  la transacción hace rollback.

## Log de Actividad (`work_item_activity`): modificado

| Campo | Cambio | Tipo | Notas |
|---|---|---|---|
| `actor_user_id` | **NUEVO** | `text`, nullable | Quién hizo el cambio (`getActor().userId`). `NULL` en las filas anteriores a esta feature. |
| `agent_client_id` | **NUEVO** | `text`, nullable | `client_id` OAuth cuando el cambio vino de un agente. |
| `agent_name` | **NUEVO** | `text`, nullable | Nombre del cliente **copiado** al escribir el evento, para que el historial siga legible si el cliente cambia de nombre o se borra (FR-034). |

**Eventos nuevos**:

| `type` | `payload` | Cuándo |
|---|---|---|
| `assignee_changed` | `{ from: { userId, name } \| null, to: { userId, name } \| null, reason?: "member_left" }` | FR-009: al asignar, reasignar o quitar la asignación. Con `reason: "member_left"` cuando la persona asignada deja el proyecto (FR-006). Se guardan los nombres para que el historial sea legible aunque la persona ya no esté. |
| `created` | `{ stageName, via: "agent" }` | Solo cuando un agente crea un Work Item, para que la creación también quede atribuida (FR-034). Desde la interfaz no se agrega, para no cambiar el historial existente. |

Los eventos existentes (`fields_edited`, `stage_changed`, `closed`,
`reopened`, `parent_linked`, `parent_unlinked`, `related_linked`,
`related_unlinked`) no cambian de forma. Solo ganan las tres columnas de
actor.

Todas las inserciones pasan por `logActivity(tx, workItemId, type, payload)`
(`lib/activity.ts`), que completa las columnas de actor desde `getActor()`.

## Notificación (`notifications`): modificado

| Campo | Cambio | Notas |
|---|---|---|
| `type` (enum `notification_type`) | **nuevo valor** `work_item_assigned` | Migración: `ALTER TYPE notification_type ADD VALUE 'work_item_assigned'`. |
| `payload` para `work_item_assigned` | nuevo formato | `{ workItemId: number, projectId: number, assignedByUserId: string, agentName: string \| null }`. Son ids internos: el payload nunca sale al cliente tal cual, porque `listMyNotifications` lo resuelve en el servidor. |

**Índice nuevo** `notifications_user_unread_idx` en `(user_id, created_at)`
con `WHERE read_at IS NULL`. El panel lee "no leídas del usuario, más
recientes primero", y con las asignaciones ese volumen crece más que con
las invitaciones.

**Reglas** (FR-011 a FR-013):

- Se inserta en la misma transacción que la asignación.
- Solo si el asignado nuevo no es `null` y `≠ actor.userId`.
- Quitar una asignación, asignarse a uno mismo o la anulación por salida del
  proyecto no generan notificación.
- `markNotificationRead(id)` pone `read_at = now()` solo si
  `user_id = actor.userId`.

## Tablas de Better Auth (generadas): nuevas

Las generan los plugins `jwt()` y `mcp()` mediante `npm run auth:generate`,
que regenera `db/auth-schema.ts`, y entran en la misma migración de
drizzle-kit. **No se editan a mano.** Los nombres exactos de columnas son
los que genere la CLI. La tabla muestra los relevantes para esta feature:

| Tabla | Uso en esta feature |
|---|---|
| `jwks` | Claves de firma de los access tokens (plugin `jwt`). |
| `oauth_client` | Agentes registrados (CIMD o DCR). Aporta el **nombre** del agente en el consentimiento y en la sección de agentes conectados. |
| `oauth_consent` | Una fila por `(user, client)` autorizado. **Es la autorización de agente de la spec** (Key Entities). Guarda la fecha de autorización (`createdAt`). Revocar la borra (FR-036), y su existencia se verifica en cada petición MCP (research.md § Revocación inmediata). |
| `oauth_refresh_token` | Renovación transparente (spec § Assumptions). Se borra al revocar. |
| `oauth_access_token` | Solo para tokens opacos. Con JWT no se usa, pero se limpia igual al revocar. |
| `oauth_client_assertion` | Anti-replay de `private_key_jwt`. Sin uso directo. |

Las FK de estas tablas a `user` tienen `onDelete: cascade` (así las genera
Better Auth), así que eliminar la cuenta elimina sus autorizaciones
(FR-037).

## Último uso de un agente (`agent_last_used`): nueva

| Campo | Tipo | Notas |
|---|---|---|
| `user_id` | `text`, PK compuesta | — |
| `client_id` | `text`, PK compuesta | — |
| `last_used_at` | `timestamptz`, not null | FR-035. |

- Se hace upsert desde el route handler MCP tras autenticar, **como máximo
  una vez por minuto** por par. El handler lee la fila vieja en memoria y la
  omite si es reciente, así no escribe en cada llamada.
- La fila se borra al revocar.
- No tiene FK, igual que las demás columnas `user_id` de `schema.ts`
  (convención de 001). Una fila huérfana no tiene efecto, porque la sección
  de agentes conectados parte de `oauth_consent`.

**Alternativa descartada**: agregar la columna a `oauth_consent` con
`additionalFields`. Mezcla nuestra lógica con la tabla que gestiona Better
Auth y complica sus actualizaciones.

## Migración `0005`

> **Al implementar**: son dos archivos, `0005_agent_access_assignee` (todo lo
> de abajo salvo el paso 3) y `0006_drop_stakeholder` (paso 3). Así se evita
> la pregunta interactiva de drizzle-kit sobre si la columna nueva es un
> rename de `stakeholder` (research.md § Hallazgos de implementación).

Una sola migración, generada con `npm run auth:generate` y después
`npm run db:generate`, con una edición manual:

1. Tablas de Better Auth: `jwks`, `oauth_client`, `oauth_consent`,
   `oauth_access_token`, `oauth_refresh_token` y `oauth_client_assertion`.
2. `ALTER TYPE notification_type ADD VALUE 'work_item_assigned'`.
3. `ALTER TABLE work_items DROP COLUMN stakeholder`.
4. `ALTER TABLE work_items ADD COLUMN assignee_user_id text`, más el índice.
5. FK compuesta. **Edición manual**: `ON DELETE SET NULL` →
   `ON DELETE SET NULL ("assignee_user_id")`.
6. `ALTER TABLE work_item_activity ADD COLUMN actor_user_id text, agent_client_id text, agent_name text`.
7. `CREATE TABLE agent_last_used (…)`.
8. Índice parcial de `notifications`.

**Orden de despliegue** (AGENTS.md):

1. Verificar que Postgres es ≥15 en las ramas `dev` y `main` de Neon
   (`SHOW server_version`).
2. Aplicar en `dev`.
3. Correr los e2e. Truncan la base de `.env.local`, así que hay que
   confirmarlo antes.
4. Aplicar en producción **antes** de desplegar el código.

Como el código viejo todavía lee `stakeholder` y la migración lo elimina,
el deploy debe seguir inmediatamente a la migración. Es el mismo patrón que
las migraciones anteriores, en una instancia de un solo operador.

**Setup de e2e**: el `TRUNCATE` global de `tests/e2e/setup.ts` agrega
`agent_last_used` y las tablas OAuth, **sin** `jwks`: la clave de firma
puede sobrevivir entre corridas.

## Diagrama de relaciones (solo lo nuevo)

```text
user (Better Auth) ─┬─< oauth_consent >── oauth_client
                    ├─< oauth_refresh_token
                    └─< agent_last_used (sin FK)

projects ─< project_members ─┐ (project_id, user_id)
    │                        │  FK compuesta, ON DELETE SET NULL (assignee_user_id)
    └─< work_items ──────────┘ (project_id, assignee_user_id)
            └─< work_item_activity  (+ actor_user_id, agent_client_id, agent_name)

notifications (+ type 'work_item_assigned', payload → work_items.id, projects.id)
```
