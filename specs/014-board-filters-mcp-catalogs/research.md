# Research: Filtros del Tablero y Catálogos por MCP

Stack, auth, hosting, permisos y testing ya están decididos en
[001-accounts-invitations/research.md](../001-accounts-invitations/research.md),
[007-roles-permissions](../007-roles-permissions/plan.md) y, para el servidor
MCP, [011-agent-access-mcp/research.md](../011-agent-access-mcp/research.md); no
se reevalúan. Aquí solo van las decisiones propias de 014.

## Decisión: filtrar el tablero en el cliente, sobre lo ya cargado

- **Decision**: `getBoard` sigue devolviendo todos los Work Items del proyecto;
  el componente `Board` filtra en memoria qué tarjetas pasa a cada
  `StageColumn`. `getBoard` suma a su resultado lo que el filtro necesita:
  `currentUserId` (para "Assigned to me"), `members` (opciones de Assignee) y
  `tagCatalog` (tags con color en orden manual).
- **Rationale**: FR-008 y SC-002 piden respuesta inmediata; el tablero ya
  tiene todas las tarjetas en el cliente (el arrastre optimista las necesita).
  Es la misma decisión que 009 para List/Table (research.md § Filtrar en el
  cliente de 009).
- **Alternatives considered**: filtrar en el servidor con `searchParams` en
  `getBoard` (un viaje por clic y rompe el estado optimista del arrastre);
  cargar miembros y catálogo en consultas aparte desde el cliente (más viajes
  sin beneficio).

## Decisión: reutilizar `ViewQuery` y las reglas de `lib/work-item-view.ts`

- **Decision**: el tablero usa el mismo `ViewQuery` y `parseViewQuery`. Se
  extrae de `filterWorkItems` un predicado puro
  `matchesAssigneeAndTags(item, query, currentUserId)` (entrada:
  `assigneeUserId` y nombres de tags) que usan tanto `filterWorkItems` como el
  tablero. `serializeViewQuery` acepta la vista `"board"`, que solo escribe
  `assignee` y `tag`.
- **Rationale**: FR-004 exige las mismas reglas (O dentro, Y entre filtros,
  tags sin distinguir mayúsculas, `none`, `me`); un solo predicado garantiza
  que no se separen con el tiempo, y los tests de tabla existentes lo cubren.
- **Alternatives considered**: duplicar la lógica para `BoardWorkItem`
  (divergiría); convertir cada `BoardWorkItem` en `WorkItemViewRow` para
  llamar a `filterWorkItems` (tipos distintos, campos inventados).

## Decisión: el filtro vive en la URL, con los mismos parámetros

- **Decision**: `?assignee=…&tag=…` en `/projects/{id}`, escritos con
  `window.history.replaceState` a través del hook `useViewQuery` (ampliado a
  `"board"`). `ProjectViewHeader` conserva `assignee` y `tag` al ir de List o
  Table a Board, y pasa los parámetros del tablero al ir de Board a List o
  Table.
- **Rationale**: FR-009/FR-010; es exactamente el mecanismo de 009 (FR-009 de
  009-work-item-views), así que un enlace del tablero y uno de la Table
  filtrados por la misma tag se leen igual.
- **Alternatives considered**: parámetros propios del tablero (`board_tag`)
  (no se podrían compartir entre vistas); preferencia guardada por usuario en
  la base (fuera de alcance, spec § Assumptions).

## Decisión: volver del detalle al tablero conserva el filtro

- **Decision**: el tablero guarda su última query (solo `assignee`/`tag`) en
  `sessionStorage` bajo `kanban:board-query:{projectPublicId}` cada vez que la
  aplica (también al abrir un enlace filtrado). El enlace "← Back to board" del
  detalle y la redirección tras eliminar un Work Item leen esa clave y la
  agregan a `/projects/{id}`. "Clear filters" la borra. Todo acceso a
  `sessionStorage` va en `try/catch` y, si falla, el enlace queda limpio.
- **Rationale**: US2 escenario 5. "Atrás" del navegador ya vuelve a la URL
  filtrada (el tablero usa `replaceState`), pero el enlace explícito del
  detalle apuntaba a la URL limpia. La clave es por pestaña y por proyecto, así
  que no se filtra a otras pestañas ni sobrevive a cerrar el navegador, y el
  enlace del proyecto en el sidebar sigue abriendo el tablero sin filtros.
- **Alternatives considered**: pasar la query del tablero en la URL del
  detalle (`?back=…`, ensucia enlaces compartidos del detalle); `router.back()`
  (falla si el detalle se abrió directo desde un enlace); `localStorage`
  (persistiría entre sesiones, lo que no se pidió).

## Decisión: mover y reordenar con tarjetas ocultas

- **Decision**: `Board` pasa a cada `StageColumn` solo las tarjetas visibles y
  el total de la columna. Arrastrar a otra columna sigue agregando al final
  (con la posición calculada sobre **todas** las tarjetas). Reordenar sobre una
  tarjeta visible sigue usando `arrayMove` sobre la lista **completa** de la
  columna (desde el índice de la tarjeta hasta el índice de la tarjeta sobre la
  que se soltó), lo que deja las ocultas en su orden relativo. El reorden por
  teclado (`reorderWorkItemByStep`) busca la vecina entre las **visibles**.
- **Rationale**: FR-012/FR-013 y SC-004 sin tocar las Server Actions
  (`moveWorkItem`, `reorderWorkItemsInStage` reciben la lista completa como
  hoy).
- **Alternatives considered**: deshabilitar el arrastre con filtro activo
  (contradice US3); mandar al servidor solo el orden de las visibles (el
  servidor tendría que intercalar las ocultas — más lógica y más riesgo).

## Decisión: aviso al crear un Work Item oculto

- **Decision**: `AddWorkItemButton` recibe un callback opcional
  `isHiddenByFilters(item)`; tras crear, si devuelve `true`, muestra un toast
  no destructivo ("KAN-14 was created but is hidden by the active filters.").
  Un Work Item recién creado no tiene asignado ni tags, así que el `Board`
  evalúa el predicado con esos valores.
- **Rationale**: FR-014, reutilizando `useToast` existente.
- **Alternatives considered**: mostrar igualmente la tarjeta nueva hasta
  recargar (rompe "lo que ves es lo que coincide" y complica el estado).

## Decisión: esquemas estrictos con `z.strictObject`

- **Decision**: todas las entradas de las herramientas se construyen con
  `z.strictObject` (también los objetos anidados: elementos de
  `create_work_items` y tags con color). `defineTool` no cambia su firma; un
  test recorre el JSON Schema publicado en `tools/list` y exige
  `additionalProperties: false` en todo objeto.
- **Rationale**: FR-021. Verificado con el SDK instalado
  (`@modelcontextprotocol/server` 2.0.0 + zod 4.6): el SDK valida con
  `schema["~standard"].validate` antes de llamar a la herramienta, y un objeto
  estricto produce `unrecognized_keys` con ruta. El agente recibe un error de
  herramienta (`isError: true`) con texto como
  `Input validation error: Invalid arguments for tool update_work_item: Unrecognized key: "colour"`
  o `items.0: Unrecognized key: "foo"` — nombra el campo y el elemento
  (FR-021) y la llamada no llega a ejecutarse, así que no cambia nada.
  Además, `z.toJSONSchema` publica `additionalProperties: false`, de modo que
  los clientes que respetan el esquema ya ni lo envían.
- **Alternatives considered**: validar a mano en `defineTool` para devolver
  nuestro formato `{ code, message }` (duplica la validación del SDK; el error
  del SDK ya es claro y es el mismo camino que cualquier otro campo inválido
  hoy); `.passthrough()` + advertencia (sigue siendo silencioso para el
  usuario).

## Decisión: color al crear tags desde un Work Item

- **Decision**: en las herramientas, `tags` es un arreglo de
  `string | { name, color }`. Se traduce a la entrada de la Server Action como
  `tagNames: string[]` más un nuevo campo opcional
  `newTagColors: Record<string, TagColor>` (clave: nombre en minúsculas), que
  `applyWorkItemFields` pasa a `resolveCatalogValue(…, { color })`. El color
  solo se usa al **crear** la tag (`resolveCatalogValue` ya devuelve la
  existente sin tocarla). Si la misma tag llega dos veces, gana el primer color.
- **Rationale**: FR-016 y "Indicar un color para una tag existente no la
  recolorea" (spec § Assumptions). Cambiar `tagNames` a objetos rompería a la
  UI y a los tests; un mapa opcional es compatible hacia atrás. Crear la tag
  con color no exige `catalog:manage`: crear tags al asignarlas ya era
  `workItem:edit`, y ambos permisos son Owner + Member.
- **Alternatives considered**: recolorear si la tag existe (edita el catálogo
  en silencio desde un Work Item); una herramienta aparte "create_tag" (FR-020
  deja fuera crear valores sueltos).

## Decisión: respuestas con las tags resultantes

- **Decision**: `create_work_items` y `update_work_item` devuelven además
  `tags: { name, color }[]` por Work Item, leídas después de la escritura con
  un helper de solo lectura `listWorkItemTags(projectId, workItemIds)` en
  `lib/work-item-catalogs.ts` (una consulta para todos los Work Items creados).
- **Rationale**: FR-017 — el agente ve si su color se aplicó o si la tag ya
  existía con otro color. Leer `db` desde una herramienta está permitido (solo
  las **escrituras** deben pasar por Server Actions; `move_work_item` ya lee).
- **Alternatives considered**: devolver un campo "colorIgnored" (más forma que
  documentar, menos información que el color real).

## Decisión: `list_catalogs` y `set_tag_color` sobre las acciones de 013

- **Decision**: `list_catalogs` llama a `getProjectCatalogs` (membresía, Viewer
  incluido) y devuelve tags `{ name, color, workItemCount }`, áreas y tamaños
  `{ name, workItemCount }` en orden manual, más `colors: TAG_COLORS`.
  `set_tag_color` llama a `setTagColor` (`catalog:manage`). Ambas se registran
  en un archivo nuevo `lib/mcp/tools/catalogs.ts`.
- **Rationale**: FR-015/FR-018 y FR-033 de 011 (mismo efecto que la UI). El
  conteo de uso ya lo calcula la acción y ayuda al agente a elegir el valor
  establecido entre variantes parecidas.
- **Alternatives considered**: consultas propias a `db` (duplicaría el orden y
  el control de acceso de 013).

## Decisión: el alcance de agentes se amplía solo en lo pedido

- **Decision**: la lista fija de herramientas de `tests/unit/mcp-route.test.ts`
  suma `list_catalogs` (READ_ONLY) y `set_tag_color` (WRITE, idempotente);
  `renameCatalogValue`, `deleteCatalogValue`, `reorderCatalog` y
  `createCatalogValue` siguen sin herramienta. Las instrucciones del servidor
  suman una frase: consultar `list_catalogs` antes de asignar tags, áreas o
  tamaños.
- **Rationale**: FR-020/FR-023 de esta spec; modifica explícitamente FR-021 de
  013 y la lista de FR-023 de 011, sin abrir nada de administración de
  miembros ni del proyecto.
- **Alternatives considered**: ninguna — el pedido excluye renombrar y borrar.
