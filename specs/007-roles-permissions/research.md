# Research: Roles y Permisos

No queda ningún `NEEDS CLARIFICATION` en el Technical Context del plan (el
stack ya está decidido en
[001-accounts-invitations/research.md](../001-accounts-invitations/research.md)
y las decisiones de producto quedaron cerradas en la sesión de clarificación
de la spec). Esta feature requiere resolver las decisiones técnicas propias
de un cambio transversal de autorización.

## Decisión: Fuente única de la matriz de permisos

**Decision**: Un módulo puro `lib/roles.ts` (sin importar nada de servidor)
define el tipo `ProjectRole`, un conjunto cerrado de claves de permiso —una
por fila de la matriz de la spec— y la función `can(role, permission)`. El
servidor lo consume vía un helper nuevo en `lib/permissions.ts`,
`requireProjectPermission(projectPublicId, permission)`, que hace lo mismo
que `requireProjectMember` (sesión → proyecto → membresía) y además lanza
`ROLE_NOT_PERMITTED` si `can(membership.role, permission)` es falso. La
interfaz importa el mismo `can` para decidir qué controles mostrar.

**Rationale**: Hoy cada Server Action decide por su cuenta si llama a
`requireProjectMember` o a `requireProjectOwner`, y las de board, work items
y relaciones simplemente no miran el rol. Con tres roles eso se vuelve una
matriz de 14 acciones × 3 roles repartida en ~30 funciones: exactamente el
tipo de regla que se desvía en silencio (una acción olvidada = un Lector que
puede escribir, violando el Principio IV). Centralizarla en una tabla
convierte "¿qué puede hacer cada rol?" en un solo lugar auditable, permite
que un test unitario la compare fila por fila con la spec, y hace que la UI y
el servidor no puedan discrepar. Que sea puro (sin `db`, sin `next/*`) es lo
que permite importarlo desde componentes cliente.

**Alternatives considered**:
- **Plugin de organizaciones/control de acceso de Better Auth**: descartado.
  El proyecto no usa ese plugin: membresías e invitaciones son tablas
  propias (`project_members`, `invitations`, ver
  [001 research.md](../001-accounts-invitations/research.md)) y migrarlas
  sería reescribir Fase 1 para resolver una matriz de 3 roles.
- **Librería de autorización (CASL, Casbin, etc.)**: descartada por
  Principio VI (YAGNI) y V (sin dependencias nuevas sin necesidad): con 3
  roles fijos y sin permisos por recurso, una tabla y una función bastan.
- **Comprobaciones de rol en línea en cada acción** (el patrón actual
  extendido con `if (membership.role === "viewer")`): es lo que se quiere
  evitar; no hay forma de verificar mecánicamente que ninguna acción se
  olvidó.

## Decisión: Representación del rol en la base de datos

**Decision**: Se agrega el valor `viewer` al enum de Postgres existente
`project_role` (`ALTER TYPE ... ADD VALUE`), y se mantiene una fila por
membresía en `project_members` con su `role`. Las filas actuales
(`owner`/`member`) no se tocan.

**Rationale**: Es el cambio mínimo y aditivo: no requiere migrar datos
(FR-015, SC-007), no altera claves ni relaciones, y el tipo TypeScript de
Drizzle se deriva del enum. Postgres permite agregar un valor a un enum
dentro de una transacción (desde PG 12) siempre que ese valor **no se use en
la misma transacción**; la migración no lo usa (solo declara), así que es
segura aunque el migrador de Drizzle ejecute todas las migraciones pendientes
en una sola transacción. El `CHECK` e índice nuevos de la misma migración
solo referencian los valores antiguos (`owner`, `member`).

**Alternatives considered**:
- **Tabla `roles` + `role_id` con permisos por fila**: es lo que habilita
  roles personalizables, que la spec deja explícitamente fuera de alcance
  (YAGNI). Más joins en cada verificación de permiso sin beneficio hoy.
- **Columna `text` + `CHECK` en lugar de enum**: pierde el tipado de Drizzle
  y la coherencia con el enum ya existente; reescribiría la columna.
- **Reemplazar `owner` por una bandera booleana `isOwner`**: mezcla dos ejes
  (propiedad y nivel de acceso) que la spec mantiene unidos en un solo rol
  con exactamente un owner.

## Decisión: Rol de ingreso en las invitaciones

**Decision**: `invitations` gana una columna `role` reutilizando el enum
`project_role`, `NOT NULL DEFAULT 'member'`, con un `CHECK (role <> 'owner')`.
`sendInvitation` la escribe (`member` o `viewer`, validada con zod), y
`respondToInvitation` la copia a `project_members.role` al aceptar en lugar
del `"member"` que hoy está fijo en el código.

**Rationale**: El `DEFAULT 'member'` hace que las invitaciones pendientes
previas a la feature ya sean válidas y se comporten exactamente como antes
(FR-008, FR-015) sin backfill. El `CHECK` es la defensa en profundidad de
FR-002: aunque un bug de aplicación llegara a intentarlo, la base de datos
rechaza una invitación que otorgue `owner`. La fila de `invitations` (no el
payload de la notificación) es la fuente de verdad del rol, porque la
invitación se puede cancelar y la notificación es solo un aviso.

**Alternatives considered**:
- **Enum aparte `invitation_role` con solo `member`/`viewer`**: hace
  inexpresable `owner` en el tipo, pero obliga a un cast
  (`role::text::project_role`) al aceptar y a un segundo tipo que mantener
  sincronizado. El `CHECK` da la misma garantía con menos piezas.
- **Guardar el rol en el `payload` de la notificación**: descartado — la
  notificación puede no existir aún (invitación a un email sin cuenta,
  001 FR-007) y no es la entidad que se cancela.

## Decisión: Invariante "un solo owner" y concurrencia

**Decision**: Dos capas.
1. **Base de datos**: índice único parcial
   `CREATE UNIQUE INDEX project_members_one_owner_idx ON project_members
   (project_id) WHERE role = 'owner'` — imposible tener dos owners aunque una
   acción tenga un bug o dos corran a la vez (SC-006).
2. **Aplicación**: `changeMemberRole` y `transferOwnership` corren dentro de
   `db.transaction` (el driver WebSocket de Neon ya se usa así en
   `respondToInvitation`) y empiezan tomando un bloqueo de fila sobre el
   proyecto (`SELECT ... FROM projects WHERE id = ? FOR UPDATE`), lo que
   serializa cualquier operación que cambie roles en ese proyecto. Tras el
   bloqueo se **re-verifica** que el actor sigue siendo owner
   (`project_members.role = 'owner'` del actor) y se ejecuta con `UPDATE ...
   WHERE` condicionales que comprueban `RETURNING` (0 filas ⇒ el estado
   esperado ya no existe ⇒ se rechaza y la transacción se revierte).

`transferOwnership` en una sola transacción: (a) bajar al owner actual a
`member`, (b) subir al destinatario a `owner` (solo si sigue siendo miembro),
(c) actualizar `projects.owner_id`. El orden (bajar primero, subir después)
evita violar el índice único parcial a mitad de la operación.

**Rationale**: SC-006 exige que "tras cualquier secuencia de transferencias,
cambios de rol y salidas, incluidas las concurrentes" quede exactamente un
owner. El bloqueo de fila hace que las operaciones sobre un mismo proyecto se
ejecuten una tras otra; la segunda ve el estado ya cambiado y falla limpio
(edge cases de la spec: dos transferencias a la vez, transferir a quien
acaba de salir, ex-owner actuando desde una pantalla vieja). El índice único
es el respaldo que no depende de que el código de aplicación sea correcto.
`projects.owner_id` se mantiene porque ya lo usa `removeMember`
(`CANNOT_REMOVE_OWNER`); la transferencia lo actualiza en la misma
transacción para que nunca discrepe de la membresía.

**Alternatives considered**:
- **Solo verificación en la aplicación (sin índice)**: no garantiza SC-006
  bajo concurrencia; descartado.
- **Nivel de aislamiento `SERIALIZABLE` + reintentos**: funciona, pero exige
  lógica de reintento en cada acción y da errores de serialización difíciles
  de traducir a mensajes claros; el bloqueo de fila es más simple y
  determinista para un recurso tan acotado como "un proyecto".
- **`pg_advisory_xact_lock`**: equivalente, pero un bloqueo de fila sobre la
  propia fila del proyecto no necesita derivar una clave numérica y queda
  atado a la entidad que protege.
- **Índice único diferible (`DEFERRABLE INITIALLY DEFERRED`)** para permitir
  subir antes que bajar: no soportado para índices únicos parciales en
  Postgres (solo para constraints); ordenar las sentencias es más simple.

## Decisión: El rol se lee de la BD en cada acción, no de la sesión

**Decision**: `requireProjectPermission` consulta la fila de
`project_members` en cada llamada, igual que `requireProjectMember` hoy. El
rol de proyecto no se copia a la sesión de Better Auth ni a ninguna cookie o
claim.

**Rationale**: Es lo que hace que SC-003 (el cambio aplica a la siguiente
acción, sin cerrar sesión) y FR-003 (rol vigente al ejecutar, no el de
cuando se abrió la pantalla) se cumplan por construcción. Un rol es por
proyecto y cambia con frecuencia; cachearlo en la sesión garantizaría
autorizaciones obsoletas. El costo es cero: las dos consultas (proyecto y
membresía) ya se hacen hoy en cada acción.

**Alternatives considered**:
- **Rol en claims de la sesión**: se desactualiza (habría que invalidar
  sesiones de otro usuario al cambiarle el rol); descartado.
- **Caché en memoria por proceso**: se desincroniza entre instancias en un
  despliegue con más de un proceso; descartado.

## Decisión: Código de error propio `ROLE_NOT_PERMITTED`

**Decision**: Un rechazo por rol lanza `AppError("ROLE_NOT_PERMITTED", …)`
con un mensaje que explica el motivo ("Tu rol en este proyecto (Lector) no
permite esta acción."). `FORBIDDEN` se conserva **solo** para "no eres
miembro del proyecto".

**Rationale**: Las páginas de servidor convierten `FORBIDDEN` en `notFound()`
(no revelar la existencia de un proyecto ajeno — Principio IV; ver
`app/(workspace)/projects/[projectPublicId]/page.tsx` y la página de detalle
de 006). Si un Lector recibiera `FORBIDDEN` por un rechazo de rol, en algún
flujo podría acabar viendo un 404 en un proyecto del que sí es miembro. Un
código distinto además le permite al cliente reaccionar específicamente
(mostrar el mensaje y refrescar a modo lectura — FR-004, Historia 2,
escenario 4) sin adivinar por el texto del mensaje. El catálogo de códigos
queda documentado en [contracts/roles-permissions.md](contracts/roles-permissions.md).

**Alternatives considered**:
- **Reusar `FORBIDDEN` con otro mensaje**: colisiona con el mapeo a 404 y
  obliga a inspeccionar el texto; descartado.

## Decisión: Modo lectura de la interfaz

**Decision**: Los Server Components pasan el rol del usuario (`role`) a los
componentes cliente, que derivan `canEdit` con `can(role, …)`.
- **Acciones estructurales** (crear columna, eliminar columna, crear Work
  Item): **se ocultan** para el Lector.
- **Interacciones de arrastre** (reordenar columnas, mover/reordenar Work
  Items) y **renombrar columna in situ**: se **deshabilitan** (dnd-kit
  soporta `disabled` en `useSortable`; el doble clic de renombrar no se
  activa). El clic en la tarjeta que navega al detalle **se conserva**.
- **Detalle de Work Item**: los campos se muestran en solo lectura
  (`readOnly`/`disabled`, incluido `TagPicker`), sin botón Guardar ni
  Eliminar ni formularios de agregar relación/quitar; los enlaces de
  navegación entre padre/hijos/relacionados **se conservan** (Principio I).
- Un aviso visible (`read-only-notice`) explica por qué ("Estás como Lector:
  solo lectura"), para que la ausencia de controles no parezca un fallo.
- **Ajustes**: cada sección se decide con `can(role, …)` (renombrar/descripción
  /eliminar: owner; invitaciones pendientes: owner+miembro; salir: no-owner).

**Rationale**: Resuelve la ambigüedad que la clarificación dejó a este plan
(FR-005 permite "ocultar o deshabilitar con explicación"). Ocultar lo
estructural evita ruido (un Lector no tiene nada que hacer con "Añadir
columna"), mientras que dejar los campos visibles pero de solo lectura
preserva la lectura completa del contenido, que es el valor del rol. La
interfaz solo refleja: la autorización real es la del servidor.

**Alternatives considered**:
- **Deshabilitar todos los controles** en lugar de ocultarlos: llena la
  pantalla de botones grises que confunden más de lo que informan.
- **Ocultar los campos vacíos del detalle** para el Lector: cambia el layout
  entre roles; se prefiere mostrar la misma estructura.

## Decisión: Cambio de rol con la pantalla ya abierta

**Decision**: Cuando una acción devuelve `ROLE_NOT_PERMITTED`, el cliente
muestra el mensaje (toast o error en línea, según el componente ya existente)
y llama a `router.refresh()`. Un helper `isRolePermissionError(result)` en
`lib/errors.ts` (sin imports de servidor) evita repetir la comparación de
códigos. El rol actualizado llega en la relectura del Server Component
(`getBoard` / `getWorkItemDetailData` / la página de ajustes ya devuelven el
rol) y la pantalla pasa a modo lectura.

**Rationale**: Cumple Historia 2, escenario 4 sin sondeos ni tiempo real (la
decisión de Fase 1 de no usar WebSockets se mantiene: se "ve al abrir o
al fallar una acción"). Usa `router.refresh()` —que ya se usa tras cada
mutación— y **no** encadena una segunda Server Action desde el cliente, la
lección de [005 research.md § Hallazgo](../005-work-item-relationships/research.md).
El tablero ya reconcilia su estado local cuando cambian las props iniciales
(patrón de `Board.tsx`), así que el refresco revierte los cambios optimistas.

**Alternatives considered**:
- **Sondeo periódico del rol**: costo constante para un caso raro; contradice
  la decisión de "sin sincronización en tiempo real" de Fase 1.
- **Cerrar sesión / forzar recarga total**: hostil; el refresco de ruta basta.

## Decisión: Cómo probar "por fuera de la interfaz" (SC-001/SC-002)

**Decision**: Además de las pruebas e2e con varias cuentas (interfaz), se
agrega un barrido unitario tabla-por-tabla (`tests/unit/action-permissions.test.ts`):
para cada Server Action de mutación se declara `{ acción, permiso esperado,
roles denegados }`, se mockea `db`/`getSession` (mismo patrón que
`tests/unit/permissions.test.ts`) para simular a un Lector o Miembro, se
invoca la acción directamente y se verifica que devuelve
`ROLE_NOT_PERMITTED` y que **ninguna** escritura (`insert`/`update`/`delete`/
`transaction`) llegó a ejecutarse. La tabla del test debe cubrir todas las
exportaciones de mutación de `lib/actions/**`: agregar una acción nueva sin
entrada en la tabla es lo que el test debe hacer fallar (comprobando la lista
de exportaciones contra la tabla).

**Rationale**: Playwright difícilmente puede invocar una Server Action sin
pasar por la UI (el transporte es un POST interno de Next.js), pero "una
petición directa" es exactamente el caso que SC-001 pide cubrir; llamar a la
función exportada directamente con la sesión simulada es el equivalente
fiable y rápido (sin base de datos, corre con `npm run test`). Se apoya en la
matriz de `lib/roles.ts` probada aparte en `tests/unit/roles.test.ts`.

**Alternatives considered**:
- **Solo e2e**: no puede probar el bypass de UI, que es el riesgo real.
- **Pruebas de integración contra una BD real por cada acción**: lentas y ya
  cubiertas parcialmente por e2e; el barrido con mocks es suficiente para
  verificar el cableado del permiso.

## Decisión: Despliegue y orden de migración

**Decision**: La migración es puramente aditiva y no requiere backfill. El
orden de despliegue es: (1) verificar previamente que todo proyecto tiene
exactamente un owner (consulta en [quickstart.md](quickstart.md#0-prerrequisitos-y-migración));
(2) `npm run db:migrate`; (3) desplegar el código nuevo.

**Rationale**: El código nuevo necesita `viewer` en el enum y
`invitations.role`; el código viejo sigue funcionando contra el esquema nuevo
(ignora la columna nueva y aún no existen filas `viewer` hasta que el código
nuevo las cree), así que migrar primero es siempre seguro. El índice único
parcial fallaría si algún proyecto tuviera dos owners; el modelo de Fase 1
no lo permite (un owner por proyecto, sin transferencia), pero la verificación
previa lo confirma de forma barata antes de aplicar.

**Alternatives considered**:
- **Desplegar código y migración a la vez**: ventana en la que el código nuevo
  consulta una columna inexistente; descartado.
