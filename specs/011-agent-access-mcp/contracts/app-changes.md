# Contratos: Cambios en la app (Asignado, notificaciones, actor, agentes conectados)

Cubre la Historia 1 y la Historia 5 de [011-agent-access-mcp](../spec.md),
más los cambios transversales que necesita el servidor MCP
([mcp-tools.md](mcp-tools.md)). Sigue el patrón de Server Actions con
`Result<T>` de [001-accounts-invitations/contracts/](../../001-accounts-invitations/contracts/)
y las claves de permiso de
[007-roles-permissions/contracts/roles-permissions.md](../../007-roles-permissions/contracts/roles-permissions.md).

## Permisos

**No hay claves nuevas.** Las acciones nuevas o modificadas usan las claves
existentes o son acciones sobre la propia cuenta, que no dependen de
ningún proyecto:

| Acción | Clave | Owner | Miembro | Lector |
|---|---|:-:|:-:|:-:|
| Asignar o quitar la asignación de un Work Item | `workItem:edit` | ✔ | ✔ | ✘ |
| Crear Work Items en bloque (`createWorkItems`) | `workItem:edit` | ✔ | ✔ | ✘ |
| Ver la persona asignada y filtrar por ella | *(sin clave: `requireProjectMember`)* | ✔ | ✔ | ✔ |
| Ser asignado | *(ser miembro)* | ✔ | ✔ | ✔ |
| Ver y revocar **sus propios** agentes conectados; marcar **sus propias** notificaciones como leídas | *(solo sesión, sin proyecto)* | — | — | — |

`tests/unit/action-permissions.test.ts` MUST clasificar las acciones
nuevas:

- `createWorkItems` como `workItem:edit`.
- `listConnectedAgents`, `revokeAgent` y `markNotificationRead` en la lista
  de acciones "de cuenta", que no son de proyecto.

## Módulo `lib/actor.ts` (nuevo, solo servidor, sin `"use server"`)

```ts
export type AgentInfo = { clientId: string; name: string };
export type Actor = { userId: string; agent: AgentInfo | null };

export function runAsAgent<T>(actor: Actor & { agent: AgentInfo }, fn: () => Promise<T>): Promise<T>;
// Solo lo llama app/api/mcp/route.ts, tras verificar token + consentimiento.

export async function getActor(): Promise<Actor | null>;
// 1) el actor del AsyncLocalStorage, si hay; 2) si no, { userId: session.user.id, agent: null }; 3) null.
```

**Cambios que provoca en `lib/permissions.ts`**:

- `requireProjectMember` y `requireProjectPermission` usan `getActor()` en
  vez de `getSession()`.
- Devuelven `{ actor, project, membership }`. Hoy devuelven
  `{ session, project, membership }`.
- Los llamadores que usaban `session.user.id` (`leaveProject`,
  `changeMemberRole`, `transferOwnership`, `cancelInvitation`,
  `sendInvitation` y los que aparezcan al compilar) pasan a `actor.userId`.
- `listMyProjects` y `listProjectMembers` usan `getActor()`.
- `listMyNotifications`, `respondToInvitation` y las demás acciones de cuenta
  siguen exigiendo **sesión**: un agente nunca las invoca (FR-023).

## Módulo `lib/activity.ts` (nuevo, solo servidor, sin `"use server"`)

```ts
export async function logActivity(tx: Tx, workItemId: number, type: string, payload: unknown): Promise<void>;
// Inserta en work_item_activity con actor_user_id / agent_client_id / agent_name de getActor().
```

Reemplaza **todas** las inserciones directas a `workItemActivity` en:

- `lib/actions/work-items.ts`
- `lib/actions/board.ts`
- `lib/actions/work-item-relationships.ts`
- `lib/actions/projects.ts` (eventos `member_left`)

Un test de unidad busca con `grep` `insert(workItemActivity)` fuera de
`lib/activity.ts` y falla si encuentra alguna.

## Server Actions modificadas

### `updateWorkItem` (`lib/actions/work-items.ts`)

```ts
updateWorkItem(input: {
  workItemId: number;
  title?: string; description?: string;          // stakeholder: ELIMINADO
  assigneeUserId?: string | null;                // NUEVO — undefined = no tocar, null = sin asignar
  tagNames?: string[]; priority?; severity?; areaName?; iterationName?; startDate?; targetDate?;
}): Promise<Result<WorkItemWithDisplayId>>
```

- Si `assigneeUserId` es distinto del actual:
  1. Verifica que sea miembro del proyecto. Si no, `NOT_A_MEMBER`.
  2. Escribe `assignee_user_id`.
  3. Registra `assignee_changed` con nombres.
  4. Si el asignado nuevo no es `null` y es distinto de
     `getActor().userId`, inserta la notificación `work_item_assigned`.

  Todo ocurre en la misma transacción. Una violación de la FK (`23503`) se
  traduce a `NOT_A_MEMBER`.
- Nuevo código de error: `NOT_A_MEMBER` (reutiliza el nombre de 007).

### `createWorkItem` → delega en `createWorkItems`

La firma **no cambia**: `{ stagePublicId, title }`. Internamente llama al
mismo camino que `createWorkItems` con un solo elemento.

### `createWorkItems` (nueva, `lib/actions/work-items.ts`)

```ts
createWorkItems(input: {
  stagePublicId: string;
  items: Array<{
    title: string; description?: string; assigneeUserId?: string | null; tagNames?: string[];
    priority?: WorkItemLevel | null; severity?: WorkItemLevel | null;
    areaName?: string | null; iterationName?: string | null;
    startDate?: string | null; targetDate?: string | null;
  }>;                                             // 1..50
}): Promise<Result<WorkItemWithDisplayId[]>>
```

- `requireProjectPermission(project, "workItem:edit")`.
- Primero valida todos los elementos con el mismo schema que
  `updateWorkItem`, más el título obligatorio y el orden de fechas. En el
  primer elemento inválido responde `BATCH_ITEM_INVALID` con
  `{ index, code, message }` en el mensaje.
- Después, una sola transacción en `createWorkItemsInStage`
  (`lib/work-item-create.ts`):
  1. Reserva N números.
  2. Bloquea la columna con `FOR SHARE`.
  3. Inserta en orden al final de la columna, aplicando el cierre si la
     columna es de cierre.
  4. Resuelve tags, área e iteración por nombre dentro del proyecto.
  5. Asigna, con el chequeo de miembro.
  6. Registra actividad: `created` si el actor es un agente, `closed` si
     nace cerrado y `assignee_changed` si nace asignado.
  7. Notifica a cada asignado distinto del actor.
- Con 0 o más de 50 elementos responde `VALIDATION_ERROR`.

### `removeMember` / `leaveProject` (`lib/actions/projects.ts`)

Ambas se envuelven en una transacción. Antes de borrar la membresía:

1. `SELECT` de los Work Items del proyecto con
   `assignee_user_id = <persona que sale>`.
2. `logActivity(…, "assignee_changed", { from: {…}, to: null, reason: "member_left" })`
   por cada uno.
3. `DELETE` de la membresía. La FK anula `assignee_user_id`.

No se notifica a nadie (FR-013).

### `getBoard`, `getWorkItemsView` y `getWorkItemDetailData`

- Devuelven `assignee: { userId, name, image } | null` por Work Item: un
  `LEFT JOIN user` sobre `assignee_user_id`.
- `getWorkItemDetailData` devuelve además `members: { userId, name, image, email? }[]`
  para el desplegable. `email` solo se incluye si la persona que mira lo
  vería en la lista de miembros.
- `stakeholder` desaparece de todos los tipos de retorno.

### `listMyNotifications` (`lib/actions/accounts-invitations.ts`)

```ts
type NotificationItem =
  | { type: "invitation"; id; createdAt; invitationPublicId; projectPublicId; projectName; invitedByName }
  | { type: "work_item_assigned"; id; createdAt; assignedByName: string; agentName: string | null;
      available: true;  projectPublicId: string; projectName: string; workItemDisplayId: string; title: string }
  | { type: "work_item_assigned"; id; createdAt; assignedByName: string; agentName: string | null;
      available: false };                        // Work Item eliminado o sin acceso (FR-013)
```

Devuelve solo las no leídas del usuario de la **sesión**. Las asignaciones
se resuelven con `LEFT JOIN work_items` y la membresía actual del
destinatario en `project_members`.

### `markNotificationRead` (nueva, `lib/actions/accounts-invitations.ts`)

```ts
markNotificationRead(notificationId: number): Promise<Result<void>>
// UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = session.user.id AND read_at IS NULL
```

Es idempotente. Si la notificación es de otra persona, no hace nada, igual
que si no existiera.

## Acciones nuevas: agentes conectados (`lib/actions/agents.ts`, `"use server"`)

```ts
type ConnectedAgent = {
  clientId: string;
  name: string;             // oauth_client.name ?? clientId
  uri: string | null;       // oauth_client.uri, si el cliente la declaró
  authorizedAt: Date;       // oauth_consent.createdAt
  lastUsedAt: Date | null;  // agent_last_used.last_used_at
};

listConnectedAgents(): Promise<Result<ConnectedAgent[]>>        // FR-035 — solo sesión
revokeAgent(clientId: string): Promise<Result<void>>            // FR-036 — solo sesión
```

`revokeAgent` borra, en una transacción y siempre filtrando por
`user_id = session.user.id`:

- El `oauth_consent` del par.
- Los `oauth_refresh_token` y `oauth_access_token` del par.
- La fila de `agent_last_used`.

Un `clientId` ajeno o inexistente no hace nada. El `oauth_client` no se
borra, porque puede estar autorizado por otros usuarios.

## Contratos de UI

| Componente | Cambio |
|---|---|
| `components/work-items/WorkItemDetailView.tsx` | Quita el campo Stakeholder. Agrega **Assignee**: un `<AssigneePicker>` si `canEdit`, o solo lectura (avatar + nombre) si no. El cambio se guarda con el mismo botón "Save" que los demás campos. `describeActivity` gana `assignee_changed` ("Assigned to Ana", "Unassigned", "Unassigned (left the project)"). Cada evento muestra "by *Nombre*" y "via *Agente*" cuando las columnas de actor existen. |
| `components/work-items/AssigneePicker.tsx` (nuevo) | Desplegable accesible (`listbox`) con "Unassigned" y los miembros (avatar o iniciales + nombre, y email si está disponible cuando hay nombres repetidos). |
| `components/ui/avatar.tsx` (nuevo) | Foto (`user.image`) o iniciales, con `title` y `aria-label` con el nombre. |
| `components/board/WorkItemCard.tsx` | Avatar compacto del asignado (FR-007). El `aria-label` de la tarjeta agrega "assigned to *Nombre*". |
| `components/views/WorkItemsTable.tsx` | La columna "Stakeholder" pasa a ser **"Assignee"**, ordenable por nombre, con los vacíos al final (FR-008). |
| `components/views/WorkItemsList.tsx` | Muestra el avatar del asignado en cada fila. |
| `components/views/ViewFilters.tsx` + `lib/work-item-view.ts` | Filtro `assignee` multivalor en la URL (`assignee=<userId>&assignee=none&assignee=me`). `"me"` se resuelve en el cliente al `userId` de la sesión, que la página pasa como prop. Se elimina la clave de orden `stakeholder` y se agrega `assignee`. |
| `components/sidebar/NotificationsPanelClient.tsx` | Muestra también `work_item_assigned`: "*Ana* assigned you *KAN-12 Título* in *Proyecto*" (+ "via *Claude*"). Al hacer clic, llama `markNotificationRead` y navega a `/projects/<id>/work-items/<n>`. Tiene un botón "Mark as read". Si `available: false`, muestra "This Work Item is no longer available" y solo "Mark as read". |
| `app/(workspace)/settings/agents/page.tsx` (nuevo) | Sección **Connected agents** (FR-035): lista con nombre, "Authorized on", "Last used" y un botón **Revoke** con diálogo de confirmación. Tiene un estado vacío que explica qué es y muestra la **dirección de conexión** (`MCP_RESOURCE`) con un botón para copiarla. Se enlaza desde el menú de la cuenta en la barra lateral. |
| `app/(auth)/consent/page.tsx` (nuevo) | Pantalla de consentimiento (FR-016): nombre y URI del agente, qué podrá hacer y qué no, y los botones **Allow** y **Deny** con el mismo peso visual. Llama `authClient.oauth2.consent({ accept })` y sigue la redirección que devuelve. Sin sesión, redirige a `/sign-in` preservando la consulta. |
| `lib/auth-client.ts` | Agrega `oauthProviderClient()`, para que `/sign-in` reanude la autorización. |

El idioma de la interfaz es inglés, como el resto de la app. Los textos de
la spec en español describen la intención, no el texto literal.
