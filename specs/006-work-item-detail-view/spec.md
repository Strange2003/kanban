# Feature Specification: Vista de Detalle de Work Item

**Feature Branch**: `006-work-item-detail-view`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Vista de detalle de Work Item: una pantalla dedicada (no un panel/dialog modal como el actual WorkItemDetailPanel) para ver y editar un Work Item completo — título, descripción, stakeholder, tags, y sus relaciones (padre, hijos, relacionados de 005-work-item-relationships), más el log de actividad. Es la Fase 2, punto 6 del roadmap, y estaba anticipada explícitamente en las Assumptions de 005-work-item-relationships y en el Principio I de la constitución. Actualmente todo lo que hará esta vista ya existe pero comprimido dentro de un panel modal pequeño que abre cada tarjeta del tablero; esta feature le da su propia pantalla/ruta dedicada con más espacio y mejor navegación entre Work Items relacionados. No cambia el modelo de datos ni las Server Actions de 004/005 — es principalmente una feature de UI/navegación sobre lo que ya existe."

## Clarifications

### Session 2026-09-17

- Q: ¿Al hacer clic en una tarjeta del tablero, el sistema navega
  directamente a la vista de detalle dedicada (reemplazando por completo al
  panel modal actual), o el modal se mantiene para edición rápida y la vista
  dedicada se abre por separado? → A: Reemplazo completo — hacer clic en una
  tarjeta navega a la vista dedicada; `WorkItemDetailPanel` deja de usarse
  para esta interacción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir un Work Item en su propia pantalla (Priority: P1)

Un miembro hace clic en un Work Item del tablero y en vez de un panel modal pequeño, navega a una pantalla dedicada con todo el detalle de ese Work Item.

**Why this priority**: Es el cambio central de esta feature — sin la navegación a una pantalla propia, el resto de las historias (edición con más espacio, navegación entre relaciones) no tiene dónde vivir.

**Independent Test**: Puede probarse haciendo clic en un Work Item del tablero y verificando que la URL cambia a una específica de ese Work Item y que la pantalla muestra su información completa.

**Acceptance Scenarios**:

1. **Given** un tablero con Work Items, **When** un miembro hace clic en uno, **Then** navega a una pantalla dedicada a ese Work Item, con una dirección propia (se puede recargar la página o compartir el enlace y sigue mostrando el mismo Work Item).
2. **Given** la vista de detalle abierta, **When** el miembro decide volver, **Then** puede regresar al tablero (por ejemplo con un botón "Volver" o el botón atrás del navegador) y ve el tablero en el mismo estado en que lo dejó.

---

### User Story 2 - Editar los campos de un Work Item desde su vista de detalle (Priority: P1)

Un miembro edita el título, la descripción, el stakeholder o los tags de un Work Item directamente desde su pantalla de detalle.

**Why this priority**: Es la funcionalidad de edición ya existente (004-work-items); debe seguir funcionando igual de bien en la nueva pantalla, si no mejor por el espacio disponible.

**Independent Test**: Puede probarse editando cada campo desde la vista de detalle y verificando que los cambios se guardan y persisten al recargar la página.

**Acceptance Scenarios**:

1. **Given** la vista de detalle de un Work Item, **When** un miembro edita su descripción y guarda, **Then** el cambio persiste y se refleja al recargar la pantalla y al volver al tablero.
2. **Given** la vista de detalle de un Work Item, **When** un miembro agrega o quita tags, **Then** el cambio se refleja tanto en esa pantalla como en la tarjeta del tablero al volver.

---

### User Story 3 - Navegar entre Work Items relacionados desde la vista de detalle (Priority: P1)

Un miembro ve el padre, los hijos y los relacionados de un Work Item desde su vista de detalle, y al hacer clic en cualquiera de ellos navega a la vista de detalle de ese otro Work Item — pudiendo luego volver con el botón atrás del navegador a donde estaba.

**Why this priority**: Es la razón de negocio explícita de esta feature (Principio I de la constitución: "la vista de detalle... MUST permitir navegar sus relaciones... sin fricción") y corrige la limitación actual (el panel modal solo reemplaza su contenido, sin historial de navegación real).

**Independent Test**: Puede probarse abriendo un Work Item con padre, hijos o relacionados, haciendo clic en uno de ellos, verificando que la pantalla cambia a ese otro Work Item, y que el botón atrás del navegador vuelve al Work Item anterior.

**Acceptance Scenarios**:

1. **Given** la vista de detalle de un Work Item con al menos una relación, **When** un miembro hace clic en el padre, un hijo o un relacionado, **Then** navega a la vista de detalle de ese Work Item.
2. **Given** un miembro que navegó de un Work Item a otro a través de sus relaciones, **When** usa el botón atrás del navegador, **Then** vuelve a la vista de detalle del Work Item anterior.
3. **Given** la vista de detalle de un Work Item, **When** un miembro crea o quita una relación (padre/hijo o "relacionado con") desde esa misma pantalla, **Then** la relación se refleja de inmediato en la vista, igual que ya ocurre hoy en el panel modal (005-work-item-relationships).

---

### User Story 4 - Ver el historial de actividad de un Work Item (Priority: P2)

Un miembro revisa, desde la vista de detalle, el registro de cambios relevantes del Work Item (cambios de columna, edición de campos, cambios de relación).

**Why this priority**: Ya es una obligación de la constitución (Estándares de Producto y Datos § Auditoría) implementada en el panel modal actual; debe seguir disponible en la nueva pantalla, pero no es el foco central de esta feature.

**Independent Test**: Puede probarse realizando un cambio (mover de columna, editar un campo, crear una relación) y verificando que aparece en el historial de esa pantalla.

**Acceptance Scenarios**:

1. **Given** un Work Item con cambios previos, **When** un miembro abre su vista de detalle, **Then** ve el historial de actividad ordenado del más reciente al más antiguo.

---

### Edge Cases

- ¿Qué pasa si un miembro accede directamente (por URL o enlace compartido) a un Work Item que ya fue eliminado? La pantalla MUST indicar claramente que ya no existe, con una forma de volver al tablero.
- ¿Qué pasa si un miembro que no pertenece al proyecto intenta abrir la vista de detalle de uno de sus Work Items (por ejemplo, por un enlace reenviado)? El sistema MUST impedir el acceso, consistente con el Principio IV de la constitución (aislamiento de datos entre proyectos).
- ¿Qué pasa si dos miembros editan el mismo Work Item casi al mismo tiempo desde vistas de detalle distintas? Se rige por el mismo criterio ya asumido en 004-work-items (último cambio confirmado gana, sin bloqueo optimista).
- ¿Qué pasa si, mientras un miembro navega entre Work Items relacionados, otro miembro elimina uno de ellos? Al intentar navegar a ese Work Item eliminado, MUST mostrarse el mismo estado de "ya no existe" del primer edge case.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST proveer, para cada Work Item, una pantalla de detalle propia con una dirección específica de ese Work Item (recargable y compartible entre miembros del mismo proyecto).
- **FR-002**: Hacer clic en un Work Item desde el tablero MUST navegar a su vista de detalle dedicada, reemplazando por completo la interacción actual de abrir el panel modal (`WorkItemDetailPanel`).
- **FR-003**: La vista de detalle MUST mostrar y permitir editar el título, la descripción, el stakeholder y los tags del Work Item, con el mismo comportamiento ya definido en 004-work-items (FR-007, FR-008, FR-009, FR-012, FR-013 de esa spec).
- **FR-004**: La vista de detalle MUST mostrar el padre (si tiene), los hijos y los relacionados del Work Item, y permitir crearlos y quitarlos, con el mismo comportamiento ya definido en 005-work-item-relationships.
- **FR-005**: Cada Work Item listado como padre, hijo o relacionado MUST ser un enlace de navegación real (no un simple reemplazo de contenido en pantalla) hacia la vista de detalle de ese Work Item.
- **FR-006**: Después de navegar entre Work Items relacionados, el sistema MUST permitir volver al Work Item visto anteriormente usando el botón atrás del navegador.
- **FR-007**: La vista de detalle MUST mostrar el historial de actividad del Work Item (Estándares de Producto y Datos § Auditoría de la constitución), igual que el panel modal actual.
- **FR-008**: La vista de detalle MUST ofrecer una forma de volver al tablero del proyecto, mostrándolo en el mismo estado en que se dejó (misma posición de scroll/columnas visibles no es un requisito estricto, pero MUST mostrar el tablero del mismo proyecto).
- **FR-009**: El sistema MUST permitir eliminar el Work Item desde su vista de detalle, con el mismo comportamiento ya definido en 004-work-items (FR-010, FR-011), volviendo al tablero tras confirmar.
- **FR-010**: El sistema MUST verificar la membresía del proyecto antes de mostrar la vista de detalle de cualquier Work Item, incluyendo accesos directos por dirección/enlace (Principio IV de la constitución).
- **FR-011**: Si el Work Item solicitado no existe (fue eliminado, o la dirección es inválida), el sistema MUST mostrar un estado claro de "no encontrado" con una forma de volver al tablero, en vez de un error genérico o una pantalla en blanco.
- **FR-012**: El panel modal actual (`WorkItemDetailPanel`) queda reemplazado por esta vista dedicada para la interacción de abrir un Work Item desde el tablero — no se elimina ninguna capacidad existente de edición o relaciones, solo cambia dónde vive esa interfaz.

### Key Entities

- Esta feature no introduce entidades ni cambia el modelo de datos — reutiliza exactamente los datos y las reglas de `Work Item`, `Tag`, `WorkItemActivity` (001-accounts-invitations/data-model.md) y `Relación entre Work Items` (005-work-item-relationships/data-model.md) ya existentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede abrir la vista de detalle de cualquier Work Item de un proyecto en un clic desde el tablero.
- **SC-002**: Un miembro puede navegar entre 3 Work Items relacionados entre sí y volver al primero usando solo el botón atrás del navegador, sin perder su lugar.
- **SC-003**: Compartir la dirección de la vista de detalle de un Work Item con otro miembro del mismo proyecto le permite a ese miembro abrir exactamente ese Work Item, sin pasos adicionales.
- **SC-004**: Intentar abrir la vista de detalle de un Work Item ya eliminado, o de un proyecto ajeno, nunca deja a un miembro en una pantalla en blanco o con un error sin salida — siempre hay una forma clara de volver.

## Assumptions

- Esta feature reutiliza exactamente las Server Actions y el modelo de datos ya implementados en 004-work-items y 005-work-item-relationships; no se agregan campos, tablas ni reglas de negocio nuevas — ver el input de esta spec y Principio VI de la constitución (YAGNI).
- El panel modal `WorkItemDetailPanel` deja de usarse para la interacción de "abrir un Work Item desde el tablero"; su lógica de edición/relaciones/actividad se traslada a la nueva pantalla en vez de duplicarse.
- Cualquier miembro del proyecto (no solo el owner) puede ver y editar la vista de detalle, consistente con el modelo de permisos ya asumido para Work Items en 004-work-items y 005-work-item-relationships. Roles y permisos diferenciados quedan para la Fase 2, punto 7 del roadmap.
- El diseño visual de la nueva pantalla (layout, ubicación de cada sección) se decide en la etapa de planificación técnica; esta spec solo fija qué información y qué interacciones debe ofrecer, no su disposición exacta.
