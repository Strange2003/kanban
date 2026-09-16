# Feature Specification: Work Items

**Feature Branch**: `004-work-items`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Work Items: tarjetas dentro de una columna, con ID visible, título, descripción, tags, stakeholder; se crean, editan, mueven entre columnas y se eliminan." Depende de que exista al menos una columna/stage, definida en [003-kanban-board](../003-kanban-board/spec.md). Las relaciones padre/hijo y "relacionado con" entre Work Items quedan fuera de alcance de esta spec (ver roadmap, Fase 2).

## Clarifications

### Session 2026-09-09

- Q: ¿El identificador visible de un Work Item debe ser correlativo por proyecto o único a nivel de toda la app? → A: Correlativo por proyecto (ej. "KAN-42").
- Q: ¿La descripción de un Work Item debe soportar formato enriquecido o texto plano? → A: Texto plano en esta versión.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear un Work Item en una columna (Priority: P1)

Un miembro agrega un Work Item nuevo a una columna del tablero, dándole al menos
un título, para empezar a registrar una tarea.

**Why this priority**: Es la unidad básica de trabajo del producto; sin ella el
tablero no tiene ningún propósito práctico.

**Independent Test**: Puede probarse creando un Work Item en una columna vacía y
verificando que aparece con un identificador visible y el título ingresado.

**Acceptance Scenarios**:

1. **Given** una columna existente, **When** un miembro crea un Work Item
   ingresando un título, **Then** el Work Item aparece en esa columna con un
   identificador único y visible.
2. **Given** un miembro que intenta crear un Work Item sin título, **When**
   confirma la creación, **Then** el sistema rechaza la acción y pide un título.

---

### User Story 2 - Mover un Work Item entre columnas (Priority: P1)

Un miembro arrastra un Work Item de una columna a otra para reflejar su avance
real en el flujo de trabajo.

**Why this priority**: Es la interacción central de cualquier tablero kanban; el
producto no cumple su propósito sin ella.

**Independent Test**: Puede probarse arrastrando un Work Item existente a otra
columna y verificando que su stage/estado cambia de inmediato.

**Acceptance Scenarios**:

1. **Given** un Work Item en una columna, **When** un miembro lo arrastra a otra
   columna, **Then** el Work Item queda asociado al stage de la nueva columna de
   inmediato.
2. **Given** un Work Item movido de columna, **When** otro miembro abre el
   tablero, **Then** lo ve en su nueva columna.

---

### User Story 3 - Editar los detalles de un Work Item (Priority: P2)

Un miembro abre un Work Item y edita su título, descripción, tags o stakeholder
para mantener la información actualizada.

**Why this priority**: Agrega valor sobre la funcionalidad mínima de crear/mover,
pero el tablero ya es usable sin edición posterior a la creación.

**Independent Test**: Puede probarse editando cada campo de un Work Item existente
y verificando que los cambios se guardan y se reflejan al reabrirlo.

**Acceptance Scenarios**:

1. **Given** un Work Item existente, **When** un miembro edita su descripción y
   guarda, **Then** el cambio se refleja al reabrir el Work Item.
2. **Given** un Work Item existente, **When** un miembro le agrega uno o más tags
   ya existentes en el catálogo del proyecto, **Then** los tags actualizados se
   reflejan tanto en el detalle como en la tarjeta del tablero.
3. **Given** un miembro editando los tags de un Work Item, **When** escribe el
   nombre de un tag que todavía no existe en el proyecto y confirma crearlo,
   **Then** el tag se agrega al catálogo del proyecto y queda aplicado a ese Work
   Item, disponible para elegir en futuros Work Items.
4. **Given** un Work Item existente, **When** un miembro edita el campo
   stakeholder, **Then** el nuevo valor se refleja en el detalle del Work Item.

---

### User Story 4 - Eliminar un Work Item (Priority: P2)

Un miembro elimina un Work Item que ya no es relevante.

**Why this priority**: Necesaria para mantener el tablero limpio, pero de uso
menos frecuente que crear, mover o editar.

**Independent Test**: Puede probarse eliminando un Work Item existente y
verificando que desaparece del tablero para todos los miembros.

**Acceptance Scenarios**:

1. **Given** un Work Item existente, **When** un miembro lo elimina tras
   confirmar, **Then** deja de aparecer en el tablero para todos los miembros.

---

### User Story 5 - Reordenar Work Items dentro de una columna (Priority: P3)

Un miembro cambia el orden vertical de los Work Items dentro de una misma columna
para priorizar visualmente cuáles importan más.

**Why this priority**: Mejora la organización pero no es indispensable para que el
tablero funcione.

**Independent Test**: Puede probarse arrastrando un Work Item a otra posición
dentro de la misma columna y verificando que el nuevo orden persiste.

**Acceptance Scenarios**:

1. **Given** una columna con varios Work Items, **When** un miembro arrastra uno
   a una nueva posición dentro de la misma columna, **Then** el nuevo orden
   persiste y es visible para el resto de los miembros.

---

### Edge Cases

- ¿Qué pasa si se intenta crear un Work Item en un proyecto que todavía no tiene
  ninguna columna? El sistema MUST impedirlo, guiando al usuario a crear una
  columna primero.
- ¿Qué pasa si dos miembros mueven el mismo Work Item a columnas distintas casi al
  mismo tiempo? El sistema MUST aplicar el último movimiento confirmado, sin
  duplicar el Work Item.
- ¿Qué pasa si se elimina la columna en la que está un Work Item? Se rige por la
  regla definida en [003-kanban-board](../003-kanban-board/spec.md) para
  eliminación de columnas con contenido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a cualquier miembro crear un Work Item
  dentro de una columna existente, indicando al menos un título.
- **FR-002**: El sistema MUST rechazar la creación de un Work Item sin título.
- **FR-003**: Cada Work Item MUST recibir un identificador visible correlativo
  dentro de su proyecto al crearse (por ejemplo, "KAN-42", combinando un
  prefijo del proyecto y un número secuencial), único dentro de ese proyecto.
- **FR-004**: El sistema MUST asociar cada Work Item a exactamente una columna
  (y por lo tanto a un stage) en todo momento.
- **FR-005**: El sistema MUST permitir a cualquier miembro mover un Work Item de
  una columna a otra mediante arrastre; el cambio de stage MUST reflejarse de
  inmediato.
- **FR-006**: El sistema MUST permitir a cualquier miembro reordenar los Work
  Items dentro de una misma columna.
- **FR-007**: El sistema MUST permitir a cualquier miembro editar el título, la
  descripción, los tags y el stakeholder de un Work Item existente.
- **FR-008**: Los tags MUST provenir de un catálogo definido a nivel de proyecto;
  un Work Item solo puede etiquetarse con tags que existan en ese catálogo.
- **FR-009**: El campo stakeholder MUST aceptarse como texto libre (no
  necesariamente un miembro del proyecto ni una cuenta del sistema), siguiendo el
  mismo uso que tiene en Azure DevOps citado como referencia.
- **FR-010**: El sistema MUST permitir a cualquier miembro eliminar un Work Item,
  solicitando confirmación antes de ejecutar la acción por ser irreversible.
- **FR-011**: Eliminar un Work Item MUST removerlo del tablero para todos los
  miembros de forma inmediata.
- **FR-012**: El sistema MUST permitir a cualquier miembro crear un tag nuevo en
  el catálogo del proyecto directamente desde el flujo de etiquetar un Work Item,
  sin requerir una pantalla de configuración separada; el tag creado MUST quedar
  disponible para etiquetar cualquier otro Work Item del mismo proyecto.
- **FR-013**: La descripción de un Work Item MUST almacenarse y mostrarse como
  texto plano en esta versión, sin formato enriquecido (markdown u otro).

### Key Entities

- **Work Item**: unidad de trabajo dentro de una columna/stage. Atributos:
  identificador visible correlativo por proyecto (ej. "KAN-42"), título,
  descripción (texto plano), lista de tags, stakeholder, columna/stage
  actual, posición dentro de esa columna.
- **Tag**: etiqueta del catálogo de un proyecto, reutilizable entre sus Work
  Items para clasificarlos o filtrarlos. Atributos: nombre (único dentro del
  proyecto), proyecto al que pertenece.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede crear un Work Item nuevo en menos de 10 segundos
  desde el tablero.
- **SC-002**: Mover un Work Item entre columnas se percibe como instantáneo para
  quien lo hace (sin espera perceptible).
- **SC-003**: El resto de los miembros ve un Work Item movido o editado la
  próxima vez que abre el tablero, sin pasos manuales adicionales.
- **SC-004**: Una columna soporta al menos 100 Work Items sin degradar la
  fluidez del arrastre ni del desplazamiento.

## Assumptions

- Cualquier miembro del proyecto (no solo el owner) puede crear, editar, mover y
  eliminar Work Items, de forma consistente con el modelo de permisos ya asumido
  para columnas en [003-kanban-board](../003-kanban-board/spec.md).
- Eliminar un Work Item es una acción definitiva (hard delete), sin papelera ni
  posibilidad de restauración en esta versión, consistente con el criterio ya
  asumido para proyectos en [002-project-spaces](../002-project-spaces/spec.md).
- Esta spec no incluye relaciones entre Work Items (padre/hijo ni "relacionado
  con"); esas quedan para una feature posterior dedicada, según el roadmap
  acordado.
- Campos adicionales vistos en Azure DevOps (prioridad, severidad, área,
  iteración, discusión/comentarios) quedan fuera de esta spec; son candidatos a
  evaluar en fases posteriores, según el Principio VI de la constitución (YAGNI).
- La gestión explícita del catálogo de tags (renombrar o eliminar un tag ya
  creado, elegirle un color) queda fuera de esta spec; en esta versión el
  catálogo solo crece mediante la creación inline descrita en FR-012. Se
  evaluará una pantalla de gestión dedicada si la necesidad se confirma más
  adelante.
- Los nombres de tag son únicos dentro de un mismo proyecto (no distingue
  mayúsculas/minúsculas); intentar crear un tag con un nombre ya existente
  simplemente lo selecciona en vez de duplicarlo.
- Soportar formato enriquecido (markdown) en la descripción queda como mejora
  candidata para una fase posterior; el campo ya modelado como texto plano no
  requiere un cambio de esquema para habilitarlo más adelante.
- El prefijo usado en el identificador correlativo (ej. "KAN") se deriva del
  proyecto (por ejemplo, de su nombre); la regla exacta de generación de ese
  prefijo se resuelve en la etapa de planificación técnica.
