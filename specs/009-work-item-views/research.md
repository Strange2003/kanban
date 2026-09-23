# Research: Vistas de Lista y Tabla

No queda ningún `NEEDS CLARIFICATION` en el Technical Context del plan. El
stack ya está decidido en
[001-accounts-invitations/research.md](../001-accounts-invitations/research.md),
y las dos decisiones de producto abiertas (qué es la Lista y si la Tabla se
edita) quedaron cerradas en la sesión de clarificación de la spec
(2026-09-22). Aquí se resuelven las decisiones técnicas propias de esta
feature.

## Decisión: Una ruta por vista, con cabecera compartida

**Decision**: Dos rutas nuevas junto al tablero existente:
`/projects/[projectPublicId]/list` y `/projects/[projectPublicId]/table`. El
tablero conserva `/projects/[projectPublicId]` (FR-002). Las tres páginas
renderizan un mismo componente de cabecera, `ProjectViewHeader`, con el
selector de vista (FR-001), el aviso de solo lectura y el enlace a Ajustes
que hoy vive dentro de la página del tablero.

**Rationale**: Una ruta por vista da direcciones recargables y compartibles
sin lógica extra (FR-002, SC-003), y el "atrás" del navegador funciona solo
(FR-003). La cabecera es un componente y no un `layout.tsx` del proyecto
porque las rutas hermanas `settings/` y `work-items/[displayNumber]/` no deben
mostrar el selector. Un layout obligaría a esconderlo según la ruta, que es
peor que componerlo en las tres páginas que lo necesitan.

**Alternatives considered**:
- **Una sola ruta con `?view=list`**: mezcla el parámetro de vista con los
  de filtro, y el tablero, que no tiene filtros, pasaría a depender de uno.
- **Route group con layout propio (`(views)/`)**: resuelve lo mismo que el
  componente compartido, pero reorganiza las carpetas existentes del tablero
  sin necesidad (Principio VI).

## Decisión: Cargar todo el proyecto una vez y ordenar/filtrar en el cliente

**Decision**: Cada página de vista pide, en el servidor y con una sola
acción de lectura nueva (`getWorkItemsView`), todos los Work Items del
proyecto ya "aplanados" para mostrar: nombre, posición y marca de cierre de
su columna, nombres de área e iteración, tags, padre, fechas y campos
de 008. Recibe también las opciones de filtro: columnas, catálogos de área,
iteración y tags. El orden, los filtros y el árbol se calculan en el cliente
con funciones puras.

**Rationale**:
- El tablero ya carga todos los Work Items del proyecto en una sola lectura
  (`getBoard`), así que esta vista no cambia la escala que el producto ya
  asume.
- Con la escala objetivo de 500 Work Items (SC-002), ordenar y filtrar en
  memoria en el navegador tarda milisegundos. Ir al servidor en cada clic
  agregaría una ida y vuelta por cambio de filtro, en contra del Principio I.
- Las funciones puras de filtro, orden y árbol se prueban tabla por tabla sin
  base de datos.
- El filtro "vencidos" depende de la fecha **local** de quien mira
  (Edge Cases), que solo existe en el navegador. Filtrarlo en el servidor
  obligaría a enviar la zona horaria.

**Alternatives considered**:
- **Filtrar y ordenar en SQL con paginación**: es lo correcto a escala de
  miles de Work Items, pero hoy no hay evidencia de esa escala y el tablero
  mismo no pagina. Se documenta como la evolución natural si un proyecto
  supera la escala objetivo.
- **Reutilizar `getBoard` más `getWorkItemDetailData` por Work Item**:
  serían N lecturas para los tags, áreas e iteraciones, y el hallazgo de 005
  prohíbe disparar Server Actions en paralelo desde el cliente.

## Decisión: Filtros y orden en la dirección, actualizados con `history.replaceState`

**Decision**: El estado de filtros y orden vive en los parámetros de la
dirección (FR-009), con este formato:

| Parámetro | Valor | Ejemplo |
|---|---|---|
| `status` | `open` \| `closed` | `status=open` |
| `stage` | `publicId` de una columna; parámetro repetido para varias | `stage=abc123&stage=def456` |
| `priority`, `severity` | un nivel de 008 o `none`; repetido para varios | `priority=critical&priority=high` |
| `area`, `iteration`, `tag` | un nombre o `none`; repetido para varios | `iteration=Sprint%2012` |
| `overdue` | `1` | `overdue=1` |
| `q` | texto libre | `q=login` |
| `sort`, `dir` | columna ordenable, `asc` \| `desc` (solo Tabla) | `sort=priority&dir=desc` |

Los cambios se escriben con `window.history.replaceState`, que Next.js
integra con `useSearchParams` (guía
`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
§ Native History API). Así la dirección se actualiza sin volver a pedir la
página al servidor. Se usa `replaceState` y no `pushState` para que "atrás"
desde la vista vuelva a la pantalla anterior y no deshaga filtro por filtro.
Desde el detalle, "atrás" vuelve a la dirección con los filtros, que es lo
que pide FR-003. Un parámetro inválido se ignora (Edge Cases). Los filtros de varios valores repiten el parámetro en vez de separar por comas, porque los nombres son texto libre y pueden contener comas (decidido al implementar).

**Rationale**: Una dirección que describe la vista es la forma más simple de
cumplir FR-009, SC-003 y SC-005 a la vez, sin guardar nada. Las columnas se
identifican por `publicId`, porque sus nombres pueden repetirse y la
constitución prohíbe exponer ids internos. Áreas, iteraciones y tags van por
nombre, porque sus catálogos ya son únicos por nombre sin distinguir
mayúsculas (008 data-model.md).

**Alternatives considered**:
- **`router.replace` de Next.js**: vuelve a ejecutar el Server Component de
  la página, es decir, otra lectura completa del proyecto por cada clic de
  filtro.
- **Estado solo en React**: no cumple FR-009 ni SC-003.
- **Guardar filtros en la cuenta**: equivale a "vistas guardadas", que está
  fuera de alcance (Assumptions).

## Decisión: Reglas de orden y de filtro en un módulo puro

**Decision**: `lib/work-item-view.ts` (puro, importable desde el cliente)
contiene:

- `parseViewQuery(searchParams)`: devuelve un `ViewQuery` tipado e ignora lo
  inválido.
- `serializeViewQuery(query)`: el inverso, que omite los valores por
  defecto.
- `filterWorkItems(rows, query, today)`.
- `sortWorkItems(rows, sort, dir)`.
- `buildWorkItemTree(rows, matchingIds)`.

Reglas de orden (FR-006):

- Prioridad y severidad se ordenan por el índice en `WORK_ITEM_LEVELS`.
- La columna del tablero, por la posición de la columna.
- Las fechas, por su string `"YYYY-MM-DD"` o por el instante.
- Los textos, con `localeCompare` sin distinguir mayúsculas.
- Los vacíos siempre al final, en ambas direcciones.
- El desempate siempre es por número de Work Item ascendente (Edge Cases,
  orden estable).

**Rationale**: Son exactamente las reglas que la spec fija y que más
fácilmente se rompen en silencio: vacíos al final en orden descendente,
prioridad no alfabética, desempate estable. En un módulo puro, cada una se
prueba con una línea.

## Decisión: El árbol de la Lista, con ancestros como contexto

**Decision**: `buildWorkItemTree` arma el árbol desde `parentWorkItemId`
(005). Los raíces son los Work Items sin padre, y también, por defensa,
aquellos cuyo padre no está en el conjunto. Los hermanos se ordenan por
número ascendente (FR-012). Con filtros activos:

1. Se calcula el conjunto de Work Items que cumplen el filtro.
2. Se agregan todos sus ancestros, marcados como "contexto" (FR-015).
3. Se arma el árbol solo con ese conjunto.

Un conjunto de visitados protege contra ciclos: 005 ya los impide en el
servidor, pero una lectura concurrente no debe colgar el navegador. El
plegado es estado de React por id, no se guarda (FR-014), y "plegar/desplegar
todo" lo reemplaza de una vez.

**Rationale**: Mostrar los ancestros atenuados es la convención de los
backlogs jerárquicos (Azure DevOps, Jira). Es lo que la spec pide para no
perder la jerarquía al filtrar. SC-006, cada Work Item exactamente una vez
bajo su padre real, se verifica con tests del módulo puro.

## Decisión: Lectura nueva `getWorkItemsView`, solo con membresía

**Decision**: Una Server Action de lectura nueva en
`lib/actions/work-item-views.ts`. Llama a `requireProjectMember` (FR-004,
SC-004) y hace 4 consultas acotadas al proyecto:

1. Los Work Items con `JOIN` a `stages` y `LEFT JOIN` a `areas` e
   `iterations`.
2. Los tags de esos Work Items (`work_item_tags` ⋈ `tags` filtrado por el
   proyecto).
3. Las columnas.
4. Los catálogos de área, iteración y tags.

Devuelve también el rol, para la cabecera. No expone ids internos de
columnas ni de catálogos. Solo sale el `id` del Work Item, que ya viaja hoy
al cliente en el tablero y el detalle. Se registra en
`MEMBERSHIP_ONLY_READS` de `tests/unit/action-permissions.test.ts`.

**Rationale**: Es la misma forma que `getBoard` y `getWorkItemDetailData`:
una lectura por página, sin que el cliente encadene acciones (005 research.md
§ Hallazgo). No hay claves de permiso nuevas (FR-017): leer solo exige
membresía.

## Decisión: Sin cambios de esquema ni índices nuevos

**Decision**: Esta feature no agrega migraciones.

**Rationale**: Todo lo que muestran las vistas ya existe (004, 005, 008). La
lectura filtra por `work_items.project_id`, que tiene índice
(`work_items_project_id_idx`), y los `JOIN` van por claves primarias. Los
índices sobre `priority`, `area_id`, etc., que 008 difirió "si 009 los
necesita" no hacen falta, porque 009 ordena y filtra en memoria. Si en el
futuro se pagina en el servidor, se agregarán entonces, con evidencia.

## Decisión: "Vencido" sin desajuste de hidratación

**Decision**: La Tabla y la Lista usan `useLocalToday()` y `isOverdue()` de
008. Mientras `today` es `null` (en el servidor y durante la hidratación),
no se pinta la marca de vencido. Si el filtro `overdue=1` está activo, la
vista muestra un estado de carga en lugar de filas hasta conocer `today`.

**Rationale**: Es el mismo mecanismo que evita el desajuste de hidratación
en el tablero (008 research.md § Fechas y "hoy"). Filtrar "vencidos" con la
fecha del servidor mostraría durante un instante filas equivocadas.
