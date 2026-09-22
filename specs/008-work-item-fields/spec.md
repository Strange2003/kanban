# Feature Specification: Campos Extendidos y Fechas de Work Items

**Feature Branch**: `008-work-item-fields`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Campos extendidos y fechas de Work Items (Fase 3, punto 9 del roadmap). Agregar a los Work Items un conjunto FIJO de campos adicionales (no hay campos personalizados definidos por el usuario en esta fase): prioridad, severidad, área e iteración. Además, los Work Items deben guardar fechas: fecha de creación (ya existe como created_at en la base, pero hoy no se muestra como dato del Work Item), una fecha de cierre opcional (cuándo se completó/cerró el Work Item) y cualquier otra fecha necesaria para planificar (p. ej. fecha objetivo/límite opcional). Estas fechas son la base para una futura vista de calendario, que queda FUERA de alcance (ni en esta spec ni en la siguiente). Los campos deben poder verse y editarse en la vista de detalle (006-work-item-detail-view) y, cuando tenga sentido, mostrarse de forma compacta en la tarjeta del tablero (003-kanban-board / 004-work-items). Toda edición de estos campos debe registrarse en work_item_activity (constitución, Estándares de Producto y Datos § Auditoría). Los permisos siguen la matriz de 007-roles-permissions (el Viewer no puede editar; definir si se necesitan claves de permiso nuevas o se reutilizan las de edición de Work Item). Los Work Items existentes antes de la migración deben seguir funcionando (campos vacíos/por defecto). Esta spec NO incluye las vistas de lista y tabla (serán la spec siguiente, 009, que usará estos campos para ordenar y filtrar) ni la vista de calendario. Resolver en la spec: valores posibles de prioridad y severidad; si área e iteración son listas fijas globales o catálogos por proyecto (el product owner pidió "campos fijos", entendido como conjunto de campos fijo, no necesariamente valores fijos); si la fecha de cierre se establece manualmente o automáticamente al mover el Work Item a cierta columna."

## Clarifications

### Session 2026-09-22

- Q: ¿Cómo se cierra un Work Item — fecha de cierre manual, automática al moverlo a una columna, o ambas? → A: Automática. Cada proyecto marca una o más columnas como "de cierre". Mover un Work Item a una de ellas lo cierra y sacarlo lo reabre. Además, el detalle tiene un botón "Cerrar" que mueve el Work Item a la columna de cierre, así que cerrar siempre equivale a estar en una columna de cierre. La fecha de cierre no se edita a mano.
- Q: ¿Área e iteración son catálogos por proyecto creados sobre la marcha (como los tags), listas fijas globales, o texto libre? → A: Catálogos por proyecto, creados en línea desde el Work Item igual que los tags de 004-work-items.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clasificar un Work Item por prioridad y severidad (Priority: P1)

Un miembro abre la vista de detalle de un Work Item y le asigna una **prioridad** (qué tan pronto hay que atenderlo) y, si aplica, una **severidad** (qué tan grave es el impacto, típicamente en defectos). Ambos se eligen de una lista cerrada de valores, se pueden cambiar o dejar vacíos, y la prioridad se ve de un vistazo en la tarjeta del tablero.

**Why this priority**: La prioridad es el campo extendido más usado para decidir qué se trabaja primero, y es la base del orden y los filtros de la futura vista de lista/tabla (009). Tiene valor por sí sola sin ninguna otra historia de esta spec.

**Independent Test**: Con un proyecto con Work Items, asignar prioridad y severidad a uno desde su detalle, recargar y verificar que persisten, que la prioridad aparece en la tarjeta del tablero y que el cambio queda en el historial.

**Acceptance Scenarios**:

1. **Given** un Work Item sin prioridad, **When** un Owner o Miembro le asigna la prioridad "Alta" desde el detalle, **Then** el valor se guarda, se muestra en el detalle y aparece un indicador compacto de prioridad en su tarjeta del tablero.
2. **Given** un Work Item con prioridad y severidad, **When** un miembro vacía ambos campos, **Then** quedan sin valor y la tarjeta deja de mostrar el indicador de prioridad.
3. **Given** cualquier cambio de prioridad o severidad, **When** se guarda, **Then** el historial de actividad del Work Item registra el campo, el valor anterior y el nuevo.
4. **Given** un Lector, **When** abre el detalle del Work Item, **Then** ve la prioridad y severidad pero no puede cambiarlas.

---

### User Story 2 - Planificar con fechas (Priority: P1)

Un miembro ve cuándo se creó un Work Item y le asigna fechas de planificación opcionales. Las fechas se muestran en el detalle y la fecha objetivo aparece en la tarjeta, resaltada si ya venció sin que el Work Item esté cerrado.

**Why this priority**: Las fechas son el pedido explícito del product owner y la base de datos para una futura vista de calendario. Sin ellas no hay forma de saber qué está atrasado.

**Independent Test**: Crear un Work Item, verificar que el detalle muestra su fecha de creación, asignarle una fecha objetivo pasada y comprobar que la tarjeta la marca como vencida.

**Acceptance Scenarios**:

1. **Given** cualquier Work Item (incluidos los creados antes de esta feature), **When** un miembro abre su detalle, **Then** ve su fecha de creación y su fecha de última modificación, que no son editables.
2. **Given** un Work Item, **When** un Owner o Miembro le asigna una fecha objetivo, **Then** la fecha se guarda, se ve en el detalle y en la tarjeta del tablero.
3. **Given** un Work Item con fecha objetivo anterior a hoy y sin fecha de cierre, **When** se muestra en el tablero o en su detalle, **Then** la fecha aparece destacada como vencida.
4. **Given** un Work Item con fecha de inicio y fecha objetivo, **When** un miembro intenta poner una fecha objetivo anterior a la de inicio, **Then** el sistema rechaza el cambio con un mensaje claro.

---

### User Story 3 - Cerrar Work Items con columnas de cierre (Priority: P1)

Un Owner o Miembro marca en el tablero qué columnas significan "terminado" (p. ej. "Done", "Closed"). Desde ese momento, llevar un Work Item a una de esas columnas lo **cierra** y registra su **fecha de cierre**, y sacarlo de ahí lo **reabre**. Para no tener que buscar la columna, el detalle del Work Item ofrece un botón **"Cerrar"** que lo mueve directamente a la columna de cierre.

**Why this priority**: Sin fecha de cierre no se sabe qué se terminó ni cuándo, y la marca de vencido no distinguiría lo que ya está hecho. Atar el cierre a la columna evita estados contradictorios, como una tarjeta en "Done" que figura abierta.

**Independent Test**: En un proyecto con columnas "To Do" y "Done", marcar "Done" como columna de cierre; arrastrar un Work Item a "Done" y verificar que muestra su fecha de cierre; devolverlo a "To Do" y verificar que se reabre; usar el botón "Cerrar" del detalle y verificar que el Work Item termina en "Done", cerrado.

**Acceptance Scenarios**:

1. **Given** un tablero sin columnas de cierre, **When** un Owner o Miembro marca la columna "Done" como de cierre, **Then** la columna muestra un indicador visible de que es de cierre.
2. **Given** "Done" marcada como de cierre, **When** un miembro arrastra un Work Item abierto a "Done" en el tablero, **Then** el Work Item queda cerrado con la fecha del día como fecha de cierre, deja de marcarse como vencido y el historial registra el cierre.
3. **Given** un Work Item cerrado en "Done", **When** un miembro lo mueve a una columna que no es de cierre, **Then** se reabre: se borra su fecha de cierre y el historial registra la reapertura.
4. **Given** un Work Item abierto y un tablero con columna de cierre, **When** un Owner o Miembro pulsa "Cerrar" en el detalle, **Then** el Work Item se mueve a la columna de cierre (al final de ella) y queda cerrado como en el escenario 2.
5. **Given** un tablero sin ninguna columna de cierre, **When** un miembro abre el detalle de un Work Item, **Then** el botón "Cerrar" no está disponible y se explica que primero hay que marcar una columna como de cierre.
6. **Given** un Work Item ya cerrado, **When** un miembro abre su detalle, **Then** ve que está cerrado y su fecha de cierre, y no se le ofrece "Cerrar".
7. **Given** una columna con Work Items dentro, **When** un miembro la marca como de cierre, **Then** todos sus Work Items quedan cerrados con la fecha de ese día; **When** luego la desmarca, **Then** todos se reabren. El historial de cada Work Item lo registra.
8. **Given** un Lector, **When** ve el tablero o el detalle, **Then** ve qué columnas son de cierre y el estado de cada Work Item, pero no puede marcar columnas ni usar "Cerrar".

---

### User Story 4 - Organizar por área e iteración (Priority: P2)

Un miembro indica a qué **área** del producto o del trabajo pertenece un Work Item (p. ej. "Frontend", "Facturación") y en qué **iteración** se planea hacer (p. ej. "Sprint 12", "Octubre"). Los valores salen de un catálogo del proyecto que los miembros amplían sobre la marcha, igual que los tags.

**Why this priority**: Aporta organización y agrupación, sobre todo para la vista de lista/tabla (009). Tiene menos valor inmediato en el tablero que la prioridad y las fechas.

**Independent Test**: Desde el detalle de un Work Item, crear el área "Frontend" y asignarla; en otro Work Item del mismo proyecto, comprobar que "Frontend" está disponible para elegir; comprobar que no aparece en otro proyecto.

**Acceptance Scenarios**:

1. **Given** un proyecto sin áreas, **When** un Owner o Miembro escribe "Frontend" en el campo área de un Work Item y confirma, **Then** se crea el área en el catálogo del proyecto y queda asignada a ese Work Item.
2. **Given** un área o iteración existente en el proyecto, **When** un miembro edita otro Work Item del mismo proyecto, **Then** puede elegirla de la lista.
3. **Given** dos proyectos distintos, **When** un miembro ve el catálogo de áreas/iteraciones de uno, **Then** no aparecen los valores del otro.
4. **Given** un Work Item con área e iteración, **When** un miembro las quita, **Then** quedan vacías y el historial registra el cambio.

---

### Edge Cases

- **Work Items anteriores a esta feature**: se muestran con prioridad, severidad, área, iteración y fechas de planificación vacías, sin cierre, y con su fecha de creación real. Siguen funcionando sin intervención.
- **Fecha objetivo sin fecha de inicio (o al revés)**: está permitido. Cada fecha es opcional por separado. La regla de orden solo aplica cuando existen las dos.
- **Proyectos existentes**: no tienen ninguna columna de cierre, así que todos sus Work Items están abiertos hasta que alguien marque una. El sistema no adivina cuál es la columna "Done" por su nombre.
- **Varias columnas de cierre**: está permitido (p. ej. "Done" y "Descartado"). "Cerrar" mueve el Work Item a la primera columna de cierre según el orden del tablero, de izquierda a derecha.
- **Mover entre dos columnas de cierre**: el Work Item sigue cerrado y conserva su fecha de cierre original. No se registra ni reapertura ni nuevo cierre, solo el cambio de columna.
- **Reordenar dentro de una columna de cierre**: no afecta el estado de cierre ni la fecha.
- **Eliminar una columna de cierre**: sigue la regla de 003-kanban-board (solo se elimina vacía), así que ningún Work Item queda en un estado incoherente.
- **Work Item creado directamente en una columna de cierre**: nace cerrado, con la fecha del día como fecha de cierre.
- **Reabrir**: no hay botón "Reabrir". Se reabre moviendo el Work Item a una columna que no es de cierre, como cualquier otro movimiento.
- **Fecha de cierre y zona horaria**: la fecha de cierre registra el momento del cierre y se muestra como día según la fecha local de quien mira.
- **Vencimiento y zona horaria**: una fecha objetivo se considera vencida a partir del día siguiente a esa fecha, según la fecha local de quien mira. Las fechas de planificación son días de calendario, sin hora.
- **Un Miembro pasa a Lector con el detalle abierto**: al intentar editar un campo, el cambio se rechaza igual que las demás ediciones de 007-roles-permissions (`ROLE_NOT_PERMITTED`).
- **Edición concurrente del mismo campo por dos miembros**: gana el último guardado (igual que los campos existentes de 004-work-items). Ambos cambios quedan en el historial.
- **Valor de catálogo duplicado**: crear un área o iteración con un nombre que ya existe en el proyecto (sin distinguir mayúsculas) reutiliza el existente en vez de duplicarlo.
- **Área e iteración son catálogos separados**: un valor "Octubre" creado como iteración no aparece como área, ni al revés.
- **Tarjetas saturadas**: en el tablero solo se muestran de forma compacta la prioridad y la fecha objetivo. Severidad, área, iteración, inicio y cierre solo se ven en el detalle, para que la tarjeta siga siendo legible.

## Requirements *(mandatory)*

### Functional Requirements

**Conjunto de campos**

- **FR-001**: Cada Work Item MUST tener este conjunto fijo de campos adicionales, todos opcionales: prioridad, severidad, área, iteración, fecha de inicio y fecha objetivo. Además tiene una fecha de cierre que el sistema calcula (FR-011 a FR-014). Esta feature no incluye campos definidos por el usuario.
- **FR-002**: La prioridad MUST elegirse de esta lista ordenada, de mayor a menor urgencia: **Crítica, Alta, Media, Baja**. También puede quedar vacía.
- **FR-003**: La severidad MUST elegirse de esta lista ordenada, de mayor a menor gravedad: **Crítica, Alta, Media, Baja**. También puede quedar vacía. La severidad es independiente de la prioridad y ninguna se calcula a partir de la otra.
- **FR-004**: Las listas de valores de prioridad y severidad MUST ser las mismas para todos los proyectos y no son configurables en esta feature.
- **FR-005**: Área e iteración MUST aceptar como máximo un valor cada una por Work Item. Los valores MUST provenir de dos catálogos separados (áreas e iteraciones) de cada proyecto.
- **FR-006**: Un Owner o Miembro MUST poder crear un área o iteración nueva directamente desde el Work Item, sin una pantalla de configuración aparte, igual que los tags (FR-012 de 004-work-items). El valor creado MUST quedar disponible para los demás Work Items del mismo proyecto. Un nombre repetido (sin distinguir mayúsculas) reutiliza el valor existente.
- **FR-007**: Renombrar o eliminar valores de los catálogos de área e iteración queda fuera de alcance, igual que la gestión del catálogo de tags en 004-work-items. Los catálogos solo crecen.

**Fechas**

- **FR-008**: Cada Work Item MUST mostrar su fecha de creación y su fecha de última modificación. Ambas las registra el sistema y ningún rol puede editarlas.
- **FR-009**: Las fechas de inicio y objetivo MUST ser días de calendario (sin hora), opcionales e independientes entre sí. Si existen las dos, la fecha objetivo MUST ser igual o posterior a la de inicio.
- **FR-010**: Un Work Item con fecha objetivo anterior al día actual y abierto MUST mostrarse como vencido, con un indicador visible, en la tarjeta del tablero y en el detalle.

**Cierre**

- **FR-011**: Un Owner o Miembro MUST poder marcar y desmarcar cualquier columna del tablero como "de cierre". Puede haber cero, una o varias por proyecto. Las columnas de cierre MUST distinguirse visualmente en el tablero para todos los miembros, Lectores incluidos. Marcar columnas requiere el mismo permiso que editar el tablero en 007-roles-permissions.
- **FR-012**: Un Work Item MUST estar cerrado solo si está en una columna de cierre, y abierto en cualquier otro caso. No hay otra forma de cerrarlo ni reabrirlo.
- **FR-013**: Cuando un Work Item pasa a estar cerrado (se mueve a una columna de cierre desde una que no lo es, se crea en ella, o su columna se marca como de cierre), el sistema MUST registrar ese momento como su fecha de cierre. Cuando deja de estar cerrado (se mueve a una columna que no es de cierre, o su columna se desmarca), MUST borrarse la fecha de cierre. Moverse entre dos columnas de cierre conserva la fecha original. La fecha de cierre no se edita a mano.
- **FR-014**: La vista de detalle MUST mostrar si el Work Item está abierto o cerrado y, si está cerrado, su fecha de cierre. Si el Work Item está abierto y el proyecto tiene al menos una columna de cierre, MUST ofrecer a Owner y Miembros un botón "Cerrar". Ese botón mueve el Work Item al final de la primera columna de cierre en el orden del tablero, con el mismo efecto que arrastrarlo ahí. Si no hay columnas de cierre, el botón MUST no estar disponible y explicar por qué.

**Visualización y edición**

- **FR-015**: La vista de detalle (006-work-item-detail-view) MUST mostrar todos los campos de FR-001 y FR-008 y permitir editar los de FR-001, con el mismo estilo de edición en línea que los campos existentes.
- **FR-016**: La tarjeta del tablero MUST mostrar de forma compacta la prioridad (si tiene) y la fecha objetivo (si tiene, con el estado de vencida de FR-010). Los demás campos nuevos no se muestran en la tarjeta.
- **FR-017**: Crear un Work Item MUST seguir funcionando igual que hoy (solo el título es obligatorio). Los campos nuevos quedan vacíos al crearlo y se completan después desde el detalle.
- **FR-018**: Los Work Items que ya existían antes de esta feature MUST seguir siendo visibles, editables y movibles sin ninguna acción manual, con los campos nuevos vacíos.

**Permisos, auditoría y aislamiento**

- **FR-019**: Editar cualquiera de los campos nuevos, crear valores de área o iteración y usar "Cerrar" MUST requerir el mismo permiso que editar un Work Item en 007-roles-permissions (Owner y Miembro sí, Lector no), sin claves de permiso nuevas. El rechazo por rol MUST comportarse igual que las demás ediciones de Work Item.
- **FR-020**: Todo cambio en un campo nuevo, incluidos el cierre y la reapertura, MUST registrarse en el historial de actividad del Work Item con el campo, el valor anterior y el nuevo (constitución, Estándares de Producto y Datos § Auditoría). El historial MUST mostrarlo de forma legible.
- **FR-021**: Todo acceso a estos campos y a los catálogos de área e iteración MUST verificar la membresía del proyecto (Principio IV). Un valor de catálogo de un proyecto MUST NOT poder asignarse a un Work Item de otro proyecto.

### Key Entities *(include if feature involves data)*

- **Work Item** (extendido): agrega prioridad, severidad, área, iteración, fecha de inicio y fecha objetivo, todos opcionales, y una fecha de cierre calculada por el sistema. Conserva su fecha de creación y de última modificación existentes.
- **Stage/Columna** (extendida): agrega la marca "de cierre" (sí/no), que por defecto es "no".
- **Prioridad / Severidad**: listas fijas y ordenadas de cuatro niveles (Crítica, Alta, Media, Baja), iguales en todos los proyectos. No son entidades editables.
- **Área / Iteración**: dos catálogos separados de valores con nombre, propios de cada proyecto, que crecen al crear valores en línea. Se eliminan junto con su proyecto.
- **Registro de actividad**: sin cambios de forma. Agrega eventos para los cambios de campos nuevos y para cierre/reapertura.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede asignar prioridad, severidad, área, iteración y fecha objetivo a un Work Item desde su detalle en menos de 30 segundos en total.
- **SC-002**: En un tablero con al menos 100 Work Items, un miembro identifica a simple vista cuáles tienen prioridad Crítica y cuáles están vencidos, sin abrir ninguno.
- **SC-003**: El 100 % de los Work Items que existían antes de la feature siguen abriéndose, editándose y moviéndose sin errores después de ella.
- **SC-004**: El 100 % de los cambios en campos nuevos (incluidos cierre y reapertura) aparecen en el historial del Work Item con valor anterior y nuevo.
- **SC-005**: Ningún intento de un Lector de modificar un campo nuevo, marcar una columna de cierre o usar "Cerrar", ya sea desde la interfaz o con una petición directa, cambia un dato.
- **SC-006**: En todo momento, el 100 % de los Work Items en columnas de cierre tienen fecha de cierre y ninguno fuera de ellas la tiene, sin importar si llegaron arrastrando, con "Cerrar" o marcando la columna.
- **SC-007**: Mostrar los campos nuevos no hace que abrir el tablero o el detalle se note más lento que antes de la feature.

## Assumptions

- **Valores de prioridad y severidad**: se eligió una escala única de cuatro niveles para ambas, común en herramientas de referencia como Azure DevOps. Es suficiente para ordenar y filtrar en 009 y evita la ambigüedad de escalas numéricas.
- **Cierre por columna**: el product owner eligió atar el cierre a columnas de cierre, con un botón "Cerrar" como atajo que mueve el Work Item. Así el tablero es la única fuente de verdad. No se detecta la columna "Done" por nombre, porque los nombres son libres y en cualquier idioma.
- **Permisos**: se reutiliza el permiso de edición de Work Item de 007 para los campos y "Cerrar", y el de edición del tablero para marcar columnas de cierre. Los campos nuevos son atributos del Work Item, y una clave aparte no resolvería ninguna necesidad confirmada (Principio VI).
- **Fecha de inicio**: se incluye junto a la fecha objetivo porque una futura vista de calendario necesita un intervalo (inicio a objetivo) para ubicar un Work Item. Es opcional y no afecta a quien solo use la fecha objetivo.
- **Fecha de última modificación**: el sistema ya la registra. Solo se muestra, sin costo de producto adicional.
- **Visualización en tarjeta**: solo prioridad y fecha objetivo, para mantener el tablero legible (Principio I). El resto vive en el detalle y, más adelante, en la vista de tabla (009).
- **Fuera de alcance**: vistas de lista y tabla (spec 009), vista de calendario, campos personalizados, configurar las listas de prioridad/severidad, filtrar u ordenar el tablero por los campos nuevos, notificaciones o recordatorios por vencimiento, fechas u horas de iteración (una iteración es solo un nombre en esta feature), renombrar o eliminar áreas e iteraciones, editar la fecha de cierre a mano y un botón "Reabrir".
- **Dependencias**: 004-work-items (edición de campos y catálogo de tags como patrón), 006-work-item-detail-view (dónde se editan), 007-roles-permissions (matriz de permisos) y el historial de actividad existente.
