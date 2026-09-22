# Feature Specification: Vistas de Lista y Tabla

**Feature Branch**: `009-work-item-views`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Vistas de lista y tabla de Work Items (Fase 3, punto 8 del roadmap). El product owner confirmó en alcance las vistas de lista y tabla, sin vista de calendario por ahora. Cada proyecto, además de su tablero kanban, debe poder ver sus Work Items como lista y como tabla, usando los campos de 008-work-item-fields (prioridad, severidad, área, iteración, fechas de inicio/objetivo/cierre, estado abierto/cerrado) para ordenar y filtrar. Debe respetar la matriz de permisos de 007-roles-permissions (el Lector puede usar las vistas para leer), el aislamiento por proyecto (Principio IV) y la experiencia rápida y clara (Principio I). El tablero sigue siendo la vista principal. Fuera de alcance: vista de calendario, vistas guardadas o personalizadas, campos personalizados."

## Clarifications

### Session 2026-09-22

- Q: ¿Qué distingue a la vista Lista de la Tabla? → A: La Lista es un **backlog jerárquico**: los Work Items padre con sus hijos anidados y plegables (relaciones padre/hijo de 005-work-item-relationships), con pocos campos (ID, título, columna, prioridad, fecha objetivo). La Tabla es plana, con todos los campos, orden y filtros.
- Q: ¿La Tabla permite editar campos en la celda? → A: No. En esta versión la Tabla es **solo de lectura**; se edita abriendo el detalle.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cambiar entre tablero, lista y tabla (Priority: P1)

Un miembro, desde cualquier proyecto, cambia con un clic entre la vista **Tablero** (la actual), la vista **Lista** y la vista **Tabla**. Cada vista tiene su propia dirección, que se puede recargar y compartir con otros miembros del proyecto, y desde cualquiera de ellas se abre el detalle de un Work Item.

**Why this priority**: Sin una forma de llegar a las vistas nuevas, ninguna de las otras historias es usable. Es el esqueleto de la feature.

**Independent Test**: En un proyecto con Work Items, pasar de Tablero a Lista y a Tabla, recargar en cada una, abrir un Work Item desde cada vista y volver con "atrás" del navegador a la misma vista.

**Acceptance Scenarios**:

1. **Given** un proyecto abierto en el tablero, **When** un miembro elige "Lista" o "Tabla" en el selector de vista, **Then** ve los mismos Work Items del proyecto en esa vista, sin recargar toda la aplicación.
2. **Given** un miembro en la vista Tabla, **When** recarga la página o comparte la dirección con otro miembro, **Then** ambos ven la vista Tabla del mismo proyecto.
3. **Given** cualquier vista, **When** un miembro hace clic en un Work Item, **Then** se abre su vista de detalle (006-work-item-detail-view), y **When** vuelve con "atrás" del navegador, **Then** regresa a la vista desde la que llegó, con los mismos filtros y orden.
4. **Given** un Lector, **When** abre las vistas Lista y Tabla, **Then** las puede usar completas para leer, ordenar y filtrar, igual que un Miembro.
5. **Given** un usuario que no es miembro del proyecto, **When** intenta abrir la dirección de una vista de ese proyecto, **Then** ve el mismo "no encontrado" que para el tablero.

---

### User Story 2 - Tabla ordenable y filtrable (Priority: P1)

Un miembro ve todos los Work Items del proyecto en una tabla con una fila por Work Item y una columna por campo: ID, título, columna del tablero, estado (abierto/cerrado), prioridad, severidad, área, iteración, tags, stakeholder, fecha de inicio, fecha objetivo, fecha de creación y fecha de cierre. Ordena por cualquier columna y filtra para encontrar, por ejemplo, "todo lo Crítico abierto de la iteración Sprint 12" o "lo vencido".

**Why this priority**: Es el pedido central de la Fase 3 que 008 dejó preparado: responder preguntas sobre el conjunto de Work Items que el tablero no responde (qué está vencido, qué es crítico, qué hay en una iteración).

**Independent Test**: En un proyecto con Work Items con prioridades, iteraciones y fechas variadas, ordenar por prioridad y por fecha objetivo, aplicar filtros combinados y comprobar que el resultado y el contador de filas son correctos, y que el estado se conserva al recargar.

**Acceptance Scenarios**:

1. **Given** la vista Tabla, **When** un miembro hace clic en el encabezado "Priority", **Then** las filas se ordenan de Crítica a Baja, con los Work Items sin prioridad al final; **When** vuelve a hacer clic, **Then** el orden se invierte, y los que no tienen valor siguen al final.
2. **Given** la vista Tabla, **When** un miembro filtra por estado "Abierto", prioridad "Crítica" e iteración "Sprint 12", **Then** solo ve los Work Items que cumplen **todas** las condiciones, y un contador indica cuántos se muestran del total.
3. **Given** la vista Tabla, **When** un miembro activa el filtro "Vencidos", **Then** ve solo los Work Items abiertos con fecha objetivo anterior al día de hoy (misma regla que FR-010 de 008-work-item-fields).
4. **Given** la vista Tabla, **When** un miembro escribe en la búsqueda, **Then** ve los Work Items cuyo título o ID contiene ese texto, sin distinguir mayúsculas.
5. **Given** filtros y orden aplicados, **When** el miembro recarga o comparte la dirección, **Then** se conservan los mismos filtros y el mismo orden.
6. **Given** filtros que no dejan ningún Work Item, **When** se aplican, **Then** la tabla muestra un estado vacío claro con una forma de quitar los filtros.

---

### User Story 3 - Lista jerárquica (backlog) (Priority: P2)

Un miembro ve los Work Items del proyecto como un backlog: los que no tienen padre en el primer nivel y, debajo de cada uno, sus hijos, a cualquier profundidad (005-work-item-relationships permite anidación arbitraria). Cada nivel se pliega y despliega. Cada fila muestra lo mínimo para ubicarse: ID, título, columna del tablero, prioridad y fecha objetivo (con la marca de vencido).

**Why this priority**: Es la única vista que muestra la estructura padre/hijo de todo el proyecto de un vistazo, que la constitución (Principio III) pone en el núcleo del producto. Aun así, la Tabla (US2) responde a la mayoría de las preguntas sobre el conjunto, por eso va después.

**Independent Test**: En un proyecto con un padre, dos hijos y un nieto, más un Work Item suelto, abrir la Lista: el padre y el suelto están en el primer nivel, los hijos y el nieto anidados debajo. Plegar el padre oculta a sus descendientes, y un filtro que solo encuentra al nieto lo muestra con su padre y su abuelo como contexto.

**Acceptance Scenarios**:

1. **Given** Work Items con relaciones padre/hijo, **When** un miembro abre la Lista, **Then** ve en el primer nivel los que no tienen padre y, anidados debajo de cada uno, sus hijos, a cualquier profundidad.
2. **Given** un Work Item con hijos, **When** un miembro lo pliega, **Then** se ocultan todos sus descendientes; **When** lo despliega, **Then** vuelven a verse. Hay acciones para plegar y desplegar todo.
3. **Given** un Work Item con hijos, **When** se muestra plegado, **Then** indica cuántos hijos directos tiene.
4. **Given** la Lista, **When** un miembro aplica los mismos filtros que en la Tabla (estado, prioridad, iteración, búsqueda, etc.), **Then** ve los Work Items que cumplen el filtro y, además, sus ancestros como contexto, visualmente atenuados, para no perder la jerarquía.
5. **Given** Work Items cerrados, **When** se muestran en la Lista, **Then** se distinguen de los abiertos (p. ej. atenuados y con su estado), y un filtro de estado permite ocultarlos.
6. **Given** un Work Item cuyo padre fue eliminado, **When** se abre la Lista, **Then** aparece en el primer nivel (quedó huérfano, FR-012 de 005-work-item-relationships).

---

### Edge Cases

- **Proyecto sin Work Items**: la Lista y la Tabla muestran un estado vacío con un enlace al tablero para crear el primero (crear Work Items sigue siendo desde el tablero).
- **Proyecto sin columnas**: igual que sin Work Items.
- **Valores vacíos al ordenar**: los Work Items sin valor en la columna por la que se ordena van siempre al final, tanto en orden ascendente como descendente.
- **Orden estable**: entre filas con el mismo valor, el orden es por ID (número de Work Item) ascendente, para que el resultado sea predecible.
- **Filtro de un valor que ya no se usa**: los filtros de área, iteración y tag ofrecen todos los valores del catálogo del proyecto, aunque ningún Work Item los tenga ahora; el resultado simplemente queda vacío.
- **Dirección con filtros inválidos** (un valor inexistente, un campo de orden desconocido): se ignora el parámetro inválido y se muestra la vista con el resto, sin error.
- **Vencido y zona horaria**: "hoy" es la fecha local de quien mira, igual que en el tablero (Edge Cases de 008-work-item-fields).
- **Cambios de otros miembros**: como en el tablero, las vistas muestran los datos del momento en que se abrieron; no hay actualización en tiempo real (AGENTS.md, decisión de Fase 1).
- **Rol cambiado con la vista abierta**: las vistas no permiten modificar nada (FR-011, FR-018), así que un cambio de rol no afecta lo que se ve.
- **Orden dentro de la Lista**: dentro de cada nivel, los hermanos se ordenan por ID ascendente; la Lista no tiene selector de orden (lo tiene la Tabla).
- **Estado de plegado**: plegar o desplegar no se guarda ni va en la dirección; al recargar, la Lista se abre con todo desplegado.

## Requirements *(mandatory)*

### Functional Requirements

**Navegación**

- **FR-001**: Cada proyecto MUST ofrecer un selector de vista visible con tres opciones —Tablero, Lista y Tabla— en la cabecera del proyecto, que indique cuál está activa.
- **FR-002**: Cada vista MUST tener su propia dirección, recargable y compartible entre miembros del mismo proyecto. El tablero conserva su dirección actual y sigue siendo la vista a la que lleva el proyecto desde la barra lateral.
- **FR-003**: Desde cualquier vista, hacer clic en un Work Item MUST abrir su vista de detalle, y el botón "atrás" del navegador MUST devolver a la vista de origen con sus filtros y orden.
- **FR-004**: Las vistas MUST mostrar exactamente los Work Items del proyecto abierto y verificar la membresía antes de mostrar nada (Principio IV); un no miembro recibe el mismo "no encontrado" que en el tablero.

**Tabla**

- **FR-005**: La Tabla MUST mostrar una fila por Work Item del proyecto (abiertos y cerrados) con estas columnas: ID, título, columna del tablero, estado (abierto/cerrado), prioridad, severidad, área, iteración, tags, stakeholder, fecha de inicio, fecha objetivo, fecha de creación y fecha de cierre.
- **FR-006**: La Tabla MUST permitir ordenar por cualquiera de esas columnas salvo tags, en orden ascendente y descendente. Prioridad y severidad se ordenan por nivel (Crítica, Alta, Media, Baja), no alfabéticamente; la columna del tablero, por su posición en el tablero; los vacíos van siempre al final. El orden por defecto es por ID ascendente.
- **FR-007**: La Tabla MUST permitir filtrar, combinando los filtros con "y": estado (abierto/cerrado), columna del tablero, prioridad, severidad, área, iteración y tag (cada uno con uno o varios valores, que se combinan con "o" dentro del mismo filtro, incluida la opción "sin valor"), "solo vencidos", y búsqueda de texto en título e ID.
- **FR-008**: La Tabla MUST mostrar cuántos Work Items se ven del total del proyecto y ofrecer una acción para quitar todos los filtros.
- **FR-009**: Los filtros y el orden de la Tabla MUST reflejarse en la dirección de la página, de modo que recargar o compartir la dirección reproduzca la misma vista.
- **FR-010**: La Tabla MUST marcar como vencidos los Work Items abiertos con fecha objetivo pasada, con la misma regla y el mismo indicador que la tarjeta del tablero (FR-010 de 008-work-item-fields).
- **FR-011**: La Tabla MUST ser de solo lectura: ningún campo se edita desde una celda; para editar, el miembro abre el detalle del Work Item (Clarifications).

**Lista**

- **FR-012**: La Lista MUST mostrar los Work Items del proyecto como un árbol según la relación padre/hijo de 005-work-item-relationships: los que no tienen padre en el primer nivel y cada hijo bajo su padre, a cualquier profundidad. Dentro de cada nivel, los hermanos van por ID ascendente.
- **FR-013**: Cada fila de la Lista MUST mostrar ID, título, columna del tablero, prioridad y fecha objetivo (con el indicador de vencido de FR-010), y distinguir los Work Items cerrados de los abiertos.
- **FR-014**: La Lista MUST permitir plegar y desplegar cada Work Item con hijos (mostrando cuántos hijos directos tiene), y plegar o desplegar todo. El estado de plegado no se guarda.
- **FR-015**: La Lista MUST ofrecer los mismos filtros que la Tabla (FR-007), reflejados en la dirección (FR-009). Con filtros activos, MUST mostrar los Work Items que cumplen el filtro y también sus ancestros, atenuados, como contexto.
- **FR-016**: La Lista MUST ser de solo lectura, igual que la Tabla.

**Permisos y datos**

- **FR-017**: Leer, ordenar y filtrar en cualquier vista MUST estar disponible para todo miembro del proyecto, Lectores incluidos, sin claves de permiso nuevas (007-roles-permissions).
- **FR-018**: Las vistas MUST NOT crear, mover ni eliminar Work Items; esas acciones siguen en el tablero y en el detalle.

### Key Entities *(include if feature involves data)*

- **Vista**: forma de presentar los Work Items de un proyecto (Tablero, Lista, Tabla). No es un dato guardado: se elige con el selector y vive en la dirección de la página.
- **Filtros y orden**: estado de la Tabla y de la Lista (los filtros; el orden solo en la Tabla) que vive en la dirección de la página. No se guardan en la cuenta ni en el proyecto.
- **Work Item**: sin cambios de datos. Se usan los campos existentes de 004, 005 y 008.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro pasa del tablero a la Tabla y encuentra "los Work Items críticos abiertos de una iteración" en menos de 20 segundos.
- **SC-002**: En un proyecto con 500 Work Items, ordenar o cambiar un filtro en la Tabla se refleja sin demora perceptible (se siente inmediato).
- **SC-003**: El 100 % de las direcciones de vista con filtros y orden, al recargarse o abrirse por otro miembro del proyecto, muestran el mismo resultado.
- **SC-004**: Ningún no miembro puede ver Work Items de un proyecto a través de las vistas nuevas, ni desde la interfaz ni pidiendo la dirección directamente.
- **SC-005**: Abrir un Work Item desde una vista y volver con "atrás" conserva la vista, los filtros y el orden en el 100 % de los casos.
- **SC-006**: En la Lista, el 100 % de los Work Items aparece exactamente una vez, bajo su padre real (o en el primer nivel si no tiene), sin importar la profundidad.

## Assumptions

- **El tablero sigue siendo la vista principal**: el enlace del proyecto en la barra lateral sigue llevando al tablero; no se recuerda la última vista usada (Principio VI; puede agregarse después si se pide).
- **Filtros en la dirección, no guardados**: compartir una dirección es la forma de compartir un filtro. Las "vistas guardadas" con nombre quedan fuera de alcance.
- **Sin paginación en esta versión**: el tablero ya carga todos los Work Items del proyecto; la Tabla hace lo mismo y ordena y filtra sobre ese conjunto, con 500 Work Items como escala objetivo (SC-002).
- **Crear Work Items solo desde el tablero**: las vistas nuevas son de consulta; FR-018.
- **Fuera de alcance**: edición en celda (Clarifications), reordenar o re-anidar arrastrando en la Lista, vista de calendario, vistas guardadas o compartidas por nombre, columnas configurables (ocultar o reordenar columnas de la Tabla), exportar a CSV, edición masiva, actualización en tiempo real.
- **Dependencias**: 004-work-items (campos base y tags), 005-work-item-relationships (padre/hijo), 006-work-item-detail-view (destino al abrir un Work Item), 007-roles-permissions (acceso de Lectores), 008-work-item-fields (campos, estado de cierre y regla de vencido).
