# Research: Relaciones entre Work Items

No queda ningún `NEEDS CLARIFICATION` en el Technical Context del plan (el
stack ya está decidido en
[001-accounts-invitations/research.md](../001-accounts-invitations/research.md)).
Esta feature solo requiere resolver dos decisiones técnicas propias.

## Decisión: Modelo de datos de las dos relaciones

**Decision**: Se modelan como dos mecanismos distintos, no como una única
tabla de relaciones genérica:

- **Padre/hijo**: columna auto-referencial `work_items.parentWorkItemId`
  (FK nullable → `work_items.id`, `onDelete: set null`).
- **"Relacionado con"**: tabla de unión simétrica `work_item_related_links`
  con dos columnas FK a `work_items` (`onDelete: cascade` en ambas) y un
  orden canónico de IDs para evitar duplicados simétricos.

**Rationale**: Los dos tipos de relación tienen reglas de integridad muy
distintas (la constitución los define como "explícitos y distintos entre
sí" — Principio III):

- Padre/hijo exige "a lo sumo un padre por Work Item" (FR-002) y "el hijo
  queda huérfano al borrar el padre" (FR-012, decidido en clarificación). Una
  columna simple con `onDelete: set null` impone ambas reglas directamente
  en la base de datos, sin lógica de aplicación adicional ni transacciones
  extra.
- "Relacionado con" exige simetría y elimina el vínculo si cualquiera de los
  dos Work Items se borra (FR-011). Una tabla de unión con `onDelete:
  cascade` en ambas columnas cubre esto igual de directo.

Forzar ambas reglas dentro de una tabla genérica `work_item_relations(type,
fromId, toId)` obligaría a reimplementar en la aplicación lo que Postgres ya
da gratis (unicidad de padre, limpieza al borrar), y mezclaría dos conjuntos
de invariantes distintos en una sola tabla — más complejidad, no menos
(Principio VI, YAGNI).

**Alternatives considered**:
- Tabla genérica `work_item_relations(type, fromId, toId)` para ambos tipos:
  más "uniforme" a primera vista, pero traslada a la aplicación reglas que
  la base de datos ya resuelve de forma nativa; se descarta.
- Tabla de unión también para padre/hijo (en vez de columna en `work_items`):
  funcionalmente equivalente pero pierde la garantía nativa de "a lo sumo un
  padre" (habría que reforzarla con un índice único sobre la columna
  "hijo", que es exactamente lo que ya da una columna simple); se descarta
  por ser una vuelta más larga al mismo resultado.

## Decisión: Detección de ciclos en la jerarquía padre/hijo

**Decision**: Antes de fijar `parentWorkItemId` de un Work Item, ejecutar una
consulta `WITH RECURSIVE` que suba desde el padre propuesto por la cadena de
ancestros (siguiendo `parentWorkItemId`) hasta la raíz, dentro de la misma
transacción que el `UPDATE`. Si el Work Item que se quiere convertir en hijo
aparece en esa cadena (o es el mismo padre propuesto), la operación se
rechaza (`CYCLE_DETECTED`).

**Rationale**: La clarificación de la spec fijó anidación arbitraria (un
hijo puede a su vez ser padre), así que la validación debe cubrir toda la
cadena de ancestros, no solo el padre directo (FR-004). Una CTE recursiva es
la herramienta estándar de Postgres para este caso, no requiere columnas ni
tablas adicionales, y su costo es proporcional a la profundidad del árbol —
aceptable para el volumen esperado (Work Items por proyecto, no por toda la
base de datos).

**Alternatives considered**:
- Tabla de clausura transitiva (closure table) mantenida de forma
  incremental en cada cambio de padre: consulta de lectura más rápida, pero
  cada escritura se vuelve más cara y más propensa a bugs de sincronización
  (hay que reescribir todas las filas de ancestro/descendiente afectadas en
  cada `setWorkItemParent`). No se justifica todavía (Principio VI); se
  revisará si el volumen real de anidación lo amerita más adelante.
- Guardar la profundidad o la ruta completa como campo desnormalizado en
  cada Work Item: evita el recursive query pero exige recalcular esa ruta en
  cascada para todo un subárbol cuando su raíz cambia de padre — más
  complejidad de la que resuelve para el volumen esperado.

## Hallazgo: Server Actions consecutivas desde el cliente se cuelgan intermitentemente

**Contexto**: el diseño original de `WorkItemDetailPanel` hacía que cada
acción de mutar una relación (`setWorkItemParent`, `linkRelatedWorkItems`,
etc., que ya llaman `revalidatePath`) fuera seguida, desde el cliente, por
una *segunda* llamada a `getWorkItemRelations` (y a veces una tercera,
`listProjectWorkItems`) para refrescar el estado local. En pruebas e2e
(Playwright) esto se colgaba de forma intermitente esperando la respuesta de
esa segunda/tercera llamada — reproducido en dos máquinas distintas, y
también en tests e2e de 004-work-items ya existentes y sin relación con esta
feature (con el mismo patrón de "mutación + navegación que dispara más
Server Actions"), así que no es un bug de esta spec en particular sino una
condición del stack (Next.js en modo dev + Server Actions + `revalidatePath`
+ el driver WebSocket de `@neondatabase/serverless`, posiblemente una
interacción específica de esa combinación en la versión usada aquí, ver
`package.json`).

**Decision**: las Server Actions que mutan una relación devuelven las
relaciones ya frescas del Work Item activo (`Result<WorkItemRelations>`) en
el mismo round-trip, calculadas server-side justo después de escribir,
en vez de que el cliente encadene una llamada adicional para refrescarlas.
Esto elimina por completo el patrón de "dos Server Actions seguidas desde el
mismo handler" para este flujo — no es un workaround del síntoma, es quitar
la necesidad del segundo round-trip.

**Rationale**: Ya existía precedente en el propio codebase de que **una**
Server Action seguida de `router.refresh()` funciona sin problema
(`updateWorkItem`, `deleteWorkItem`, `moveWorkItem` en 004-work-items). El
problema aparecía específicamente al encadenar una *segunda* Server Action
(no un `router.refresh()`) inmediatamente después de la primera. Devolver
los datos necesarios desde la propia mutación es además más simple y más
rápido (un round-trip menos), independientemente de si algún día se
entiende la causa raíz exacta del cuelgue.

**Alternatives considered**:
- Investigar y arreglar la causa raíz en la capa de Next.js/driver: se
  intentó (ver historial de `tasks.md` de esta feature) sin llegar a una
  causa concluyente en el tiempo disponible; queda como posible mejora de
  infraestructura, no bloquea esta feature.
- Reintentar la segunda llamada con backoff en el cliente: enmascara el
  síntoma sin resolverlo, y complica el código de `WorkItemDetailPanel` sin
  necesidad, dado que evitar la segunda llamada es estrictamente más simple.
- Debounce/retraso artificial entre la mutación y la relectura: mismo
  problema — trata el síntoma, no la causa, y degrada la percepción de
  velocidad (Principio I).
