# Research: Acceso para Agentes de IA y Asignación de Work Items

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-22

El stack (Next.js 16, Neon + Drizzle, Better Auth self-hosted, Render) ya
está decidido en [001-accounts-invitations/research.md](../001-accounts-invitations/research.md)
y no se reevalúa. Esta investigación cubre solo lo nuevo: el protocolo para
agentes, el servidor de autorización, cómo una petición de agente reutiliza
las Server Actions existentes, la persona asignada y las notificaciones.

Versiones verificadas el 2026-09-22 contra el registro de npm y la
documentación oficial:

- `better-auth` 1.7.5, `@better-auth/mcp` 1.7.5 y `@better-auth/cimd` 1.7.5.
- `@modelcontextprotocol/server` 2.0.0, que implementa la revisión
  2026-07-28 de MCP.

---

## Decisión: protocolo para agentes → MCP sobre Streamable HTTP

**Decision**: Se expone un servidor **MCP** (Model Context Protocol) en
`POST /api/mcp` con el transporte Streamable HTTP. El SDK oficial es
`@modelcontextprotocol/server` v2 con `createMcpHandler`.

**Rationale**:

- MCP es el estándar abierto que ya soportan los asistentes objetivo
  (Claude Code, Claude Desktop, claude.ai) y otros clientes. Cumple FR-014 y
  el Principio V: no ata el producto a un proveedor.
- `createMcpHandler` recibe un `Request` web estándar y devuelve un
  `Response`, así que se monta tal cual en un Route Handler de Next.js.
- El handler es **stateless**: crea un `McpServer` nuevo por petición y no
  necesita un almacén de sesiones. Encaja con Render y no requiere Redis ni
  WebSockets, lo que respeta la decisión de "sin tiempo real" de la Fase 1.

**Alternatives considered**:

- *API REST propia + documentación*: cada asistente necesitaría una
  integración a medida. Descartada.
- *`mcp-handler` (Vercel)*: es un adaptador de terceros sobre el SDK. No
  aporta nada que `createMcpHandler` no tenga ya en v2.
- *SDK v1 (`@modelcontextprotocol/sdk` 1.30)*: está reemplazado por v2.
  Empezar en v1 sería empezar con deuda.

## Decisión: compatibilidad de protocolo → `legacy: "stateless"`

**Decision**: `createMcpHandler(factory, { legacy: "stateless" })`. Sirve la
revisión moderna (2026-07-28) y también la anterior (familia 2025-11-25) sin
estado.

**Rationale**: La documentación de `@better-auth/mcp` recomienda
`legacy: "reject"`. Pero la revisión 2026-07-28 tiene menos de dos meses y
no podemos garantizar que todos los clientes que el usuario va a usar ya la
negocien. Aceptar ambas eras no agrega estado: el SDK responde las peticiones
legacy con una instancia nueva por petición, y GET/DELETE devuelven `405`.
Si más adelante todos los clientes objetivo hablan 2026-07-28, se cambia a
`"reject"` en una línea.

**Alternatives considered**: `"reject"` (lo que recomienda la
documentación). Es el riesgo de que un cliente no pueda conectarse el primer
día. Se revisa en la validación manual (quickstart § 2).

## Decisión: servidor de autorización → `@better-auth/mcp` dentro del Better Auth existente

**Decision**: Se agregan tres plugins al `betterAuth()` de `lib/auth.ts`:

- `jwt()`: firma los access tokens y publica `/api/auth/jwks`.
- `mcp({ loginPage: "/sign-in", consentPage: "/consent", resource })`: es el
  proveedor OAuth 2.1 configurado para MCP. Vincula los tokens a la
  audiencia del recurso MCP y publica los metadatos RFC 9728.
- `cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" })`:
  implementa *Client ID Metadata Documents*, el mecanismo de registro de
  clientes de MCP 2026-07-28.

Además, `allowDynamicClientRegistration: true` y
`allowUnauthenticatedClientRegistration: true` habilitan la registración
dinámica (RFC 7591) para los clientes de la revisión anterior.

Consecuencias:

- `better-auth` sube de 1.7.4 a 1.7.5, porque es la peer dependency de los
  plugins.
- `resource` = `${BETTER_AUTH_URL}/api/mcp`. El plugin acepta `http` solo en
  loopback, así que el desarrollo local funciona con `http://localhost:3000`.

**Rationale**:

- La constitución (Principio VI) y la decisión de 001 (Better Auth
  self-hosted, no un servicio de identidad aparte) favorecen extender la
  misma librería: el consentimiento reutiliza la misma sesión, las mismas
  cuentas y el mismo login de Google o email.
- `mcp()` ya resuelve PKCE, refresh tokens con rotación, audiencia del
  recurso, metadatos `.well-known`, el desafío `WWW-Authenticate` que
  dispara el flujo en el cliente y DPoP cuando el cliente lo usa.
- El usuario no copia ninguna clave (FR-015).
- La registración abierta, tanto CIMD como DCR, es segura para este caso:
  registrar un cliente no da acceso a nada, porque todo acceso pasa por el
  consentimiento del usuario (FR-015; spec § Assumptions). Better Auth ya
  limita la velocidad de sus propios endpoints.

**Alternatives considered**:

- *`oauthProvider()` a secas*: habría que replicar a mano lo que `mcp()`
  agrega para MCP. La documentación además prohíbe combinar ambos plugins.
- *Proveedor externo (Auth0, WorkOS, Stytch)*: es un servicio más que cada
  operador de una instancia self-hosted tendría que contratar, y va en contra
  de la decisión de 001. Descartado.
- *Claves de API personales*: el usuario tendría que copiar un secreto, y
  eso viola FR-015. Además cada asistente las configura distinto. Quedan
  fuera de alcance (spec § Fuera de alcance).
- *Solo CIMD, sin DCR*: es lo que recomienda la documentación, pero dejaría
  fuera a los clientes de la revisión anterior. Se revisa junto con
  `legacy`.

## Decisión: revocación inmediata con access tokens JWT → verificación de consentimiento por petición

**Decision**: `requireMcpAuth` verifica el JWT localmente (firma, emisor,
audiencia y expiración contra el JWKS). Después, **en cada petición**, el
route handler comprueba en la base de datos que:

1. Sigue existiendo un `oauthConsent` para `(sub, azp)`: el usuario y el
   cliente del token.
2. El usuario existe.

Si alguna de las dos falla, responde 401 con el mismo desafío que un token
inválido.

Revocar (FR-036) borra, en una transacción:

- El `oauthConsent` del par.
- Los `oauthRefreshToken` del par.
- Los `oauthAccessToken` opacos del par, si los hubiera.

**Rationale**: Los JWT no se pueden revocar: el endpoint `/oauth2/revoke`
responde `unsupported_token_type` para ellos, y un access token sigue siendo
válido hasta su expiración, que por defecto es 1 hora. FR-036 y SC-008 exigen
que la **siguiente** consulta falle. Una lectura indexada por petición es
barata frente a lo que cuesta ejecutar la herramienta, y cubre también el
caso de la cuenta eliminada (FR-037).

**Alternatives considered**:

- *Solo TTL corto (5 minutos)*: seguiría habiendo una ventana de uso tras
  revocar. No cumple FR-036.
- *Tokens opacos + introspección*: agrega un round-trip HTTP interno por
  petición. La documentación de Better Auth desaconseja la introspección para
  clientes externos, y además perderíamos la verificación JWKS que ya trae
  `requireMcpAuth`.

**A verificar al implementar**: que el JWT del access token trae `azp` con el
`client_id`. El código de `@better-auth/oauth-provider` 1.7.5 lo lee de
`payload.client_id ?? payload.azp`. También el nombre exacto de las
columnas de `oauthConsent`, tal como las genere `auth:generate`.

## Decisión: cómo una petición de agente reutiliza las Server Actions → contexto de actor con `AsyncLocalStorage`

**Hallazgo**: Toda la autorización actual depende de la cookie de sesión:
`requireProjectMember` llama a `getSession()`, y `getSession()` lee
`headers()`. Una petición MCP no trae cookie, solo un bearer token. Sin
cambios, ninguna Server Action funcionaría llamada desde `/api/mcp`.

**Decision**: Se crea `lib/actor.ts` (solo servidor, sin `"use server"`) con:

- `type Actor = { userId: string; agent: { clientId: string; name: string } | null }`.
- `runAsAgent(actor, fn)`: ejecuta `fn` dentro de un `AsyncLocalStorage`
  con ese actor. Solo lo llama el route handler MCP, **después** de
  verificar el token y el consentimiento.
- `getActor()`: devuelve el actor del `AsyncLocalStorage` si existe. Si no,
  lo deriva de `getSession()` con `agent: null`. Si tampoco hay sesión,
  devuelve `null`.

`requireProjectMember` y `requireProjectPermission` pasan a usar
`getActor()` y devuelven `{ actor, project, membership }` en vez de
`{ session, … }`. Los pocos llamadores que usaban `session.user.id` pasan a
`actor.userId`. Las herramientas MCP llaman **las mismas funciones
exportadas** de `lib/actions/*` (`createWorkItem`, `moveWorkItem`,
`updateWorkItem`, `deleteStage`, …) con los mismos argumentos que usa la
interfaz.

**Rationale**:

- FR-033 exige que toda escritura de un agente tenga **exactamente** el
  mismo resultado que desde la interfaz. La forma más segura de garantizarlo
  es que sea el mismo código: mismas validaciones, mismos bloqueos
  `FOR SHARE`/`FOR UPDATE`, mismo `nextClosedAt`, misma auditoría y mismo
  `requireProjectPermission`.
- FR-020 (mismo rol vigente en cada acción) sale gratis: el rol se sigue
  leyendo de `project_members` en cada llamada.
- El contexto solo lo pone el route handler MCP tras autenticar. Una Server
  Action invocada por RPC desde el navegador corre en otra petición y
  otro contexto asíncrono, así que nunca lo ve: no hay forma de que un
  cliente web "se haga pasar" por agente.
- La auditoría obtiene el actor sin cambiar la firma de ninguna acción (ver
  § Auditoría).

**Alternatives considered**:

- *Capa de servicios con `actor` explícito*: mover el cuerpo de cada
  acción a `lib/services/*(actor, input)` y dejar las acciones como
  envoltorios. Es más explícito, pero toca las ~20 acciones del tablero,
  los Work Items y las relaciones, con riesgo de regresión en código probado
  por 43 e2e, sin cambiar el comportamiento. Se descarta por
  Principio VI. Si algún día hay un segundo transporte, se puede extraer
  entonces.
- *Llamar a las Server Actions por HTTP desde el handler MCP*: no hay una
  API estable para eso y seguiría faltando la cookie.
- *Sesión Better Auth sintética por petición MCP*: crear una sesión real a
  partir del token mezcla los dos mundos. Las sesiones MCP aparecerían como
  sesiones de navegador y revocarlas sería más difícil. Descartado.

**Reglas que quedan** (van al contrato):

1. `runAsAgent` no se exporta desde ningún archivo `"use server"`.
2. Ninguna herramienta MCP accede a `db` para escribir: toda escritura pasa
   por una Server Action exportada.
3. Las lecturas pueden componer consultas propias en `lib/mcp/`, siempre
   después de `requireProjectMember`.

## Decisión: identificadores que ve el agente

**Decision**: El agente trabaja solo con identificadores públicos:

- Proyecto: `projectPublicId`.
- Columna: `stage.publicId`.
- Work Item: su ID visible `PREFIX-N`, siempre junto al `projectPublicId`.
- Miembro: el `userId` de Better Auth. Ya se expone en
  `listProjectMembers` y en `removeMember`. Es un id de texto aleatorio,
  no secuencial.

`lib/mcp/resolve.ts` traduce `PREFIX-N` y `stage.publicId` a los ids
internos que esperan `moveWorkItem`, `updateWorkItem` y las demás acciones,
**siempre después** de `requireProjectMember` y siempre filtrando por el
proyecto. Un `PREFIX-N` de otro proyecto no se encuentra (spec § Edge Cases).

**Rationale**: El Principio IV exige que las entidades expuestas usen
identificadores públicos. Además, el ID visible es lo que el usuario dice en
lenguaje natural ("mueve KAN-12").

**Alternatives considered**: *Aceptar el nombre del proyecto*. Es ambiguo
(spec § Edge Cases): el agente primero llama `list_projects`, elige y usa el
id.

## Decisión: creación en bloque todo-o-nada

**Decision**: `createWorkItem` pasa a delegar en una función de
`lib/work-item-create.ts` (solo servidor, sin `"use server"`):
`createWorkItemsInStage(tx, { project, stage, items })`. Esa función crea N
Work Items en una transacción recibida, reserva los números con un solo
`UPDATE … SET next_work_item_number = next_work_item_number + N RETURNING`
y aplica cierre, asignación, tags y campos igual que la creación unitaria.

Se agrega una Server Action nueva, `createWorkItems({ stagePublicId, items })`.
Valida todos los elementos con zod **antes** de abrir la transacción y
reporta el índice del primero inválido (FR-029, spec US4 escenario 2).
`createWorkItem` (unitario) es `createWorkItems` con un elemento. Máximo 50
elementos por llamada (FR-029).

**Rationale**:

- Todo-o-nada es simplemente una transacción. Los números `PREFIX-N` quedan
  consecutivos.
- La validación previa evita abortar la transacción a mitad de camino por un
  error de entrada.
- Los errores que solo se detectan dentro de la transacción (asignado que ya
  no es miembro, columna eliminada) hacen rollback de todo.

**Alternatives considered**: *N llamadas a `createWorkItem` desde la
herramienta*. No sería todo-o-nada y generaría huecos de numeración si una
falla.

## Decisión: persona asignada → FK compuesta a `project_members` con `ON DELETE SET NULL (assignee_user_id)`

**Decision**:

- `work_items.assignee_user_id text NULL`.
- FK compuesta `(project_id, assignee_user_id) → project_members(project_id, user_id)`
  con `ON DELETE SET NULL (assignee_user_id)`. Es la sintaxis de Postgres ≥15
  que anula solo la columna indicada.

Al remover o sacar a un miembro (`removeMember`, `leaveProject`), la misma
transacción:

1. Lee los Work Items del proyecto asignados a esa persona.
2. Inserta un evento `assignee_changed` con `reason: "member_left"` por
   cada uno (FR-006, FR-009).
3. Borra la membresía. La FK deja `assignee_user_id` en `NULL`.

**Rationale**:

- SC-004 pide que **nunca** haya un Work Item asignado a alguien que no es
  miembro, "incluso tras salidas y remociones". Una FK lo garantiza a nivel
  de base de datos, incluidas las carreras entre "asignar" y "salir" que un
  chequeo en la aplicación no cubre.
- La FK compuesta impide además, por construcción, asignar a un miembro de
  **otro** proyecto (FR-005, Principio IV).
- Postgres no puede usar `SET NULL` a secas porque anularía también
  `project_id`, que es `NOT NULL`. Por eso se usa la lista de columnas.

**Riesgos y mitigaciones**:

- `drizzle-orm` 0.45 no modela la lista de columnas de `SET NULL`. La FK se
  declara en `schema.ts` con `onDelete: "set null"` para que el snapshot sea
  coherente, y el SQL de la migración generada se **edita a mano** para
  agregar `(assignee_user_id)`. Un comentario en `schema.ts` lo explica.
  drizzle-kit compara contra el snapshot, no contra la base de datos, así
  que no la vuelve a generar. Hay que verificar la versión de Postgres de
  las ramas `dev` y `main` de Neon (≥15) antes de aplicar la migración.
- Eliminar una cuenta: el producto no tiene un flujo de borrado de cuenta
  (010-legal-pages lo resuelve con un pedido al operador). Como `user_id` no
  tiene FK a `user` (convención de 001), el operador borra primero las
  membresías del usuario, lo que dispara el `SET NULL`, y después el usuario.
  El orden queda documentado en el README (§ Self-hosting). Las tablas OAuth
  de Better Auth sí tienen FK a `user` con cascada, así que las
  autorizaciones desaparecen con la cuenta (FR-037).

**Alternatives considered**: *Chequeo solo en la aplicación*. Deja carreras
posibles y un camino más para olvidarlo. Descartado.

## Decisión: notificaciones de asignación → nuevo tipo en `notifications`

**Decision**:

- `notification_type` gana el valor `work_item_assigned`, con payload
  `{ workItemId, projectId, assignedByUserId, agentName | null }`.
- La notificación se inserta en la **misma transacción** que la asignación:
  en `updateWorkItem` y en `createWorkItemsInStage`, solo cuando el asignado
  nuevo no es `null` y es distinto del actor (FR-011, FR-013). Se usa
  `getActor()`, así que el caso "me asigné con mi propio agente" tampoco
  notifica.
- `listMyNotifications` pasa a devolver una unión discriminada por `type`:
  - `invitation`: la consulta actual.
  - `work_item_assigned`: `LEFT JOIN` a `work_items`, `projects` y
    `project_members` del destinatario.

  Si el Work Item ya no existe o el destinatario perdió el acceso, la
  notificación se devuelve con `available: false` y sin título ni
  proyecto actuales (FR-013).
- Acción nueva `markNotificationRead(id)`, que solo afecta notificaciones
  del propio usuario. El cliente la llama al abrir la notificación, antes de
  navegar al detalle, y también desde un botón de "marcar como leída".

**Rationale**:

- La tabla y el panel ya existen (001, FR-006) y el enum se declaró
  "extensible a futuro" en su data-model. El usuario pidió explícitamente el
  mismo mecanismo que las invitaciones.
- La inserción transaccional evita notificaciones de asignaciones que
  hicieron rollback.

**Alternatives considered**: *Tabla de notificaciones aparte para
asignaciones*. Duplica el panel y la consulta. Descartado.

## Decisión: auditoría con actor y agente

**Hallazgo**: `work_item_activity` hoy no guarda **quién** hizo cada cambio,
solo `type` y `payload`.

**Decision**: Se agregan tres columnas nullable a `work_item_activity`:

- `actor_user_id text`: quién hizo el cambio.
- `agent_client_id text`: el cliente OAuth, si el cambio vino de un agente.
- `agent_name text`: el nombre del cliente **copiado en el momento**, para
  que el historial siga siendo legible aunque el cliente se borre o cambie de
  nombre.

Un helper `lib/activity.ts` (`logActivity(tx, workItemId, type, payload)`)
toma el actor de `getActor()` y reemplaza los `tx.insert(workItemActivity)`
dispersos en las acciones. Las filas anteriores quedan con actor `NULL` y la
vista de detalle simplemente no muestra autor para ellas.

La vista de detalle muestra, en cada evento:

- "por *Nombre*", cuando hay actor.
- "por *Nombre* vía *Claude*", cuando además vino de un agente (FR-034).

**Rationale**: FR-034 exige la atribución, y también SC-010. Hacerlo en
columnas en vez de dentro del `payload` permite mostrar el autor igual para
todos los tipos de evento sin tocar cada `describeActivity`.

**Alternatives considered**: *Meter el actor dentro de cada `payload`*.
Cada tipo de evento tendría que acordarse de hacerlo. Descartado.

## Decisión: búsqueda y lectura para el agente

**Decision**: Las herramientas de lectura reutilizan las lecturas que ya
existen:

- `listMyProjects` para los proyectos.
- `getBoard` para el tablero.
- `getWorkItemDetailData` para el detalle.
- `listProjectMembers` para los miembros.
- `getWorkItemsView` para buscar.

Esta última ya carga todos los Work Items de un proyecto con sus campos,
porque la Tabla y la Lista de 009 filtran en memoria. La búsqueda por texto,
asignado, columna y estado se hace en memoria en `lib/mcp/search.ts`, con
funciones puras probadas por unidad. Los resultados se paginan con `limit`
(por defecto 100, máximo 500) y `offset`, y la respuesta indica `total` y
`nextOffset` para que nunca haya truncado silencioso.

**Rationale**:

- 009 ya validó que cargar el proyecto completo es aceptable a la escala
  asumida (≥100 Work Items).
- SC-011 (500 Work Items en <2 s) se cumple con una sola consulta y un
  filtro en memoria.
- No hace falta búsqueda de texto completo en Postgres (Principio VI).

**Alternatives considered**: *`ILIKE` en SQL*. Sería otro camino de lectura
paralelo a 009 sin necesidad demostrada.

## Decisión: límite de velocidad por conexión de agente

**Decision**: Token bucket **en memoria** por `(userId, clientId)`:

- 120 llamadas a herramientas por minuto, con ráfagas de hasta 30.
- Implementado en `lib/mcp/rate-limit.ts`, con entradas que expiran solas.
- Al excederse, la herramienta devuelve un error de herramienta
  (`isError: true`) con el código `RATE_LIMITED` y los segundos a esperar
  (FR-038).

**Rationale**:

- Hoy hay una sola instancia en Render, así que un contador en memoria es
  exacto.
- No afecta la interfaz web (FR-038), porque solo corre en `/api/mcp`.
- Si algún día hay varias instancias, el límite pasa a ser por instancia,
  lo cual sigue protegiendo. Documentado.

**Alternatives considered**: *Tabla en Postgres o Redis*. Agrega una
escritura por llamada o un servicio más. No hay necesidad demostrada
(Principio VI).

## Decisión: pantalla de consentimiento y reanudación del flujo

**Decision**:

- Página `app/(auth)/consent/page.tsx`. Es un Server Component que exige
  sesión y lee el cliente por `client_id` para mostrar su nombre y, si
  existe, su URI. El formulario cliente llama
  `authClient.oauth2.consent({ accept })`.
- `lib/auth-client.ts` agrega `oauthProviderClient()`. La pantalla de
  sign-in no cambia de comportamiento: el plugin cliente reanuda la
  autorización cuando `/sign-in` recibe los parámetros firmados de
  `/oauth2/authorize`.
- El texto del consentimiento es el de FR-016: acceso completo con los
  permisos de tu rol, incluye eliminar Work Items y columnas, y no incluye
  administrar miembros ni proyectos.

**A verificar al implementar**: el flujo completo con Google como método de
login, porque el `callbackURL` de Google debe preservar los parámetros de la
autorización. Queda cubierto en quickstart § 2.

## Decisión: pruebas

**Decision**:

- **Unidad (Vitest)**:
  - `lib/mcp/search.ts` (filtros y paginación).
  - `lib/mcp/resolve.ts` (IDs visibles de otro proyecto → `NOT_FOUND`).
  - `lib/actor.ts` (el contexto de agente gana sobre la sesión y no se filtra
    fuera de `runAsAgent`).
  - `createWorkItems` (todo o nada, índice del error, límite de 50).
  - `updateWorkItem` con asignado (no miembro → `NOT_A_MEMBER`, notificación
    solo si el asignado ≠ actor).
  - `listMyNotifications` con `available: false`.
  - El barrido de `action-permissions.test.ts` ampliado.
  - Un test nuevo que recorre las herramientas registradas y verifica que
    ninguna corresponde a una acción de administración (FR-023).
- **Integración del handler MCP (Vitest)**: petición sin token → 401 con
  `WWW-Authenticate`. Token válido pero consentimiento borrado → 401. Token
  válido → `tools/list` con las herramientas esperadas. Los tokens se firman
  en el test con una clave JWKS de prueba.
- **E2E (Playwright)**: asignar, filtrar, notificación y la pantalla de
  agentes conectados (listar y revocar con datos sembrados). El flujo OAuth
  completo con un cliente MCP real es **manual** (quickstart § 2), porque
  depende del asistente del usuario.

---

## Hallazgos de implementación (2026-09-23)

Verificaciones que el plan dejó marcadas como pendientes y lo que se decidió
al implementar:

1. **Claims del access token**: el JWT trae `sub` (usuario), `azp` y
   `client_id` (cliente) y `aud` = `[<instancia>/api/mcp, <instancia>/api/auth/oauth2/userinfo]`.
   `requireMcpAuth` valida la audiencia de `/api/mcp`. Confirmado con un flujo
   OAuth real contra `next dev`: registro DCR, autorización con PKCE,
   consentimiento, token y llamadas MCP.
2. **Descubrimiento en la raíz**: Better Auth sirve sus metadatos bajo
   `/api/auth`, y el 401 de `/api/mcp` apunta a
   `/.well-known/oauth-protected-resource/api/mcp`. Hacen falta tres Route
   Handlers en `app/.well-known/`:
   - `oauth-protected-resource`: delega en `auth.handler`, porque el plugin
     `mcp()` responde por el path.
   - `oauth-authorization-server`: `oauthProviderAuthServerMetadata`.
   - `openid-configuration`: `oauthProviderOpenIdConfigMetadata`.

   Los tres usan `[[...path]]` para aceptar la variante con y sin el path
   del emisor.
3. **Protocolo**: con `legacy: "stateless"`, el cliente oficial
   `@modelcontextprotocol/client` 2.0 funciona tanto fijado en 2026-07-28
   como con la negociación por defecto (2025-11-25). El contexto de actor
   (`AsyncLocalStorage`) llega a los handlers de las herramientas en ambos
   casos.
4. **CLI de Better Auth**: `@better-auth/cli` (1.4.x) quedó obsoleta. La
   CLI actual es el paquete `auth`, que no resuelve el alias `@/` de
   `tsconfig`. Por eso los plugins viven en `lib/auth-plugins.ts`, sin
   alias, y `npm run auth:generate` lee `db/auth-schema.config.ts`, una
   config mínima que solo sirve para generar el esquema.
5. **Dos migraciones en vez de una**: `drizzle-kit generate` pregunta de
   forma interactiva si `assignee_user_id` es un rename de `stakeholder`.
   Para evitarlo:
   - `0005_agent_access_assignee` agrega todo, incluida la FK editada a mano.
   - `0006_drop_stakeholder` solo elimina la columna.

   Se aplican juntas. La rama `dev` de Neon corre Postgres 18.
6. **`redirect_uri` de clientes nativos**: Better Auth exige `https` salvo en
   `localhost` para clientes `web`. Los clientes MCP de escritorio se
   registran como `native` con `http://localhost:<puerto>/…`, que es lo que
   hacen Claude Code y Claude Desktop.
7. **Reanudar tras el login**: `oauthProviderClient()` agrega la consulta
   firmada a `signIn.email`. Better Auth responde `{ redirect: true, url }` y
   navega solo. La página `/sign-in` ya no hace `router.push("/")` en ese
   caso. Verificado en el navegador: autorizar sin sesión → `/sign-in` →
   `/consent` → Allow/Deny → callback con `code` o `error=access_denied`.
   El login con Google dentro del flujo queda para la validación manual
   (quickstart § 2), porque requiere una cuenta real de Google.
8. **Lote con asignado inválido**: además de la FK, `createWorkItems` valida
   antes de la transacción que cada asignado sea miembro, y así puede
   reportar `BATCH_ITEM_INVALID` con el índice (FR-029).
9. **Herramientas**: son 16 (5 de lectura, 6 de Work Items y 5 de
   columnas), no 17 como decía el borrador del plan.
