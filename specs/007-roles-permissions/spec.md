# Feature Specification: Roles y Permisos

**Feature Branch**: `007-roles-permissions`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Roles y permisos: definir y hacer cumplir permisos diferenciados dentro de un proyecto. Es la Fase 2, punto 7 del roadmap. Hoy el modelo solo tiene `owner` y `member`, solo el owner puede invitar (FR-009 de 001-accounts-invitations), renombrar/eliminar el proyecto y remover miembros (002-project-spaces), y cualquier miembro puede editar Work Items, board y relaciones (004, 005, 006). Las specs 001, 002, 005 y 006 difirieron explícitamente a esta feature: quién puede invitar (extender ese permiso a otros roles), si existe un rol de solo lectura, y la transferencia de propiedad del proyecto (002 la dejó fuera). La constitución (Estándares de Producto y Datos › Roles) exige al menos owner + miembro invitado, con permisos exactos documentados en la etapa de especificación antes de implementarse, y el Principio IV exige verificar membresía y rol en todo acceso. La spec debe resolver las preguntas abiertas de kanban-app-vision.md §8 sobre roles y permisos (¿todos los miembros pueden invitar? ¿hay rol de solo lectura?), definir la matriz de permisos por rol para cada acción existente (proyecto, miembros, invitaciones, board/columnas, Work Items, relaciones, tags), y respetar el principio II (colaboración sin límites: sin tope de miembros). No incluir vistas adicionales ni campos extendidos (Fase 3)."

## Clarifications

### Session 2026-09-18

- Q: ¿Un Miembro debería poder invitar a otras personas y, si puede, qué roles puede otorgar? → A: Owner y Miembros invitan, y cualquiera de los dos elige Miembro o Lector como rol de ingreso (nunca Owner); los Lectores no invitan.
- Q: Cuando el owner transfiere la propiedad, ¿debe el destinatario aceptarla antes de que sea efectiva, o es inmediata? → A: Inmediata, sin aceptación del destinatario; el owner anterior queda como Miembro.
- Q: ¿Debe un Lector poder ver la lista de invitaciones pendientes (con los emails invitados), o solo el Owner y los Miembros? → A: Solo Owner y Miembros; el Lector no ve esa sección.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El owner cambia el rol de un miembro (Priority: P1)

El owner de un proyecto compartido decide qué nivel de acceso tiene cada colaborador: puede dejar a una persona como **Miembro** (puede editar todo el contenido del proyecto) o pasarla a **Lector** (puede ver todo, pero no modificar nada), y revertirlo cuando quiera.

**Why this priority**: Es el mecanismo mínimo para que exista más de un nivel de acceso. Sin poder asignar roles no hay nada que diferenciar; el resto de historias se apoya en esta capacidad. Resuelve la pregunta abierta de la visión sobre un rol de solo lectura.

**Independent Test**: Puede probarse con un proyecto de dos cuentas (owner + miembro): el owner cambia al otro a Lector y verifica que el rol se refleja en la lista de miembros; luego lo devuelve a Miembro.

**Acceptance Scenarios**:

1. **Given** un proyecto con un owner y un Miembro, **When** el owner cambia el rol de ese Miembro a Lector, **Then** la lista de miembros muestra el nuevo rol y el permiso reducido aplica de inmediato a esa persona (ver Historia 2).
2. **Given** un Lector, **When** el owner lo cambia a Miembro, **Then** recupera de inmediato todos los permisos de edición.
3. **Given** la lista de miembros del proyecto, **When** cualquier miembro la abre, **Then** ve el rol de cada persona (Owner, Miembro, Lector) y su propio rol de forma clara.
4. **Given** un Miembro o un Lector, **When** intenta cambiar el rol de otra persona, **Then** el sistema rechaza la acción y no se modifica ningún rol.
5. **Given** el owner, **When** intenta cambiar su propio rol, **Then** el sistema lo impide indicando que para dejar de ser owner debe transferir la propiedad (Historia 4).

---

### User Story 2 - Un Lector consulta el proyecto sin poder modificarlo (Priority: P1)

Una persona con rol Lector abre el proyecto y puede recorrer todo su contenido —tablero, detalle de Work Items, relaciones, historial de actividad, lista de miembros— pero no puede alterar nada. La interfaz no le ofrece acciones de edición, y aunque alguien intente ejecutarlas por fuera de la interfaz, el sistema las rechaza.

**Why this priority**: Es el valor central del rol de solo lectura y el requisito de seguridad de la constitución (Principio IV: verificar membresía **y rol** en todo acceso). Un Lector que puede modificar datos vuelve inútil la feature.

**Independent Test**: Con una cuenta Lector, recorrer cada pantalla del proyecto verificando que no hay controles de edición, e intentar cada acción de modificación de la matriz de permisos verificando que el sistema la rechaza sin cambiar ningún dato.

**Acceptance Scenarios**:

1. **Given** un Lector en el tablero, **When** mira las columnas y tarjetas, **Then** puede ver todo el contenido pero no puede arrastrar tarjetas, reordenar ni crear/renombrar/eliminar columnas, ni crear Work Items; esos controles no aparecen o aparecen deshabilitados con una explicación.
2. **Given** un Lector en la vista de detalle de un Work Item, **When** la abre, **Then** ve título, descripción, stakeholder, tags, relaciones (padre, hijos, relacionados) e historial, sin poder editar ningún campo, agregar/quitar relaciones ni eliminar el Work Item; sí puede navegar entre Work Items relacionados.
3. **Given** un Lector, **When** una acción de modificación llega al sistema sin pasar por la interfaz (por ejemplo, una petición directa), **Then** el sistema la rechaza con un mensaje claro y no se altera ningún dato.
4. **Given** un Miembro con el tablero abierto, **When** el owner lo pasa a Lector y esa persona intenta luego una acción de edición, **Then** la acción se rechaza con un mensaje que explica que su rol cambió, no se aplica ningún cambio, y la pantalla pasa a mostrarse en modo lectura tras refrescar.
5. **Given** un Lector, **When** decide dejar el proyecto, **Then** puede hacerlo igual que cualquier otro miembro que no es owner.

---

### User Story 3 - Invitar eligiendo el rol, y quién puede invitar (Priority: P2)

Al invitar a alguien, quien invita elige con qué rol entra la persona (Miembro o Lector). La capacidad de invitar deja de ser exclusiva del owner: también la tienen los Miembros; los Lectores no pueden invitar.

**Why this priority**: Cierra el ciclo de la feature (roles asignables desde el ingreso, sin tener que invitar y luego corregir) y resuelve la pregunta abierta de quién puede invitar, alineada con el Principio II (colaboración sin límites). Depende de que los roles ya existan (Historias 1 y 2), por eso es P2.

**Independent Test**: Un Miembro invita a un email eligiendo Lector; la persona acepta y aparece en el proyecto como Lector. Un Lector no ve ni puede usar la acción de invitar.

**Acceptance Scenarios**:

1. **Given** el owner o un Miembro, **When** invita a un email, **Then** debe elegir el rol de ingreso (Miembro o Lector) y la invitación pendiente muestra ese rol.
2. **Given** una invitación pendiente con un rol asignado, **When** el invitado la acepta, **Then** ingresa al proyecto con exactamente ese rol.
3. **Given** un Lector, **When** intenta invitar a alguien, **Then** la acción no está disponible en la interfaz y, si se intenta por fuera de ella, el sistema la rechaza.
4. **Given** un Miembro que envió una invitación pendiente, **When** decide cancelarla, **Then** puede hacerlo (regla de 001-accounts-invitations, FR-011); el owner puede cancelar cualquier invitación pendiente del proyecto.
5. **Given** cualquier invitación, **When** se envía, **Then** no es posible invitar directamente con rol Owner: el proyecto tiene exactamente un owner (ver Historia 4).

---

### User Story 4 - Transferir la propiedad del proyecto (Priority: P3)

El owner que ya no quiere gestionar el proyecto (o que quiere dejarlo en manos de otra persona) transfiere la propiedad a otro miembro. El owner anterior pasa a ser Miembro y puede, si lo desea, salir después del proyecto.

**Why this priority**: Resuelve un vacío ya reconocido (002-project-spaces dejó fuera la transferencia, y hoy un owner que quiere irse solo puede borrar todo el proyecto). Es valioso pero no bloquea el resto: el sistema funciona correctamente con roles sin poder transferir.

**Independent Test**: Un owner transfiere la propiedad a otro miembro; verificar que el nuevo owner tiene los permisos de owner, el anterior quedó como Miembro, y el proyecto sigue teniendo exactamente un owner.

**Acceptance Scenarios**:

1. **Given** un proyecto con al menos otro miembro, **When** el owner elige a un miembro y confirma explícitamente la transferencia, **Then** esa persona pasa a ser el owner y el owner anterior pasa a ser Miembro, todo en un solo paso.
2. **Given** la confirmación de la transferencia, **When** el owner la ve, **Then** el sistema le advierte con claridad que perderá los permisos exclusivos de owner (renombrar/eliminar proyecto, remover miembros, cambiar roles, transferir).
3. **Given** un proyecto con un único miembro (Personal), **When** el owner abre las opciones de propiedad, **Then** no hay a quién transferir y la acción no está disponible.
4. **Given** un Miembro o un Lector, **When** intenta iniciar una transferencia, **Then** el sistema la rechaza.
5. **Given** un owner que ya transfirió la propiedad, **When** intenta salir del proyecto, **Then** puede hacerlo (ya es Miembro) — completando el flujo que 002-project-spaces dejó sin resolver.
6. **Given** que el destinatario de la transferencia es un Lector, **When** el owner lo elige, **Then** pasa a ser owner con todos los permisos de owner (el rol previo no limita).

---

### Edge Cases

- ¿Qué pasa si el owner intenta removerse o cambiarse el rol a sí mismo? El sistema MUST impedirlo: un proyecto siempre tiene exactamente un owner; la única vía para dejar de serlo es transferir la propiedad.
- ¿Qué pasa si el owner transfiere la propiedad a alguien que acaba de ser removido, o que sale del proyecto justo en ese momento? El sistema MUST rechazar la transferencia (el destinatario ya no es miembro) sin dejar el proyecto sin owner ni con dos.
- ¿Qué pasa si dos acciones de propiedad ocurren casi a la vez (por ejemplo, dos transferencias, o una transferencia y un cambio de rol)? El sistema MUST garantizar que en todo momento el proyecto tiene exactamente un owner; la acción que no encuentre el estado esperado se rechaza con un mensaje claro.
- ¿Qué pasa con una persona que ya no es owner e intenta ejecutar una acción exclusiva de owner desde una pantalla que tenía abierta? MUST rechazarse con un mensaje que explique que su rol cambió, sin aplicar ningún cambio.
- ¿Qué pasa con las invitaciones pendientes enviadas por un Miembro que luego pasa a ser Lector? Siguen pendientes y válidas (ya fueron enviadas con el rol elegido); el owner puede cancelarlas, pero el ex-remitente, al perder el permiso de invitar, ya no puede gestionarlas.
- ¿Qué pasa con las invitaciones pendientes y con los miembros que ya existían antes de esta feature? MUST tratarse como Miembro (mismo comportamiento que tenían antes), sin acción manual de nadie.
- ¿Qué pasa si un Lector abre por enlace directo la vista de detalle de un Work Item? MUST verse en modo lectura; el enlace no le da capacidad de edición.
- ¿Qué pasa si un Miembro invita a un email que ya es miembro, o que ya tiene una invitación pendiente? Rigen las mismas reglas de 001-accounts-invitations (FR-012, FR-013), sin importar el rol de quien invita.
- ¿Qué pasa con el límite de velocidad de invitaciones? Se aplica por cuenta, igual que hoy (001-accounts-invitations, FR-017), sea quien invite el owner o un Miembro.
- ¿Qué pasa si el owner elimina el proyecto o remueve a un miembro? No cambia respecto a 002-project-spaces; el rol del afectado es irrelevante.

## Requirements *(mandatory)*

### Matriz de permisos

Esta matriz es la definición normativa de qué puede hacer cada rol. Cubre todas las acciones existentes del producto; cualquier acción no listada aquí es solo de lectura y está disponible para los tres roles.

| Área | Acción | Owner | Miembro | Lector |
|---|---|---|---|---|
| Lectura | Ver proyecto, tablero, detalle de Work Items, relaciones, tags, historial de actividad y lista de miembros | ✔ | ✔ | ✔ |
| Lectura | Ver invitaciones pendientes del proyecto | ✔ | ✔ | ✘ |
| Proyecto | Renombrar, editar descripción | ✔ | ✘ | ✘ |
| Proyecto | Eliminar el proyecto | ✔ | ✘ | ✘ |
| Proyecto | Salir del proyecto | ✘ (debe transferir o eliminar) | ✔ | ✔ |
| Miembros | Remover a otro miembro | ✔ | ✘ | ✘ |
| Miembros | Cambiar el rol de otro miembro (Miembro ↔ Lector) | ✔ | ✘ | ✘ |
| Miembros | Transferir la propiedad | ✔ | ✘ | ✘ |
| Invitaciones | Enviar invitación (con rol Miembro o Lector) | ✔ | ✔ | ✘ |
| Invitaciones | Cancelar una invitación pendiente | ✔ (cualquiera) | ✔ (solo las que envió) | ✘ |
| Tablero | Crear, renombrar, eliminar y reordenar columnas | ✔ | ✔ | ✘ |
| Work Items | Crear, editar campos (título, descripción, stakeholder), mover entre columnas, reordenar, eliminar | ✔ | ✔ | ✘ |
| Work Items | Agregar/quitar tags de un Work Item y crear tags nuevos desde el propio Work Item | ✔ | ✔ | ✘ |
| Relaciones | Crear y quitar relaciones padre/hijo y "relacionado con" | ✔ | ✔ | ✘ |

### Functional Requirements

- **FR-001**: Todo miembro de un proyecto MUST tener exactamente uno de tres roles: **Owner**, **Miembro** o **Lector**. El rol es propio de cada membresía (una misma persona puede tener roles distintos en proyectos distintos).
- **FR-002**: Todo proyecto MUST tener exactamente un Owner en todo momento (consistente con 002-project-spaces, FR-014); el rol Owner MUST NOT poder asignarse por invitación ni por cambio de rol, solo mediante la transferencia de propiedad (FR-011).
- **FR-003**: El sistema MUST aplicar la matriz de permisos anterior a toda acción sobre un proyecto, verificando la membresía **y el rol vigente** del usuario en el momento de ejecutar la acción (Principio IV de la constitución), no el rol que tenía al abrir la pantalla.
- **FR-004**: El sistema MUST rechazar cualquier acción no permitida a un rol con un mensaje claro que explique el motivo, sin modificar ningún dato, con independencia de si la acción se originó desde la interfaz o por otra vía.
- **FR-005**: La interfaz MUST reflejar el rol del usuario: para las acciones que su rol no permite, no MUST ofrecer el control o MUST mostrarlo deshabilitado con una explicación. Un Lector MUST poder recorrer tablero, detalle de Work Items y navegación entre relaciones sin ver controles de edición operativos.
- **FR-006**: El owner MUST poder cambiar el rol de cualquier otro miembro entre Miembro y Lector en cualquier momento; el cambio MUST aplicarse a la siguiente acción que esa persona ejecute, sin requerir que cierre sesión.
- **FR-007**: La lista de miembros MUST mostrar el rol de cada miembro, y cada usuario MUST poder identificar claramente su propio rol en el proyecto.
- **FR-008**: Al enviar una invitación, quien invita MUST elegir el rol de ingreso (Miembro o Lector); la invitación pendiente MUST mostrar ese rol, y aceptar la invitación MUST incorporar a la persona con exactamente ese rol. Las invitaciones existentes previas a esta feature MUST tratarse como rol Miembro.
- **FR-009**: Solo el Owner y los Miembros MUST poder enviar invitaciones; los Lectores MUST NOT. Esto reemplaza a 001-accounts-invitations, FR-009 (que restringía las invitaciones al owner en la primera versión). Todas las demás reglas de invitación (FR-005 a FR-008, FR-010 a FR-017 de 001-accounts-invitations) permanecen sin cambio.
- **FR-010**: Un Miembro MUST poder cancelar solo las invitaciones que él envió y que sigan pendientes; el Owner MUST poder cancelar cualquier invitación pendiente del proyecto (extiende 001-accounts-invitations, FR-011).
- **FR-011**: El Owner MUST poder transferir la propiedad a cualquier otro miembro del proyecto, sin importar su rol actual, mediante una confirmación explícita que advierta la pérdida de permisos exclusivos. Al confirmar, en una única operación indivisible, el destinatario pasa a Owner y el Owner anterior pasa a Miembro. La transferencia es inmediata y no requiere una aceptación del destinatario.
- **FR-012**: El sistema MUST impedir transferir la propiedad si el destinatario ya no es miembro del proyecto en el momento de confirmar, y MUST garantizar que ningún estado intermedio deje el proyecto sin Owner o con dos.
- **FR-013**: Tras transferir la propiedad, el Owner anterior MUST poder salir del proyecto con las reglas ya definidas para los miembros que no son owner (002-project-spaces, FR-013); esto reemplaza la limitación por la cual un owner que no quería seguir gestionando el proyecto solo podía eliminarlo.
- **FR-014**: Los permisos de renombrar, editar la descripción y eliminar el proyecto, y de remover a otros miembros, MUST permanecer exclusivos del Owner (002-project-spaces, FR-005, FR-006, FR-008, FR-012 sin cambio).
- **FR-015**: Los miembros y las invitaciones existentes antes de habilitar esta feature MUST conservar exactamente el comportamiento que tenían (los miembros ya existentes como Miembro, el creador como Owner), sin intervención manual ni pérdida de acceso.
- **FR-016**: El rol de un miembro MUST NOT afectar la clasificación Personal/Compartido del proyecto, que sigue derivándose únicamente del número de miembros (Principio II de la constitución); un proyecto con un Owner y un Lector es "Compartido".
- **FR-017**: El sistema MUST NOT imponer ningún límite al número de miembros, ni por rol ni en total (Principio II de la constitución); en particular, el número de Lectores y de Miembros de un proyecto no tiene tope.
- **FR-018**: Solo el Owner y los Miembros MUST poder ver la lista de invitaciones pendientes de un proyecto (con los emails invitados); a un Lector MUST NOT mostrársele esa sección ni devolvérsele esa información por ninguna vía, porque expone datos de terceros que aún no aceptaron.

### Key Entities

- **Membresía**: relación entre una Cuenta y un Proyecto (001-accounts-invitations). Esta feature amplía su rol a tres valores: Owner, Miembro y Lector. Invariante: un proyecto tiene exactamente una membresía Owner.
- **Invitación**: ya definida en 001-accounts-invitations; esta feature agrega el **rol de ingreso** que se otorgará al aceptarla (Miembro o Lector).
- **Matriz de permisos**: definición conceptual (no una entidad almacenada) de qué acciones permite cada rol; es la fuente única de verdad que toda acción del sistema consulta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las acciones de modificación listadas en la matriz de permisos son rechazadas cuando las intenta un Lector, incluidas las que no pasan por la interfaz, con 0 cambios en los datos del proyecto.
- **SC-002**: El 100% de las acciones exclusivas de Owner (renombrar/eliminar proyecto, remover miembros, cambiar roles, transferir propiedad) son rechazadas cuando las intenta un Miembro o un Lector.
- **SC-003**: Tras un cambio de rol, el nuevo nivel de permisos aplica a la siguiente acción de la persona afectada, sin que deba cerrar sesión ni el owner deba hacer nada adicional.
- **SC-004**: Un owner puede cambiar el rol de un miembro en menos de 15 segundos desde la lista de miembros, y transferir la propiedad en menos de 30 segundos.
- **SC-005**: Recorriendo todas las pantallas del proyecto (tablero, detalle de Work Item, ajustes) con una cuenta Lector, se observan 0 controles de edición operativos.
- **SC-006**: Tras cualquier secuencia de transferencias, cambios de rol y salidas, incluidas las concurrentes, el 100% de los proyectos conserva exactamente un Owner.
- **SC-007**: Los miembros e invitaciones existentes al habilitar la feature mantienen su comportamiento en el 100% de los casos, sin migración manual.
- **SC-008**: Un proyecto con al menos 100 miembros con una mezcla de roles funciona sin degradación perceptible ni error por límite de cantidad (mantiene 001-accounts-invitations, SC-005).

## Assumptions

- **Conjunto de roles**: tres roles fijos (Owner, Miembro, Lector). No hay un rol administrador intermedio ni roles personalizados ni permisos configurables por proyecto; agregarlos sería especular más allá de la necesidad confirmada (Principio VI de la constitución, YAGNI). "Miembro" equivale exactamente al miembro invitado de las specs anteriores, por lo que no cambia nada para los proyectos existentes.
- **Rol de solo lectura**: se decide incluirlo (Lector). La visión (§8) lo planteaba como pregunta abierta y esta feature la resuelve afirmativamente por ser el caso de uso más común de colaboración con terceros (stakeholders, clientes, observadores) con el mínimo costo de modelado.
- **Quién puede invitar**: Owner y Miembros pueden invitar, y ambos eligen Miembro o Lector como rol de ingreso (confirmado en la sesión de clarificación 2026-09-18; resuelve la pregunta abierta de la visión, §8). Es coherente con "colaboración sin límites" (Principio II) y con que los Miembros ya tienen acceso completo al contenido; el Owner conserva el control mediante su capacidad exclusiva de cambiar roles y remover miembros, y un Miembro solo puede otorgar Miembro o Lector, nunca Owner. Los Lectores no invitan.
- **Transferencia de propiedad**: inmediata, sin aceptación del destinatario (confirmado en la sesión de clarificación 2026-09-18), y el Owner anterior queda como Miembro (no sale del proyecto ni queda como Lector). Un flujo de aceptación en dos pasos se evalúa solo si la necesidad se confirma más adelante.
- **Rol de una invitación pendiente**: no se puede editar; para cambiarlo se cancela y se reenvía la invitación. El rol de un miembro ya incorporado sí se puede cambiar (Historia 1).
- **Visibilidad de invitaciones pendientes**: se muestran solo a los roles con permiso de invitar (Owner y Miembro), porque exponen emails de terceros que un Lector no necesita ver (confirmado en la sesión de clarificación 2026-09-18; ver FR-018).
- **Sin notificaciones de cambio de rol**: la persona afectada percibe su nuevo rol al refrescar o cuando una acción es rechazada con explicación (FR-004); enviarle una notificación dentro de la app queda fuera de esta spec.
- **Sin registro de auditoría a nivel proyecto**: la constitución exige el log de actividad para cambios en Work Items (que no cambia; un Lector no puede generar esos cambios); registrar cambios de roles o transferencias no está exigido y queda fuera de esta spec.
- **Enmiendas a specs anteriores** (documentadas aquí para trazabilidad): 001-accounts-invitations FR-009 (solo el owner invita) queda reemplazada por FR-009 de esta spec, y su asunción de que "esta spec no modela roles adicionales" queda superada; 002-project-spaces pierde la exclusión de "transferir la propiedad" (ahora en alcance); 004-work-items, 005-work-item-relationships y 006-work-item-detail-view asumían "cualquier miembro edita", lo que pasa a ser "Owner y Miembro editan; el Lector solo lee".
- **Fuera de alcance**: roles a nivel de organización/cuenta (solo existen roles por proyecto); múltiples owners; permisos por columna o por Work Item; gestión del catálogo de tags (sigue como en 004-work-items); vistas adicionales y campos extendidos (Fase 3).
