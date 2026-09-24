# Feature Specification: Detalle colaborativo de Work Item

**Feature Branch**: `codex/012-work-item-discussion`
**Created**: 2026-09-24
**Status**: Confirmed
**Input**: Vista de Work Item inspirada en la estructura de Azure DevOps y la estética oscura de GitLab: encabezado, descripción, conversación y columna lateral. Incluir comentarios, estimación y registros individuales de tiempo, historial técnico en pestaña secundaria e icono de la app. No agregar stakeholder, root cause, CI/CD ni otros campos de las referencias.

## Clarifications

- 2026-09-24: La estimación se guarda por Work Item; el tiempo invertido consiste en registros individuales.
- 2026-09-24: El changelog no forma parte de la conversación. Se accede desde una pestaña secundaria de Historial.

## User Scenarios & Testing

### User Story 1 — Leer y editar un detalle claro (P1)

Un miembro abre un Work Item y ve primero ID, título y estado. En escritorio, la columna izquierda agrupa asignado, etiquetas, prioridad, severidad, área, iteración, fechas y horas; el centro contiene descripción, relaciones y discusión. En móvil se apila sin scroll horizontal global.

**Independent Test**: Abrir un WI existente, editar título, descripción y atributos, guardar y recargar; navegar a relaciones sin perder la ruta.

### User Story 2 — Conversar en un Work Item (P1)

Cualquier miembro del proyecto, incluido Viewer, puede publicar un comentario de texto plano. Se muestra autor y fecha, de más antiguo a más nuevo. Un usuario ajeno no puede leer ni comentar.

**Independent Test**: Dos miembros abren el mismo WI; uno comenta y el otro lo ve al recargar. Viewer comenta pero no edita campos.

### User Story 3 — Estimar y registrar horas (P2)

Owner o Member fija una estimación en horas y registra entradas positivas de tiempo con nota opcional. El total se calcula de las entradas. El autor puede eliminar una entrada errónea si conserva permiso de edición.

**Independent Test**: Estimar 8 h, registrar 1.5 h y 0.5 h, comprobar 2 h; eliminar la propia entrada y comprobar 0.5 h.

### User Story 4 — Consultar historial por separado (P2)

Una pestaña de Historial muestra la auditoría existente. Detalles es la vista predeterminada y contiene solo comentarios humanos.

**Independent Test**: Editar un campo, abrir Historial y ver el evento; volver a Detalles y ver la discusión separada.

### User Story 5 — Reconocer la app (P3)

La pestaña del navegador muestra un icono SVG propio del Kanban en fondos claros y oscuros.

## Edge Cases

- Comentarios vacíos o de más de 10 000 caracteres, y tiempo no positivo, se rechazan sin escribir.
- Ninguna acción confía en un projectId del cliente; se deriva del WI y se verifica membresía o permiso.
- Eliminar el WI borra sus comentarios y entradas por cascada.
- Los comentarios y entradas conservan el nombre del autor si sale del proyecto.
- Viewer solo ve controles de comentario; edición y tiempo permanecen deshabilitados.

## Functional Requirements

- **FR-001**: La ruta de detalle MUST mostrar encabezado, descripción, discusión, relaciones y metadatos en layout adaptable; conservar navegación y edición existentes.
- **FR-002**: Solo miembros MUST poder leer comentarios y entradas de tiempo.
- **FR-003**: Todo miembro, incluido Viewer, MUST poder publicar comentario no vacío de texto plano (máximo 10 000 caracteres) con autor y fecha.
- **FR-004**: Owner y Member MUST poder guardar estimación opcional no negativa en minutos enteros, presentada en horas.
- **FR-005**: Owner y Member MUST poder crear entradas positivas en minutos enteros, con nota opcional hasta 500 caracteres; el total MUST derivarse de entradas.
- **FR-006**: El autor de una entrada MUST poder quitarla mientras conserve `workItem:edit`; el total MUST actualizarse.
- **FR-007**: Comentarios, estimación y operaciones de tiempo MUST escribir auditoría, sin mezclarla con discusión.
- **FR-008**: La auditoría existente MUST quedar accesible en pestaña secundaria.
- **FR-009**: La app MUST servir un icono propio en el navegador.
- **FR-010**: La UI MUST evitar referencias o integraciones con Git/CI/CD.

## Key Entities

- `Work Item`: agrega `estimate_minutes` nullable; el total invertido no se almacena.
- `Work Item Comment`: cuerpo, autor, nombre al crear, fecha, WI y `publicId`.
- `Work Item Time Entry`: minutos, nota opcional, autor, nombre al crear, fecha, WI y `publicId`.

## Success Criteria

- **SC-001**: Un comentario persiste tras recargar; Viewer comenta sin poder editar campos.
- **SC-002**: El total suma exactamente las entradas y se recalcula al eliminar una.
- **SC-003**: En viewport de 390 px, la página es utilizable sin scroll horizontal global.
- **SC-004**: Historial solo aparece en su pestaña; discusión no muestra eventos técnicos.
- **SC-005**: Miembros de otros proyectos no leen ni modifican comentarios ni tiempo.

## Assumptions

- Descripción y comentarios son texto plano, coherentes con la fase actual.
- No se agregan notificaciones, menciones, adjuntos, reacciones ni editor enriquecido.
- Comentarios publicados son inmutables; una corrección se publica como otro comentario.
- La UI propone incrementos de 15 minutos; el servidor admite minutos enteros.
