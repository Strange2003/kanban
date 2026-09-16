# Feature Specification: Tablero Kanban (Columnas/Stages)

**Feature Branch**: `003-kanban-board`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Tablero Kanban: cada proyecto tiene un tablero con columnas creadas y eliminadas libremente, cada columna atada 1:1 a un stage del proyecto, columnas reordenables por drag and drop." Depende de que exista un proyecto, definido en [002-project-spaces](../002-project-spaces/spec.md).

## Clarifications

### Session 2026-09-09

- Q: Si el reordenamiento de una columna falla al guardarse, ¿el tablero debe revertir al orden anterior o mantener el orden arrastrado? → A: Revertir al orden anterior y mostrar un aviso de error.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el tablero de un proyecto (Priority: P1)

Un miembro del proyecto entra a él y ve su tablero kanban con las columnas
existentes, una al lado de la otra.

**Why this priority**: Es la vista principal del producto; sin ella no hay forma
de interactuar con el resto de las funcionalidades del tablero.

**Independent Test**: Puede probarse abriendo un proyecto con columnas ya creadas
y verificando que todas se muestran en el orden correcto.

**Acceptance Scenarios**:

1. **Given** un proyecto con columnas existentes, **When** un miembro lo abre,
   **Then** ve todas las columnas del tablero en su orden actual.

---

### User Story 2 - Crear una columna (Priority: P1)

Un miembro agrega una columna nueva al tablero, dándole un nombre, para
representar una nueva etapa del flujo de trabajo.

**Why this priority**: Es la acción fundacional para poder organizar trabajo en el
tablero; sin columnas no puede haber work items.

**Independent Test**: Puede probarse creando una columna en un tablero vacío y
verificando que aparece inmediatamente, junto con su stage asociado.

**Acceptance Scenarios**:

1. **Given** un tablero con o sin columnas, **When** un miembro crea una columna
   ingresando un nombre, **Then** la columna aparece en el tablero y queda
   automáticamente asociada a un stage del proyecto con ese mismo nombre.
2. **Given** un miembro que intenta crear una columna sin nombre, **When**
   confirma la creación, **Then** el sistema rechaza la acción y pide un nombre.

---

### User Story 3 - Reordenar columnas (Priority: P2)

Un miembro arrastra una columna a una nueva posición horizontal para reflejar
mejor el orden real del flujo de trabajo.

**Why this priority**: Mejora la claridad del tablero pero no bloquea el uso
básico si el orden inicial no es perfecto.

**Independent Test**: Puede probarse arrastrando una columna a otra posición y
verificando que el nuevo orden persiste al recargar el tablero.

**Acceptance Scenarios**:

1. **Given** un tablero con al menos dos columnas, **When** un miembro arrastra
   una columna a una nueva posición, **Then** el tablero refleja el nuevo orden de
   inmediato para quien lo hizo.
2. **Given** un nuevo orden de columnas ya guardado, **When** otro miembro abre el
   tablero, **Then** ve las columnas en ese mismo orden actualizado.
3. **Given** un miembro que reordena una columna, **When** el guardado de ese
   nuevo orden falla (por ejemplo, un error de red), **Then** el tablero
   revierte visualmente al último orden confirmado y muestra un aviso de
   error a quien intentó el cambio.

---

### User Story 4 - Eliminar una columna (Priority: P2)

Un miembro elimina una columna vacía que ya no representa una etapa válida del
flujo de trabajo.

**Why this priority**: Es necesaria para mantener el tablero relevante con el
tiempo, pero de uso menos frecuente que crear o ver columnas.

**Independent Test**: Puede probarse eliminando una columna vacía y verificando
que desaparece del tablero junto con su stage asociado; y, por separado,
intentando eliminar una columna con contenido y verificando que el sistema lo
impide.

**Acceptance Scenarios**:

1. **Given** una columna vacía (sin Work Items), **When** un miembro la elimina,
   **Then** la columna y su stage asociado dejan de existir en el proyecto.
2. **Given** una columna que todavía tiene uno o más Work Items, **When** un
   miembro intenta eliminarla, **Then** el sistema impide la acción y explica que
   primero debe mover o eliminar esos Work Items.

---

### User Story 5 - Renombrar una columna (Priority: P3)

Un miembro cambia el nombre de una columna existente para reflejar mejor su
propósito.

**Why this priority**: Es una acción de mantenimiento menor y de baja frecuencia.

**Independent Test**: Puede probarse renombrando una columna existente y
verificando que el nuevo nombre se refleja para todos los miembros.

**Acceptance Scenarios**:

1. **Given** una columna existente, **When** un miembro edita su nombre y guarda,
   **Then** el nuevo nombre se refleja en el tablero para todos los miembros.

---

### Edge Cases

- ¿Qué ocurre al eliminar una columna que todavía tiene Work Items dentro? El
  sistema MUST bloquear la eliminación mientras la columna no esté vacía,
  indicando que sus Work Items deben moverse o eliminarse primero (ver FR-007).
- ¿Un proyecto recién creado arranca con columnas predefinidas o completamente
  vacío? Arranca completamente vacío; el usuario crea sus propias columnas desde
  cero (ver FR-010).
- ¿Qué pasa si dos miembros reordenan columnas al mismo tiempo? El sistema MUST
  aplicar el último reordenamiento confirmado, sin bloquear a nadie ni duplicar
  columnas.
- ¿Qué pasa si el guardado de un reordenamiento falla? El tablero MUST revertir
  al último orden confirmado y mostrar un aviso de error a quien lo intentó
  (ver FR-011).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar el tablero kanban del proyecto en cuanto un
  miembro lo abre, con todas sus columnas en el orden actual.
- **FR-002**: El sistema MUST permitir a cualquier miembro del proyecto crear una
  columna nueva indicando un nombre.
- **FR-003**: Crear una columna MUST crear automáticamente, en la misma
  operación, su stage correspondiente en el proyecto — desde la perspectiva del
  usuario es una sola acción, no dos.
- **FR-004**: El sistema MUST rechazar la creación de una columna sin nombre.
- **FR-005**: El sistema MUST permitir a cualquier miembro reordenar las columnas
  mediante arrastre; el nuevo orden MUST persistir y ser visible para el resto de
  los miembros la próxima vez que abran el tablero.
- **FR-006**: El sistema MUST permitir a cualquier miembro eliminar una columna,
  eliminando también su stage asociado en la misma operación.
- **FR-007**: El sistema MUST impedir eliminar una columna mientras contenga uno
  o más Work Items; MUST informar al usuario que primero debe moverlos o
  eliminarlos.
- **FR-008**: El sistema MUST permitir a cualquier miembro renombrar una columna
  existente, reflejando el cambio para todos los miembros.
- **FR-009**: El sistema MUST NOT imponer un número mínimo de columnas; un
  tablero puede llegar a tener cero columnas.
- **FR-010**: Un proyecto recién creado MUST comenzar sin ninguna columna; el
  sistema no MUST crear columnas por defecto.
- **FR-011**: Si el guardado de un reordenamiento de columnas falla, el
  sistema MUST revertir la vista al último orden confirmado y MUST mostrar un
  aviso de error a quien intentó el cambio.

### Key Entities

- **Stage/Columna**: representa una etapa del flujo de trabajo de un proyecto y,
  al mismo tiempo, su columna visual en el tablero — son una misma entidad vista
  desde dos ángulos, nunca existen por separado. Atributos: nombre, posición/orden
  dentro del tablero, proyecto al que pertenece.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede crear una columna nueva en menos de 10 segundos.
- **SC-002**: Reordenar una columna mediante arrastre se percibe como instantáneo
  para quien lo hace (sin espera perceptible).
- **SC-003**: El resto de los miembros ve el nuevo orden de columnas la próxima
  vez que abre el tablero, sin pasos manuales adicionales.
- **SC-004**: Un tablero soporta al menos 20 columnas sin degradar la fluidez del
  arrastre ni del desplazamiento horizontal.

## Assumptions

- Cualquier miembro del proyecto (no solo el owner) puede crear, renombrar,
  reordenar y eliminar columnas, ya que gestionar la estructura del tablero es una
  actividad colaborativa cotidiana, distinta de acciones sensibles como invitar
  o eliminar el proyecto completo (que sí están restringidas al owner en
  [001](../001-accounts-invitations/spec.md) y [002](../002-project-spaces/spec.md)).
- Esta spec no define el modelo de Work Items en sí (ver
  [004-work-items](../004-work-items/spec.md)); solo cubre la estructura de
  columnas/stages que los contendrá.
