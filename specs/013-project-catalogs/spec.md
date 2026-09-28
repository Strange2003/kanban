# Feature Specification: Catálogos por Proyecto — Tags con Color, Áreas y Tamaño

**Feature Branch**: `013-project-catalogs`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Catálogos por proyecto: Tags (con color), Áreas y Tamaño (KAN-13). La interfaz se construye en inglés, como el resto de la app. Cada proyecto define y gestiona sus propios valores de Tags, Áreas y Tamaño. Pantalla de gestión: en los ajustes del proyecto, una pantalla con tres secciones — Tags, Areas y Size. Las tres se gestionan igual: crear, renombrar y eliminar; las Tags además tienen color. En el sidebar, bajo el nombre de cada proyecto, hay una opción anidada "Tags" (por ahora la única; más adelante se agregarán otras) que lleva a esa pantalla, donde también se ven Areas y Size. Areas y Size no tienen entrada propia en el sidebar. Tags: nombre + color (sin icono). El color se elige de una paleta fija legible en modo claro y oscuro. Las tags que ya existen quedan en gris por defecto. En la tarjeta del tablero aparece una línea fina bajo la tarjeta con los colores de sus tags (p. ej. azul | rojo | verde). En el detalle del Work Item cada tag se muestra con fondo de su color. Areas y Size: solo nombre, sin color. Ejemplos de área: backend, frontend, Usuarios, Profesores. Ejemplos de tamaño: S, M, L, XL. Size se obtiene RECONVIRTIENDO el campo Iteration existente (misma forma: catálogo por proyecto, un solo valor por Work Item); los valores de iteración existentes pasan a ser tamaños. Iteration deja de existir como concepto. Las tags existentes tipo "tamaño M" no se migran; el usuario las ajusta a mano. Campo para asignar en el detalle del Work Item (igual para Tags, Area y Size): filtra las opciones del catálogo del proyecto mientras se escribe (escribir "ba" muestra "Backend"); si el texto no existe, ofrece "Create new", que abre un pop-up rápido para confirmar el nombre (y en tags elegir el color) y lo crea sin salir del Work Item. Eliminar un valor en uso: se quita de todos los Work Items donde esté, dejando registro en el historial (activity) de cada uno. Renombrar se refleja en todos los Work Items. Permisos: gestionan los catálogos todos los que pueden editar (Owner y Member); el Viewer solo lee. Beneficio: los filtros del tablero (tarea futura KAN-4) y los filtros de List/Table leen directamente el catálogo del proyecto. Reemplaza el candidato del README "Managing catalogs"."

## Clarifications

### Session 2026-09-25

- Q: ¿Cómo se ordenan los valores de Size (y de los catálogos en general)? → A: Orden manual. En la pantalla de catálogos el usuario define el orden de los valores de cada sección (p. ej. S, M, L, XL). Ese orden se usa en los selectores, en los filtros y al ordenar la Table por Area o Size.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gestionar los catálogos del proyecto (Priority: P1)

Un Owner o Miembro entra, desde la opción **Tags** anidada bajo el proyecto en el sidebar, a la pantalla de catálogos de ese proyecto. Ahí ve tres secciones — **Tags**, **Areas** y **Size** — y en cada una puede crear valores nuevos, renombrarlos y eliminarlos. Hoy los catálogos solo crecen (FR-007 de 008-work-item-fields y la gestión de tags excluida en 004-work-items); esta historia los vuelve administrables.

**Why this priority**: Es el núcleo del pedido: sin un lugar donde administrar los valores, un error de tipeo o un valor obsoleto queda para siempre en el catálogo y en los filtros. Las demás historias (color, creación rápida) se apoyan en esta pantalla.

**Independent Test**: En un proyecto con tags, áreas y tamaños en uso, abrir la pantalla desde el sidebar; crear "Frontend" en Areas, renombrar la tag "bakend" a "Backend" y eliminar el tamaño "XXL"; verificar que los Work Items muestran el nombre nuevo, que los que tenían "XXL" quedan sin tamaño y que su historial registra la eliminación.

**Acceptance Scenarios**:

1. **Given** un proyecto al que pertenezco, **When** miro el sidebar, **Then** bajo el nombre del proyecto aparece la opción anidada "Tags", y al pulsarla llego a la pantalla de catálogos del proyecto con las secciones Tags, Areas y Size.
2. **Given** la pantalla de catálogos, **When** un Owner o Miembro crea un valor en cualquiera de las tres secciones, **Then** el valor aparece en la lista y queda disponible de inmediato para los Work Items del proyecto.
3. **Given** una tag, área o tamaño asignado a varios Work Items, **When** un Owner o Miembro lo renombra, **Then** todos esos Work Items muestran el nombre nuevo en el tablero, el detalle, List y Table.
4. **Given** un valor asignado a varios Work Items, **When** un Owner o Miembro lo elimina, **Then** el sistema avisa cuántos Work Items lo usan y pide confirmación; al confirmar, el valor desaparece del catálogo, se quita de todos esos Work Items y el historial de cada uno registra que se quitó.
5. **Given** un Lector, **When** abre la pantalla de catálogos, **Then** ve los valores (y el color de cada tag) pero no puede crear, renombrar, cambiar colores ni eliminar.
6. **Given** la sección Size con S, M, XL, L, **When** un Owner o Miembro mueve L antes de XL, **Then** el orden queda S, M, L, XL en la pantalla de catálogos, en el selector del Work Item, en los filtros y al ordenar la Table por Size.
7. **Given** un valor en un proyecto, **When** alguien intenta renombrarlo con el nombre de otro valor ya existente en el mismo catálogo (sin distinguir mayúsculas), **Then** el sistema lo rechaza con un mensaje claro.

---

### User Story 2 - Tags con color en tablero y detalle (Priority: P1)

Cada tag tiene un color elegido de una paleta fija. En el tablero, cada tarjeta muestra una línea fina en su borde inferior dividida en tramos con los colores de sus tags (p. ej. azul | rojo | verde), para reconocer de un vistazo de qué tipo es cada Work Item. En el detalle del Work Item, cada tag se muestra con fondo de su color.

**Why this priority**: Es la mejora visible del pedido y lo que hace que las tags sirvan para escanear el tablero sin abrir cada tarjeta.

**Independent Test**: Asignar a un Work Item tres tags de colores distintos; verificar la línea de tres tramos bajo su tarjeta y las tres tags con su fondo de color en el detalle; cambiar el color de una tag en la pantalla de catálogos y verificar que la tarjeta y el detalle reflejan el nuevo color.

**Acceptance Scenarios**:

1. **Given** una tag, **When** un Owner o Miembro le elige un color de la paleta en la pantalla de catálogos, **Then** el color se guarda y se refleja en todas las tarjetas y detalles que la usan.
2. **Given** un Work Item con tags de colores azul, rojo y verde, **When** se muestra en el tablero, **Then** su tarjeta tiene una línea fina inferior con un tramo de cada color, en el mismo orden en que se muestran sus tags.
3. **Given** un Work Item sin tags, **When** se muestra en el tablero, **Then** su tarjeta no muestra la línea.
4. **Given** un Work Item con tags, **When** se abre su detalle, **Then** cada tag aparece con fondo de su color y texto legible, tanto en modo claro como oscuro.
5. **Given** las tags que existían antes de esta feature, **When** se muestran por primera vez, **Then** tienen el color gris por defecto.

---

### User Story 3 - Buscar o crear un valor desde el Work Item (Priority: P2)

Al asignar una tag, área o tamaño en el detalle del Work Item, el campo filtra las opciones del catálogo del proyecto mientras se escribe (escribir "ba" muestra "Backend"). Si lo escrito no existe, el campo ofrece **"Create new"**, que abre un pop-up rápido para confirmar el nombre — y, en tags, elegir el color — y crea el valor sin salir del Work Item.

**Why this priority**: Hoy ya se puede crear un valor escribiéndolo, pero sin confirmación es fácil llenar el catálogo de variantes con errores de tipeo, y una tag creada así no tendría color. El pop-up corrige ambas cosas sin obligar a ir a la pantalla de catálogos.

**Independent Test**: En el detalle de un Work Item, escribir "ba" en Tags y verificar que solo aparecen las tags que contienen "ba"; escribir "Mobile" (que no existe), elegir "Create new", elegir el color verde y confirmar; verificar que "Mobile" queda asignada, en verde, y aparece en la pantalla de catálogos.

**Acceptance Scenarios**:

1. **Given** un catálogo con "Backend", "Frontend" y "Bugs", **When** escribo "ba" en el campo, **Then** solo se ofrece "Backend" (coincidencia por contenido, sin distinguir mayúsculas).
2. **Given** un texto que no coincide exactamente con ningún valor del catálogo, **When** lo escribo, **Then** además de las coincidencias parciales se ofrece "Create new".
3. **Given** "Create new" en Tags, **When** lo elijo, **Then** se abre un pop-up con el nombre precargado y editable y la paleta de colores (gris preseleccionado); al confirmar, la tag se crea con ese color y queda asignada al Work Item.
4. **Given** "Create new" en Area o Size, **When** lo elijo, **Then** el pop-up solo pide confirmar el nombre; al confirmar, el valor se crea y queda asignado.
5. **Given** el pop-up abierto, **When** lo cancelo, **Then** no se crea nada y vuelvo al campo con lo que había escrito.
6. **Given** un texto que coincide con un valor existente salvo por mayúsculas ("BACKEND"), **When** lo confirmo, **Then** se asigna el valor existente con su escritura original y no se ofrece "Create new".

---

### User Story 4 - Size en lugar de Iteration (Priority: P2)

El campo **Iteration** del Work Item se reconvierte en **Size**: un catálogo por proyecto con un solo valor por Work Item (p. ej. S, M, L, XL). Todo lugar donde hoy aparece Iteration — detalle, List, Table, filtros, orden y las herramientas de agentes de IA — pasa a llamarse Size. Los valores de iteración que ya existan pasan a ser tamaños.

**Why this priority**: El product owner no usa iteraciones y sí necesita el tamaño, que hoy simula con tags como "tamaño M". Reutilizar el campo evita sumar un campo más a la app.

**Independent Test**: Con un proyecto que tenía iteraciones asignadas, verificar que tras la migración esos valores aparecen como Size en el detalle, en List y Table (columna, filtro y orden) y en la sección Size de la pantalla de catálogos, y que la palabra "Iteration" ya no aparece en la interfaz.

**Acceptance Scenarios**:

1. **Given** un Work Item con la iteración "Sprint 12" antes de esta feature, **When** se abre después, **Then** muestra el tamaño "Sprint 12" y la sección Size del catálogo contiene "Sprint 12" (el usuario puede renombrarlo o eliminarlo).
2. **Given** la Table, **When** la veo, **Then** tiene una columna Size (en lugar de Iteration) que se puede ordenar y filtrar como antes lo era Iteration.
3. **Given** un agente de IA conectado por MCP, **When** lee o edita un Work Item, **Then** el campo se llama Size en lugar de Iteration.
4. **Given** el historial de un Work Item con cambios de iteración anteriores, **When** se consulta, **Then** esos cambios se muestran como cambios de Size.

---

### Edge Cases

- **Eliminar un valor que ningún Work Item usa**: se elimina directamente tras la confirmación normal; no hay historial que registrar.
- **Eliminar un valor en uso en muchos Work Items**: la eliminación y los registros de historial ocurren juntos; si algo falla, no queda ningún Work Item a medio actualizar.
- **Filtros guardados en la URL que apuntan a un valor eliminado o renombrado** (List/Table): el filtro con un valor que ya no existe se ignora sin error; un valor renombrado deja de coincidir y el usuario vuelve a elegirlo.
- **Dos miembros crean el mismo valor a la vez** (mismo nombre, sin distinguir mayúsculas): el segundo reutiliza el existente, como hoy (FR-006 de 008-work-item-fields).
- **Renombrar a un nombre vacío o solo espacios**: se rechaza.
- **Un miembro edita un Work Item mientras otro elimina una de sus tags**: al guardar el Work Item, la tag eliminada no se vuelve a crear en silencio; el valor ya no está disponible y el usuario ve el estado actual.
- **Muchas tags en una tarjeta**: la línea fina reparte el ancho entre todos los colores; con tags del mismo color, los tramos contiguos se ven como uno solo, lo cual es aceptable.
- **Tags con nombre tipo "tamaño M"**: no se tocan; el usuario las elimina o renombra a mano desde la pantalla de catálogos.
- **Proyecto sin ningún valor en un catálogo**: la sección muestra un estado vacío que invita a crear el primero (para Owner y Miembro).

## Requirements *(mandatory)*

### Functional Requirements

**Pantalla de catálogos**

- **FR-001**: Cada proyecto MUST tener una pantalla de catálogos, dentro de sus ajustes, con tres secciones: Tags, Areas y Size, cada una con la lista de valores del catálogo de ese proyecto.
- **FR-002**: El sidebar MUST mostrar, bajo el nombre de cada proyecto, una opción anidada "Tags" que lleva a la pantalla de catálogos de ese proyecto. Areas y Size MUST NOT tener entrada propia en el sidebar; se acceden desde la misma pantalla. El sidebar MUST quedar preparado para sumar más opciones anidadas en el futuro sin rehacerlo.
- **FR-003**: En cada sección, un Owner o Miembro MUST poder crear, renombrar, eliminar y reordenar valores. En la sección Tags MUST poder, además, cambiar el color de cada tag.
- **FR-003a**: Cada catálogo MUST tener un orden manual definido por el usuario en la pantalla de catálogos, con una forma de reordenar usable sin arrastrar (p. ej. mover arriba/abajo). Los valores nuevos (creados desde la pantalla o desde el Work Item) MUST agregarse al final. Los valores existentes antes de esta feature MUST quedar inicialmente en orden alfabético. Reordenar es un cambio del catálogo y no genera entradas en el historial de los Work Items.
- **FR-004**: Los nombres de un catálogo MUST ser únicos dentro del proyecto sin distinguir mayúsculas, y no vacíos. Crear o renombrar con un nombre repetido MUST rechazarse con un mensaje claro (en la pantalla de catálogos) o reutilizar el valor existente (al asignar desde el Work Item, FR-013).
- **FR-005**: Renombrar un valor MUST reflejarse en todos los Work Items que lo usan, en todas las vistas (tablero, detalle, List, Table) y en lo que ven los agentes de IA. Renombrar un valor es un cambio del catálogo, no de cada Work Item, y no genera entradas en el historial de los Work Items.
- **FR-006**: Eliminar un valor MUST pedir confirmación indicando cuántos Work Items lo usan. Al confirmar, el valor MUST quitarse de todos esos Work Items y del catálogo en una sola operación, y el historial de cada Work Item afectado MUST registrar que se le quitó ese valor, quién lo hizo y a través de qué agente de IA si aplica (Estándares de Producto y Datos § Auditoría; FR-034 de 011-agent-access-mcp).
- **FR-007**: Crear, renombrar, cambiar color y eliminar valores MUST estar permitido a Owner y Miembro y rechazado al Lector, con el mismo comportamiento de rechazo por rol que las demás ediciones (007-roles-permissions). El Lector MUST poder ver la pantalla de catálogos en modo lectura.

**Color de las tags**

- **FR-008**: Cada tag MUST tener exactamente un color, elegido de una paleta fija definida por el producto (no un selector libre), de unos 10 colores, uno de ellos gris. Cada color de la paleta MUST ser legible como fondo de la tag y como línea en la tarjeta, en modo claro y oscuro.
- **FR-009**: Las tags existentes antes de esta feature y las creadas sin elegir color MUST quedar en gris.
- **FR-010**: La tarjeta de cada Work Item en el tablero MUST mostrar, si tiene tags, una línea fina en su borde inferior dividida en tramos iguales, uno por tag, con el color de cada una y en el mismo orden en que se listan sus tags. Sin tags, no hay línea. La línea MUST ser decorativa: los nombres de las tags siguen disponibles para lectores de pantalla.
- **FR-011**: El detalle del Work Item MUST mostrar cada tag con fondo de su color y texto con contraste suficiente.

**Asignar desde el Work Item**

- **FR-012**: Los campos Tags, Area y Size del detalle del Work Item MUST filtrar las opciones del catálogo del proyecto (en su orden manual) mientras se escribe, por coincidencia de contenido sin distinguir mayúsculas.
- **FR-013**: Si lo escrito no coincide exactamente (sin distinguir mayúsculas) con ningún valor, el campo MUST ofrecer "Create new". Si coincide, MUST asignarse el valor existente con su escritura original.
- **FR-014**: "Create new" MUST abrir un pop-up sobre el Work Item, sin navegar a otra pantalla, con el nombre precargado y editable; en Tags, MUST incluir además la paleta de colores con gris preseleccionado. Confirmar MUST crear el valor en el catálogo del proyecto y asignarlo al Work Item; cancelar MUST no crear nada. Crear desde aquí requiere el mismo permiso que FR-007.

**Size en lugar de Iteration**

- **FR-015**: El campo Iteration del Work Item MUST reconvertirse en Size: mismo comportamiento (catálogo por proyecto, como máximo un valor por Work Item, creado en línea), con otro nombre. El concepto Iteration MUST desaparecer de la interfaz, de List/Table (columna, filtro y orden), de las herramientas de agentes de IA y de la documentación del producto.
- **FR-016**: Los valores de iteración existentes MUST conservarse como valores de Size, asignados a los mismos Work Items, sin pérdida de datos. El historial de cambios de iteración anteriores MUST mostrarse como cambios de Size.
- **FR-017**: El orden manual de cada catálogo (FR-003a) MUST usarse en la pantalla de catálogos, en las opciones de los campos del Work Item, en los filtros de List/Table y al ordenar la Table por Area o Size (reemplaza el orden alfabético que hoy usa FR-006 de 009-work-item-views para esas columnas). Los vacíos siguen yendo al final. Las tags de un Work Item se muestran en el mismo orden que hoy.
- **FR-018**: Las tags existentes que representan tamaños (p. ej. "tamaño M") MUST NOT migrarse automáticamente.

**Transversales**

- **FR-019**: Los filtros de List/Table (y los futuros filtros del tablero) MUST ofrecer los valores del catálogo del proyecto, incluidos sus colores en el caso de las tags, reflejando al instante las altas, cambios y bajas.
- **FR-020**: Toda lectura y cambio de catálogos MUST verificar la membresía del proyecto (Principio IV). Un valor de catálogo de un proyecto MUST NOT poder verse, renombrarse, eliminarse ni asignarse desde otro proyecto.
- **FR-021**: Los agentes de IA MUST ver el color de cada tag al leer Work Items y MUST poder asignar tags, áreas y tamaños por nombre como hoy. La gestión de catálogos (renombrar, eliminar, cambiar color) desde agentes queda fuera de alcance.
- **FR-022**: Toda la interfaz nueva MUST estar en inglés, como el resto de la app.

### Key Entities *(include if feature involves data)*

- **Tag**: valor del catálogo de tags de un proyecto. Nombre único en el proyecto (sin distinguir mayúsculas) y un color de la paleta (gris por defecto). Un Work Item puede tener varias.
- **Area**: valor del catálogo de áreas de un proyecto. Solo nombre. Un Work Item tiene como máximo una.
- **Size**: valor del catálogo de tamaños de un proyecto; reemplaza a Iteration conservando sus valores. Solo nombre. Un Work Item tiene como máximo uno.
- **Paleta de colores de tags**: conjunto fijo de colores definido por el producto, cada uno con su variante legible en modo claro y oscuro. No es editable por el usuario.
- **Entrada de historial por eliminación de valor**: registro en el historial de cada Work Item al que se le quitó una tag, área o tamaño porque el valor se eliminó del catálogo; indica el valor quitado, quién y a través de qué agente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede corregir un nombre mal escrito de una tag, área o tamaño en menos de 30 segundos desde el tablero, y el cambio se ve en el 100% de los Work Items que lo usan.
- **SC-002**: Al eliminar un valor en uso, el 100% de los Work Items afectados queda sin ese valor y con una entrada en su historial; ninguno queda con el valor eliminado.
- **SC-003**: Un miembro distingue el tipo de un Work Item por los colores de su tarjeta sin abrirla; los colores de la paleta son legibles en modo claro y oscuro (contraste de texto sobre fondo de al menos 4.5:1 en el detalle).
- **SC-004**: Crear un valor nuevo desde el Work Item, incluido elegir el color de una tag, toma menos de 15 segundos y no saca al usuario del Work Item.
- **SC-005**: Después de la migración, el 100% de los valores de iteración existentes aparece como Size en los mismos Work Items, y la palabra "Iteration" no aparece en ninguna pantalla.
- **SC-006**: Un Lector no puede modificar ningún catálogo por ningún medio (interfaz ni agente de IA).

## Assumptions

- La pantalla de catálogos es una página propia dentro de los ajustes del proyecto (a la par de la página de ajustes actual), no un modal. Lleva a ella tanto la opción "Tags" del sidebar como un acceso desde los ajustes del proyecto.
- Solo se agrega la opción "Tags" al sidebar; el nombre del proyecto sigue llevando al tablero como hoy.
- "Todos los que pueden editar" se entiende como Owner y Miembro; el Lector solo lee, según la matriz de roles de 007-roles-permissions y la constitución.
- La paleta tiene alrededor de 10 colores con nombre (p. ej. gris, rojo, naranja, amarillo, verde, verde azulado, azul, índigo, violeta, rosa); los tonos exactos se definen en el diseño.
- El orden de las tags de un Work Item (en la línea de la tarjeta y en el detalle) es el mismo en que se listan hoy.
- Renombrar no deja rastro en el historial de cada Work Item (es un cambio del catálogo); las entradas antiguas del historial conservan el nombre que tenía el valor en ese momento.
- La gestión de catálogos desde agentes de IA queda fuera de alcance (las herramientas MCP no administran el proyecto, FR-023 de 011-agent-access-mcp).
- Los filtros del tablero (KAN-4) son una feature aparte; esta spec solo garantiza que los catálogos estén disponibles para ellos.
- Dependencias: 004-work-items (tags), 007-roles-permissions (permisos), 008-work-item-fields (área e iteración), 009-work-item-views (filtros y orden de List/Table), 011-agent-access-mcp (herramientas de agentes e historial con agente), 012-work-item-discussion (layout del detalle y pestaña History).
