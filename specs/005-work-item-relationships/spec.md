# Feature Specification: Relaciones entre Work Items

**Feature Branch**: `005-work-item-relationships`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Relaciones entre Work Items: permitir vincular Work Items entre sí mediante dos tipos de relación — jerárquica (padre/hijo, un work item puede tener un padre y múltiples hijos) y no jerárquica ("relacionado con", vínculo simétrico entre dos work items sin jerarquía). Esta feature es la Fase 2, punto 5 del roadmap, y estaba explícitamente fuera de alcance de 004-work-items. Debe permitir: crear/eliminar una relación entre dos work items del mismo proyecto, ver en cada work item sus relaciones (padre, hijos, relacionados), y evitar ciclos en las relaciones padre/hijo. La vista de detalle dedicada donde se mostrarán estas relaciones es una feature separada y posterior (Fase 2, punto 6) — no la construyas aquí, pero la spec debe dejar claro qué datos/contratos necesitará esa vista futura."

## Clarifications

### Session 2026-09-16

- Q: ¿Un Work Item hijo puede a su vez ser padre de otros Work Items, o la
  jerarquía se limita a un único nivel padre-hijo? → A: Anidación arbitraria —
  un hijo puede a su vez tener sus propios hijos, formando un árbol de
  cualquier profundidad.
- Q: ¿Qué debe pasar con los Work Items hijos cuando se elimina el Work Item
  padre? → A: Quedan huérfanos — permanecen en el tablero como Work Items
  independientes, solo pierden la referencia al padre eliminado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vincular un Work Item como hijo de otro (Priority: P1)

Un miembro convierte un Work Item existente en hijo de otro Work Item del mismo
proyecto, para modelar que el primero es una subtarea del segundo.

**Why this priority**: Es el tipo de relación central que motiva la feature —
sin ella no existe la jerarquía padre/hijo descrita en la visión del producto.

**Independent Test**: Puede probarse vinculando dos Work Items existentes como
padre/hijo y verificando que el hijo aparece listado bajo el padre y que el
padre aparece referenciado desde el hijo.

**Acceptance Scenarios**:

1. **Given** dos Work Items del mismo proyecto sin relación entre sí, **When**
   un miembro define uno como hijo del otro, **Then** el hijo queda asociado a
   ese padre y ambos reflejan la relación de inmediato.
2. **Given** un Work Item que ya tiene un padre, **When** un miembro intenta
   asignarle un segundo padre, **Then** el sistema rechaza la acción (un Work
   Item MUST tener a lo sumo un padre a la vez).
3. **Given** un Work Item, **When** un miembro intenta convertirlo en hijo de
   sí mismo, **Then** el sistema rechaza la acción.

---

### User Story 2 - Vincular dos Work Items como "relacionado con" (Priority: P1)

Un miembro vincula dos Work Items del mismo proyecto con una relación simple de
"relacionado con", sin que ninguno sea padre del otro, para dejar constancia de
que tienen algo que ver entre sí.

**Why this priority**: Es el segundo tipo de relación explícitamente requerido
por el producto y es independiente de la relación padre/hijo; puede entregarse
y probarse por separado.

**Independent Test**: Puede probarse vinculando dos Work Items existentes como
"relacionados" y verificando que cada uno aparece en la lista de relacionados
del otro.

**Acceptance Scenarios**:

1. **Given** dos Work Items del mismo proyecto sin relación entre sí, **When**
   un miembro los vincula como "relacionado con", **Then** cada uno pasa a
   listar al otro como relacionado, de forma simétrica.
2. **Given** dos Work Items ya vinculados como relacionados, **When** un
   miembro intenta crear el mismo vínculo de nuevo, **Then** el sistema no
   duplica la relación.
3. **Given** un Work Item, **When** un miembro intenta relacionarlo consigo
   mismo, **Then** el sistema rechaza la acción.

---

### User Story 3 - Ver las relaciones de un Work Item (Priority: P2)

Un miembro abre un Work Item y ve, junto al resto de sus datos, su padre (si
tiene), su lista de hijos y su lista de relacionados, cada uno navegable hacia
el Work Item correspondiente.

**Why this priority**: Sin visibilidad, crear relaciones no aporta valor
práctico; pero depende de que ya existan relaciones creadas (US1/US2), por eso
va después.

**Independent Test**: Puede probarse abriendo un Work Item con relaciones ya
creadas y verificando que padre, hijos y relacionados aparecen listados y que
cada uno permite navegar al Work Item vinculado.

**Acceptance Scenarios**:

1. **Given** un Work Item con padre, uno o más hijos y uno o más relacionados,
   **When** un miembro lo abre, **Then** ve las tres listas (padre, hijos,
   relacionados) con el identificador visible y título de cada Work Item
   vinculado.
2. **Given** un Work Item sin ninguna relación, **When** un miembro lo abre,
   **Then** el sistema indica claramente que no tiene relaciones, sin mostrar
   listas vacías confusas.

---

### User Story 4 - Quitar una relación entre dos Work Items (Priority: P2)

Un miembro elimina una relación (padre/hijo o "relacionado con") entre dos Work
Items que ya no debe existir, sin afectar a ninguno de los dos Work Items en sí.

**Why this priority**: Cierra el ciclo de vida de una relación; necesaria pero
de uso menos frecuente que crearla o verla.

**Independent Test**: Puede probarse quitando una relación existente entre dos
Work Items y verificando que ambos dejan de listarse mutuamente, sin que
ninguno de los dos Work Items desaparezca.

**Acceptance Scenarios**:

1. **Given** dos Work Items vinculados como padre/hijo, **When** un miembro
   quita esa relación desde cualquiera de los dos, **Then** ambos dejan de
   referenciarse como padre/hijo y ninguno se elimina.
2. **Given** dos Work Items vinculados como "relacionado con", **When** un
   miembro quita esa relación, **Then** ambos dejan de listarse como
   relacionados.

---

### Edge Cases

- ¿Qué pasa si un miembro intenta convertir un Work Item en hijo de uno de sus
  propios descendientes (por ejemplo, hacer que un padre pase a ser hijo de su
  propio hijo o nieto)? El sistema MUST rechazar la acción por crear un ciclo.
  La jerarquía padre/hijo admite anidación arbitraria (un hijo puede a su vez
  ser padre de otros Work Items, formando un árbol de cualquier profundidad),
  por lo que la detección de ciclos MUST considerar toda la cadena de
  ancestros, no solo el padre directo.
- ¿Qué ocurre con los Work Items hijos cuando se elimina el Work Item padre?
  Quedan huérfanos: permanecen en el tablero como Work Items independientes y
  completos, y solo pierden la referencia a ese padre.
- ¿Qué pasa si se elimina un Work Item que tiene relaciones "relacionado con"
  activas? El sistema MUST eliminar automáticamente esas relaciones junto con
  el Work Item (no deja vínculos huérfanos apuntando a un Work Item
  inexistente).
- ¿Qué pasa si dos miembros intentan crear la misma relación casi al mismo
  tiempo? El sistema MUST evitar duplicados, sin importar el orden de llegada.
- ¿Qué pasa si un miembro intenta vincular (como padre/hijo o como
  relacionado) dos Work Items de proyectos distintos? El sistema MUST
  impedirlo; las relaciones solo existen entre Work Items del mismo proyecto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a cualquier miembro del proyecto
  definir un Work Item existente como hijo de otro Work Item del mismo
  proyecto.
- **FR-002**: Un Work Item MUST tener a lo sumo un padre a la vez; el sistema
  MUST rechazar el intento de asignarle un segundo padre mientras ya tenga uno
  (sin quitar antes la relación existente).
- **FR-003**: Un Work Item MUST poder tener múltiples hijos simultáneamente,
  sin límite artificial en su cantidad.
- **FR-004**: El sistema MUST rechazar cualquier relación padre/hijo que
  introduzca un ciclo (un Work Item no puede ser, directa o
  transitivamente, padre de sí mismo). La jerarquía admite anidación
  arbitraria: un Work Item hijo MUST poder a su vez tener sus propios hijos,
  y la validación de ciclos MUST revisar toda la cadena de ancestros del
  posible padre, no solo su relación directa.
- **FR-005**: El sistema MUST permitir a cualquier miembro del proyecto
  vincular dos Work Items existentes del mismo proyecto con una relación
  simétrica de "relacionado con".
- **FR-006**: El sistema MUST rechazar una relación "relacionado con" entre un
  Work Item y sí mismo, y MUST evitar crear el mismo vínculo "relacionado con"
  dos veces entre el mismo par de Work Items.
- **FR-007**: El sistema MUST impedir crear cualquier relación (padre/hijo o
  "relacionado con") entre dos Work Items que pertenezcan a proyectos
  distintos.
- **FR-008**: El sistema MUST permitir a cualquier miembro del proyecto quitar
  una relación existente (padre/hijo o "relacionado con") desde cualquiera de
  los dos Work Items involucrados, sin eliminar ninguno de los dos Work Items.
- **FR-009**: El sistema MUST mostrar, para cada Work Item, su padre (si
  tiene), la lista completa de sus hijos y la lista completa de sus
  relacionados, cada uno identificado por su identificador visible y título.
- **FR-010**: Cada Work Item, hijo o relacionado, listado en una relación MUST
  ser navegable hacia ese Work Item.
- **FR-011**: Al eliminar un Work Item, el sistema MUST eliminar también todas
  las relaciones "relacionado con" en las que participaba, sin dejar vínculos
  huérfanos.
- **FR-012**: Al eliminar un Work Item que tiene hijos, el sistema MUST
  preservar a cada hijo como Work Item independiente en el tablero,
  quitándole únicamente la referencia al padre eliminado (los hijos quedan
  huérfanos, no se eliminan en cascada).
- **FR-013**: Al eliminar un Work Item que tiene padre, el sistema MUST quitar
  la referencia desde ese padre (el padre deja de listarlo como hijo), sin
  afectar al resto de los hijos del padre.
- **FR-014**: Cada cambio de relación (crear o quitar una relación padre/hijo
  o "relacionado con") sobre un Work Item MUST registrarse en su log de
  actividad, consistente con el requisito de auditoría de la constitución.

### Key Entities

- **Relación entre Work Items**: vínculo entre dos Work Items del mismo
  proyecto. Tiene un tipo — anidación (padre/hijo) o asociación
  ("relacionado con") — y referencia a los dos Work Items vinculados. En la
  anidación el orden importa (uno es el padre, el otro el hijo); en la
  asociación es simétrica (no hay un lado "origen" ni "destino"). Los datos
  mínimos que expone (padre de un Work Item, lista de hijos, lista de
  relacionados, cada uno con identificador visible y título) son los que
  necesitará la futura vista de detalle dedicada (Fase 2, punto 6) para
  renderizarlos y permitir navegar entre ellos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede crear una relación (padre/hijo o "relacionado
  con") entre dos Work Items existentes en menos de 10 segundos.
- **SC-002**: El sistema previene el 100% de los intentos de crear un ciclo en
  las relaciones padre/hijo o una relación entre proyectos distintos.
- **SC-003**: Un miembro puede identificar el padre, todos los hijos y todos
  los relacionados de un Work Item sin tener que abrir por separado cada Work
  Item del proyecto para buscarlos.
- **SC-004**: Quitar una relación se refleja de inmediato para quien la quita
  y, a más tardar, la próxima vez que el resto de los miembros abre alguno de
  los dos Work Items involucrados.

## Assumptions

- Cualquier miembro del proyecto (no solo el owner) puede crear y quitar
  relaciones entre Work Items, consistente con el modelo de permisos ya
  asumido para Work Items en
  [004-work-items](../004-work-items/spec.md#assumptions). Roles y permisos
  diferenciados quedan para la Fase 2, punto 7 del roadmap, y no se anticipan
  aquí.
- Las relaciones solo pueden crearse entre Work Items de un mismo proyecto; no
  existen relaciones entre Work Items de proyectos distintos (ver FR-007).
- No existe límite artificial en la cantidad de hijos ni de relaciones
  "relacionado con" que puede acumular un Work Item, consistente con el
  Principio II de la constitución (sin límites artificiales), aplicado aquí
  por analogía a las relaciones de contenido.
- Esta spec no incluye la vista de detalle dedicada de Work Item (Fase 2,
  punto 6 del roadmap); mientras esa vista no exista, las relaciones se crean,
  quitan y visualizan desde el panel de detalle de Work Item ya existente
  (`WorkItemDetailPanel`, ver
  [001-accounts-invitations/contracts/work-items.md](../001-accounts-invitations/contracts/work-items.md)).
  Los datos que esta spec expone (padre, hijos, relacionados) están pensados
  para ser reutilizados sin cambios por esa vista futura.
- Vincular un Work Item como hijo de otro no cambia su columna/stage actual;
  un Work Item hijo sigue siendo un Work Item independiente y completo que se
  mueve entre columnas igual que cualquier otro, según lo ya definido en
  [004-work-items](../004-work-items/spec.md).
