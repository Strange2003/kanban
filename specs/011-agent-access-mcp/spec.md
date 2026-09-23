# Feature Specification: Acceso para Agentes de IA y Asignación de Work Items

**Feature Branch**: `011-agent-access-mcp`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Acceso para agentes de IA vía MCP (Model Context Protocol). La app expone un servidor MCP remoto (HTTP) al que un agente de IA (Claude Code, Claude Desktop, claude.ai u otro cliente MCP compatible) se conecta en nombre de un usuario, autorizado mediante OAuth desde la propia app (pantalla de consentimiento tras iniciar sesión). El agente actúa como el usuario: puede operar sobre proyectos personales y compartidos exactamente con los permisos del rol del usuario en cada proyecto (roles de 007-roles-permissions); si el usuario pierde acceso a un proyecto, el agente también. El usuario puede ver sus aplicaciones/agentes conectados y revocar el acceso en cualquier momento, con efecto inmediato. Capacidades del agente: listar proyectos (propios y compartidos), ver el tablero (columnas y Work Items), buscar Work Items (para verificar cuáles ya existen antes de crear), listar miembros, crear Work Items (incluso varios a la vez), editar campos, mover de columna/estado, asignar a miembros, relacionar (padre/hijo). Todo cambio hecho por el agente queda en el registro de actividad del Work Item marcado como hecho vía agente. Ejemplos de uso: "ve al kanban y en el proyecto X genera tales tareas y verifica cuáles ya están"; "en el proyecto compartido UMG ASISTENCIA crea tareas, asígnalas a personas y cambia estados". Decisiones abiertas a clarificar: si al autorizar se puede elegir solo lectura vs lectura y escritura; si se puede limitar el acceso a proyectos concretos; si el agente puede eliminar Work Items/columnas; si el agente puede administrar miembros/roles del proyecto."

## Clarifications

### Session 2026-09-22

- Q: Hoy los Work Items no tienen un campo "asignado a" (solo "stakeholder" en texto libre, FR-009 de 004-work-items). ¿Cómo se asigna un Work Item a una persona? → A: Se elimina el campo stakeholder y se reemplaza por **Asignado**: un selector con los miembros del proyecto. Se puede asignar desde la interfaz y pidiéndoselo al agente. Entra en esta misma feature.
- Q: ¿El agente recibe siempre acceso a todos los proyectos del usuario con los permisos de su rol, o el usuario puede elegir "solo lectura" y/o limitarlo a proyectos concretos al autorizar? → A: Siempre acceso completo: todos los proyectos del usuario, con los permisos de su rol en cada uno. Para limitarlo, se revoca.
- Q: Además de crear, editar, mover y relacionar, ¿qué más puede hacer el agente? → A: También puede eliminar Work Items y gestionar columnas (crear, renombrar, reordenar, eliminar y marcar/desmarcar de cierre). No puede administrar el proyecto: invitar, cancelar invitaciones, remover miembros, cambiar roles, transferir la propiedad, renombrar, editar la descripción, eliminar ni salir del proyecto quedan solo en la interfaz.
- Q: ¿Qué pasa con los textos de stakeholder que ya existen? → A: No hay stakeholders en uso; el campo se elimina sin preservar valores.
- Q: ¿La persona asignada recibe algún aviso? → A: Sí: una notificación dentro de la app, igual que cuando te invitan a un proyecto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Asignar un Work Item a un miembro del proyecto (Priority: P1)

Un Owner o Miembro abre un Work Item y, en el campo **Asignado**, elige de una lista desplegable a una de las personas que integran el proyecto. La persona asignada recibe una notificación dentro de la app, se ve en la tarjeta del tablero, en el detalle y en las vistas de Lista y Tabla, y se puede filtrar por ella (por ejemplo, "asignados a mí"). El campo reemplaza al antiguo "stakeholder" de texto libre.

**Why this priority**: Hoy el producto no puede decir quién es responsable de una tarea, que es una capacidad básica de cualquier tablero colaborativo y una de las acciones que el usuario quiere delegar al agente ("asígnalas a personas"). Las capacidades de escritura del agente (Historia 4) dependen de que este campo exista.

**Independent Test**: En un proyecto compartido con tres miembros, asignar un Work Item a cada uno desde el detalle, verificar que cada persona recibe su notificación, que la tarjeta y las vistas muestran a la persona asignada, filtrar la Tabla por "asignados a mí", y quitar la asignación.

**Acceptance Scenarios**:

1. **Given** un Owner o Miembro en el detalle de un Work Item, **When** abre el campo Asignado, **Then** ve un desplegable con todos los miembros actuales del proyecto (nombre y foto o iniciales) y una opción "Sin asignar".
2. **Given** ese desplegable, **When** elige a un miembro, **Then** el Work Item queda asignado a esa persona y el cambio se registra en el historial con el valor anterior y el nuevo.
3. **Given** un Work Item asignado, **When** un Owner o Miembro elige "Sin asignar", **Then** el Work Item queda sin persona asignada y el cambio se registra en el historial.
4. **Given** un Work Item asignado, **When** cualquier miembro mira el tablero, **Then** la tarjeta muestra de forma compacta a la persona asignada (foto o iniciales, con su nombre al pasar el cursor).
5. **Given** la Tabla y la Lista de un proyecto, **When** un miembro las abre, **Then** la Tabla muestra la columna Asignado (en lugar de stakeholder) y ambas vistas permiten filtrar por persona asignada, por "Sin asignar" y por "Asignados a mí".
6. **Given** un Lector, **When** abre el detalle de un Work Item, **Then** ve a la persona asignada pero no puede cambiarla.
7. **Given** un Work Item asignado a una persona, **When** esa persona sale o es removida del proyecto, **Then** el Work Item queda sin asignar y el historial lo registra.
8. **Given** un miembro, **When** otra persona (o el agente de otra persona) le asigna un Work Item, **Then** recibe una notificación dentro de la app, en el mismo lugar que las invitaciones, que dice quién le asignó qué Work Item (ID visible y título) y en qué proyecto, e indica si se hizo a través de un agente.
9. **Given** esa notificación, **When** la abre, **Then** llega al detalle del Work Item y la notificación queda como leída.
10. **Given** un miembro, **When** se asigna un Work Item a sí mismo, o alguien le quita una asignación, **Then** no recibe ninguna notificación.

---

### User Story 2 - Conectar un agente de IA a la cuenta (Priority: P1)

Un usuario quiere que su asistente de IA trabaje en su Kanban. Desde el asistente agrega la dirección de su instancia como herramienta conectada. El asistente lo envía a la pantalla de inicio de sesión de la propia instancia; tras iniciar sesión, ve una pantalla de consentimiento que dice qué agente pide acceso y qué podrá hacer, y decide autorizar o rechazar. Si autoriza, el agente queda conectado a su cuenta sin que el usuario tenga que copiar ni pegar claves.

**Why this priority**: Es la puerta de entrada del agente. Sin una conexión autorizada por el usuario no existe ninguna capacidad del agente, y es donde se juega la seguridad: nadie obtiene acceso a los datos de una cuenta sin que su dueño lo apruebe de forma explícita.

**Independent Test**: Desde un cliente de agente compatible, agregar la instancia, completar el inicio de sesión y el consentimiento, y comprobar que el agente puede leer la lista de proyectos del usuario. Repetir rechazando el consentimiento y comprobar que el agente no obtiene acceso.

**Acceptance Scenarios**:

1. **Given** un usuario con cuenta en la instancia, **When** conecta un agente y autoriza en la pantalla de consentimiento, **Then** el agente queda conectado y puede operar en nombre de ese usuario.
2. **Given** la pantalla de consentimiento, **When** el usuario la lee, **Then** ve el nombre del agente que pide acceso y que el agente podrá leer y modificar todos sus proyectos con sus mismos permisos en cada uno, incluido eliminar Work Items y columnas, pero no administrar miembros ni proyectos.
3. **Given** la pantalla de consentimiento, **When** el usuario elige rechazar, **Then** el agente no obtiene ningún acceso.
4. **Given** un usuario sin sesión iniciada, **When** su agente inicia la conexión, **Then** primero debe iniciar sesión en la instancia (con cualquiera de los métodos existentes) antes de ver el consentimiento.
5. **Given** un agente sin autorización, o con una autorización revocada, **When** hace cualquier consulta, **Then** el sistema la rechaza sin devolver ningún dato.

---

### User Story 3 - El agente consulta proyectos y verifica lo que ya existe (Priority: P1)

Con el agente conectado, el usuario le pide cosas como "en el proyecto X, dime qué tareas ya hay sobre facturación" o "¿qué tiene asignado Ana en UMG ASISTENCIA?". El agente lista los proyectos del usuario (personales y compartidos), ubica el proyecto, lee sus columnas y Work Items, busca los que coinciden con un texto o con una persona asignada y ve los miembros del proyecto. Con eso puede responder y comparar lo que el usuario quiere crear con lo que ya existe.

**Why this priority**: Leer es la base de todo trabajo útil del agente y el paso previo obligatorio a "verifica cuáles ya están". Por sí sola ya entrega valor (consultas, resúmenes, estado de un proyecto) con riesgo mínimo, porque no cambia datos.

**Independent Test**: Con un agente conectado a una cuenta miembro de un proyecto personal y de uno compartido, pedirle la lista de proyectos, el tablero de cada uno, una búsqueda por texto, una búsqueda por persona asignada y la lista de miembros, y comparar con lo que la cuenta ve en la interfaz.

**Acceptance Scenarios**:

1. **Given** un usuario con proyectos personales y compartidos, **When** el agente pide la lista de proyectos, **Then** recibe exactamente los proyectos donde el usuario es miembro, cada uno con su identificador, nombre, si es Personal o Compartido y el rol del usuario en él.
2. **Given** un proyecto del usuario, **When** el agente pide su tablero, **Then** recibe las columnas en orden (indicando cuáles son de cierre) y los Work Items de cada columna con su ID visible, título, persona asignada y campos principales.
3. **Given** un proyecto, **When** el agente busca Work Items por texto, por persona asignada, por columna o por estado abierto/cerrado, **Then** recibe los Work Items que cumplen todos los criterios, con su ID visible y su columna.
4. **Given** un Work Item, **When** el agente pide su detalle, **Then** recibe todos sus campos, sus relaciones (padre, hijos, relacionados) y su historial de actividad.
5. **Given** un proyecto, **When** el agente pide sus miembros, **Then** recibe el nombre, el rol y un identificador de cada miembro, con el que puede asignar Work Items.
6. **Given** un proyecto donde el usuario no es miembro, **When** el agente intenta leerlo, **Then** el sistema responde como si no existiera, sin revelar su existencia ni su contenido.

---

### User Story 4 - El agente crea, actualiza y organiza el trabajo (Priority: P1)

El usuario le pide al agente "en el proyecto compartido UMG ASISTENCIA crea estas cinco tareas, solo las que no existan, asigna las de backend a Carlos y pon la de login en En curso". El agente crea los Work Items que faltan (varios en una sola operación), edita sus campos, los asigna a miembros del proyecto, los mueve de columna, crea relaciones padre/hijo y, si se lo piden, elimina Work Items o reorganiza las columnas del tablero, siempre dentro de lo que el rol del usuario permite en ese proyecto. Cada cambio queda en el historial marcado como hecho a través del agente.

**Why this priority**: Es el objetivo que motiva la feature: delegar al agente el trabajo repetitivo de cargar, asignar y mover tareas, en proyectos propios y compartidos.

**Independent Test**: Con un agente conectado a una cuenta Miembro de un proyecto compartido, pedirle crear varios Work Items de una vez, asignarlos, moverlos, editarlos, relacionarlos, eliminar uno y crear una columna; comprobar en la interfaz que los cambios aparecen, que el historial los atribuye al usuario vía el agente, y que las reglas del producto se cumplen igual que en la interfaz. Repetir con una cuenta Lector y verificar que todo se rechaza.

**Acceptance Scenarios**:

1. **Given** un usuario Owner o Miembro de un proyecto, **When** el agente crea varios Work Items en una sola operación indicando la columna, **Then** todos se crean al final de esa columna en el orden dado, cada uno con su ID visible, y el agente recibe esos IDs.
2. **Given** una creación de varios Work Items donde uno es inválido (por ejemplo, sin título, o asignado a alguien que no es miembro), **When** el agente la envía, **Then** no se crea ninguno y el agente recibe qué elemento falló y por qué.
3. **Given** un Work Item, **When** el agente edita sus campos (título, descripción, tags, prioridad, severidad, área, iteración, fechas), **Then** se aplican las mismas reglas que en la interfaz (por ejemplo, fecha objetivo no anterior a la de inicio; área e iteración del catálogo del propio proyecto, creándolas si no existen).
4. **Given** un Work Item y un miembro del proyecto, **When** el agente lo asigna a ese miembro o lo deja sin asignar, **Then** el resultado es el mismo que hacerlo desde el desplegable de la Historia 1, incluida la notificación a la persona asignada.
5. **Given** una persona que no es miembro del proyecto, **When** el agente intenta asignarle un Work Item, **Then** el sistema lo rechaza con un mensaje claro y no cambia la asignación.
6. **Given** un Work Item, **When** el agente lo mueve a otra columna, **Then** se comporta igual que arrastrarlo en el tablero, incluido el cierre o la reapertura si la columna es de cierre (008-work-item-fields).
7. **Given** dos Work Items del mismo proyecto, **When** el agente crea o quita una relación padre/hijo o "relacionado con", **Then** se aplican las reglas de 005-work-item-relationships, incluido el rechazo de ciclos.
8. **Given** un Work Item, **When** el agente lo elimina, **Then** se elimina igual que desde la interfaz (sus hijos quedan como Work Items independientes, 005-work-item-relationships).
9. **Given** el tablero de un proyecto, **When** el agente crea, renombra, reordena o marca/desmarca de cierre una columna, o elimina una columna vacía, **Then** el resultado es el mismo que en la interfaz (003-kanban-board y 008-work-item-fields); eliminar una columna con Work Items se rechaza igual que en la interfaz.
10. **Given** cualquier cambio hecho por el agente sobre un Work Item, **When** alguien abre su historial, **Then** ve el cambio atribuido al usuario y marcado como hecho a través de un agente, con el nombre del agente.
11. **Given** un usuario Lector en un proyecto compartido, **When** el agente intenta cualquier cambio en él, **Then** el sistema lo rechaza con un mensaje que explica que el rol del usuario no lo permite, sin cambiar ningún dato.
12. **Given** cualquier usuario, **When** el agente intenta invitar, remover miembros, cambiar roles, transferir la propiedad, renombrar, eliminar o salir del proyecto, **Then** no tiene forma de hacerlo: esas acciones no están disponibles para agentes, aunque el rol del usuario las permita.

---

### User Story 5 - Ver y revocar los agentes conectados (Priority: P2)

El usuario abre, dentro de la app, una sección de agentes conectados. Ve cada agente al que dio acceso, cuándo lo autorizó y cuándo lo usó por última vez. Con un clic revoca el acceso de cualquiera, y a partir de ese momento ese agente ya no puede leer ni cambiar nada.

**Why this priority**: Es el control que hace aceptable dar acceso completo a un agente: el usuario siempre puede retirarlo. No bloquea el uso básico (Historias 2 a 4 funcionan sin esta pantalla), pero es un requisito antes de considerar la feature terminada.

**Independent Test**: Conectar un agente, verlo en la lista de agentes conectados, revocarlo, y comprobar que su siguiente consulta es rechazada.

**Acceptance Scenarios**:

1. **Given** un usuario con uno o más agentes conectados, **When** abre la sección de agentes conectados, **Then** ve cada uno con su nombre, la fecha de autorización y la de último uso.
2. **Given** un agente conectado, **When** el usuario revoca su acceso y confirma, **Then** la siguiente consulta de ese agente es rechazada, incluso si estaba a mitad de una tarea.
3. **Given** un agente revocado, **When** el usuario quiere volver a usarlo, **Then** debe pasar otra vez por el consentimiento (Historia 2).
4. **Given** un usuario sin agentes conectados, **When** abre la sección, **Then** ve un estado vacío que explica para qué sirve y cómo conectar uno, incluida la dirección de la instancia que debe darle a su asistente.

---

### Edge Cases

- ¿Qué pasa si el usuario pierde acceso a un proyecto (lo remueven, sale, o el proyecto se elimina) mientras su agente trabaja en él? La siguiente acción del agente sobre ese proyecto MUST rechazarse como si el proyecto no existiera, igual que para el usuario.
- ¿Qué pasa si al usuario le cambian el rol de Miembro a Lector mientras el agente trabaja? La siguiente acción de modificación MUST rechazarse con el mensaje de rol no permitido (007-roles-permissions, FR-003); las lecturas siguen funcionando.
- ¿Qué pasa si hay dos proyectos con el mismo nombre visibles para el usuario? La lista de proyectos MUST incluir un identificador único y la clasificación Personal/Compartido de cada uno, y las acciones MUST indicar el proyecto por ese identificador; el sistema MUST NOT elegir un proyecto a partir de un nombre ambiguo.
- ¿Qué pasa si dos miembros de un proyecto tienen el mismo nombre? El desplegable de Asignado MUST distinguirlos (por ejemplo, mostrando también su email a quienes pueden verlo, o su foto), y el agente asigna por el identificador del miembro, nunca por nombre.
- ¿Qué pasa si se asigna un Work Item a alguien justo cuando esa persona sale del proyecto? La asignación MUST rechazarse (la persona ya no es miembro) o quedar sin asignar; nunca MUST quedar un Work Item asignado a alguien que no es miembro.
- ¿Qué pasa si se asigna un Work Item a un Lector? Está permitido: el Lector es miembro del proyecto y puede ser responsable de una tarea aunque no pueda editarla.
- ¿Qué pasa si una persona asignada elimina su cuenta? Sus Work Items quedan sin asignar.
- ¿Qué pasa si el agente crea un Work Item que ya existe con el mismo título? El sistema no impide títulos repetidos (igual que en la interfaz); verificar duplicados es trabajo del agente usando la búsqueda (Historia 3).
- ¿Qué pasa si el agente usa un ID visible de Work Item (`PREFIX-N`) de otro proyecto? MUST rechazarse como inexistente; un Work Item solo se identifica dentro de un proyecto donde el usuario es miembro.
- ¿Qué pasa si el agente intenta mover a una columna que ya no existe, o editar un Work Item que otro miembro eliminó? MUST recibir un error claro que diga qué no se encontró, sin cambios parciales.
- ¿Qué pasa si el usuario elimina su cuenta? Todas las autorizaciones de sus agentes MUST dejar de funcionar.
- ¿Qué pasa si un agente hace una cantidad anormal de operaciones en poco tiempo (por ejemplo, un bucle)? El sistema MUST limitar la velocidad de operaciones por conexión de agente y responder con un error que indique esperar, sin afectar el uso normal de la app desde la interfaz.
- ¿Qué pasa si el agente pide un tablero o una búsqueda con cientos de Work Items? MUST poder obtener todos los resultados (completos o por páginas); el sistema MUST NOT truncar resultados en silencio.
- ¿Qué pasa si el agente envía un texto que parece una instrucción dentro de un título o descripción? Se guarda como texto plano, igual que desde la interfaz (004-work-items); el sistema no interpreta el contenido.

## Requirements *(mandatory)*

### Campo Asignado

- **FR-001**: Cada Work Item MUST tener un campo **Asignado**, opcional, que contiene a lo sumo un miembro actual de su proyecto. Un Work Item nuevo se crea sin asignar, salvo que quien lo crea indique a quién asignarlo.
- **FR-002**: El campo stakeholder (FR-009 de 004-work-items) MUST eliminarse del producto: del detalle, de la creación de Work Items, de la Tabla (FR-005 de 009-work-item-views) y de cualquier otro lugar donde aparezca. Lo reemplaza el campo Asignado.
- **FR-003**: Al habilitar esta feature, los valores de stakeholder existentes se descartan junto con el campo, sin traspasarse a otro lugar (no hay stakeholders en uso; ver Clarifications). Todos los Work Items existentes quedan sin asignar.
- **FR-004**: En el detalle de un Work Item, el campo Asignado MUST editarse con un desplegable que liste a todos los miembros actuales del proyecto (Owner, Miembros y Lectores) con su nombre y foto o iniciales, más la opción "Sin asignar". Editarlo MUST requerir el mismo permiso que editar un Work Item en 007-roles-permissions (Owner y Miembro sí, Lector no).
- **FR-005**: El sistema MUST rechazar asignar un Work Item a alguien que no es miembro actual de su proyecto, sea cual sea el origen de la acción.
- **FR-006**: Cuando una persona deja de ser miembro de un proyecto (sale, es removida o elimina su cuenta), todos los Work Items de ese proyecto asignados a ella MUST quedar sin asignar, y cada uno MUST registrarlo en su historial.
- **FR-007**: La tarjeta del tablero MUST mostrar de forma compacta a la persona asignada (foto o iniciales, con el nombre visible al pasar el cursor o al enfocarla). Los Work Items sin asignar no muestran nada.
- **FR-008**: La Tabla (009-work-item-views) MUST mostrar la columna Asignado en lugar de stakeholder y permitir ordenar por ella (por nombre; los vacíos al final, como las demás columnas). La Tabla y la Lista MUST ofrecer un filtro por persona asignada, con uno o varios miembros, la opción "Sin asignar" y un atajo "Asignados a mí", combinado con los demás filtros y reflejado en la dirección de la página (FR-007 y FR-009 de 009-work-item-views). La Lista MUST mostrar también a la persona asignada en cada fila.
- **FR-009**: Todo cambio del campo Asignado, incluido quitar la asignación, MUST registrarse en el historial de actividad del Work Item con el valor anterior y el nuevo, mostrando nombres legibles (constitución, Estándares de Producto y Datos § Auditoría).
- **FR-010**: Al crear un Work Item desde la interfaz, crear sigue requiriendo solo el título (FR-017 de 008-work-item-fields); el Work Item queda sin asignar y se asigna después desde el detalle.

### Notificaciones de asignación

- **FR-011**: Cuando un Work Item se asigna a una persona (al crearlo o después, desde la interfaz o desde un agente), esa persona MUST recibir una notificación dentro de la app, en el mismo panel y con el mismo comportamiento que las notificaciones de invitación (FR-006 de 001-accounts-invitations). No se envían correos.
- **FR-012**: La notificación MUST decir quién hizo la asignación, el ID visible y el título del Work Item y el nombre del proyecto, e indicar si se hizo a través de un agente (con el nombre del agente). Abrirla MUST llevar al detalle del Work Item y marcarla como leída; el usuario MUST poder marcarla como leída sin abrirla.
- **FR-013**: MUST NOT generarse una notificación cuando una persona se asigna a sí misma (directamente o con su propio agente), cuando se quita una asignación, ni cuando un Work Item queda sin asignar porque su asignado dejó el proyecto (FR-006). Si el Work Item se elimina o el destinatario pierde acceso al proyecto, la notificación MUST dejar de llevar al Work Item y mostrar que ya no está disponible, sin revelar su contenido actual.

### Conexión y autorización de agentes

- **FR-014**: La instancia MUST exponer un punto de conexión para agentes de IA que siga un estándar abierto de conexión de herramientas para agentes, de modo que cualquier cliente de agente compatible pueda usarlo, no uno en particular (Principio V de la constitución).
- **FR-015**: Todo acceso de un agente MUST estar autorizado por el dueño de la cuenta mediante un flujo de consentimiento estándar: el usuario inicia sesión en la propia instancia (con los métodos existentes, 001-accounts-invitations) y aprueba de forma explícita. El usuario MUST NOT tener que copiar, pegar ni ver ninguna clave o secreto para conectar un agente.
- **FR-016**: La pantalla de consentimiento MUST mostrar el nombre del agente que pide acceso y explicar que podrá leer y modificar todos los proyectos del usuario con sus mismos permisos en cada uno, incluido eliminar Work Items y columnas, y que no podrá administrar miembros ni proyectos. MUST ofrecer rechazar con la misma facilidad que autorizar.
- **FR-017**: El acceso otorgado a un agente MUST ser siempre completo: todos los proyectos del usuario (actuales y futuros), con los permisos de su rol en cada uno y dentro de las capacidades de esta spec. No hay alcances parciales (solo lectura o por proyecto); para limitar a un agente, el usuario lo revoca (FR-035).
- **FR-018**: El sistema MUST rechazar sin devolver datos toda consulta de un agente sin autorización válida (inexistente, vencida o revocada).
- **FR-019**: Una autorización MUST pertenecer a un único usuario y a un único agente; un agente autorizado por un usuario MUST NOT poder actuar como otro usuario.

### Permisos y aislamiento

- **FR-020**: El agente MUST actuar exactamente como el usuario que lo autorizó: cada acción MUST verificar la membresía y el rol vigente del usuario en el proyecto en el momento de ejecutarla, aplicando la misma matriz de permisos de 007-roles-permissions que la interfaz. El agente MUST NOT poder hacer nada que el usuario no pueda hacer.
- **FR-021**: El agente MUST ver únicamente los proyectos donde el usuario es miembro, personales y compartidos. Un proyecto donde no es miembro MUST comportarse como inexistente (Principio IV).
- **FR-022**: Una acción rechazada por el rol MUST devolver al agente un mensaje claro que diga que el rol del usuario no la permite, diferenciable de "no encontrado", sin modificar ningún dato (007-roles-permissions, FR-004).
- **FR-023**: Las capacidades del agente MUST limitarse a las de FR-024 a FR-032. En particular, el agente MUST NOT poder invitar, cancelar invitaciones, remover miembros, cambiar roles, transferir la propiedad, renombrar, editar la descripción, eliminar ni salir de un proyecto, ni crear proyectos, aunque el rol del usuario lo permita; esas acciones quedan solo en la interfaz.

### Capacidades de lectura del agente

- **FR-024**: El agente MUST poder listar los proyectos del usuario, cada uno con su identificador público, nombre, prefijo de IDs, clasificación Personal/Compartido y el rol del usuario.
- **FR-025**: El agente MUST poder leer el tablero de un proyecto: columnas en orden (con su identificador e indicando cuáles son de cierre) y, por columna, sus Work Items en orden con ID visible, título, persona asignada, prioridad, fecha objetivo, estado abierto/cerrado y tags.
- **FR-026**: El agente MUST poder buscar Work Items de un proyecto por texto (título y descripción, sin distinguir mayúsculas) y filtrarlos por persona asignada (incluido "sin asignar"), por columna y por estado abierto/cerrado, combinando los criterios.
- **FR-027**: El agente MUST poder leer el detalle completo de un Work Item por su ID visible: todos sus campos (004-work-items, 008-work-item-fields y el campo Asignado), relaciones e historial de actividad.
- **FR-028**: El agente MUST poder listar los miembros de un proyecto con su identificador, nombre y rol. El email de los miembros y las invitaciones pendientes MUST seguir las mismas reglas de visibilidad que en la interfaz para el rol del usuario (007-roles-permissions, FR-018).

### Capacidades de escritura del agente

- **FR-029**: El agente MUST poder crear uno o varios Work Items en una sola operación, en una columna dada, con título obligatorio y, opcionalmente, descripción, persona asignada, tags y los campos de 008-work-item-fields. La operación de varios MUST ser todo o nada: si un elemento es inválido, no se crea ninguno y se informa cuál falló. MUST aceptar al menos 50 Work Items por operación.
- **FR-030**: El agente MUST poder editar los campos de un Work Item, asignarlo a un miembro del proyecto o dejarlo sin asignar, con las mismas validaciones que la interfaz. Área, iteración y tags se indican por nombre y se resuelven en el catálogo del propio proyecto, creándose si no existen (008-work-item-fields, FR-006); la persona asignada se indica por el identificador del miembro.
- **FR-031**: El agente MUST poder mover un Work Item a otra columna (al final, o en una posición dada), crear y quitar relaciones padre/hijo y "relacionado con" (005-work-item-relationships) y eliminar Work Items (004-work-items), con el mismo efecto que en la interfaz, incluido el cálculo de cierre y reapertura (008-work-item-fields, FR-012 y FR-013).
- **FR-032**: El agente MUST poder crear, renombrar, reordenar y eliminar columnas y marcarlas o desmarcarlas como de cierre, con las mismas reglas que la interfaz (003-kanban-board y 008-work-item-fields), incluido el rechazo a eliminar una columna con Work Items.
- **FR-033**: Toda acción de escritura del agente MUST tener exactamente el mismo resultado en los datos que la acción equivalente desde la interfaz; ninguna regla del producto se salta por venir de un agente.

### Auditoría

- **FR-034**: Todo cambio que un agente haga sobre un Work Item MUST registrarse en su historial de actividad (constitución, Estándares de Producto y Datos § Auditoría), atribuido al usuario y marcado como hecho a través de un agente, con el nombre de ese agente. El historial MUST mostrar esa marca de forma legible en la vista de detalle.

### Gestión de agentes conectados

- **FR-035**: Cada usuario MUST tener en la app una sección de agentes conectados que liste cada agente autorizado con su nombre, fecha de autorización y fecha de último uso, y que muestre la dirección de conexión de la instancia para configurar un asistente.
- **FR-036**: El usuario MUST poder revocar el acceso de cualquier agente conectado, con confirmación; la revocación MUST aplicar a la siguiente consulta de ese agente, sin esperas.
- **FR-037**: Al eliminarse la cuenta de un usuario, todas las autorizaciones de sus agentes MUST dejar de ser válidas.
- **FR-038**: El sistema MUST limitar la velocidad de operaciones por conexión de agente para proteger la instancia, con un error explícito cuando se excede, sin afectar el uso de la app desde la interfaz.

### Key Entities

- **Work Item** (existente): pierde el campo stakeholder y gana **Asignado**, una referencia opcional a un miembro actual de su proyecto.
- **Agente conectado (cliente)**: una aplicación de agente de IA que se registró ante la instancia para poder pedir acceso. Tiene un nombre visible para el usuario en el consentimiento y en la sección de agentes conectados.
- **Autorización de agente**: el permiso que un usuario concreto le dio a un agente concreto. Guarda cuándo se otorgó, cuándo se usó por última vez y si fue revocado. Un usuario puede tener varias; revocar una no afecta a las demás.
- **Notificación** (existente, 001-accounts-invitations): gana un nuevo tipo, **asignación de Work Item**, que referencia el Work Item, el proyecto, quién asignó y, si aplica, el agente.
- **Registro de actividad de Work Item** (existente): se amplía para indicar el usuario que hizo cada cambio y, cuando aplica, el agente a través del cual lo hizo, y para registrar los cambios del campo Asignado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un Owner o Miembro asigna un Work Item a una persona del proyecto desde el detalle en menos de 5 segundos.
- **SC-002**: En un proyecto de hasta 500 Work Items, un miembro encuentra todo lo asignado a sí mismo con un solo filtro en la Tabla o en la Lista.
- **SC-003**: El 100% de las asignaciones hechas por otra persona o por el agente de otra persona generan exactamente una notificación a la persona asignada, visible la próxima vez que abre la app, y ninguna asignación a uno mismo la genera.
- **SC-004**: En el 100% de los casos, ningún Work Item queda asignado a alguien que no es miembro de su proyecto, incluso tras salidas, remociones y eliminaciones de cuenta.
- **SC-005**: Un usuario conecta un agente a su cuenta, desde que lo agrega en su asistente hasta que el agente puede leer sus proyectos, en menos de 2 minutos y sin copiar ninguna clave.
- **SC-006**: El 100% de las acciones que la matriz de 007-roles-permissions niega al rol del usuario son rechazadas también cuando las intenta su agente, con 0 cambios en los datos.
- **SC-007**: El 100% de los intentos de un agente de leer o modificar un proyecto donde el usuario no es miembro fallan sin revelar su existencia, y el 100% de los intentos de administrar miembros o proyectos fallan.
- **SC-008**: Tras revocar un agente, el 100% de sus consultas siguientes son rechazadas.
- **SC-009**: Un usuario puede pedir a su agente "crea estas N tareas en el proyecto X, solo las que no existan, y asígnalas a estas personas" con N ≤ 50, y el agente lo completa correctamente en una sola conversación, sin que el usuario abra la interfaz.
- **SC-010**: El 100% de los cambios hechos por agentes aparecen en el historial del Work Item correspondiente, identificables como hechos a través de un agente.
- **SC-011**: Las consultas de lectura de un agente sobre un proyecto de hasta 500 Work Items responden en menos de 2 segundos.
- **SC-012**: Un usuario puede revocar un agente desde la app en menos de 15 segundos.

## Assumptions

- **Una sola persona asignada**: un Work Item tiene como máximo una persona asignada. Asignar a varias personas es una extensión posible, pero no se confirmó una necesidad (Principio VI).
- **Quién puede ser asignado**: cualquier miembro actual del proyecto, Lectores incluidos. Invitaciones pendientes no cuentan: una persona se puede asignar solo después de aceptar.
- **Notificaciones solo dentro de la app**: igual que las invitaciones, sin correo ni avisos push; se ven la próxima vez que la persona abre o refresca la app (sin tiempo real, decisión de la Fase 1).
- **Destino del stakeholder**: el campo se elimina (no se oculta) para no mantener dos conceptos de responsable. Sus valores no se preservan porque no hay stakeholders en uso (FR-003).
- **Enmiendas a specs anteriores** (para trazabilidad): FR-009 de 004-work-items (stakeholder en texto libre) queda reemplazado por el campo Asignado (FR-001 a FR-013 de esta spec); FR-003 de 006-work-item-detail-view y la matriz de 007-roles-permissions pasan a decir "Asignado" donde decían "stakeholder"; FR-005 y FR-007 de 009-work-item-views ganan la columna y el filtro de Asignado (FR-008 de esta spec).
- **Actuar como el usuario**: el agente no es un miembro más del proyecto ni tiene rol propio; es una forma de acceso del usuario. Por eso no aparece en la lista de miembros, no se le pueden asignar Work Items, no cuenta para la clasificación Personal/Compartido (Principio II) y no necesita ser invitado a proyectos compartidos.
- **Estándar de conexión**: se asume el estándar abierto de conexión de herramientas para agentes que ya soportan los asistentes objetivo (Claude Code, Claude Desktop, claude.ai), con autorización basada en OAuth. La elección concreta y su justificación se documentan en el plan técnico.
- **Registro abierto de agentes**: cualquier agente compatible puede presentarse ante la instancia sin que el operador lo configure antes; el control está en que ningún agente obtiene datos sin el consentimiento del usuario (FR-015).
- **Duración de la autorización**: una autorización dura hasta que el usuario la revoca o elimina su cuenta; la renovación técnica del acceso es transparente y no requiere repetir el consentimiento.
- **Sin tiempo real**: los cambios del agente se ven en el tablero de otras personas la próxima vez que lo abran, igual que los cambios desde la interfaz (decisión de la Fase 1).
- **Descripciones en texto plano**: el agente envía y recibe descripciones en texto plano, como la interfaz (004-work-items).
- **Historial de columnas**: los cambios de columnas hechos por un agente no tienen historial propio (tampoco lo tienen desde la interfaz); solo los efectos sobre Work Items (por ejemplo, cierre al marcar una columna) se registran en el historial de cada Work Item.
- **Fuera de alcance**: agentes que actúan por sí mismos sin un usuario (cuentas de servicio o bots con rol propio); alcances parciales al autorizar (solo lectura o por proyecto); administración de proyectos y miembros por agentes; webhooks o eventos enviados desde la app hacia el agente; claves de API personales como método alternativo de conexión; ejecutar el agente dentro de la app; notificaciones por correo o push; otros tipos de notificación (por ejemplo, cambios en Work Items asignados); múltiples personas asignadas; comentarios en Work Items (aún no existen en el producto).
