# Feature Specification: Animaciones de Carga y un Esqueleto por Página

**Feature Branch**: `015-loading-animations`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "015-loading-animations: Animaciones de carga ("tarjetas que caen") y un esqueleto de carga propio por página. Hoy solo existe app/(workspace)/projects/[projectPublicId]/loading.tsx (BoardSkeleton, 3 columnas fijas), heredado por el detalle de Work Item, List, Table, Settings y Catálogos; My work y los ajustes de cuenta no tienen ninguno. Objetivo: (1) tablero: siluetas de tarjetas que caen en las columnas en bucle mientras carga, con el número real de columnas del proyecto (recordado de la última visita en el navegador; primera visita usa un valor por defecto); al llegar los datos, las tarjetas reales aterrizan escalonadas por columna; (2) un esqueleto con la forma de cada página: detalle de Work Item, List, Table, Settings del proyecto, Catálogos, My work, ajustes de cuenta, con filas/bloques que caen con la misma estética; (3) el esqueleto aparece solo si la carga dura más de ~150 ms; (4) respetar prefers-reduced-motion (versión estática); (5) solo CSS, sin librerías nuevas; la animación nunca alarga la carga (entrada < 500 ms). Fuera de alcance: View Transitions tarjeta→detalle (posible mejora futura). Prototipo aprobado por el usuario: https://claude.ai/artifact/UV4Jswwk9dgt3oXYFL7xNx. Work Item KAN-14."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El tablero "se arma" mientras carga (Priority: P1)

Un miembro abre un proyecto desde la barra lateral. Mientras llegan los datos, en lugar de tres columnas grises fijas ve las columnas del proyecto (tantas como tenía la última vez que lo abrió) y siluetas de tarjetas que caen suavemente en ellas, una y otra vez. Cuando llegan los datos, las tarjetas reales "aterrizan" en su sitio, columna por columna, en menos de medio segundo.

**Why this priority**: Es la pantalla que más se abre y la que el usuario eligió en el prototipo ("Tarjetas que caen"). Convierte la espera en parte de la experiencia (Principio I) y elimina la incoherencia de mostrar 3 columnas a un proyecto que tiene 2 o 5.

**Independent Test**: Abrir un proyecto de 5 columnas, volver a otra página y abrirlo de nuevo con la red ralentizada: el esqueleto muestra 5 columnas con siluetas que caen, y al cargar las tarjetas entran escalonadas. Abrir un proyecto nunca visitado en ese navegador: el esqueleto usa el número por defecto de columnas.

**Acceptance Scenarios**:

1. **Given** un proyecto que abrí antes en este navegador con N columnas, **When** lo vuelvo a abrir y la carga tarda, **Then** el esqueleto del tablero muestra N columnas.
2. **Given** un proyecto que nunca abrí en este navegador, **When** lo abro y la carga tarda, **Then** el esqueleto muestra el número de columnas por defecto (3, el de una plantilla nueva).
3. **Given** el esqueleto del tablero visible, **When** pasa el tiempo, **Then** en cada columna caen siluetas de tarjetas de forma continua, con un pequeño desfase entre columnas, hasta que llegan los datos.
4. **Given** que llegan los datos del tablero, **When** se muestra, **Then** las tarjetas entran con un movimiento corto de "aterrizaje", escalonadas por columna y posición, y toda la entrada termina en menos de 500 ms.
5. **Given** el tablero ya visible, **When** arrastro una tarjeta, creo un Work Item, filtro o se refresca el tablero, **Then** las tarjetas no repiten la animación de entrada.
6. **Given** un proyecto al que se le añadió o quitó una columna, **When** lo vuelvo a abrir, **Then** el esqueleto usa el número de columnas actualizado (el último visto).

---

### User Story 2 - Cada página carga con su propia forma (Priority: P1)

Al abrir el detalle de un Work Item, List, Table, los ajustes del proyecto, los catálogos, "My work" o los ajustes de la cuenta, mientras carga se ve un esqueleto con la forma de esa página — no el del tablero — con la misma estética de bloques que caen.

**Why this priority**: Hoy abrir un Work Item muestra el tablero de 3 columnas, lo que se lee como un error y desorienta. Es el problema que el usuario reportó junto con la idea de las animaciones.

**Independent Test**: Con la red ralentizada, abrir un Work Item desde el tablero: el esqueleto tiene la forma del detalle (título, campos, pestañas), no columnas. Repetir con List, Table, Settings, Catálogos, My work y Connected agents.

**Acceptance Scenarios**:

1. **Given** el tablero, **When** abro un Work Item y la carga tarda, **Then** veo un esqueleto con la forma del detalle del Work Item (encabezado con ID y título, zona de descripción y pestañas, columna de campos).
2. **Given** cualquier vista del proyecto, **When** abro List o Table y la carga tarda, **Then** veo un esqueleto de filas con la forma de esa vista (List: filas con ID y título; Table: encabezado de columnas y filas de celdas).
3. **Given** el proyecto, **When** abro Settings o Catálogos y la carga tarda, **Then** veo un esqueleto con la forma de esa página (secciones y listas), no el del tablero.
4. **Given** cualquier página, **When** abro "My work" o los ajustes de la cuenta (agentes conectados) y la carga tarda, **Then** veo un esqueleto propio en lugar de que la pantalla se quede quieta.
5. **Given** cualquiera de estos esqueletos, **When** está visible, **Then** sus filas o bloques usan la misma estética de "caer y asentarse" que el tablero, de forma escalonada.

---

### User Story 3 - Sin parpadeos ni movimiento no deseado (Priority: P2)

Si una página carga muy rápido, el usuario no ve un destello de esqueleto. Quien tiene activado "reducir movimiento" en su sistema ve esqueletos estáticos y el contenido aparece sin animación de desplazamiento.

**Why this priority**: Un esqueleto que parpadea 50 ms empeora la sensación de velocidad; y la animación no debe molestar a quien pidió menos movimiento (accesibilidad).

**Independent Test**: Sin ralentizar la red, navegar entre páginas: no aparece ningún esqueleto si la carga dura menos de ~150 ms. Con "reducir movimiento" activado y la red ralentizada: los esqueletos se ven quietos y las tarjetas aparecen sin caer.

**Acceptance Scenarios**:

1. **Given** una navegación que carga en menos de ~150 ms, **When** navego, **Then** no se ve el esqueleto (la página anterior o un área vacía hasta el contenido).
2. **Given** una navegación que tarda más de ~150 ms, **When** pasa ese umbral, **Then** el esqueleto aparece con un fundido suave.
3. **Given** "reducir movimiento" activado en el sistema, **When** una página carga, **Then** el esqueleto no tiene movimiento (sin caída ni pulso) y el contenido aparece sin la animación de aterrizaje.

---

### Edge Cases

- **Proyecto sin columnas**: si la última vez tenía 0 columnas, el esqueleto muestra el número por defecto (un tablero vacío no necesita esqueleto de columnas, pero mostrar el por defecto es inofensivo y más simple).
- **Muchas columnas** (p. ej. 15): el esqueleto muestra como máximo un tope razonable (8) para no generar decenas de animaciones; el resto se ve al cargar.
- **Datos del navegador borrados, modo privado o almacenamiento bloqueado**: el esqueleto usa el valor por defecto y nada falla.
- **Recarga completa de la página** (no navegación interna): el esqueleto puede mostrar primero el valor por defecto y ajustarse al número recordado en cuanto el navegador lo lee, sin errores.
- **Varias pestañas**: cada vez que un tablero se muestra, actualiza el número recordado; el último que se vio gana.
- **Un proyecto al que ya no tengo acceso**: el número recordado no revela nada sensible (solo un número por proyecto, en el propio navegador) y la página responde como hoy (no encontrado).
- **Error al cargar**: se muestra la página de error actual; el esqueleto no se queda animando indefinidamente.
- **Detalle de un Work Item abierto desde el tablero, List, Table, My work o la búsqueda**: siempre el esqueleto del detalle, venga de donde venga.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mientras carga el tablero de un proyecto, el sistema MUST mostrar un esqueleto con tantas columnas como tenía ese proyecto la última vez que se mostró su tablero en ese navegador, con un tope de 8; si no hay un número recordado válido, MUST usar 3.
- **FR-002**: Cada vez que el tablero de un proyecto se muestra, el sistema MUST recordar en el navegador su número de columnas, por proyecto. No se guarda nada más que ese número y el identificador público del proyecto, y nada se envía al servidor.
- **FR-003**: El esqueleto del tablero MUST animar siluetas de tarjetas que caen y se asientan en cada columna, en bucle, con desfase entre columnas y entre siluetas, mientras dure la carga.
- **FR-004**: Al mostrarse el tablero tras navegar a él, sus tarjetas y encabezados de columna MUST entrar con una animación corta de aterrizaje, escalonada por columna y posición, que termina en menos de 500 ms en total (incluido el escalonado).
- **FR-005**: La animación de entrada MUST ocurrir solo al montarse el tablero; actualizaciones en sitio (arrastrar, crear, editar, filtrar, refrescar) MUST NOT repetirla.
- **FR-006**: El detalle de un Work Item, List, Table, Settings del proyecto, Catálogos, My work y los ajustes de la cuenta (Connected agents) MUST tener cada uno un esqueleto de carga propio con la forma de su página; ninguna de estas páginas MUST mostrar el esqueleto del tablero.
- **FR-007**: Los bloques y filas de esos esqueletos MUST usar la misma estética del tablero: aparecen cayendo y asentándose de forma escalonada, y mantienen un movimiento suave mientras dure la carga.
- **FR-008**: Todo esqueleto MUST permanecer invisible durante los primeros ~150 ms de carga y aparecer después con un fundido, para que las cargas rápidas no muestren un destello.
- **FR-009**: Con la preferencia del sistema "reducir movimiento" activada, los esqueletos MUST mostrarse sin movimiento y la entrada del contenido MUST NOT usar desplazamientos (a lo sumo un fundido breve).
- **FR-010**: Las animaciones MUST NOT retrasar la aparición del contenido: en cuanto llegan los datos, la página se muestra y el esqueleto desaparece.
- **FR-011**: Los esqueletos MUST usar los colores del tema actual (claro y oscuro) y verse correctos en ambos.
- **FR-012**: Los esqueletos MUST ser ignorados por lectores de pantalla como contenido, anunciando solo que la página está cargando.
- **FR-013**: La funcionalidad MUST NOT añadir dependencias nuevas.

### Key Entities

- **Número de columnas recordado**: valor por proyecto guardado solo en el navegador del usuario (identificador público del proyecto → número de columnas visto la última vez). No es un dato del servidor ni del modelo Cuenta/Proyecto/Tablero; es una preferencia de presentación local, desechable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al volver a abrir un proyecto ya visitado en el mismo navegador, el esqueleto muestra el número correcto de columnas en el 100% de los casos (hasta el tope de 8).
- **SC-002**: Ninguna de las 8 páginas cubiertas (tablero, detalle, List, Table, Settings, Catálogos, My work, Connected agents) muestra el esqueleto de otra página.
- **SC-003**: Las cargas de menos de ~150 ms no muestran esqueleto.
- **SC-004**: La animación de entrada del tablero termina en menos de 500 ms desde que llegan los datos, sin retrasar su aparición.
- **SC-005**: Con "reducir movimiento" activado, ninguna página muestra movimiento en sus esqueletos.
- **SC-006**: El usuario, en una pasada manual, considera que las cargas "se sienten parte de la app" y no un bloqueo (validación cualitativa del product owner sobre el prototipo aprobado).

## Assumptions

- El estilo elegido es "Tarjetas que caen" del prototipo aprobado; los otros estilos (niebla, morph) quedan descartados.
- El número por defecto de columnas es 3, el de un proyecto recién creado sin plantilla; el tope de 8 cubre casi todos los tableros reales y limita el número de elementos animados.
- Recordar el número de columnas en el navegador es suficiente; no se sincroniza entre dispositivos ni se guarda en el servidor (YAGNI, Principio VI).
- La animación de caída de List/Table es por filas; la de las demás páginas, por bloques/secciones. La forma exacta de cada esqueleto sigue el diseño actual de cada página.
- La página de inicio del espacio de trabajo (sin proyecto seleccionado), las páginas de autenticación y las legales no necesitan esqueleto: son estáticas o casi.
- Fuera de alcance: la transición animada tarjeta → detalle (View Transitions) y cualquier animación en páginas que no cargan datos.
