# Feature Specification: Filtros del Tablero y Catálogos por MCP

**Feature Branch**: `014-board-filters-mcp-catalogs`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Filtros en el tablero (asignado y tags) + catálogos por MCP (KAN-4). Agregar filtros al tablero (Board): 'Asignado a' con checkboxes de cada miembro del proyecto (selección múltiple) y 'Tags' con checkboxes de las tags del proyecto (selección múltiple), leídas del catálogo del proyecto (con su color, en el orden manual). Reusar las reglas de filtro de List/Table donde aplique. Incluido también: catálogos por MCP (los agentes hoy no pueden ver ni poner colores): 1) herramienta nueva de solo lectura list_catalogs: tags (con color), áreas y tamaños del proyecto en su orden manual, para que el agente reutilice valores existentes en vez de inventar variantes; 2) color al crear/asignar tags: que 'tags' en create_work_items / update_work_item acepte también { name, color } además del nombre, para que una tag nueva nazca con color; 3) herramienta set_tag_color para cambiar el color de una tag existente (paleta fija); 4) esquemas estrictos en todas las herramientas MCP: un campo desconocido debe dar error claro en vez de ignorarse en silencio (hoy un 'color' suelto se descarta sin avisar). Fuera de alcance para agentes: renombrar y borrar valores de catálogo (borrar afecta a todas las tareas; lo hace una persona). Actualizar la lista fija de herramientas en los tests y el README § AI agents. Nota: los clientes MCP guardan la lista de herramientas; tras el deploy hay que reconectar el conector para ver los cambios."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filtrar el tablero por asignado y por tags (Priority: P1)

Un miembro abre el tablero de un proyecto con muchas tarjetas y quiere ver solo lo suyo, o solo lo de ciertas personas, o solo lo marcado con ciertas tags ("Bug", "UI"). Sobre el tablero hay dos filtros: **Assignee** y **Tags**, cada uno un botón que abre una lista de casillas de selección múltiple. El tablero oculta las tarjetas que no coinciden y deja visibles todas las columnas, para que el flujo de trabajo se siga leyendo igual.

**Why this priority**: Es el pedido principal de KAN-4. Hoy el tablero no se puede filtrar y hay que ir a List o Table, perdiendo la vista por columnas. Los catálogos de 013-project-catalogs se hicieron en parte para alimentar estos filtros.

**Independent Test**: En un proyecto con tres miembros y tags de colores, marcar "Assigned to me" en Assignee y verificar que solo quedan mis tarjetas en todas las columnas; marcar además la tag "Bug" y verificar que solo quedan mis tarjetas con "Bug"; recargar la página y verificar que el filtro sigue aplicado; pulsar "Clear filters" y verificar que vuelven todas.

**Acceptance Scenarios**:

1. **Given** el tablero de un proyecto, **When** abro el filtro Assignee, **Then** veo casillas para "Assigned to me", para cada miembro actual del proyecto y para "Unassigned", y puedo marcar varias a la vez.
2. **Given** el tablero, **When** abro el filtro Tags, **Then** veo una casilla por cada tag del catálogo del proyecto, con su color y en el orden manual del catálogo, más "None" (sin tags), y puedo marcar varias.
3. **Given** dos personas marcadas en Assignee, **When** se aplica el filtro, **Then** se ven las tarjetas asignadas a cualquiera de las dos (O dentro de un filtro).
4. **Given** una persona marcada en Assignee y una tag marcada en Tags, **When** se aplica, **Then** solo se ven las tarjetas que cumplen ambos filtros (Y entre filtros).
5. **Given** tags "Bug" y "UI" marcadas, **When** se aplica, **Then** se ven las tarjetas que tienen al menos una de las dos.
6. **Given** un filtro activo que deja una columna sin tarjetas visibles, **When** miro el tablero, **Then** la columna sigue visible, con su nombre, e indica que sus tarjetas están ocultas por el filtro.
7. **Given** un filtro activo, **When** miro el encabezado de cada columna, **Then** el contador indica cuántas tarjetas se ven sobre el total de la columna.
8. **Given** filtros activos, **When** pulso "Clear filters" o quito un filtro desde su etiqueta de filtro activo, **Then** el tablero vuelve a mostrar las tarjetas correspondientes al instante.
9. **Given** un Lector, **When** abre el tablero, **Then** puede usar los filtros igual que un Owner o Miembro (filtrar solo lee).

---

### User Story 2 - Filtros que se conservan y se comparten (Priority: P2)

Los filtros del tablero quedan en la dirección de la página, como los de List y Table: recargar, usar "atrás/adelante" del navegador o compartir el enlace conserva lo filtrado. Al cambiar entre Board, List y Table, los filtros de asignado y tags se conservan.

**Why this priority**: Sin esto, cada vez que se abre una tarjeta y se vuelve, o se recarga, habría que volver a filtrar. Mantener la misma regla que List/Table evita que cada vista se comporte distinto.

**Independent Test**: En el tablero, filtrar por la tag "UI"; abrir una tarjeta y volver al tablero; verificar que el filtro sigue; cambiar a Table y verificar que está filtrada por "UI"; volver a Board y verificar lo mismo.

**Acceptance Scenarios**:

1. **Given** un filtro aplicado en el tablero, **When** recargo la página o copio y abro el enlace en otra pestaña, **Then** el tablero se abre con el mismo filtro.
2. **Given** un filtro de asignado y de tags en el tablero, **When** cambio a List o Table, **Then** esas vistas se abren con los mismos filtros de asignado y tags.
3. **Given** List o Table con filtros de asignado, tags y otros (p. ej. prioridad), **When** cambio a Board, **Then** el tablero conserva los de asignado y tags; los demás no aplican al tablero y no afectan lo que muestra.
4. **Given** un enlace con un miembro que ya no está en el proyecto o una tag que ya no existe, **When** lo abro, **Then** el tablero no falla; ese valor aparece como filtro activo que puedo quitar, igual que en List/Table.
5. **Given** que abro una tarjeta desde el tablero filtrado y cierro su detalle, **When** vuelvo al tablero, **Then** el filtro sigue aplicado.

---

### User Story 3 - Trabajar en el tablero con un filtro activo (Priority: P2)

Con un filtro activo, un Owner o Miembro puede seguir arrastrando tarjetas entre columnas, reordenándolas y creando Work Items, sin que las tarjetas ocultas se desordenen ni se pierdan de vista sin aviso.

**Why this priority**: Filtrar para ordenar "lo mío" es un uso típico; si mover tarjetas con un filtro activo rompiera el orden de las ocultas, el filtro sería peligroso de usar.

**Independent Test**: Con un filtro de asignado activo, reordenar dos tarjetas visibles de una columna y moverlas a otra; quitar el filtro y verificar que las tarjetas ocultas mantienen su orden relativo y que la tarjeta movida quedó junto a la tarjeta visible sobre la que se soltó.

**Acceptance Scenarios**:

1. **Given** un filtro activo, **When** arrastro una tarjeta visible a otra columna, **Then** se mueve igual que sin filtro (con el mismo cierre o reapertura si la columna es de cierre).
2. **Given** un filtro activo, **When** reordeno una tarjeta respecto de otra visible, **Then** queda junto a esa tarjeta, y las tarjetas ocultas conservan su orden relativo.
3. **Given** un filtro activo, **When** muevo una tarjeta hacia arriba o abajo con el teclado, **Then** salta a la posición de la tarjeta visible vecina (no a una oculta, que no produciría ningún cambio visible).
4. **Given** un filtro activo, **When** creo un Work Item que no coincide con el filtro, **Then** se crea normalmente y se me avisa que quedó oculto por los filtros activos.
5. **Given** un filtro activo, **When** edito una tarjeta de modo que deja de coincidir (p. ej. cambio su asignado), **Then** al volver al tablero ya no se ve, igual que cualquier otra que no coincide.

---

### User Story 4 - Un agente de IA conoce y reutiliza los catálogos (Priority: P1)

Un agente de IA conectado por MCP que va a crear o editar Work Items puede consultar primero los catálogos del proyecto — tags con su color, áreas y tamaños, en su orden manual — para reutilizar los valores que ya existen en vez de inventar variantes ("frontend", "Front-end", "FE"). Al crear una tag nueva, puede darle un color de la paleta; y puede cambiar el color de una tag existente.

**Why this priority**: Hoy un agente no tiene forma de ver el catálogo, así que crea variantes, y toda tag que crea nace gris sin que pueda corregirlo. Esto ensucia justamente los catálogos que 013 hizo administrables y los filtros de esta feature.

**Independent Test**: Con un agente conectado, pedir la lista de catálogos y verificar que devuelve las tags con su color, las áreas y los tamaños en el orden de la pantalla de catálogos; crear un Work Item con la tag nueva "Mobile" en verde y verificar que la tag aparece en verde en la app; cambiar con el agente el color de "Mobile" a azul y verificar el cambio en la app.

**Acceptance Scenarios**:

1. **Given** un agente de un usuario miembro del proyecto (con cualquier rol, incluido Lector), **When** pide los catálogos del proyecto, **Then** recibe las tags (nombre y color), las áreas y los tamaños, cada uno en el orden manual del catálogo, y la lista de colores válidos de la paleta.
2. **Given** un agente de un Owner o Miembro, **When** crea o edita un Work Item indicando una tag nueva con un color de la paleta, **Then** la tag se crea en el catálogo con ese color y queda asignada.
3. **Given** un agente que indica una tag que ya existe (sin distinguir mayúsculas) con un color distinto al suyo, **When** crea o edita el Work Item, **Then** se asigna la tag existente sin cambiar su color, y la respuesta muestra el color real de la tag.
4. **Given** un agente que indica las tags solo por nombre, como hasta ahora, **When** crea o edita un Work Item, **Then** el comportamiento es el mismo de antes (las nuevas nacen grises).
5. **Given** un agente de un Owner o Miembro, **When** cambia el color de una tag existente a otro color de la paleta, **Then** el color cambia en toda la app, igual que si lo hubiera cambiado la persona en la pantalla de catálogos.
6. **Given** un color que no está en la paleta, **When** el agente intenta usarlo, **Then** recibe un error claro con la lista de colores válidos y no se cambia nada.
7. **Given** un agente de un Lector, **When** intenta cambiar el color de una tag, **Then** recibe el rechazo por rol (el mismo que para cualquier otra escritura) y no se cambia nada.
8. **Given** un agente, **When** intenta cambiar el color de una tag que no existe en el proyecto, **Then** recibe "no encontrado" y no se crea nada.

---

### User Story 5 - Errores claros ante campos desconocidos (Priority: P2)

Si un agente envía a cualquier herramienta un campo que esa herramienta no conoce (un nombre mal escrito, un campo que no existe, un "color" suelto donde no corresponde), recibe un error claro que nombra el campo, en lugar de que el campo se descarte en silencio y el agente crea que hizo algo que no hizo.

**Why this priority**: Hoy un campo desconocido se ignora sin aviso: el agente reporta éxito al usuario y el dato nunca se guardó. Es un fallo silencioso que socava la confianza en los agentes.

**Independent Test**: Llamar a update_work_item con un campo inexistente ("colour": "red") junto con un cambio válido de título; verificar que la llamada falla con un error que nombra "colour" y que el título no cambió.

**Acceptance Scenarios**:

1. **Given** cualquier herramienta, **When** un agente envía un campo que no forma parte de su entrada, **Then** la llamada se rechaza con un error de validación que nombra el campo desconocido, y no se modifica ningún dato.
2. **Given** una herramienta que recibe una lista de elementos (p. ej. varios Work Items a crear), **When** un elemento trae un campo desconocido, **Then** el error indica también qué elemento lo trae, y no se crea ninguno.
3. **Given** una llamada con solo campos conocidos, **When** se ejecuta, **Then** funciona exactamente como antes.

---

### Edge Cases

- **Proyecto sin tags**: el filtro Tags muestra solo "None" y un texto de que el proyecto aún no tiene tags; no falla.
- **Proyecto personal (un solo miembro)**: el filtro Assignee sigue disponible ("Assigned to me", la persona y "Unassigned").
- **Miembro que sale del proyecto con un filtro en el enlace**: sus Work Items ya quedaron sin asignar (011-agent-access-mcp); su valor en el enlace no coincide con nada y se muestra como filtro activo removible.
- **Tag renombrada o eliminada mientras el tablero está filtrado por ella**: al recargar, el filtro por el nombre viejo no coincide con nada y se muestra como filtro activo removible, igual que en List/Table (Edge Cases de 013-project-catalogs).
- **Tag con el mismo nombre en distinta capitalización en el enlace** ("ui" frente a "UI"): coincide, como en List/Table.
- **Todas las columnas quedan sin tarjetas visibles**: el tablero lo indica y ofrece "Clear filters"; las columnas se siguen mostrando.
- **Arrastrar con el filtro activo a una columna sin tarjetas visibles pero con tarjetas ocultas**: la tarjeta va al final de la columna, como al soltar sobre una columna vacía.
- **Tablero sin columnas**: no hay filtros que mostrar; se ve el estado vacío actual.
- **El agente manda la misma tag dos veces en una lista**, una como nombre y otra con color (o con dos colores distintos): se asigna una sola vez; si la tag es nueva, se crea con el primer color indicado.
- **El agente manda una tag nueva con color y otra persona la crea en gris al mismo tiempo**: queda una sola tag (sin distinguir mayúsculas), con el color de quien la creó primero; la respuesta muestra el color real.
- **Campo conocido con valor inválido** (p. ej. una prioridad inexistente): sigue dando el error de validación de siempre; esta feature solo agrega el caso del campo desconocido.
- **Cliente MCP con la lista de herramientas vieja en caché**: no ve las herramientas nuevas hasta reconectar el conector; las herramientas existentes siguen funcionando.

## Requirements *(mandatory)*

### Functional Requirements

**Filtros del tablero**

- **FR-001**: El tablero MUST ofrecer dos filtros de selección múltiple: **Assignee** y **Tags**, visibles sobre las columnas, cada uno con casillas en un panel desplegable, con el mismo aspecto y comportamiento de teclado que los filtros de List/Table (009-work-item-views).
- **FR-002**: El filtro Assignee MUST ofrecer "Assigned to me", cada miembro actual del proyecto y "Unassigned" — las mismas opciones que el filtro de asignado de List/Table (FR-008 de 011-agent-access-mcp).
- **FR-003**: El filtro Tags MUST ofrecer cada tag del catálogo del proyecto con su color y en el orden manual del catálogo (FR-017 y FR-019 de 013-project-catalogs), más "None" para los Work Items sin tags.
- **FR-004**: Las reglas de coincidencia MUST ser las mismas que en List/Table: los valores dentro de un filtro se combinan con O, los dos filtros entre sí con Y; las tags se comparan sin distinguir mayúsculas; "None" coincide con un Work Item sin tags y "Unassigned" con uno sin asignado.
- **FR-005**: El tablero MUST ocultar las tarjetas que no coinciden y MUST seguir mostrando todas las columnas en su orden, aunque queden sin tarjetas visibles; una columna sin tarjetas visibles por el filtro MUST indicarlo.
- **FR-006**: Con un filtro activo, el contador de cada columna MUST mostrar las tarjetas visibles sobre el total de la columna; el tablero MUST ofrecer "Clear filters" y mostrar cada valor filtrado como filtro activo que se puede quitar individualmente.
- **FR-007**: Filtrar MUST estar disponible para todos los roles, incluido el Lector, y MUST NOT modificar ningún dato: es solo una forma de ver el tablero.
- **FR-008**: Aplicar o quitar un filtro MUST reflejarse al instante, sin esperar al servidor (Principio I).

**Persistencia de los filtros**

- **FR-009**: Los filtros del tablero MUST guardarse en la dirección de la página con el mismo formato que usan List/Table para asignado y tags, de modo que recargar, navegar atrás/adelante y compartir el enlace conserven el filtro. Cambiar un filtro MUST NOT agregar una entrada nueva al historial del navegador por cada cambio (misma regla que List/Table).
- **FR-010**: Al cambiar de vista, los filtros de asignado y tags MUST conservarse en ambos sentidos entre Board, List y Table. Los filtros de List/Table que el tablero no tiene (estado, columna, prioridad, etc.) MUST NOT afectar lo que muestra el tablero.
- **FR-011**: Un valor del enlace que no corresponde a ningún miembro actual o tag del catálogo MUST NOT producir un error: MUST mostrarse como filtro activo removible y aplicarse con las mismas reglas que en List/Table.

**Trabajar con el filtro activo**

- **FR-012**: Con un filtro activo, mover y reordenar tarjetas MUST seguir funcionando con los mismos permisos y efectos que sin filtro (cierre/reapertura, historial). Reordenar respecto de una tarjeta visible MUST dejar la tarjeta junto a ella, y las tarjetas ocultas MUST conservar su orden relativo.
- **FR-013**: Mover una tarjeta arriba o abajo con los controles de teclado MUST saltar a la posición de la tarjeta visible vecina.
- **FR-014**: Crear un Work Item con un filtro activo que no lo incluye MUST crearlo normalmente y MUST avisar al usuario que quedó oculto por los filtros activos.

**Catálogos para agentes de IA**

- **FR-015**: Las herramientas MCP MUST incluir una herramienta de solo lectura que devuelva los catálogos de un proyecto: las tags con su color, las áreas y los tamaños, cada lista en el orden manual del catálogo, más la lista de colores de la paleta. MUST estar disponible para cualquier miembro del proyecto, Lector incluido, y MUST verificar la membresía como toda lectura (Principio IV).
- **FR-016**: Al crear o editar Work Items, cada tag de la lista MUST poder indicarse como un nombre (como hoy) o como un nombre con un color de la paleta. El color MUST aplicarse solo si la tag se crea en ese momento; si la tag ya existe (sin distinguir mayúsculas), MUST asignarse la existente sin cambiar su color.
- **FR-017**: La respuesta de crear y de editar Work Items MUST incluir las tags resultantes de cada Work Item con su color real, para que el agente vea qué quedó guardado.
- **FR-018**: Las herramientas MCP MUST incluir una herramienta para cambiar el color de una tag existente del proyecto, identificada por su nombre (sin distinguir mayúsculas), a otro color de la paleta. MUST requerir el mismo permiso que cambiar el color desde la pantalla de catálogos (Owner y Miembro, FR-007 de 013-project-catalogs) y MUST tener exactamente el mismo efecto (FR-033 de 011-agent-access-mcp). Es un cambio del catálogo: no genera entradas en el historial de los Work Items (igual que en 013).
- **FR-019**: Un color que no está en la paleta MUST rechazarse con un error que liste los colores válidos, sin cambiar nada.
- **FR-020**: Los agentes MUST NOT poder renombrar, eliminar ni reordenar valores de catálogo, ni crear valores sueltos fuera de un Work Item: eso queda solo en la interfaz. Esta feature amplía FR-021 de 013-project-catalogs (los agentes ahora ven los catálogos y pueden cambiar el color de una tag) y la lista de capacidades de FR-023 de 011-agent-access-mcp; nada más de la gestión del proyecto se abre a los agentes.

**Entradas estrictas de las herramientas**

- **FR-021**: Toda herramienta MCP MUST rechazar una llamada que incluya un campo que no forma parte de su entrada — también dentro de los elementos de una lista — con un error de validación que nombre el campo (y el elemento, si aplica), sin modificar ningún dato.
- **FR-022**: Las llamadas que solo usan campos conocidos MUST comportarse exactamente como antes de esta feature.

**Transversales**

- **FR-023**: Las instrucciones que el servidor MCP da a los agentes MUST recomendar consultar los catálogos antes de crear o asignar tags, áreas y tamaños, para reutilizar los valores existentes.
- **FR-024**: La documentación del producto (sección de agentes de IA) MUST describir las herramientas nuevas y avisar que, tras actualizar la instancia, hay que reconectar el conector MCP para que el cliente vea la lista de herramientas nueva.
- **FR-025**: Toda la interfaz nueva MUST estar en inglés, como el resto de la app.

### Key Entities *(include if feature involves data)*

- **Filtro del tablero**: selección de asignados y de tags aplicada a la vista del tablero. No se guarda en la base de datos: vive en la dirección de la página, con el mismo formato que los filtros de List/Table. Ninguna entidad nueva se almacena.
- **Catálogos del proyecto (vista para agentes)**: las tags (nombre y color), áreas y tamaños de un proyecto en su orden manual, más la paleta de colores. Es una lectura de los catálogos de 013-project-catalogs, no una entidad nueva.
- **Tag con color indicado**: forma en que un agente indica una tag al crear o editar un Work Item — un nombre, o un nombre con un color de la paleta que solo se usa si la tag se crea.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede reducir el tablero a "sus tarjetas con la tag X" en menos de 10 segundos y con no más de 4 clics desde que lo abre.
- **SC-002**: Aplicar o quitar un filtro actualiza el tablero de forma percibida como inmediata (sin esperas visibles) en un tablero de 500 Work Items.
- **SC-003**: El 100% de los filtros aplicados en el tablero se conserva al recargar, al abrir y cerrar una tarjeta y al cambiar a List o Table y volver.
- **SC-004**: Tras mover o reordenar tarjetas con un filtro activo, el 100% de las tarjetas ocultas conserva su orden relativo.
- **SC-005**: Un agente puede consultar los catálogos y crear un Work Item con una tag nueva en el color deseado sin intervención de una persona, y el color se ve en la app en el 100% de los casos.
- **SC-006**: El 100% de las llamadas de agentes con un campo desconocido reciben un error que nombra ese campo; ninguna se reporta como exitosa con el campo descartado.
- **SC-007**: Ninguna llamada de agente puede renombrar, eliminar ni reordenar un valor de catálogo, y un Lector no puede cambiar el color de una tag por ningún medio.

## Assumptions

- "Asignado a" se entiende como el campo Assignee de 011-agent-access-mcp; las opciones son las mismas que ya ofrece List/Table, incluidas "Assigned to me" y "Unassigned", y "Tags" incluye "None" como en List/Table, para que las tres vistas se comporten igual ("reusar las reglas de filtro de List/Table").
- El tablero solo suma los filtros de asignado y tags; filtros de prioridad, estado, búsqueda, etc. en el tablero quedan fuera de alcance (siguen en List/Table).
- Los filtros se aplican sobre los Work Items que el tablero ya tiene cargados, sin volver a pedirlos al servidor.
- Los filtros no son una preferencia guardada por usuario: viven solo en la dirección de la página, como en List/Table (FR-009 de 009-work-item-views).
- El aviso al crear un Work Item oculto por el filtro es un mensaje breve y no bloqueante.
- Indicar un color para una tag que ya existe no la recolorea: recolorear es una acción explícita con su propia herramienta, para que editar un Work Item nunca cambie en silencio cómo se ve una tag en todo el proyecto.
- Crear valores de catálogo desde un agente sigue ocurriendo solo al asignarlos a un Work Item, como hoy (FR-021 de 013-project-catalogs).
- Hacer estrictas las entradas de las herramientas podría romper a un agente que hoy manda campos de más; se acepta, porque es justamente el fallo silencioso que se quiere eliminar.
- Dependencias: 003-kanban-board y 004-work-items (tablero, mover y reordenar), 007-roles-permissions (permisos), 009-work-item-views (reglas y formato de filtros), 011-agent-access-mcp (servidor MCP, asignado, historial con agente), 013-project-catalogs (catálogos, colores y orden manual).
