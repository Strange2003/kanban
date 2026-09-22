# Feature Specification: Proyectos y Espacios

**Feature Branch**: `002-project-spaces`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Proyectos y Espacios (Personal/Compartido): crear proyecto, listado en barra lateral tipo Notion agrupado en Personal/Compartido, configuración individual por proyecto." Depende de la clasificación automática Personal/Compartido y del modelo de Cuenta/Membresía ya definidos en [001-accounts-invitations](../001-accounts-invitations/spec.md).

## Clarifications

### Session 2026-09-09

- Q: ¿La barra lateral debe incluir un buscador de proyectos por nombre? → A: Sí, filtro por nombre para cumplir SC-004.
- Q: ¿Esta spec debe incluir que el owner remueva a un miembro y que un miembro se retire voluntariamente? → A: Sí, ambas acciones quedan dentro del alcance de esta spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear un proyecto nuevo (Priority: P1)

Un usuario autenticado crea un proyecto nuevo dándole un nombre, para empezar a
organizar su propio trabajo.

**Why this priority**: Es el punto de partida de todo lo demás — sin un proyecto
no existe tablero, ni columnas, ni work items.

**Independent Test**: Puede probarse de forma aislada creando un proyecto desde
una cuenta recién autenticada y verificando que aparece inmediatamente en la
sección "Personal" de su barra lateral.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado, **When** crea un proyecto ingresando un
   nombre, **Then** el proyecto se crea con ese usuario como único miembro (owner)
   y aparece en la sección "Personal".
2. **Given** un usuario que intenta crear un proyecto sin ingresar un nombre,
   **When** confirma la creación, **Then** el sistema rechaza la acción y pide un
   nombre.

---

### User Story 2 - Ver mis proyectos organizados en la barra lateral (Priority: P1)

Un usuario ve todos sus proyectos agrupados en dos secciones colapsables,
"Personal" y "Compartido", y puede navegar a cualquiera de ellos.

**Why this priority**: Es la forma principal de moverse entre proyectos; sin esta
vista, un usuario con varios proyectos no puede ubicarlos ni distinguir cuáles son
colaborativos.

**Independent Test**: Puede probarse creando varios proyectos (algunos con un solo
miembro, otros con más) y verificando que cada uno aparece bajo la sección
correcta.

**Acceptance Scenarios**:

1. **Given** un usuario con proyectos propios y proyectos compartidos con otros,
   **When** abre la barra lateral, **Then** ve dos secciones separadas,
   "Personal" y "Compartido", cada una listando solo los proyectos que
   corresponden.
2. **Given** una sección de la barra lateral, **When** el usuario hace clic en su
   encabezado, **Then** la sección se colapsa u expande, ocultando o mostrando sus
   proyectos.
3. **Given** un proyecto listado, **When** el usuario hace clic sobre él, **Then**
   navega al tablero de ese proyecto.

---

### User Story 3 - Renombrar un proyecto (Priority: P2)

El owner de un proyecto cambia su nombre para reflejar mejor su propósito actual.

**Why this priority**: Es una acción de mantenimiento común pero no bloquea el uso
básico del producto si aún no existe.

**Independent Test**: Puede probarse renombrando un proyecto existente y
verificando que el nuevo nombre se refleja en la barra lateral de todos sus
miembros.

**Acceptance Scenarios**:

1. **Given** un proyecto existente, **When** su owner edita el nombre y guarda,
   **Then** el nuevo nombre se refleja en la barra lateral de todos los miembros.
2. **Given** un miembro que no es el owner, **When** intenta renombrar el
   proyecto, **Then** el sistema rechaza la acción (mismo modelo de permisos
   v1 que Eliminar, ver Historia 4 y FR-008).

---

### User Story 4 - Eliminar un proyecto (Priority: P2)

El owner de un proyecto lo elimina por completo cuando ya no lo necesita.

**Why this priority**: Es necesaria para mantener el espacio de trabajo limpio,
pero es una acción destructiva de menor frecuencia que crear o navegar proyectos.

**Independent Test**: Puede probarse eliminando un proyecto de prueba (con y sin
otros miembros) y verificando que desaparece de la barra lateral de todos sus
miembros.

**Acceptance Scenarios**:

1. **Given** un proyecto existente, **When** su owner confirma la eliminación tras
   una advertencia explícita, **Then** el proyecto y todo lo que contiene deja de
   existir para todos sus miembros.
2. **Given** un miembro que no es el owner, **When** intenta eliminar el
   proyecto, **Then** el sistema rechaza la acción.

---

### User Story 5 - Buscar un proyecto en la barra lateral (Priority: P2)

Un usuario con muchos proyectos escribe parte del nombre en un buscador de la
barra lateral para encontrarlo rápido, sin desplazarse manualmente por las
secciones.

**Why this priority**: Sin esto, ubicar un proyecto específico entre muchos
depende solo de scroll visual, lo cual no escala más allá de unos pocos
proyectos.

**Independent Test**: Puede probarse con un usuario que tiene 50 proyectos,
escribiendo parte del nombre de uno de ellos y verificando que aparece entre
los resultados filtrados.

**Acceptance Scenarios**:

1. **Given** un usuario con varios proyectos, **When** escribe parte de un
   nombre en el buscador de la barra lateral, **Then** ve solo los proyectos
   (en Personal y/o Compartido) cuyo nombre contiene ese texto.
2. **Given** un buscador con texto ingresado, **When** el usuario lo borra,
   **Then** vuelve a ver todos sus proyectos agrupados normalmente.

---

### User Story 6 - Salir de un proyecto compartido (Priority: P3)

Un miembro que no es el owner decide dejar un proyecto compartido en el que ya
no participa.

**Why this priority**: Es una acción de mantenimiento de baja frecuencia, pero
necesaria para que un miembro pueda desvincularse sin depender del owner.

**Independent Test**: Puede probarse con una cuenta miembro (no owner) de un
proyecto compartido, saliendo de él y verificando que deja de aparecer en su
barra lateral.

**Acceptance Scenarios**:

1. **Given** un miembro (no owner) de un proyecto compartido, **When** elige
   salir del proyecto y confirma, **Then** pierde el acceso de inmediato y el
   proyecto deja de aparecer en su barra lateral.
2. **Given** un proyecto compartido del que queda un único miembro tras una
   salida, **When** esto ocurre, **Then** el proyecto se reclasifica como
   "Personal" para ese miembro restante.

---

### User Story 7 - Remover a un miembro del proyecto (Priority: P2)

El owner de un proyecto remueve a un colaborador que ya no debería tener
acceso.

**Why this priority**: Es el mecanismo que le da sentido práctico a la regla ya
definida en [001-accounts-invitations](../001-accounts-invitations/spec.md)
de que un proyecto vuelve a "Personal" al quedar un único miembro.

**Independent Test**: Puede probarse con un proyecto de dos o más miembros,
removiendo a uno desde la vista del owner y verificando que pierde el acceso
de inmediato.

**Acceptance Scenarios**:

1. **Given** un proyecto compartido, **When** el owner remueve a un miembro,
   **Then** ese miembro pierde el acceso de inmediato y el proyecto
   desaparece de su barra lateral.
2. **Given** un miembro que no es el owner, **When** intenta remover a otro
   miembro, **Then** el sistema rechaza la acción.

---

### Edge Cases

- ¿Qué pasa si dos personas renombran el mismo proyecto casi al mismo tiempo? El
  sistema MUST aplicar la última edición confirmada, sin bloquear a nadie.
- ¿Qué pasa si el owner elimina un proyecto que tiene otros miembros (es
  "Compartido")? El proyecto MUST desaparecer también de la barra lateral del
  resto de los miembros, no solo del owner.
- ¿Qué pasa si un usuario no tiene ningún proyecto todavía? La barra lateral MUST
  mostrar un estado vacío que invite a crear el primer proyecto.
- ¿Qué pasa si el buscador de la barra lateral no encuentra ningún proyecto que
  coincida? MUST mostrarse un estado vacío indicando que no hay resultados.
- ¿Qué pasa si el owner intenta salir de su propio proyecto? El sistema MUST
  impedirlo — un proyecto siempre MUST tener un owner; en su lugar puede
  eliminar el proyecto por completo (ver Historia 4).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a un usuario autenticado crear un proyecto
  nuevo indicando al menos un nombre.
- **FR-002**: El sistema MUST rechazar la creación de un proyecto sin nombre.
- **FR-003**: Al crearse, un proyecto MUST tener como único miembro a su creador,
  con rol de owner, clasificándolo como "Personal" según las reglas ya definidas
  en [001-accounts-invitations](../001-accounts-invitations/spec.md).
- **FR-004**: La barra lateral MUST mostrar dos secciones colapsables
  independientes, "Personal" y "Compartido", listando únicamente los proyectos de
  los que el usuario actual es miembro.
- **FR-005**: El sistema MUST permitir al owner de un proyecto renombrarlo en
  cualquier momento; el nuevo nombre MUST reflejarse para todos sus miembros.
- **FR-006**: El sistema MUST permitir al owner eliminar un proyecto por completo,
  solicitando confirmación explícita antes de ejecutar la acción por ser
  irreversible.
- **FR-007**: Eliminar un proyecto MUST removerlo (junto con todo lo que
  contiene) de la barra lateral de todos sus miembros de forma inmediata.
- **FR-008**: Solo el owner del proyecto MUST poder renombrarlo o eliminarlo en
  esta versión (mismo modelo de permisos v1 que en invitaciones).
- **FR-009**: Cada proyecto MUST tener su propia configuración (nombre,
  descripción) independiente de la de cualquier otro proyecto; no MUST existir
  configuración global compartida entre proyectos.
- **FR-010**: Cuando un usuario no tiene ningún proyecto, la barra lateral MUST
  mostrar un estado vacío con una acción clara para crear el primero.
- **FR-011**: La barra lateral MUST incluir un buscador que filtre los
  proyectos visibles (en ambas secciones) por coincidencia de texto en el
  nombre, actualizándose mientras el usuario escribe.
- **FR-012**: El sistema MUST permitir al owner remover a cualquier otro
  miembro de su proyecto, revocando su acceso de inmediato.
- **FR-013**: El sistema MUST permitir a cualquier miembro que no sea el
  owner salir de un proyecto compartido voluntariamente en cualquier momento.
- **FR-014**: El sistema MUST impedir que el owner salga de su propio
  proyecto; un proyecto siempre MUST tener exactamente un owner.
- **FR-015**: Cuando remover o la salida de un miembro deja al proyecto con un
  único miembro restante, el sistema MUST reclasificarlo como "Personal" de
  inmediato, siguiendo la regla ya definida en
  [001-accounts-invitations](../001-accounts-invitations/spec.md).

### Key Entities

- **Proyecto**: ya definido en [001-accounts-invitations](../001-accounts-invitations/spec.md);
  esta feature agrega los atributos de nombre, descripción opcional y fecha de
  creación, y el comportamiento de creación/edición/eliminación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede crear un proyecto nuevo en menos de 15 segundos
  desde la barra lateral.
- **SC-002**: El 100% de los proyectos de un usuario aparecen agrupados
  correctamente en "Personal" o "Compartido" sin intervención manual.
- **SC-003**: Al eliminar un proyecto compartido, deja de ser visible para todos
  sus miembros sin que cada uno deba refrescar manualmente más de una vez.
- **SC-004**: Un usuario puede ubicar y abrir un proyecto específico entre 50
  proyectos propios en menos de 10 segundos, usando el buscador de la barra
  lateral.
- **SC-005**: Los resultados del buscador de proyectos se actualizan de forma
  percibida como instantánea mientras el usuario escribe (sin espera
  perceptible).

## Assumptions

- Dentro de cada sección (Personal/Compartido), los proyectos se ordenan por
  actividad más reciente primero; el vision doc no especificó un criterio de
  orden explícito.
- La configuración por proyecto en esta versión se limita a nombre y
  descripción; otros ajustes se agregarán en features futuras conforme surja la
  necesidad (Principio VI de la constitución — YAGNI).
- Eliminar un proyecto es una acción definitiva (hard delete), sin papelera ni
  posibilidad de restauración en esta versión.
- Esta spec asume y reutiliza el modelo de Cuenta, Membresía e Invitación, y la
  regla de clasificación Personal/Compartido, ya definidos en
  [001-accounts-invitations](../001-accounts-invitations/spec.md); no los
  redefine aquí.
- Transferir la propiedad (owner) de un proyecto a otro miembro queda fuera de
  esta spec (*ahora en alcance de [007-roles-permissions](../007-roles-permissions/spec.md),
  FR-011 y FR-013*); en esta versión, un owner que ya no quiere gestionar el proyecto
  solo puede eliminarlo por completo, no transferirlo.
