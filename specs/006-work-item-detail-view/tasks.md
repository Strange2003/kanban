---

description: "Task list for 006-work-item-detail-view implementation"
---

# Tasks: Vista de Detalle de Work Item

**Input**: Design documents from `specs/006-work-item-detail-view/`
(plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅,
quickstart.md ✅ (todos generados por `/speckit-plan`).

**Tests**: Se incluye un test unitario para la resolución de
`displayNumber` y un test e2e por historia de usuario, mismo criterio que
[005-work-item-relationships/tasks.md](../005-work-item-relationships/tasks.md).

**Organization**: Tareas agrupadas por historia de usuario de
[spec.md](spec.md) (US1, US2, US3 son P1; US4 es P2). Cada historia usa la
etiqueta `[F6-US<m>]` (`F6` = 006-work-item-detail-view), siguiendo la
convención de [AGENTS.md](../../AGENTS.md#working-with-tasksmd).

**Nota sobre dependencia entre historias**: a diferencia de una feature
típica de spec-kit, las 4 historias de esta feature no son independientes
entre sí en el sentido usual — todas agregan contenido al **mismo**
componente (`WorkItemDetailView.tsx`) creado en US1, porque las 4 viven en
una sola pantalla. Por eso US2/US3/US4 dependen de que US1 exista, no solo
de la fase Foundational.

**Sin fase de Setup separada**: esta feature no agrega dependencias ni
herramientas nuevas (plan.md § Technical Context). Se empieza directo en
Foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin
  dependencias de tareas incompletas)
- **[Story]**: `[F6-US<m>]` — a qué historia de esta spec pertenece
- Cada descripción incluye la ruta exacta de archivo

## Path Conventions

Mismo monolito Next.js (`app/`, `lib/`, `components/`, `tests/` en la raíz
del repositorio) — ver plan.md § Project Structure.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: La función de resolución de ruta que toda historia necesita.
**⚠️ CRITICAL**: ninguna historia de usuario puede empezar hasta completar
esta fase.

- [X] T001 Implementar `getWorkItemByDisplayNumber(projectPublicId, displayNumber)` en `lib/actions/work-items.ts`: valida membresía con `requireProjectMember` primero, busca `work_items` por `(projectId, displayNumber)`, retorna `NOT_FOUND` si no existe (data-model.md § Acceso nuevo; FR-001/FR-010/FR-011 — contracts/work-item-detail-view.md)

**Checkpoint**: resolución de ruta lista — las historias de usuario pueden empezar.

---

## Phase 2: [F6-US1] Abrir un Work Item en su propia pantalla (Priority: P1) 🎯 MVP

**Goal**: Un miembro hace clic en un Work Item del tablero y navega a una
pantalla dedicada con URL propia, recargable y con vuelta al tablero.

**Independent Test**: Hacer clic en un Work Item del tablero, verificar que
la URL cambia a una específica de ese Work Item, que recargar la página
conserva su contenido, y que se puede volver al tablero.

**Depends on**: Phase 1 (Foundational).

- [X] T002 [F6-US1] Crear `components/work-items/WorkItemDetailView.tsx` (client component, esqueleto inicial): recibe `workItem` y `projectPublicId` por props, muestra encabezado con `displayId`/título y un `<Link>` "Volver al tablero" hacia `/projects/[projectPublicId]` (FR-008)
- [X] T003 [F6-US1] Crear la ruta `app/(workspace)/projects/[projectPublicId]/work-items/[displayNumber]/page.tsx` (Server Component): parsea `displayNumber` de los params, llama a `getWorkItemByDisplayNumber` (T001) y a `getWorkItemDetailData` (ya existente de 005-work-item-relationships); invoca `notFound()` genérico solo ante `FORBIDDEN` (no revela si el Work Item existe a quien no es miembro), y ante `NOT_FOUND`/`displayNumber` inválido renderiza un estado en línea con enlace de vuelta al tablero (FR-011); renderiza `WorkItemDetailView` en el caso feliz (mismo patrón que `app/(workspace)/projects/[projectPublicId]/page.tsx` con `getBoard`)
- [X] T004 [F6-US1] Modificar `components/board/WorkItemCard.tsx`: el `onClick` de la tarjeta llama a `router.push(`/projects/${projectPublicId}/work-items/${workItem.displayNumber}`)` (`useRouter` de `next/navigation`) en vez de abrir `WorkItemDetailPanel`; quitar el estado `open`/`useState` y el import de `WorkItemDetailPanel` (research.md § Reemplazar el modal por navegación real)
- [X] T005 [P] [F6-US1] Test unitario de `getWorkItemByDisplayNumber`: `displayNumber` inexistente devuelve `NOT_FOUND`, `displayNumber` de otro proyecto devuelve `NOT_FOUND` (no debe filtrarse entre proyectos), en `tests/unit/work-items.test.ts`
- [X] T006 [P] [F6-US1] Test e2e: clic en una tarjeta navega a una URL propia del Work Item, recargar la página conserva su contenido, volver al tablero funciona, en `tests/e2e/work-item-detail-view.spec.ts` (quickstart.md bloque 1)

**Checkpoint**: se puede abrir cualquier Work Item en su propia pantalla y volver.

---

## Phase 3: [F6-US2] Editar los campos de un Work Item desde su vista de detalle (Priority: P1) 🎯 MVP

**Goal**: Editar título, descripción, stakeholder y tags, y eliminar el Work
Item, desde la vista de detalle.

**Independent Test**: Editar cada campo desde la vista de detalle y
verificar que persiste tras recargar; eliminar un Work Item y verificar que
vuelve al tablero sin él.

**Depends on**: Phase 2 (`WorkItemDetailView.tsx` debe existir).

- [X] T007 [F6-US2] Trasladar el formulario de edición de `components/work-items/WorkItemDetailPanel.tsx` (título, descripción, stakeholder, `TagPicker`) a `WorkItemDetailView.tsx`, llamando `updateWorkItem` de `lib/actions/work-items.ts` al guardar (FR-003; mismo comportamiento que FR-007/FR-008/FR-009/FR-012/FR-013 de 004-work-items)
- [X] T008 [F6-US2] Trasladar el control de eliminar (con confirmación) a `WorkItemDetailView.tsx`, llamando `deleteWorkItem` y navegando con `router.push` de vuelta a `/projects/[projectPublicId]` al confirmar (FR-009)
- [X] T009 [P] [F6-US2] Test e2e: editar descripción y tags desde la vista de detalle, verificar que persisten tras recargar y que la tarjeta del tablero los refleja al volver; eliminar un Work Item desde su vista de detalle vuelve al tablero sin él, en `tests/e2e/work-item-detail-view.spec.ts` (quickstart.md bloque 2)

**Checkpoint**: la vista de detalle permite editar y eliminar, igual que el panel modal anterior.

---

## Phase 4: [F6-US3] Navegar entre Work Items relacionados desde la vista de detalle (Priority: P1) 🎯 MVP

**Goal**: Ver y gestionar el padre, los hijos y los relacionados desde la
vista de detalle, navegando entre ellos con URLs reales (botón atrás
funcional).

**Independent Test**: Abrir un Work Item con relaciones, hacer clic en una
de ellas, verificar que navega a la vista de detalle de ese otro Work Item,
y que el botón atrás del navegador vuelve al anterior.

**Depends on**: Phase 2 (`WorkItemDetailView.tsx` debe existir).

- [X] T010 [F6-US3] Trasladar la sección de relaciones (padre/hijos/relacionados, selectores "Convertir en hijo de..."/"Relacionar con...", controles de quitar) de `WorkItemDetailPanel.tsx` a `WorkItemDetailView.tsx`, llamando `setWorkItemParent`/`removeWorkItemParent`/`linkRelatedWorkItems`/`unlinkRelatedWorkItems`/`listProjectWorkItems` de 005-work-item-relationships (FR-004) — cada padre/hijo/relacionado listado MUST ser un `<Link>` hacia `/projects/[projectPublicId]/work-items/[displayNumber]` de ese Work Item, no un botón que reemplace estado local (FR-005; research.md § Navegación entre relaciones)
- [X] T011 [F6-US3] Eliminar de `WorkItemDetailView.tsx` el estado `activeWorkItem` y la función `navigateTo` que existían en `WorkItemDetailPanel.tsx` solo para simular navegación dentro del mismo diálogo — con `<Link>` real ya no aplican; los handlers de mutación operan directamente sobre el `workItem` recibido por props (research.md § Navegación entre relaciones)
- [X] T012 [P] [F6-US3] Test e2e: navegar de un Work Item a su hijo haciendo clic en la relación, volver con el botón atrás del navegador al Work Item anterior, crear una relación "relacionado con" desde la vista de detalle y verla reflejada sin recargar, en `tests/e2e/work-item-detail-view.spec.ts` (quickstart.md bloque 3, FR-006)

**Checkpoint**: navegar entre relaciones usa URLs reales con historial del navegador funcional.

---

## Phase 5: [F6-US4] Ver el historial de actividad de un Work Item (Priority: P2)

**Goal**: Ver el registro de cambios del Work Item desde su vista de
detalle.

**Independent Test**: Realizar un cambio (editar un campo o una relación) y
verificar que aparece en el historial de esa pantalla.

**Depends on**: Phase 2 (`WorkItemDetailView.tsx` debe existir).

- [X] T013 [F6-US4] Trasladar la sección de actividad (`listWorkItemActivity`, función `describeActivity`) de `WorkItemDetailPanel.tsx` a `WorkItemDetailView.tsx` (FR-007; Estándares de Producto y Datos § Auditoría de la constitución)
- [X] T014 [P] [F6-US4] Test e2e: realizar un cambio de campo y uno de relación, abrir la vista de detalle y verificar que ambos aparecen en el historial, más reciente primero, en `tests/e2e/work-item-detail-view.spec.ts` (quickstart.md bloque 4)

**Checkpoint**: la vista de detalle cubre las 4 historias — reemplaza por completo al panel modal anterior.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Retirar el código reemplazado y endurecer lo construido.

- [X] T015 [P] Eliminar `components/work-items/WorkItemDetailPanel.tsx` — reemplazado por completo por `WorkItemDetailView.tsx` (plan.md § Project Structure; Principio VI, no dejar código muerto)
- [X] T016 [P] Eliminar `getWorkItemById` de `lib/actions/work-item-relationships.ts` — sin uso tras esta feature, existía solo para la navegación simulada del panel modal (contracts/work-item-detail-view.md)
- [X] T017 [P] Correr manualmente el flujo completo de `quickstart.md` de punta a punta, incluidos los 2 edge cases (Work Item eliminado, acceso de un no-miembro), y registrar los resultados
- [X] T018 [P] Pasada de accesibilidad de `WorkItemDetailView.tsx`: foco al navegar entre Work Items relacionados, `aria-label` en los enlaces de relación, consistente con la pasada ya hecha en 005-work-item-relationships (T021 de su tasks.md)
- [X] T019 [P] Actualizar `README.md` § Roadmap marcando el punto 6 de la Fase 2 (vista de detalle de Work Item) como implementado

---

## Dependencies & Execution Order

```
Phase 1 (Foundational) ── BLOQUEA todas las historias
    ↓
Phase 2 [F6-US1] Abrir en pantalla propia    (P1 · MVP)
    ↓ (WorkItemDetailView.tsx ya existe)
Phase 3 [F6-US2] Editar campos               (P1 · MVP) ─┐
Phase 4 [F6-US3] Navegar entre relaciones    (P1 · MVP) ─┼─ independientes entre sí,
Phase 5 [F6-US4] Ver historial de actividad  (P2)       ─┘  todas requieren Phase 2
    ↓
Final Phase (Polish)
```

Las Phases 3, 4 y 5 tocan el mismo archivo (`WorkItemDetailView.tsx`) en
secciones distintas del formulario — pueden trabajarse en paralelo por
personas o agentes distintos, pero conviene fusionar los cambios con
cuidado al ser el mismo archivo (mismo criterio que Foundational de
001-accounts-invitations con `db/schema.ts`).

## Parallel Execution Examples

**Dentro de `[F6-US1]` (Phase 2)**: T005 (test unitario) y T006 (test e2e)
son `[P]` entre sí y pueden avanzar en paralelo una vez que T001-T004 están
listos.

**Entre historias P1**: una vez cerrada Phase 2, Phase 3 (`[F6-US2]`),
Phase 4 (`[F6-US3]`) y Phase 5 (`[F6-US4]`) pueden avanzar en paralelo por
distintas personas — cada una agrega una sección distinta de
`WorkItemDetailView.tsx` (formulario de campos, relaciones, actividad) sin
depender de las otras dos, más allá de fusionar el mismo archivo al final.

## Implementation Strategy

### MVP First (Phase 1 + Phase 2)

1. Completar Phase 1: Foundational.
2. Completar Phase 2 (`[F6-US1]`).
3. **STOP and VALIDATE**: ya se puede abrir cualquier Work Item en su propia
   pantalla y volver al tablero — es el MVP de esta feature (aunque todavía
   sin edición ni relaciones visibles ahí).
4. Continuar con Phase 3, 4 y 5 para completar el reemplazo del panel modal.

### Incremental Delivery

1. Foundational → resolución de ruta lista.
2. `[F6-US1]` → pantalla propia navegable (MVP).
3. `[F6-US2]` → edición de campos desde la pantalla.
4. `[F6-US3]` → relaciones navegables con historial real del navegador.
5. `[F6-US4]` → historial de actividad visible.
6. Polish → se retira `WorkItemDetailPanel.tsx` y `getWorkItemById`, y se
   valida todo de punta a punta.
