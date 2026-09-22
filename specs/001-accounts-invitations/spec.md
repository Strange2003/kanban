# Feature Specification: Cuentas e Invitaciones

**Feature Branch**: `001-accounts-invitations`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "en base a kanban-app-vision.md, genera las features que debe tener este proyecto" — feature seleccionada: Cuentas, Autenticación e Invitaciones a proyectos.

## Clarifications

### Session 2026-09-09

- Q: ¿Una cuenta nueva registrada por email/contraseña debe verificar su email antes de que las invitaciones pendientes a su nombre se apliquen automáticamente? → A: Sí, la verificación se exige solo como condición para que se apliquen invitaciones pendientes (Google OAuth ya llega verificado por Google).
- Q: ¿El flujo de "olvidé mi contraseña" es parte del alcance de esta feature? → A: Sí, queda dentro del alcance de esta spec como capacidad para el usuario.
- Q: ¿Qué requisito mínimo de contraseña debe exigir el registro por email/contraseña? → A: Mínimo 8 caracteres.
- Q: ¿Debe existir un límite de velocidad sobre cuántas invitaciones puede enviar una misma cuenta en un periodo corto? → A: Sí, se limita la velocidad de envío (no el total de miembros, que sigue sin límite por FR-005).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear cuenta e iniciar sesión (Priority: P1)

Una persona nueva llega a la aplicación y necesita crear una cuenta, ya sea con su
cuenta de Google o con un email y contraseña propios, para poder acceder a sus
proyectos personales.

**Why this priority**: Sin una cuenta no existe ningún otro flujo posible (ni
proyectos personales ni colaboración); es el prerequisito absoluto de todo el
producto.

**Independent Test**: Puede probarse de forma aislada registrando una cuenta nueva
por cada método (Google OAuth y email/password) y verificando que la persona queda
autenticada y puede acceder a un espacio vacío de "Personal".

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta, **When** elige "Continuar con Google" y
   autoriza el acceso, **Then** se crea su cuenta y queda autenticada dentro de la
   app.
2. **Given** una persona sin cuenta, **When** ingresa un email y una contraseña
   válidos y confirma el registro, **Then** se crea su cuenta y queda autenticada.
3. **Given** una cuenta ya existente, **When** la persona ingresa sus credenciales
   correctas (Google o email/password) en un nuevo inicio de sesión, **Then**
   accede a su misma cuenta con sus proyectos existentes.

---

### User Story 2 - Invitar a un colaborador a un proyecto (Priority: P2)

Un miembro de un proyecto quiere sumar a otra persona ingresando su dirección de
email, sin ningún límite en la cantidad de personas que puede invitar.

**Why this priority**: Es el mecanismo que habilita la colaboración, el diferencial
central del producto frente a herramientas que limitan miembros por plan.

**Independent Test**: Puede probarse invitando repetidamente a distintos emails
desde un mismo proyecto y verificando que no existe un tope de invitaciones
enviadas ni de miembros aceptados.

**Acceptance Scenarios**:

1. **Given** un proyecto existente, **When** un miembro con permiso de invitar
   ingresa el email de una persona y confirma, **Then** se crea una invitación en
   estado "pendiente" asociada a ese proyecto y ese email.
2. **Given** un proyecto con varias invitaciones ya aceptadas, **When** se envía
   una invitación adicional, **Then** el sistema la acepta sin rechazarla por
   límite de miembros.
3. **Given** un email que ya es miembro del proyecto, **When** se intenta
   invitarlo de nuevo, **Then** el sistema rechaza la acción e informa que ya es
   miembro.

---

### User Story 3 - Aceptar una invitación (Priority: P2)

La persona invitada ve una notificación dentro de la app informando que fue
invitada a un proyecto, y puede aceptarla para unirse.

**Why this priority**: Completa el ciclo de colaboración iniciado en la Historia 2;
sin aceptación, la invitación nunca genera valor real.

**Independent Test**: Puede probarse de forma aislada generando una invitación
pendiente y verificando que, al aceptarla, el proyecto aparece en la sección
"Compartido" tanto para el invitado como para el resto de los miembros.

**Acceptance Scenarios**:

1. **Given** una invitación pendiente dirigida a su cuenta, **When** el invitado
   abre la app, **Then** ve una notificación in-app describiendo el proyecto y
   quién lo invitó.
2. **Given** una notificación de invitación, **When** el invitado la acepta,
   **Then** el proyecto aparece en la sección "Compartido" de su barra lateral.
3. **Given** un proyecto que antes tenía un único miembro, **When** una invitación
   a ese proyecto es aceptada, **Then** el proyecto pasa de "Personal" a
   "Compartido" también para el miembro original, sin que nadie edite ese campo
   manualmente.

---

### User Story 4 - Rechazar o cancelar una invitación (Priority: P3)

Tanto la persona invitada como quien envió la invitación necesitan poder
deshacerla antes de que se acepte: el invitado rechazándola, o el invitador
cancelándola.

**Why this priority**: Es un caso secundario de manejo de errores/arrepentimiento;
el flujo principal (Historias 1–3) ya entrega valor sin esto, pero completa la
experiencia y evita invitaciones "fantasma" acumuladas.

**Independent Test**: Puede probarse generando una invitación pendiente y
verificando, por separado, que el invitado puede rechazarla y que el invitador
puede cancelarla, en ambos casos dejando de existir como pendiente.

**Acceptance Scenarios**:

1. **Given** una invitación pendiente, **When** el invitado la rechaza, **Then**
   la invitación deja de estar pendiente y el invitado no se convierte en miembro
   del proyecto.
2. **Given** una invitación pendiente aún no aceptada, **When** quien la envió la
   cancela, **Then** deja de aparecer como notificación para el invitado.

---

### User Story 5 - Recuperar contraseña olvidada (Priority: P2)

Una persona que se registró con email y contraseña, pero olvidó su contraseña,
necesita poder recuperarla para volver a acceder a su cuenta.

**Why this priority**: Sin esta capacidad, un usuario que olvida su contraseña
queda bloqueado permanentemente fuera de su cuenta y de todos sus proyectos; es
un requisito básico esperado en cualquier login con contraseña.

**Independent Test**: Puede probarse de forma aislada solicitando la
recuperación para una cuenta existente y verificando que, tras completar el
flujo, la persona puede iniciar sesión con la nueva contraseña.

**Acceptance Scenarios**:

1. **Given** una cuenta existente registrada por email/contraseña, **When** la
   persona solicita recuperar su contraseña ingresando su email, **Then** recibe
   un email con un enlace para definir una nueva contraseña.
2. **Given** un enlace de recuperación válido y no usado, **When** la persona
   define una nueva contraseña que cumple el mínimo requerido, **Then** puede
   iniciar sesión con la nueva contraseña y la anterior deja de funcionar.
3. **Given** un email que no corresponde a ninguna cuenta, **When** se solicita
   recuperar su contraseña, **Then** el sistema no revela si el email existe o
   no, mostrando el mismo mensaje de confirmación en ambos casos.

---

### Edge Cases

- ¿Qué ocurre si se invita dos veces al mismo email para el mismo proyecto mientras
  la primera invitación sigue pendiente? El sistema MUST impedir invitaciones
  pendientes duplicadas para el mismo par (email, proyecto).
- ¿Qué ocurre si el único otro miembro de un proyecto "Compartido" es removido (o
  se va) y vuelve a quedar un solo miembro? El proyecto MUST reclasificarse
  automáticamente como "Personal" de nuevo, siguiendo la misma regla derivada.
- ¿Qué ocurre si una persona intenta iniciar sesión con Google usando el mismo
  email con el que ya se registró por contraseña (o viceversa)? Ambos métodos MUST
  asociarse a la misma cuenta en lugar de crear cuentas duplicadas (ver Assumptions).
- ¿Qué ocurre si se invita a un email con un formato inválido? El sistema MUST
  rechazar la invitación antes de crearla, con un mensaje de validación claro.
- ¿Qué ocurre si una invitación queda pendiente para una cuenta cuyo email
  todavía no fue verificado? La invitación MUST permanecer pendiente y no se
  aplica hasta que esa cuenta verifique su email.
- ¿Qué ocurre si se ingresa una contraseña de menos de 8 caracteres al
  registrarse? El sistema MUST rechazarla e indicar el mínimo requerido.
- ¿Qué ocurre si una cuenta alcanza el límite de velocidad de invitaciones
  enviadas? El sistema MUST rechazar el envío e indicar cuándo puede volver a
  intentarlo, sin afectar las invitaciones ya enviadas.
- ¿Qué ocurre si se usa un enlace de recuperación de contraseña ya usado o
  vencido? El sistema MUST rechazarlo y permitir solicitar uno nuevo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir crear una cuenta autenticándose con Google
  OAuth.
- **FR-002**: El sistema MUST permitir crear una cuenta con email y contraseña
  propios, exigiendo una contraseña de al menos 8 caracteres.
- **FR-003**: El sistema MUST permitir iniciar sesión posteriormente con el mismo
  método usado en el registro, y reconocer como la misma cuenta a ambos métodos
  cuando comparten el mismo email verificado.
- **FR-004**: El sistema MUST garantizar que cada email esté asociado a una única
  cuenta.
- **FR-005**: El sistema MUST permitir a un miembro con permiso de invitar sumar a
  un colaborador ingresando únicamente su email, sin límite en la cantidad de
  invitaciones enviadas ni de miembros aceptados por proyecto.
- **FR-006**: El sistema MUST entregar cada invitación como una notificación
  dentro de la app (no MUST enviar correos electrónicos salientes para esto).
- **FR-007**: Cuando se invita a un email sin cuenta existente, el sistema MUST
  dejar la invitación en estado pendiente y aplicarla automáticamente en cuanto esa
  persona cree una cuenta con ese mismo email y verifique su email (ver FR-015).
- **FR-008**: Al aceptar una invitación, el sistema MUST agregar al invitado como
  miembro del proyecto y reclasificar el proyecto como "Compartido" para todos sus
  miembros de forma inmediata.
- **FR-009**: El sistema MUST permitir que solo el owner/creador del proyecto envíe
  invitaciones en esta primera versión (la extensión de este permiso a otros roles
  se evalúa en la feature de Roles y Permisos).
  *Enmendado por [007-roles-permissions](../007-roles-permissions/spec.md#functional-requirements)
  (FR-009): Owner y Miembros invitan, y quien invita elige el rol de ingreso.*
- **FR-010**: El sistema MUST permitir al invitado rechazar una invitación
  pendiente sin convertirse en miembro.
- **FR-011**: El sistema MUST permitir a quien envió una invitación cancelarla
  mientras siga pendiente.
- **FR-012**: El sistema MUST impedir crear una invitación pendiente duplicada
  para el mismo email en el mismo proyecto.
- **FR-013**: El sistema MUST impedir invitar a un email que ya es miembro del
  proyecto.
- **FR-014**: El sistema MUST reclasificar un proyecto de vuelta a "Personal" si,
  tras remover a un miembro, vuelve a quedar un único miembro.
- **FR-015**: Una cuenta creada por email/contraseña MUST verificar su email
  (mediante un enlace de confirmación enviado por email) antes de que cualquier
  invitación pendiente a su nombre se le aplique automáticamente; una cuenta
  creada por Google OAuth se considera verificada de inmediato.
- **FR-016**: El sistema MUST permitir a una persona con cuenta por
  email/contraseña solicitar y completar la recuperación de su contraseña vía
  email, sin revelar si un email ingresado corresponde o no a una cuenta
  existente.
- **FR-017**: El sistema MUST limitar la velocidad de envío de invitaciones por
  cuenta (por ejemplo, no más de 20 invitaciones por hora) para prevenir abuso o
  spam, sin imponer ningún límite al número total de miembros o invitaciones
  aceptadas de un proyecto (ver FR-005).

### Key Entities

- **Cuenta**: identidad de una persona en el sistema; email único, uno o más
  métodos de autenticación asociados (Google OAuth y/o contraseña), y un estado
  de verificación de email (verificado automáticamente si es por Google OAuth,
  pendiente hasta confirmar si es por email/contraseña).
- **Proyecto**: entidad principal a la que se pertenece; su clasificación
  Personal/Compartido se deriva del número de miembros actuales, nunca se
  configura manualmente.
- **Membresía**: relación entre una Cuenta y un Proyecto, con un rol asociado
  (owner/creador o miembro invitado en esta versión).
- **Invitación**: solicitud para unir un email a un proyecto; tiene estado
  (pendiente, aceptada, rechazada, cancelada) y referencia al proyecto y a quien
  la envió.
- **Notificación**: aviso dentro de la app que informa a una cuenta sobre una
  invitación recibida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona nueva puede crear una cuenta y quedar autenticada en
  menos de 1 minuto, con cualquiera de los dos métodos.
- **SC-002**: Un miembro puede enviar una invitación a un colaborador en menos de
  30 segundos desde que decide hacerlo.
- **SC-003**: El invitado ve la notificación de la invitación dentro de la app sin
  necesidad de recargar la página manualmente.
- **SC-004**: El 100% de los proyectos con 2 o más miembros se muestran como
  "Compartido" para todos sus miembros, sin ninguna intervención manual.
- **SC-005**: Un proyecto admite al menos 100 miembros simultáneos en pruebas sin
  degradación perceptible ni error por límite de cantidad.
- **SC-006**: Una persona puede completar la recuperación de su contraseña
  (solicitud + definición de nueva contraseña) en menos de 5 minutos desde que
  recibe el email.
- **SC-007**: El 100% de las invitaciones pendientes dirigidas a un email no
  verificado permanecen sin aplicarse hasta que esa cuenta verifica su email,
  sin excepciones.

## Assumptions

- Un email identifica una única cuenta: si una persona se registró por
  email/contraseña y luego usa Google OAuth con el mismo email verificado (o
  viceversa), ambos métodos se asocian a la misma cuenta en lugar de crear una
  cuenta duplicada.
- Las invitaciones no expiran automáticamente por tiempo; permanecen pendientes
  hasta ser aceptadas, rechazadas o canceladas explícitamente. No se especificó una
  política de expiración en el vision doc.
- En esta primera versión, solo el owner/creador del proyecto puede enviar
  invitaciones; abrir ese permiso a otros roles queda para la feature de Roles y
  Permisos (Fase 2), por lo que esta spec no modela roles adicionales.
  *Superado por [007-roles-permissions](../007-roles-permissions/spec.md): ya existen
  los roles Owner, Miembro y Lector, y los Miembros también pueden invitar.*
- La notificación de invitación es exclusivamente dentro de la app; no existe
  envío de emails salientes como parte de esta feature (la recuperación de
  contraseña de FR-016 y la verificación de email de FR-015 sí envían email,
  por ser flujos de autenticación distintos de las invitaciones).
- El número exacto del límite de velocidad de invitaciones (FR-017, hoy
  ilustrado como "20 por hora") es un valor de referencia a confirmar durante
  la planificación técnica, no un requisito de negocio cerrado.
- La elección del proveedor de base de datos y de la librería/servicio de
  autenticación (incluyendo si ofrece verificación de email y recuperación de
  contraseña ya resueltas) se decide en la etapa de planificación técnica
  (`/speckit-plan`), no en esta spec.
