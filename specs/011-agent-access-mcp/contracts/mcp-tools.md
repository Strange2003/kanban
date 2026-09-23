# Contrato: Servidor MCP (`POST /api/mcp`)

Cubre las Historias 2 a 4 de [011-agent-access-mcp](../spec.md). Es la
**única** superficie HTTP nueva de la feature, sin contar los endpoints OAuth
que monta Better Auth (§ Autorización). Las decisiones y alternativas están
en [research.md](../research.md).

## Transporte

| Aspecto | Valor |
|---|---|
| Ruta | `app/api/mcp/route.ts`. Solo exporta `POST`. Next.js responde `405` a `GET` y `DELETE`. |
| Protocolo | MCP revisión 2026-07-28, más la familia 2025-11-25 en modo stateless (`legacy: "stateless"`). |
| SDK | `@modelcontextprotocol/server` v2: `createMcpHandler(factory, { legacy: "stateless" })`. El factory crea un `McpServer` nuevo por petición. |
| Nombre del servidor | `{ name: "kanban", version: <package.json version> }`, con `instructions` que explican los identificadores (§ Identificadores). |
| Runtime | Node.js (por defecto), no Edge: usa `AsyncLocalStorage` y el `Pool` de Neon. |

## Autorización

```text
POST /api/mcp
  └─ requireMcpAuth(auth, handler, { resource: MCP_RESOURCE })
       │  Sin token o token inválido → 401 + WWW-Authenticate (RFC 9728), el cliente inicia OAuth
       ▼
     handler(request, claims)
       1. userId = claims.sub; clientId = claims.azp ?? claims.client_id
       2. SELECT oauth_consent WHERE user_id = userId AND client_id = clientId  ── no existe → 401 (revocado, FR-036)
       3. SELECT user WHERE id = userId                                          ── no existe → 401 (FR-037)
       4. agentName = oauth_client.name ?? clientId
       5. touchAgentLastUsed(userId, clientId)                                   (como máximo 1/min, FR-035)
       6. runAsAgent({ userId, agent: { clientId, name: agentName } },
                     () => mcpHandler.fetch(request))
```

- `MCP_RESOURCE` = `${BETTER_AUTH_URL}/api/mcp`. Se define una sola vez en
  `lib/mcp/config.ts`, y lo usan `mcp({ resource })` y `requireMcpAuth`.
- **No se exigen scopes propios** (FR-017: el acceso es siempre completo).
  El límite de lo que puede hacer el agente lo pone el rol del usuario,
  vía `requireProjectPermission`, más la lista cerrada de herramientas de
  este contrato (FR-023).
- **Endpoints que monta Better Auth** en `/api/auth/*`:
  - `/oauth2/authorize`, `/oauth2/token`, `/oauth2/register` (DCR),
    `/oauth2/consent` y `/jwks`.
  - Los metadatos `.well-known`.

  Si el cliente los busca en la raíz del dominio, se exponen además con
  Route Handlers que delegan en los helpers de Better Auth:
  - `app/.well-known/oauth-authorization-server/[[...path]]/route.ts`
    delega en `oauthProviderAuthServerMetadata(auth)`.
  - `app/.well-known/oauth-protected-resource/[[...path]]/route.ts`
    publica los metadatos RFC 9728 de `MCP_RESOURCE`.

  Qué rutas hacen falta exactamente se verifica con el primer cliente real
  (quickstart § 2).

## Errores de herramienta

Toda herramienta envuelve la Server Action y traduce su `Result`:

- `ok: true`: `content: [{ type: "text", text: JSON.stringify(data) }]` más
  `structuredContent: data`.
- `ok: false`: `isError: true` y un texto
  `{"code": "<CODE>", "message": "<mensaje>"}`. Los códigos son los de
  `lib/errors.ts` y los de cada contrato de acción.

Códigos que el agente debe distinguir (FR-022):

| Código | Significado |
|---|---|
| `NOT_FOUND` / `FORBIDDEN` | El proyecto, la columna o el Work Item no existe **o** el usuario no es miembro. Ambos se devuelven como `NOT_FOUND` al agente, para no revelar existencia (FR-021, SC-007). |
| `ROLE_NOT_PERMITTED` | El usuario es miembro, pero su rol no permite la acción. |
| `NOT_A_MEMBER` | Se quiso asignar a alguien que no es miembro del proyecto. |
| `VALIDATION_ERROR`, `TITLE_REQUIRED`, `NAME_REQUIRED`, `INVALID_DATE_RANGE`, `STAGE_NOT_EMPTY`, `SELF_PARENT`, `SELF_RELATION`, `ALREADY_HAS_PARENT`, `CYCLE_DETECTED`, `DIFFERENT_PROJECT` | Los mismos de la interfaz. `ALREADY_HAS_PARENT` se conserva tal cual: para cambiar el padre, el agente primero llama `set_parent` con `null` (misma regla que la interfaz, 005). |
| `BATCH_ITEM_INVALID` | `create_work_items`: incluye `index` del primer elemento inválido y el motivo. No se creó nada. |
| `RATE_LIMITED` | Incluye `retryAfterSeconds` (FR-038). |

## Identificadores

- `projectId`: `publicId` del proyecto, obtenido de `list_projects`.
- `columnId`: `publicId` de la columna, obtenido de `get_board`.
- `workItemId`: ID visible `PREFIX-N` (por ejemplo `KAN-12`), **siempre
  junto con `projectId`**.
- `memberId`: `userId` del miembro, obtenido de `list_members`.

`lib/mcp/resolve.ts` traduce `workItemId` y `columnId` a ids internos
**después** de `requireProjectMember(projectId)` y filtrando por el proyecto.
Un `PREFIX-N` que no pertenece a `projectId` da `NOT_FOUND`.

## Herramientas

Anotaciones MCP: 🔍 = `readOnlyHint: true`; ✏️ = escribe, con
`destructiveHint: false`; 🗑️ = `destructiveHint: true`. Todas las
herramientas llevan `openWorldHint: false`.

### Lectura (Historia 3)

| Herramienta | Entrada | Salida | Reutiliza | FR |
|---|---|---|---|---|
| 🔍 `list_projects` | `{}` | `[{ projectId, name, prefix, kind: "personal" \| "shared", role, memberCount }]` | `listMyProjects` | FR-024 |
| 🔍 `get_board` | `{ projectId }` | `{ role, columns: [{ columnId, name, isClosing, workItems: [{ workItemId, title, assignee: { memberId, name } \| null, priority, targetDate, isClosed, tags }] }] }` | `getBoard` + `getWorkItemsView` (tags, asignado) | FR-025 |
| 🔍 `search_work_items` | `{ projectId, text?, assigneeIds?: (memberId \| "unassigned" \| "me")[], columnIds?, state?: "open" \| "closed", limit? = 100 (≤500), offset? = 0 }` | `{ total, nextOffset \| null, items: [{ workItemId, title, columnId, columnName, assignee, priority, isClosed }] }` | `getWorkItemsView` + `lib/mcp/search.ts` | FR-026 |
| 🔍 `get_work_item` | `{ projectId, workItemId }` | Todos los campos (`description`, `assignee`, `tags`, `priority`, `severity`, `area`, `iteration`, `startDate`, `targetDate`, `closedAt`, `createdAt`, `updatedAt`, `column`), más `parent`, `children`, `related` (como `workItemId` + título) y `activity: [{ type, at, actorName, agentName, summary }]` | `getWorkItemDetailData` + `listWorkItemActivity` | FR-027 |
| 🔍 `list_members` | `{ projectId }` | `[{ memberId, name, role, email? }]`. `email` solo si el rol del usuario lo ve en la interfaz. | `listProjectMembers` | FR-028 |

### Escritura de Work Items (Historia 4)

| Herramienta | Entrada | Reutiliza | FR |
|---|---|---|---|
| ✏️ `create_work_items` | `{ projectId, columnId, items: [{ title, description?, assigneeId?, tags?, priority?, severity?, area?, iteration?, startDate?, targetDate? }] }`, con 1 a 50 elementos | `createWorkItems` (nueva) | FR-029 |
| ✏️ `update_work_item` | `{ projectId, workItemId, title?, description?, assigneeId?: memberId \| null, tags?, priority?, severity?, area?, iteration?, startDate?, targetDate? }`. `undefined` no toca el campo y `null` lo vacía. | `updateWorkItem` | FR-030 |
| ✏️ `move_work_item` | `{ projectId, workItemId, columnId, position?: number }`. Sin `position`, va al final. | `moveWorkItem` | FR-031 |
| ✏️ `set_parent` | `{ projectId, workItemId, parentWorkItemId: string \| null }`. `null` quita el padre. | `setWorkItemParent` / `removeWorkItemParent` | FR-031 |
| ✏️ `link_related` | `{ projectId, workItemId, relatedWorkItemId, linked: boolean }` | `linkRelatedWorkItems` / `unlinkRelatedWorkItems` | FR-031 |
| 🗑️ `delete_work_item` | `{ projectId, workItemId }` | `deleteWorkItem` | FR-031 |

`create_work_items` devuelve `{ created: [{ workItemId, title }] }`, en el
orden de entrada.

### Columnas (Historia 4, escenario 9)

| Herramienta | Entrada | Reutiliza | FR |
|---|---|---|---|
| ✏️ `create_column` | `{ projectId, name }` | `createStage` | FR-032 |
| ✏️ `rename_column` | `{ projectId, columnId, name }` | `renameStage` | FR-032 |
| ✏️ `reorder_columns` | `{ projectId, columnIds: string[] }` (orden completo) | `reorderStages` | FR-032 |
| ✏️ `set_column_closing` | `{ projectId, columnId, isClosing }` | `setStageClosing` | FR-032 |
| 🗑️ `delete_column` | `{ projectId, columnId }`. Si la columna tiene Work Items, responde `STAGE_NOT_EMPTY`. | `deleteStage` | FR-032 |

### Excluidas a propósito (FR-023)

No existen herramientas para:

- Crear proyectos.
- Invitar, cancelar invitaciones, remover miembros o cambiar roles.
- Transferir la propiedad.
- Renombrar, editar la descripción, eliminar o salir de un proyecto.
- Responder invitaciones o leer notificaciones.

`tests/unit/mcp-tools.test.ts` fija la lista exacta de nombres registrados,
así que agregar una herramienta requiere cambiar ese test **y** este
contrato.

## Límite de velocidad

Antes de ejecutar cada herramienta, `lib/mcp/rate-limit.ts` consume un token
del bucket `(userId, clientId)`: 120 por minuto, con ráfagas de 30. Si no
quedan, la herramienta devuelve `RATE_LIMITED` sin ejecutar la acción.

## Invariantes (verificadas por test)

1. Ninguna herramienta escribe con `db` directamente: toda escritura llama a
   una función exportada de `lib/actions/*` (FR-033).
2. Toda herramienta que recibe `projectId` llama a
   `requireProjectMember(projectId)` antes de resolver ids. Esto ocurre
   directamente o a través de la acción que reutiliza.
3. `runAsAgent` solo se invoca en `app/api/mcp/route.ts`, después de los
   pasos 1 a 3 de § Autorización.
