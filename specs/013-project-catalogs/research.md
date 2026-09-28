# Research: Catálogos por Proyecto — Tags con Color, Áreas y Tamaño

Stack, auth, hosting, permisos y testing ya están decididos en
[001-accounts-invitations/research.md](../001-accounts-invitations/research.md)
y [007-roles-permissions](../007-roles-permissions/plan.md); no se reevalúan.
Aquí solo van las decisiones propias de 013.

## Decisión: Size = la tabla `iterations` renombrada

- **Decision**: renombrar `iterations` → `sizes` y `work_items.iteration_id` →
  `size_id` en la migración, sin copiar filas. En el código, `CatalogKind`
  pasa de `"area" | "iteration"` a `"area" | "size"`.
- **Rationale**: FR-015/FR-016 piden el mismo comportamiento con otro nombre y
  sin pérdida de datos. Renombrar conserva ids, FKs y asignaciones en una
  operación de metadatos, sin backfill.
- **Alternatives considered**: crear `sizes` y copiar desde `iterations`
  (más SQL, dos tablas conviviendo durante el deploy, sin beneficio); dejar
  el nombre físico `iterations` y solo cambiar la interfaz (confunde a quien
  lea el esquema y contradice "Iteration deja de existir").

## Decisión: historial antiguo de iteración

- **Decision**: no se reescribe `work_item_activity`. Los eventos
  `fields_edited` antiguos tienen la clave `iteration`; `describeWorkItemActivity`
  mapea tanto `iteration` como `size` a la etiqueta "Size". Los eventos nuevos
  usan la clave `size`.
- **Rationale**: FR-016 pide que el historial se *muestre* como Size; el log
  es append-only y reescribir JSON histórico es riesgo sin ganancia.
- **Alternatives considered**: `UPDATE … SET payload = jsonb_set(...)` en la
  migración (toca el log de auditoría, que no debe editarse).

## Decisión: identificar valores de catálogo por nombre

- **Decision**: las acciones de gestión reciben `(projectPublicId, kind, name)`;
  no se agrega `publicId` a `tags`, `areas` ni `sizes`.
- **Rationale**: el nombre ya es clave única del catálogo dentro del proyecto
  (índice `lower(name)`), y es lo que ya viaja por URLs de List/Table y por
  MCP. Ningún id serial sale del servidor, así que el Principio IV se cumple
  igual que con los Work Items (`PREFIX-N`). Evita tres columnas nuevas con
  backfill de nanoid en SQL.
- **Alternatives considered**: `publicId` nanoid por valor (más migración,
  y el cliente seguiría necesitando el nombre para mostrar y filtrar).
- **Consecuencia**: si otro miembro renombra o elimina el valor mientras
  alguien lo edita, la acción no lo encuentra y devuelve `NOT_FOUND`; la UI
  refresca y muestra el estado actual.

## Decisión: orden manual con `position` por catálogo

- **Decision**: columna `position integer NOT NULL` en `tags`, `areas` y
  `sizes`. La migración la llena en orden alfabético por proyecto
  (`row_number() OVER (PARTITION BY project_id ORDER BY lower(name))`). Todo
  valor nuevo entra con `max(position) + 1` del proyecto. Reordenar recibe la
  lista completa de nombres en el nuevo orden y reescribe las posiciones en
  una transacción, igual que `reorderStages`. Toda lectura ordena por
  `(position, id)`.
- **Rationale**: FR-003a/FR-017. Mandar la lista completa es el patrón ya
  usado para columnas y no requiere posiciones dispersas. El desempate por
  `id` cubre la carrera de dos altas simultáneas con la misma posición, que
  es inofensiva: ninguna restricción única sobre `position`.
- **Alternatives considered**: posiciones fraccionarias o lexorank (YAGNI con
  catálogos de decenas de valores); orden por creación (descartado por el
  product owner, Clarifications).
- **Lista desactualizada**: si la lista recibida no contiene exactamente los
  nombres actuales del catálogo, la acción devuelve `CONFLICT` sin cambiar
  nada, y la UI refresca.

## Decisión: color de tag como enum de Postgres

- **Decision**: `pgEnum("tag_color", TAG_COLORS)` con 10 claves: `gray`,
  `red`, `orange`, `amber`, `green`, `teal`, `blue`, `indigo`, `violet`,
  `pink`. Columna `tags.color tag_color NOT NULL DEFAULT 'gray'` (FR-009 sin
  backfill). La paleta vive en un módulo puro, `lib/tag-colors.ts`, que mapea
  cada clave a clases literales de Tailwind para el fondo del chip, su texto
  y el tramo de la línea, en modo claro y oscuro.
- **Rationale**: mismo patrón que prioridad/severidad en 008 (enum desde un
  `const` compartido). Guardar la *clave* y no el hex permite ajustar tonos
  sin migrar. Clases literales porque Tailwind 4 solo genera las que ve
  escritas.
- **Alternatives considered**: hex libre (lo descarta FR-008); `text` con
  `CHECK` (equivalente, pero rompe el patrón de 008).
- **Contraste (SC-003)**: cada par fondo/texto se elige para ≥ 4.5:1 en
  ambos modos; se valida en la implementación con un test unitario que
  calcula el contraste de los valores hex documentados junto a la paleta.

## Decisión: eliminar un valor en uso

- **Decision**: `deleteCatalogValue` en una transacción:
  1. `SELECT … FOR UPDATE` del valor (serializa contra un renombre o borrado
     simultáneo).
  2. Lee los Work Items que lo usan.
  3. Quita el valor: para área/size, `UPDATE work_items SET area_id|size_id =
     NULL, updated_at = now()`; para tags, `DELETE FROM work_item_tags` (y
     `updated_at` de esos Work Items).
  4. Un `logActivity` en bloque con un `fields_edited` por Work Item:
     `{ fields: { area|size: { from, to: null } } }` o `{ fields: { tags:
     { from: [...], to: [...] } } }`, con `reason: "catalog_value_deleted"`.
  5. Borra el valor.
- **Rationale**: FR-006 exige una sola operación y una entrada por Work Item
  con autor y agente; reutilizar `fields_edited` hace que el historial ya lo
  describa ("Area: Backend → None"), y `reason` agrega "(value deleted)",
  igual que `assignee_changed` usa `reason: "member_left"`.
- **Alternatives considered**: un evento nuevo `catalog_value_removed`
  (duplica el formateo de `fields_edited`); confiar en `ON DELETE SET NULL` /
  `CASCADE` (no deja historial).

## Decisión: no recrear en silencio un valor eliminado

- **Decision**: `updateWorkItem` gana la opción `createMissingCatalogValues`
  (por defecto `true`). El detalle del Work Item la manda en `false`: como los
  valores nuevos ahora se crean en el pop-up (FR-014) antes de guardar, un
  nombre desconocido al guardar significa que alguien lo eliminó, y la acción
  devuelve `CATALOG_VALUE_NOT_FOUND` con el nombre. Las herramientas MCP
  mantienen `true` ("new names are created", FR-021).
- **Rationale**: cumple el edge case de la spec sin cambiar el contrato de
  los agentes.
- **Alternatives considered**: prohibir la creación implícita en todos lados
  (rompe MCP); ignorar el caso (la tag borrada reaparecería gris).

## Decisión: permiso `catalog:manage`

- **Decision**: clave nueva en `lib/roles.ts`, `catalog:manage: ["owner",
  "member"]`, para crear desde la pantalla o el pop-up, renombrar, cambiar
  color, reordenar y eliminar. Asignar valores a un Work Item sigue siendo
  `workItem:edit`.
- **Rationale**: FR-007. Tiene los mismos roles que `workItem:edit`, pero es
  otra acción (afecta a todos los Work Items del proyecto); una clave propia
  deja la matriz legible y permite cambiarla sin tocar la edición de Work
  Items.
- **Alternatives considered**: reutilizar `workItem:edit` o `board:edit`
  (mezcla conceptos en la matriz).

## Decisión: pantalla y ruta

- **Decision**: página nueva
  `app/(workspace)/projects/[projectPublicId]/settings/catalogs/page.tsx`
  (Server Component, `requireProjectMember`), con tres secciones con ancla
  (`#tags`, `#areas`, `#sizes`). La página de ajustes actual enlaza a ella.
- **Rationale**: los ajustes de proyecto ya son una página con
  `requireProjectMember`; una sub-ruta mantiene el patrón y deja una URL
  propia a la que apunta el sidebar.
- **Alternatives considered**: meter las secciones en la página de ajustes
  actual (queda muy larga y el sidebar tendría que apuntar a un ancla de otra
  cosa); ruta `/projects/X/tags` fuera de ajustes (contradice FR-001).

## Decisión: opción anidada en el sidebar

- **Decision**: la opción "Tags" se muestra anidada **bajo el proyecto
  activo** (el que corresponde a la URL actual), no bajo todos a la vez. El
  nombre del proyecto sigue llevando al tablero. La lista de opciones
  anidadas es un arreglo, para sumar más después (FR-002).
- **Rationale**: con varios proyectos, repetir la opción bajo cada uno
  duplica el largo del sidebar. Mostrarla en el proyecto activo es el patrón
  habitual de navegación jerárquica y sigue cumpliendo "cada proyecto tiene
  su opción Tags".
- **Alternatives considered**: bajo todos los proyectos (ruido visual);
  acordeón expandible por proyecto (un clic extra sin beneficio).
- **Confirmado** por el product owner (2026-09-25).

## Decisión: pop-up "Create new"

- **Decision**: `TagPicker` y `CatalogPicker` dejan de crear un valor al
  pulsar Enter sobre un nombre nuevo. En su lugar muestran la opción "Create
  new "…"", que abre `CreateCatalogValueDialog` (el `Dialog` existente, con
  `dismissible`), con el nombre editable y, en tags, la paleta
  (`TagColorPicker`, gris preseleccionado). Confirmar llama a
  `createCatalogValue` y, si sale bien, agrega el nombre a la selección del
  formulario; el Work Item se guarda con el botón "Save" de siempre.
- **Rationale**: FR-013/FR-014. Crear en el catálogo al confirmar (y no al
  guardar) es lo que permite elegir el color y hace que `createMissingCatalogValues:
  false` sea seguro.
- **Consecuencia aceptada**: si el usuario crea un valor en el pop-up y luego
  descarta los cambios del Work Item, el valor queda en el catálogo sin uso;
  se puede eliminar desde la pantalla de catálogos.
- **Filtro**: los pickers ya filtran por contenido sin distinguir mayúsculas;
  solo cambia que las opciones siguen el orden manual del catálogo.

## Decisión: línea de colores en la tarjeta

- **Decision**: `getBoard` agrega una consulta (tags de todos los Work Items
  del proyecto con nombre y color, en el orden del Work Item) y devuelve
  `tags: { name, color }[]` por Work Item. `TagColorBar` es un `flex` de
  `h-1` en el borde inferior de la tarjeta con un tramo `flex-1` por tag,
  `aria-hidden`; el `aria-label` de la tarjeta suma "tags: A, B" (FR-010).
- **Rationale**: una sola consulta extra por tablero, sin N+1 (mismo patrón
  que `tagsByItem` en `listProjectWorkItems`).
- **Orden de las tags en un Work Item**: se mantiene el actual (alfabético),
  como pide FR-017.

## Decisión: List/Table

- **Decision**: `ViewData` pasa `iterations` → `sizes` y sus catálogos llegan
  en orden manual; las tags del catálogo traen color para los filtros. El
  parámetro de URL `iteration` pasa a `size`; un `iteration=` viejo se ignora
  como cualquier parámetro desconocido. El orden de la Table por Area/Size
  usa el índice del valor en el catálogo (el catálogo ya viene ordenado, así
  que la función pura de orden recibe un `Map<nombre, índice>`); los vacíos
  siguen al final.
- **Rationale**: FR-017/FR-019 sin consultas nuevas.

## Decisión: MCP

- **Decision**: en `create_work_items` y `update_work_item` el parámetro
  `iteration` pasa a `size`; en `get_work_item` y `get_board`, `iteration` →
  `size` y `tags` pasa de `string[]` a `{ name, color }[]`. No se agregan
  herramientas: la gestión de catálogos queda fuera (FR-021, FR-023 de 011);
  `tests/unit/mcp-route.test.ts` sigue fijando la misma lista.
- **Rationale**: FR-015 y FR-021.

## Decisión: migración `0008`

- **Decision**: una migración, aplicada primero en Neon `dev` y en
  producción **antes** de hacer push del código (AGENTS.md: Render despliega
  al hacer push y no migra). Contenido en [data-model.md § Migración](data-model.md#migración-0008).
  `drizzle-kit generate` pregunta de forma interactiva si un cambio es un
  renombre; como no se puede responder en este entorno, el SQL se escribe a
  mano (`drizzle-kit generate --custom`) y luego se comprueba que un
  `drizzle-kit generate` normal no detecte diferencias entre `schema.ts` y el
  snapshot. Si las detecta, se corrige el snapshot antes de continuar.
- **Rationale**: renombrar sin perder datos (FR-016) requiere `RENAME`, no
  `DROP` + `CREATE`.
- **Orden de deploy**: el código viejo lee `iterations`/`iteration_id`, que
  dejan de existir. Hay una ventana de error entre migrar producción y que
  termine el deploy. Se acepta (instancia pequeña, deploy de ~2 min) y se
  hace en un momento de poco uso; la alternativa (vista de compatibilidad
  `iterations`) no se justifica. Aceptado por el product owner (2026-09-25).
