# Implementation Plan: Acceso para Agentes de IA y Asignación de Work Items

**Branch**: `011-agent-access-mcp` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-agent-access-mcp/spec.md`

**Nota de alcance**: Esta feature extiende el mismo codebase y el mismo
deploy de las fases anteriores. El stack, la autenticación (Better Auth
self-hosted), el hosting (Render), la matriz de permisos y las convenciones
de testing ya se decidieron en
[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md) y
[007-roles-permissions/plan.md](../007-roles-permissions/plan.md), y no se
vuelven a evaluar. Es la primera feature de la Fase 4.

## Summary

Dos entregas en una misma feature, porque la segunda depende de la primera
(spec § Clarifications):

1. **Asignado.** Reemplaza el campo `stakeholder` de texto libre por
   `assignee_user_id`: un miembro actual del proyecto, garantizado por una
   FK compuesta a `project_members` con `ON DELETE SET NULL (assignee_user_id)`.
   - Se edita con un desplegable en el detalle.
   - Se ve en la tarjeta, la Lista y la Tabla, y se filtra ("Assigned to
     me", "Unassigned").
   - Notifica a la persona asignada por el mismo panel que las invitaciones.
2. **Acceso para agentes.** Agrega un servidor **MCP** en `POST /api/mcp`
   (`@modelcontextprotocol/server` v2, stateless), protegido por OAuth 2.1.
   - El servidor de autorización es el mismo Better Auth, con los plugins
     `jwt()`, `mcp()` y `cimd()` y una pantalla de consentimiento propia.
   - Cada petición verifica el JWT y, además, que el consentimiento siga
     vigente. Eso hace que la revocación sea inmediata.
   - Después ejecuta las **mismas Server Actions** que la interfaz dentro
     de un contexto de actor (`AsyncLocalStorage`). El agente hereda
     exactamente el rol del usuario, las validaciones, los bloqueos y la
     auditoría.
   - El historial de actividad gana el actor y el agente.
   - Una sección "Connected agents" lista y revoca los agentes.

Ver [research.md](research.md) para cada decisión y sus alternativas
descartadas.

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 20+ (sin cambios).

**Primary Dependencies**: Next.js 16 (App Router, Server Actions,
Route Handlers), React 19, Drizzle ORM 0.45 + drizzle-kit, zod 4 y
lucide-react, ya instaladas. Cambios de dependencias:

- `better-auth` **1.7.4 → 1.7.5** (peer dependency de los plugins).
- **Nuevas**:
  - `@better-auth/mcp` 1.7.5: servidor de autorización OAuth 2.1 para MCP y
    `requireMcpAuth`.
  - `@better-auth/cimd` 1.7.5: *Client ID Metadata Documents*.
  - `@modelcontextprotocol/server` 2.0.0: SDK oficial de MCP,
    `createMcpHandler`.

Las tres son MIT y open source (Principio V). Antes de implementar hay que
leer en `node_modules/next/dist/docs/` la guía de Route Handlers y la de
`.well-known` (AGENTS.md: esta versión de Next.js difiere de la conocida).

**Storage**: Neon Postgres. Una migración `0005`, detallada en
[data-model.md § Migración](data-model.md#migración-0005):

- 6 tablas generadas por Better Auth.
- 1 tabla propia (`agent_last_used`).
- `work_items`: −`stakeholder`, +`assignee_user_id`, una FK compuesta
  **editada a mano** para `SET NULL (columna)` (requiere Postgres ≥15) y un
  índice.
- 3 columnas de actor en `work_item_activity`.
- 1 valor nuevo del enum `notification_type`.
- 1 índice parcial en `notifications`.

**Testing**: Vitest para unidad e integración, con lo detallado en
[research.md § Pruebas](research.md#decisión-pruebas):

- Contexto de actor.
- Búsqueda y paginación del agente.
- Resolución de IDs.
- `createWorkItems` todo o nada.
- Asignación, notificaciones y salida de un miembro.
- Handler MCP: 401 sin token, 401 con consentimiento revocado,
  `tools/list` exacto.
- Barrido de permisos ampliado.
- Test que prohíbe `insert(workItemActivity)` fuera de `lib/activity.ts`.

Playwright para e2e (`tests/e2e/assignee.spec.ts` y
`tests/e2e/connected-agents.spec.ts`): asignación, filtros, notificación, y
listar y revocar agentes con datos sembrados. El flujo OAuth con un asistente
real se valida **manualmente** (quickstart § 2), igual que el login de Google
en 010.

**Target Platform**: Web, mismo deploy de Render. La migración `0005` se
aplica primero en `dev` y luego en producción, **inmediatamente antes** del
deploy, porque elimina `stakeholder`.

**Project Type**: Aplicación web monolítica. Se agregan Route Handlers
(`/api/mcp` y, si hacen falta, rutas `.well-known`) al mismo proceso. No es
un servicio aparte.

**Performance Goals**:

- SC-011: lecturas del agente en menos de 2 s sobre 500 Work Items. Usan una
  sola consulta existente (`getWorkItemsView`) y filtran en memoria.
- Costo fijo por petición MCP: verificación JWT local (JWKS cacheado), una
  lectura indexada del consentimiento y del usuario, y un upsert de "último
  uso" como máximo una vez por minuto.
- Asignar suma una inserción de notificación en la transacción que ya
  existía. La interfaz no suma consultas: el asignado llega por `LEFT JOIN`
  en las lecturas actuales.

**Constraints**:

1. **Principio IV**:
   - Toda herramienta pasa por `requireProjectMember` o
     `requireProjectPermission`, a través de la Server Action que reutiliza.
   - Los IDs visibles y los `publicId` se resuelven siempre dentro del
     proyecto.
   - La FK compuesta impide asignar a no miembros.
   - `NOT_FOUND` y `FORBIDDEN` se unifican hacia el agente.
2. **Una sola ruta de escritura (FR-033)**: las herramientas MCP no escriben
   con `db`, solo llaman Server Actions exportadas.
3. **Ningún helper sin control de acceso exportado desde un archivo `"use
   server"`**. Las piezas nuevas son solo servidor y no llevan
   `"use server"`: `lib/actor.ts`, `lib/activity.ts`,
   `lib/work-item-create.ts`, `lib/work-item-assignee.ts` y `lib/mcp/*`.
4. **Auditoría (constitución)**: toda inserción de actividad pasa por
   `logActivity`, con actor y agente.
5. **No encadenar Server Actions desde el cliente** (005 research.md §
   Hallazgo). Tras asignar o revocar se usa `router.refresh()`. La
   notificación llama a `markNotificationRead` y navega.
6. **Sin tiempo real**: los cambios de agentes y las notificaciones se ven
   al abrir o refrescar la app.
7. **Principio V**: MCP y OAuth son estándares abiertos. Nada relacionado
   con Git ni CI/CD.

**Scale/Scope**: 1 feature, 5 historias de usuario, 38 requisitos
funcionales y 12 criterios de éxito. Toca:

- 5 archivos de Server Actions existentes y 1 nuevo (`agents.ts`).
- `lib/permissions.ts` y `lib/auth.ts`.
- ~7 módulos nuevos de `lib/` más `lib/mcp/`.
- 1 Route Handler MCP y hasta 2 `.well-known`.
- 2 páginas nuevas (consentimiento y agentes conectados).
- ~7 componentes existentes y 4 nuevos.
- 1 migración.
- 16 herramientas MCP.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | Asignar es un desplegable en línea que se guarda con el mismo "Save" del detalle. El avatar en la tarjeta es compacto, sin saturar el tablero. "Assigned to me" es un filtro de un clic. El consentimiento dice claramente qué podrá y qué no podrá hacer el agente, con Allow y Deny al mismo nivel. Revocar es un botón con confirmación (SC-012). Conectar un agente no requiere copiar claves (SC-005). |
| II. Colaboración sin Límites | PASS | El agente no es un miembro y no cuenta para Personal/Compartido. Asignar no limita miembros. Cualquier miembro, Lectores incluidos, puede ser asignado. |
| III. Jerarquía de Datos Consistente | PASS | La jerarquía no cambia. El asignado cuelga del Work Item y referencia una membresía del **mismo** proyecto. Las relaciones padre/hijo y "relacionado con" siguen igual, y el agente las usa con las mismas reglas. |
| IV. Aislamiento y Seguridad de Datos | PASS | Toda acción del agente verifica membresía y rol vigente con el mismo `requireProjectPermission`. Un proyecto ajeno responde `NOT_FOUND`. La FK compuesta impide asignar fuera del proyecto. El agente solo recibe identificadores públicos: `publicId`, `PREFIX-N` (ya justificado en 001 data-model) y `userId` de Better Auth (texto aleatorio, ya expuesto en la gestión de miembros). Las tablas nuevas borran en cascada con `user` (OAuth) o se limpian al revocar. La autorización se verifica **en cada petición**, incluido el consentimiento (research.md § Revocación inmediata). |
| V. Código Abierto / Sin Bloqueo | PASS | MCP es un estándar abierto que soportan varios asistentes. OAuth 2.1, CIMD y DCR son estándares. Las dependencias nuevas son MIT. No hay nada atado a un proveedor de IA concreto ni a Git/CI-CD. Cada operador self-hosted obtiene el servidor MCP sin configurar nada extra: `resource` se deriva de `BETTER_AUTH_URL`. |
| VI. Simplicidad y Alcance Enfocado (YAGNI) | PASS | Las capacidades son exactamente las confirmadas por el product owner (Clarifications). Se reutilizan las Server Actions, `getWorkItemsView`, el panel de notificaciones y Better Auth, sin capa de servicios nueva, sin búsqueda de texto completo, sin Redis para el límite de velocidad y sin scopes parciales. Una sola persona asignada. |
| Estándares § Autenticación | PASS | Sin cambios en los métodos de login. El consentimiento reutiliza Google y email/password. |
| Estándares § Auditoría | PASS | Nuevo evento `assignee_changed`, incluida la salida de un miembro. Los cambios de agentes quedan atribuidos con `actor_user_id` y `agent_name` en **todos** los eventos (FR-034). Un test impide saltarse `logActivity`. |
| Estándares § Roles | PASS | No hay claves de permiso nuevas. El agente hereda el rol del usuario. La restricción adicional del agente (sin administración, FR-023) es una lista cerrada de herramientas verificada por test, no un rol nuevo. |

Sin violaciones. Tres puntos de complejidad justificados están en
§ Complexity Tracking.

**Enmiendas a specs anteriores** (documentadas en spec § Assumptions): FR-009
de 004 (stakeholder), FR-003 de 006, la fila de campos de la matriz de 007 y
FR-005 y FR-007 de 009. No se modifica la constitución.

**Re-check post-diseño (Fase 1)**: se mantiene PASS. El diseño confirmó
cinco cosas:

1. Ninguna Server Action existente cambia de firma salvo `updateWorkItem`,
   que pierde `stakeholder` y gana `assigneeUserId` opcional.
   `requireProjectMember` cambia `session` por `actor` en su retorno, y es
   un cambio interno.
2. Las acciones nuevas (`createWorkItems`, `markNotificationRead`,
   `listConnectedAgents`, `revokeAgent`) usan claves existentes o son de
   cuenta.
3. Ningún helper sin control de acceso queda exportado desde un archivo
   `"use server"`.
4. Las 16 herramientas MCP mapean 1:1 a acciones existentes o nuevas y
   ninguna es de administración.
5. Los eventos de actividad existentes no cambian de forma.

## Project Structure

### Documentation (this feature)

```text
specs/011-agent-access-mcp/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — MCP, OAuth/Better Auth, revocación, actor, IDs, bloque, asignado, notificaciones, auditoría, búsqueda, rate limit, consentimiento, pruebas
├── data-model.md        # Phase 1 — work_items, work_item_activity, notifications, tablas OAuth, agent_last_used, migración 0005
├── quickstart.md        # Phase 1 — validación de las 5 historias (incluido el flujo OAuth manual)
├── contracts/
│   ├── mcp-tools.md     # POST /api/mcp: transporte, autorización, errores, identificadores, 16 herramientas
│   └── app-changes.md   # actor, logActivity, acciones modificadas/nuevas, agentes conectados, UI
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks) — no creado por este comando
```

### Source Code (repository root)

```text
db/
├── schema.ts                         # MODIFICADO: work_items −stakeholder +assignee_user_id + FK compuesta
│                                     #   (comentario: SET NULL (col) editado a mano en SQL) + índice;
│                                     #   work_item_activity +actor_user_id +agent_client_id +agent_name;
│                                     #   notification_type +'work_item_assigned' + índice parcial;
│                                     #   + tabla agent_last_used
├── auth-schema.ts                    # REGENERADO (npm run auth:generate): jwks, oauth_*
└── migrations/0005_<nombre>.sql      # NUEVO (+ meta/) — con la edición manual de la FK

lib/
├── auth.ts                           # MODIFICADO: plugins jwt(), mcp({ loginPage, consentPage, resource,
│                                     #   allowDynamicClientRegistration… }), cimd({ … })
├── auth-client.ts                    # MODIFICADO: + oauthProviderClient()
├── actor.ts                          # NUEVO (servidor): Actor, runAsAgent(), getActor()
├── activity.ts                       # NUEVO (servidor): logActivity() con actor/agente
├── permissions.ts                    # MODIFICADO: getActor() en vez de getSession(); retorna { actor, … }
├── work-item-create.ts               # NUEVO (servidor): createWorkItemsInStage(tx, …) — bloque todo-o-nada
├── work-item-assignee.ts             # NUEVO (servidor): setAssigneeWithinTx() — valida miembro, log,
│                                     #   notificación; unassignOnMemberExitWithinTx()
├── work-item-view.ts                 # MODIFICADO (puro): filtro/orden assignee, − stakeholder
├── mcp/
│   ├── config.ts                     # NUEVO: MCP_RESOURCE derivado de BETTER_AUTH_URL
│   ├── server.ts                     # NUEVO: createMcpHandler + registro de las 16 herramientas
│   ├── tools/{read,work-items,columns}.ts  # NUEVO: cada herramienta = zod input → Server Action → resultado
│   ├── resolve.ts                    # NUEVO: PREFIX-N / columnId → ids internos, dentro del proyecto
│   ├── search.ts                     # NUEVO (puro): filtros + paginación de search_work_items
│   ├── result.ts                     # NUEVO: Result<T> → CallToolResult; FORBIDDEN → NOT_FOUND
│   └── rate-limit.ts                 # NUEVO: token bucket en memoria por (userId, clientId)
└── actions/
    ├── work-items.ts                 # MODIFICADO: updateWorkItem (+assigneeUserId, −stakeholder),
    │                                 #   createWorkItem → createWorkItems (nueva), logActivity
    ├── board.ts                      # MODIFICADO: logActivity; getBoard con assignee
    ├── work-item-relationships.ts    # MODIFICADO: logActivity; getWorkItemDetailData con assignee + members
    ├── work-item-views.ts            # MODIFICADO: assignee en filas, − stakeholder
    ├── projects.ts                   # MODIFICADO: removeMember/leaveProject desasignan con log;
    │                                 #   listMyProjects/listProjectMembers con getActor(); session → actor
    ├── accounts-invitations.ts       # MODIFICADO: listMyNotifications (unión), + markNotificationRead
    └── agents.ts                     # NUEVO: listConnectedAgents, revokeAgent

app/
├── api/mcp/route.ts                  # NUEVO: POST = requireMcpAuth → consentimiento/usuario → runAsAgent
├── .well-known/…/route.ts            # NUEVO si hace falta (ver contracts/mcp-tools.md § Autorización)
├── (auth)/consent/page.tsx           # NUEVO: pantalla de consentimiento (+ componente cliente)
└── (workspace)/settings/agents/page.tsx  # NUEVO: Connected agents

components/
├── ui/avatar.tsx                     # NUEVO
├── work-items/
│   ├── AssigneePicker.tsx            # NUEVO
│   └── WorkItemDetailView.tsx        # MODIFICADO: − Stakeholder, + Assignee, autor/agente en historial
├── board/WorkItemCard.tsx            # MODIFICADO: avatar del asignado
├── views/{WorkItemsTable,WorkItemsList,ViewFilters}.tsx  # MODIFICADO: columna/filtro Assignee
├── sidebar/NotificationsPanelClient.tsx  # MODIFICADO: notificaciones de asignación + marcar leída
├── sidebar/…                         # MODIFICADO: enlace a Settings → Connected agents
└── settings/ConnectedAgentsList.tsx  # NUEVO: lista + Revoke con confirmación

tests/
├── unit/
│   ├── actor.test.ts                 # NUEVO
│   ├── mcp-search.test.ts            # NUEVO
│   ├── mcp-resolve.test.ts           # NUEVO
│   ├── mcp-tools.test.ts             # NUEVO: lista exacta de herramientas; ninguna de administración
│   ├── mcp-route.test.ts             # NUEVO: 401 sin token / consentimiento revocado; tools/list
│   ├── activity-logging.test.ts      # NUEVO: nadie inserta actividad fuera de logActivity
│   ├── work-items.test.ts            # MODIFICADO: asignado, notificación, createWorkItems
│   ├── work-item-view.test.ts        # MODIFICADO: filtro/orden assignee
│   ├── projects.test.ts              # MODIFICADO (o nuevo caso): salir desasigna con log
│   └── action-permissions.test.ts    # MODIFICADO: createWorkItems, acciones de cuenta
└── e2e/
    ├── setup.ts                      # MODIFICADO: TRUNCATE + tablas oauth_* y agent_last_used
    ├── assignee.spec.ts              # NUEVO: quickstart § 1
    └── connected-agents.spec.ts      # NUEVO: quickstart § 5 con consentimiento sembrado
```

**Structure Decision**: Es el mismo monolito Next.js. El servidor MCP es un
Route Handler más, no un servicio aparte. Todo lo nuevo en `lib/` es puro o
de solo servidor sin `"use server"`, por la regla de endpoints públicos de
AGENTS.md. Las herramientas MCP viven en `lib/mcp/tools/*` y solo traducen:
validan la entrada con zod, resuelven ids y llaman a la Server Action. Así
la lógica de negocio sigue en un solo lugar. `AssigneePicker` es un
componente aparte de `CatalogPicker`: elige una **persona** existente (sin
creación en línea, con avatar), no un valor de catálogo.

## Complexity Tracking

No hay violaciones de la constitución. Se registran tres decisiones no
obvias para que la revisión las evalúe explícitamente:

| Decisión | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| Contexto de actor con `AsyncLocalStorage` (`lib/actor.ts`) | Las Server Actions obtienen el usuario de la cookie, y una petición MCP trae un bearer token. Con el contexto, el agente usa **el mismo código** que la interfaz (FR-033) sin cambiar ~20 firmas. | Una capa de servicios con `actor` explícito toca todas las acciones probadas por los e2e sin cambiar el comportamiento. Una sesión sintética de Better Auth mezcla sesiones de navegador con agentes y complica la revocación. |
| FK compuesta con `SET NULL (assignee_user_id)` editada a mano en la migración | Es la única forma de garantizar SC-004 frente a carreras entre asignar y salir, y de impedir por construcción asignar fuera del proyecto. | Un chequeo solo en la aplicación deja la carrera abierta. `SET NULL` sin lista de columnas anularía `project_id` (NOT NULL) y fallaría. |
| Verificación del consentimiento en cada petición MCP, además del JWT | Los JWT no se pueden revocar, y FR-036 exige que la siguiente consulta tras revocar falle. | Un TTL corto deja una ventana de uso tras revocar. Los tokens opacos más introspección agregan un round-trip HTTP interno por petición. |
