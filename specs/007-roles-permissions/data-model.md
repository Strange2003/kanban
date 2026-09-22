# Data Model: Roles y Permisos

Extiende el esquema documentado en
[001-accounts-invitations/data-model.md](../001-accounts-invitations/data-model.md)
(y sus ampliaciones en
[005-work-item-relationships/data-model.md](../005-work-item-relationships/data-model.md)).
Solo se documenta aquí lo nuevo o modificado: un valor de enum, una columna y
un índice único parcial. Ninguna tabla nueva; el resto del esquema
(`stages`, `work_items`, `work_item_activity`, `tags`, etc.) no cambia.

## Rol de membresía (enum `project_role`) — valor añadido

| Valor | Estado | Notas |
|---|---|---|
| `owner` | existente | Exactamente uno por proyecto (FR-002). |
| `member` | existente | "Miembro": edita todo el contenido y puede invitar. Equivale al miembro invitado de Fase 1. |
| `viewer` | **nuevo** | "Lector": solo lectura. |

La etiqueta visible al usuario (Owner / Miembro / Lector) es una cuestión de
interfaz; en la base de datos y el código se conservan los valores en inglés
del enum, como ya ocurre con `owner`/`member`.

## Membresía (`project_members`) — restricción añadida

Sin columnas nuevas: `role` ya existe (`projectRoleEnum`, `NOT NULL`) y pasa a
admitir `viewer`.

| Restricción | Definición | Notas |
|---|---|---|
| Un solo owner por proyecto | Índice único parcial `project_members_one_owner_idx` sobre `(project_id)` `WHERE role = 'owner'` | FR-002, SC-006. Garantiza en la base de datos que un proyecto nunca tiene dos owners, aunque dos operaciones corran a la vez. No impide tener **cero** owners (no expresable como restricción de fila); eso lo evita la aplicación — ver "Invariantes" abajo. |

Las restricciones existentes no cambian: PK `(project_id, user_id)`, FK
`project_id` con `onDelete: cascade`, índice por `user_id`.

## Proyecto (`projects`) — sin cambios de esquema

`projects.ownerId` ya existe y ya lo usa `removeMember` para rechazar la
remoción del owner. Esta feature **no lo modifica en esquema**, pero
`transferOwnership` MUST actualizarlo en la misma transacción que las filas
de `project_members`, para que `projects.ownerId` y la membresía con rol
`owner` nunca discrepen.

## Invitación (`invitations`) — columna añadida

| Campo | Tipo | Notas |
|---|---|---|
| `role` | `project_role`, `NOT NULL`, `DEFAULT 'member'` | FR-008. Rol con el que ingresará el invitado al aceptar. Solo `member` o `viewer`. Las invitaciones ya existentes reciben `member` por el default (FR-008, FR-015, SC-007) — sin backfill. |

Restricción: `CHECK (role <> 'owner')` (`invitations_role_not_owner_check`) —
una invitación nunca otorga `owner` (FR-002); la aplicación además valida
`member | viewer` con zod antes de escribir. Las demás restricciones de
`invitations` (índice único parcial de una invitación pendiente por proyecto
y email — FR-012 de 001) no cambian.

## Transiciones de rol

```
                    invitación (role = member | viewer)
                       aceptar │
                               ▼
        ┌────────────────► member ◄──── changeMemberRole ────► viewer
        │                     │                                  │
   (transferencia:            │  transferOwnership(→ este)       │  transferOwnership(→ este)
    owner anterior)           ▼                                  ▼
        └───────────────── owner ◄────────────────────────────────┘
                             │
                             │  transferOwnership(→ otro miembro)
                             ▼
                        member (owner anterior)
```

Reglas de transición (todas verifican primero que el actor sigue siendo
owner, con el proyecto bloqueado — ver
[research.md](research.md#decisión-invariante-un-solo-owner-y-concurrencia)):

| Transición | Quién la ejecuta | Condiciones |
|---|---|---|
| `member ↔ viewer` | Owner (`changeMemberRole`) | El destino no es el owner; el nuevo rol es `member` o `viewer` (nunca `owner`). Idempotente si el rol ya es el pedido. |
| `member \| viewer → owner` y `owner → member` (juntas) | Owner (`transferOwnership`) | El destinatario es otro miembro del proyecto (cualquier rol, FR-011). Un solo paso indivisible; sin aceptación del destinatario (Clarifications). |
| ingreso como `member \| viewer` | El invitado (`respondToInvitation`, aceptar) | Usa `invitations.role`; nunca `owner`. |

No existe transición que deje al proyecto sin owner: el owner no puede
cambiarse el rol a sí mismo ni abandonar el proyecto (002, FR-014); la única
forma de dejar de ser owner es `transferOwnership`, que promueve a otro en la
misma transacción.

## Invariantes (aplicación + base de datos)

- **Exactamente un owner por proyecto** (FR-002, SC-006): "a lo sumo uno" por
  el índice único parcial; "al menos uno" porque ninguna acción quita el rol
  `owner` sin otorgarlo a otro miembro en la misma transacción, y
  `deleteProject` elimina el proyecto entero.
- **`projects.ownerId` = `user_id` de la fila `owner` de `project_members`**:
  mantenido en la misma transacción por `transferOwnership`.
- **El rol vigente es el de la base de datos** en el momento de cada acción
  (FR-003, SC-003): no se copia a la sesión.
- **Clasificación Personal/Compartido**: sigue derivada solo del número de
  miembros; `role` no interviene (FR-016).
- **Sin tope de miembros** por rol ni total (FR-017): ninguna restricción ni
  consulta nueva depende del número de miembros.

## Migración

Una sola migración generada por `npm run db:generate`
(`db/migrations/0003_*.sql`), con el contenido lógico siguiente (el SQL exacto
lo produce drizzle-kit y se revisa a mano antes de aplicar):

1. `ALTER TYPE "public"."project_role" ADD VALUE 'viewer';`
2. `ALTER TABLE "invitations" ADD COLUMN "role" "project_role" DEFAULT 'member' NOT NULL;`
3. `ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_not_owner_check" CHECK ("invitations"."role" <> 'owner');`
4. `CREATE UNIQUE INDEX "project_members_one_owner_idx" ON "project_members" USING btree ("project_id") WHERE "project_members"."role" = 'owner';`

Ninguna sentencia usa el valor `viewer` recién agregado (restricción de
Postgres sobre enums dentro de una misma transacción — ver research.md §
Representación del rol). No hay backfill: las filas existentes ya cumplen las
nuevas restricciones si el modelo de Fase 1 se respetó (un owner por
proyecto); el quickstart incluye la verificación previa.

## Reglas de validez transversales (adicionales a las de 001)

- Toda mutación sobre un proyecto MUST pasar por `requireProjectPermission`,
  que verifica membresía **y** rol vigente contra la matriz de
  [contracts/roles-permissions.md](contracts/roles-permissions.md) (Principio
  IV).
- Ninguna consulta ni respuesta a un Lector MUST incluir invitaciones
  pendientes del proyecto (FR-018).
