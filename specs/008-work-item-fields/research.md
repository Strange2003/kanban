# Research: Campos Extendidos y Fechas de Work Items

No queda ningún `NEEDS CLARIFICATION` en el Technical Context del plan. El
stack ya está decidido en
[001-accounts-invitations/research.md](../001-accounts-invitations/research.md),
y las decisiones de producto se cerraron en la sesión de clarificación de la
spec (2026-09-22). Aquí se resuelven las decisiones técnicas propias de esta
feature.

## Decisión: Prioridad y severidad como enums de Postgres

**Decision**: Dos enums nuevos, `work_item_priority` y `work_item_severity`,
ambos con los valores `critical`, `high`, `medium`, `low` **en ese orden**.
Se guardan en dos columnas nullable de `work_items` (`NULL` = sin valor). La
etiqueta visible (Crítica/Alta/Media/Baja) es cosa de la interfaz, igual que
`owner`/`member`/`viewer` en 007.

**Rationale**: Postgres ordena un enum según el orden en que se declararon
sus valores. Así `ORDER BY priority` ya da "más urgente primero" sin
traducción, que es justo lo que necesita la vista de tabla de 009. El enum
rechaza valores inválidos en la propia base de datos, y Drizzle deriva de él
el tipo TypeScript. El conjunto es fijo por spec (FR-004), así que la
limitación de los enums (no se pueden quitar valores) no aplica. Se usan dos
enums, no uno compartido, para que cambiar la escala de uno en el futuro no
obligue a cambiar el otro.

**Alternatives considered**:
- **Entero 1–4, al estilo de Azure DevOps**: el significado quedaría implícito
  (¿1 es alta o baja?), y validarlo exigiría un `CHECK`. No aporta nada frente
  al enum.
- **Texto con `CHECK`**: equivalente en validación, pero ordena
  alfabéticamente (`critical < high < low < medium`), lo que rompe el orden
  natural que necesita 009.
- **Tabla de catálogo de prioridades**: sería configurable, pero la spec pide
  explícitamente valores fijos (FR-004, Principio VI).

## Decisión: Área e iteración como dos tablas de catálogo, calcadas de `tags`

**Decision**: Dos tablas nuevas, `areas` e `iterations`, con la misma forma
que `tags`: `id`, `project_id` (FK con `onDelete: cascade`) y `name`, más un
índice único sobre `(project_id, lower(name))`. `work_items` recibe dos FK
nullable, `area_id` e `iteration_id`, con `onDelete: set null`. El cliente
siempre envía **nombres**, nunca ids. El servidor resuelve cada nombre dentro
del proyecto del Work Item: reutiliza el valor si ya existe (sin distinguir
mayúsculas) o lo crea. Es el mismo algoritmo que usa hoy `updateWorkItem`
para los tags (FR-012 de 004).

**Rationale**: El product owner eligió "catálogo por proyecto, como los tags"
(Clarifications, P2). Copiar el patrón existente mantiene una sola forma de
hacerlo en el código (Principio VI). Como el cliente trabaja con nombres,
nunca manda un id que podría pertenecer a otro proyecto, así que FR-021 (un
valor de otro proyecto no se puede asignar) se cumple por construcción: la
búsqueda siempre filtra por el `project_id` del Work Item. Tampoco hace falta
un `publicId`, por la misma razón que los tags no lo tienen: el id interno no
sale del servidor como identificador. `set null` es solo defensivo, porque
ningún flujo borra un valor de catálogo (FR-007) y borrar el proyecto ya borra
sus Work Items en cascada.

**Alternatives considered**:
- **Una sola tabla `catalog_values` con una columna `kind`**: ahorra una
  tabla, pero no permite una FK que garantice que `area_id` apunte a un área
  y no a una iteración. Habría que añadir un `CHECK` o validarlo en la
  aplicación.
- **Texto libre en `work_items`**: el product owner lo descartó, porque
  "Frontend" y "front-end" contarían como valores distintos al filtrar en
  009.
- **FK compuesta `(area_id, project_id)` para imponer el mismo proyecto en la
  base de datos**: `work_item_tags` tampoco lo hace, y la resolución por
  nombre ya lo garantiza. Añadiría índices y columnas duplicadas sin una
  necesidad real.

## Decisión: Fechas de planificación como `date`, cierre como `timestamptz`

**Decision**: `start_date` y `target_date` son columnas `date` nullable (en
Drizzle, `mode: "string"`, es decir, `"YYYY-MM-DD"`), con
`CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date)`.
`closed_at` es `timestamptz` nullable. Las columnas existentes `created_at` y
`updated_at` se muestran tal cual.

**Rationale**: La spec define inicio y objetivo como días de calendario sin
hora (FR-009). Con `date`, "15 de octubre" es el mismo día para todos y no se
corre un día al pasar de una zona horaria a otra. Usar el modo string evita
que el driver lo convierta a un `Date` a medianoche UTC, que es la fuente
clásica de ese desfase. El `CHECK` es la defensa en profundidad de la regla
de orden; zod la valida antes con un mensaje amable. `closed_at` sí es un
instante (el momento del cierre), y cada persona lo ve como día en su zona
horaria (Edge Cases de la spec).

**Alternatives considered**:
- **Guardar `closed_date` como `date`**: habría que decidir en qué zona
  horaria "cae" el día del cierre al guardarlo. Guardar el instante es más
  preciso y deja esa decisión a la hora de mostrarlo.
- **`timestamptz` para las fechas de planificación**: reintroduce el problema
  de la zona horaria en un dato que por definición no tiene hora.

## Decisión: Estado de cierre derivado de la columna; solo se guarda la fecha

**Decision**: `stages` recibe `is_closing boolean NOT NULL DEFAULT false`. "El
Work Item está cerrado" **no se guarda**: se deriva de
`stage.is_closing` (FR-012). Solo se guarda `work_items.closed_at`, y la
invariante es:

> `work_items.closed_at IS NOT NULL` ⇔ la columna del Work Item tiene `is_closing = true`.

Todas las transiciones pasan por una función pura,
`nextClosedAt(fromIsClosing, toIsClosing, currentClosedAt, now)` en
`lib/work-item-closing.ts`. Devuelve el nuevo `closedAt` y el evento que hay
que registrar (`closed`, `reopened` o ninguno). La usan todos los caminos que
cambian la columna de un Work Item o la marca de una columna:

| Camino | Efecto |
|---|---|
| `moveWorkItem` a una columna de cierre desde una que no lo es | `closed_at = now()` + evento `closed` |
| `moveWorkItem` desde una columna de cierre a una que no lo es | `closed_at = NULL` + evento `reopened` |
| `moveWorkItem` entre dos columnas de cierre | `closed_at` sin cambios, sin evento de cierre |
| `createWorkItem` en una columna de cierre | nace con `closed_at = now()` + evento `closed` |
| `closeWorkItem` (botón "Cerrar") | igual que mover al final de la primera columna de cierre |
| `setStageClosing(true)` | todos los Work Items de la columna reciben `closed_at = now()` + `closed` |
| `setStageClosing(false)` | todos los Work Items de la columna quedan con `closed_at = NULL` + `reopened` |
| `reorderWorkItemsInStage`, `deleteStage` (solo si está vacía) | sin efecto |

**Rationale**: Si "cerrado" fuera una columna propia, habría dos datos que
mantener sincronizados con la columna del tablero. Derivarlo deja un solo
dato que sincronizar, la fecha, y esa sincronización vive en una sola función
pura, fácil de probar tabla por tabla. SC-006 se vuelve una consulta SQL
verificable (ver [quickstart.md](quickstart.md)).

**Alternatives considered**:
- **Trigger de Postgres que mantenga `closed_at`**: garantizaría la
  invariante incluso ante un bug de la aplicación, pero esconde lógica de
  negocio en la base de datos, no escribe en el log de actividad (que necesita
  la etiqueta de la columna y el motivo) y es la primera lógica en triggers
  del proyecto. Se descarta a favor de un único helper cubierto por tests.
- **Calcular la fecha de cierre desde `work_item_activity`**: cada lectura del
  tablero tendría que consultar el log, y 009 no podría ordenar por fecha de
  cierre con un índice.
- **Detectar "Done" por el nombre de la columna**: la spec lo descarta
  (Assumptions), porque los nombres son libres y en cualquier idioma.

## Decisión: Concurrencia entre mover y marcar/desmarcar una columna

**Decision**: Dentro de la transacción, `moveWorkItem` y `closeWorkItem`
leen las columnas de origen y destino con `SELECT … FOR SHARE`, y
`setStageClosing` lee la columna que cambia con `SELECT … FOR UPDATE` antes
de su actualización masiva. `createWorkItem` lee su columna con `FOR SHARE`.

**Rationale**: Sin esos bloqueos puede pasar lo siguiente. La transacción A
marca "Done" como de cierre y actualiza sus Work Items. A la vez, la
transacción B mueve un Work Item a "Done" habiendo leído `is_closing = false`
antes de que A confirmara. El Work Item termina en una columna de cierre sin
`closed_at`, violando SC-006. Con `FOR SHARE` frente a `FOR UPDATE` sobre la
misma fila de `stages`, B espera a que A termine y relee el valor ya
confirmado. Varias transacciones de mover sí pueden correr en paralelo entre
ellas, porque `FOR SHARE` no las bloquea entre sí. Es el mismo enfoque de
bloqueo por fila que 007 usó para serializar la transferencia de propiedad.

**Alternatives considered**:
- **Aislamiento `SERIALIZABLE`**: resolvería el problema, pero obliga a
  reintentar ante fallos de serialización en todos los movimientos, que son la
  interacción más frecuente del tablero (Principio I).
- **Ignorar la carrera**: la ventana es de milisegundos, pero SC-006 dice "en
  todo momento, el 100 %", y el costo de evitarla es una cláusula por
  consulta.

## Decisión: Acciones nuevas y extensión de las existentes

**Decision**:
- `updateWorkItem` acepta además `priority`, `severity`, `areaName`,
  `iterationName`, `startDate` y `targetDate`. `undefined` significa "no
  tocar" y `null` significa "vaciar", como ya ocurre con `description`. Los
  cambios se registran en el mismo evento `fields_edited` que ya existe, con
  las claves nuevas en `payload.fields`.
- Nueva `closeWorkItem(workItemId)` en `lib/actions/work-items.ts`, con el
  permiso `workItem:edit`.
- Nueva `setStageClosing({ projectPublicId, stagePublicId, isClosing })` en
  `lib/actions/board.ts`, con el permiso `board:edit`.
- La resolución de catálogos por nombre y la lectura de catálogos para el
  detalle viven en un módulo de servidor **sin** `"use server"`
  (`lib/work-item-catalogs.ts`), igual que `lib/work-item-queries.ts`. No se
  exportan acciones públicas nuevas de solo lectura: `getWorkItemDetailData`,
  que ya verifica la membresía, las incorpora.

**Rationale**: Extender `updateWorkItem` mantiene un único botón "Save" y un
único evento de auditoría por guardado, igual que hoy con título, descripción
y tags. Tanto el botón "Cerrar" como marcar una columna son operaciones con
efectos en cascada y códigos de error propios (`NO_CLOSING_STAGE`,
`ALREADY_CLOSED`), así que merecen su propia acción en lugar de colgarse de
otra. Mantener los helpers fuera de archivos `"use server"` cumple la regla de
AGENTS.md: todo lo exportado desde esos archivos es un endpoint público.

**Alternatives considered**:
- **Una acción por campo** (`setWorkItemPriority`, …): multiplica los
  endpoints y los eventos de auditoría sin beneficio. La interfaz ya guarda en
  bloque.
- **Implementar "Cerrar" en el cliente, calculando la columna y llamando a
  `moveWorkItem`**: requiere que el cliente conozca las columnas del proyecto
  desde el detalle y abre una carrera si la marca cambia en el medio. El
  servidor elige la columna dentro de la transacción.

## Decisión: Auditoría legible de los campos nuevos y del cierre

**Decision**:
- `fields_edited` sigue con la forma `{ fields: { <campo>: { from, to } } }`.
  Para `area` e `iteration` se guarda el **nombre** (no el id), y para las
  fechas, el string `"YYYY-MM-DD"`. Así el historial se lee sin joins y sigue
  siendo correcto aunque en el futuro se renombre un valor.
- Dos tipos de evento nuevos: `closed`, con payload
  `{ closedAt, stageName, via }`, y `reopened`, con payload
  `{ stageName, via }`. `via` es uno de `move`, `close_button`, `created`,
  `stage_marked` o `stage_unmarked`.
- `describeActivity` en `WorkItemDetailView` muestra el valor anterior y el
  nuevo para los campos nuevos (p. ej. "Priority: High → Critical") y frases
  para el cierre ("Closed (moved to Done)", "Closed: column Done marked as
  closing", "Reopened (moved to In Progress)").

**Rationale**: FR-020 exige campo, valor anterior y valor nuevo, legibles. La
columna `type` libre de `work_item_activity` ya admite tipos nuevos sin
migración. Guardar el nombre de la columna en el payload evita que el
historial dependa de columnas que pueden renombrarse o borrarse.

## Decisión: `updated_at` deja de cambiar al reordenar

**Decision**: `reorderWorkItemsInStage` deja de escribir `updated_at`. El
resto de las mutaciones lo siguen actualizando: editar campos, mover,
cerrar/reabrir y el efecto de `setStageClosing` sobre cada Work Item.

**Rationale**: Hasta ahora `updated_at` no se mostraba. A partir de esta
feature es "Última modificación" (FR-008), y hoy reordenar una columna lo
cambia en **todos** sus Work Items, incluidos los que no se movieron. La
posición dentro de la columna es un dato del tablero, no un cambio del Work
Item. Tampoco se registra en el log de actividad, así que es coherente que no
cuente como modificación.

## Decisión: Fechas y "hoy" sin desajustes de hidratación

**Decision**: Un hook `useLocalToday()` en `lib/dates.ts` basado en
`useSyncExternalStore`. En el servidor y en la primera hidratación devuelve
`null`, y en el cliente devuelve la fecha local `"YYYY-MM-DD"`. La marca de
vencido solo se pinta cuando `today` ya no es `null`. Los instantes
(`created_at`, `updated_at`, `closed_at`) se muestran con un componente
`<LocalDate>` que usa el mismo mecanismo: en el servidor renderiza la fecha
UTC y en el cliente la fecha local. Las fechas de planificación (`date`) se
formatean sin convertir de zona horaria.

**Rationale**: El tablero y el detalle se renderizan primero en el servidor
(Render corre en UTC) y luego se hidratan en el navegador. Calcular "¿está
vencido?" con la hora del servidor daría resultados distintos cerca de la
medianoche y un error de hidratación de React. La spec pide la fecha local de
quien mira (Edge Cases). `useSyncExternalStore` con snapshot de servidor es el
mecanismo que React documenta para valores que solo existen en el cliente, y
evita el patrón `useEffect` + `setState`.

**Alternatives considered**:
- **`suppressHydrationWarning`**: oculta el aviso, pero el HTML inicial
  mostraría un estado incorrecto hasta la siguiente renderización.
- **Calcular el vencimiento en el servidor, en `getBoard`**: usaría la zona
  horaria del servidor, no la de quien mira.

## Hallazgo durante el diseño: `moveWorkItem` no valida el proyecto de la columna destino

**Contexto**: `moveWorkItem` recibe `toStageId` (id interno) y verifica el
permiso sobre el proyecto **del Work Item**, pero no comprueba que la columna
destino pertenezca a ese mismo proyecto. Un Owner o Miembro de un proyecto
podría, con una petición directa, mover un Work Item suyo a una columna de
otro proyecto. Esa sería una violación del Principio IV y dejaría una fila
incoherente, con `work_items.project_id` distinto de
`stages.project_id`.

**Decision**: Como esta feature necesita leer la columna destino de todos
modos (para su `is_closing`, con `FOR SHARE`), `moveWorkItem` pasa a
cargarla y a rechazar con `NOT_FOUND` si `stage.project_id` difiere del
proyecto del Work Item. Se agrega un test unitario del caso.
