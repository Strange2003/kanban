---

description: "Task list for 005-work-item-relationships implementation"
---

# Tasks: Relaciones entre Work Items

**Input**: Design documents from `specs/005-work-item-relationships/`
(plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅,
quickstart.md ✅ (todos generados por `/speckit-plan`).

**Tests**: Se incluye un test unitario para la detección de ciclos y un test
e2e (Playwright) por historia de usuario, consistente con el criterio ya
usado en [001-accounts-invitations/tasks.md](../001-accounts-invitations/tasks.md):
`plan.md` ya decidió Vitest/Playwright como frameworks y `quickstart.md` está
redactado 1:1 como escenarios ejecutables por historia; omitirlos dejaría
esa decisión del plan sin implementar.

**Nota sobre la ejecución de los tests e2e (T008/T011/T014/T018) — resuelta**:
durante la implementación, estos 4 tests se colgaban intermitentemente
esperando la respuesta de una *segunda* Server Action lanzada justo después
de otra desde el mismo componente (reproducido en dos máquinas distintas, y
también en `tests/e2e/work-items.spec.ts` ya existente). La causa era que
`WorkItemDetailPanel` disparaba varias Server Actions seguidas o en paralelo
(hasta 5 al abrir el panel, 2 más tras cada mutación) — ver research.md
§ Hallazgo. Se resolvió consolidando esas llamadas en una sola Server Action
por operación (`getWorkItemDetailData` al abrir el panel;
`setWorkItemParent`/`linkRelatedWorkItems`/etc. devuelven ya las relaciones
frescas en vez de que el cliente las vuelva a pedir). Con eso, los 4 tests
pasan en verde de forma consistente (`npm run test:e2e -- tests/e2e/work-item-relationships.spec.ts`).

**Organization**: Tareas agrupadas por historia de usuario de
[spec.md](spec.md), en el orden en que aparecen (US1 y US2 son P1, US3 y US4
son P2). Cada historia usa la etiqueta `[F5-US<m>]` (`F5` =
005-work-item-relationships), siguiendo la convención de
[AGENTS.md](../../AGENTS.md#working-with-tasksmd).

**Sin fase de Setup separada**: esta feature no agrega dependencias ni
herramientas nuevas (ver plan.md § Technical Context) — extiende el
codebase ya inicializado en
[001-accounts-invitations/tasks.md](../001-accounts-invitations/tasks.md)
(T001-T009). Se empieza directo en Foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, o mismo archivo
  con adiciones independientes — mismo criterio ya usado en Foundational de
  001 para `db/schema.ts`)
- **[Story]**: `[F5-US<m>]` — a qué historia de esta spec pertenece
- Cada descripción incluye la ruta exacta de archivo

## Path Conventions

Mismo monolito Next.js de la Fase 1 (`db/`, `lib/`, `components/`, `tests/`
en la raíz del repositorio) — ver plan.md § Project Structure.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Esquema de datos para ambos tipos de relación. **⚠️ CRITICAL**:
ninguna historia de usuario puede empezar hasta completar esta fase.

- [X] T001 Añadir la columna `parentWorkItemId` a la tabla `work_items` en `db/schema.ts`: FK auto-referencial → `work_items.id`, nullable, `onDelete: set null` (data-model.md § Work Item — columna añadida; FR-001/FR-002/FR-012)
- [X] T002 [P] Definir la tabla `work_item_related_links` en `db/schema.ts`: `id` serial PK, `workItemIdA` FK → `work_items.id` con `onDelete: cascade`, `workItemIdB` FK → `work_items.id` con `onDelete: cascade`, `createdAt` timestamptz not null, índice único en `(workItemIdA, workItemIdB)`, `CHECK (workItemIdA <> workItemIdB)` (data-model.md § WorkItemRelatedLink; FR-005/FR-006/FR-011)
- [X] T003 Generar y aplicar la migración de Drizzle con los cambios de T001-T002 en `db/migrations/` (`npm run db:generate && npm run db:migrate`)

**Checkpoint**: esquema listo — las historias de usuario pueden empezar.

---

## Phase 2: [F5-US1] Vincular un Work Item como hijo de otro (Priority: P1) 🎯 MVP

**Goal**: Un miembro convierte un Work Item existente en hijo de otro Work
Item del mismo proyecto.

**Independent Test**: Vincular dos Work Items existentes como padre/hijo y
verificar que el hijo aparece asociado a ese padre, incluyendo el rechazo de
un segundo padre y de un ciclo.

**Depends on**: Phase 1 (Foundational).

- [X] T004 [F5-US1] Implementar `workItemHasAncestor(candidateAncestorId, workItemId)` en `lib/actions/work-item-relationships.ts`: `WITH RECURSIVE` que sube por `parentWorkItemId` desde `candidateAncestorId` hasta la raíz y verifica si `workItemId` aparece en esa cadena (research.md § Detección de ciclos; FR-004)
- [X] T005 [F5-US1] Implementar Server Action `setWorkItemParent(workItemId, parentWorkItemId)` en `lib/actions/work-item-relationships.ts`: valida membresía de ambos Work Items, rechaza `DIFFERENT_PROJECT` si no comparten proyecto (FR-007), `SELF_PARENT` si `parentWorkItemId === workItemId`, `ALREADY_HAS_PARENT` si ya tiene un padre distinto de `null` (FR-002), `CYCLE_DETECTED` usando T004 (FR-004); si pasa, hace el `UPDATE` y registra una fila en `work_item_activity` (`type='parent_linked'`, `payload={ parentWorkItemId }`) en la misma transacción (FR-014, FR-001) — contracts/work-item-relationships.md
- [X] T006 [P] [F5-US1] Agregar el control "Convertir en hijo de..." (selector de Work Item del mismo proyecto, excluyendo al propio y a sus descendientes ya conocidos en cliente) a `components/work-items/WorkItemDetailPanel.tsx`, invocando `setWorkItemParent` y mostrando los errores `ALREADY_HAS_PARENT`/`CYCLE_DETECTED`/`SELF_PARENT` de forma legible
- [X] T007 [P] [F5-US1] Test unitario de `workItemIsAncestorOf`: cadena directa (padre inmediato), cadena transitiva de varios niveles, y sin ancestros, en `tests/unit/work-item-relationships.test.ts`
- [X] T008 [P] [F5-US1] Test e2e: crear relación padre/hijo, rechazar un segundo padre, aceptar una cadena de 3 niveles (anidación arbitraria), rechazar el ciclo que cerraría esa cadena, en `tests/e2e/work-item-relationships.spec.ts` (quickstart.md bloque 1)

**Checkpoint**: la relación padre/hijo funciona de punta a punta, sin ciclos.

---

## Phase 3: [F5-US2] Vincular dos Work Items como "relacionado con" (Priority: P1) 🎯 MVP

**Goal**: Un miembro vincula dos Work Items del mismo proyecto con una
relación simétrica de "relacionado con".

**Independent Test**: Vincular dos Work Items existentes como relacionados y
verificar que cada uno lista al otro, sin duplicar el vínculo ni permitir
autorrelación.

**Depends on**: Phase 1 (Foundational). Independiente de Phase 2 (mecanismo
de datos distinto) — puede desarrollarse en paralelo.

- [X] T009 [F5-US2] Implementar Server Action `linkRelatedWorkItems(workItemIdX, workItemIdY)` en `lib/actions/work-item-relationships.ts`: valida membresía de ambos, rechaza `DIFFERENT_PROJECT` (FR-007) y `SELF_RELATION` si son el mismo Work Item (FR-006), ordena los IDs canónicamente (`workItemIdA = min(...)`, `workItemIdB = max(...)`) e inserta con `ON CONFLICT (workItemIdA, workItemIdB) DO NOTHING` (FR-006); si el `INSERT` crea una fila nueva, registra una fila en `work_item_activity` para cada Work Item (`type='related_linked'`, `payload={ relatedWorkItemId }`) en la misma transacción (FR-014, FR-005) — contracts/work-item-relationships.md
- [X] T010 [P] [F5-US2] Agregar el control "Relacionar con..." (selector de Work Item del mismo proyecto) a `components/work-items/WorkItemDetailPanel.tsx`, invocando `linkRelatedWorkItems`
- [X] T011 [P] [F5-US2] Test e2e: crear relación "relacionado con", verificar que aparece simétricamente en ambos Work Items, que repetir el mismo par no la duplica, y que relacionar un Work Item consigo mismo se rechaza, en `tests/e2e/work-item-relationships.spec.ts` (quickstart.md bloque 2)

**Checkpoint**: ambos tipos de relación pueden crearse de forma independiente.

---

## Phase 4: [F5-US3] Ver las relaciones de un Work Item (Priority: P2)

**Goal**: Un miembro ve, al abrir un Work Item, su padre, sus hijos y sus
relacionados, cada uno navegable.

**Independent Test**: Abrir un Work Item con relaciones ya creadas (por
Phase 2/3, o sembradas directamente) y verificar que las tres listas
aparecen y permiten navegar al Work Item vinculado.

**Depends on**: Phase 1 (Foundational). Se prueba de forma más significativa
una vez completas Phase 2 y Phase 3 (que son las que crean datos reales para
mostrar).

- [X] T012 [F5-US3] Implementar `getWorkItemRelations(workItemId)` en `lib/actions/work-item-relationships.ts`: retorna `{ parent, children, related }`, cada elemento con `displayId` y `title`, resolviendo `parent` desde `parentWorkItemId`, `children` desde los Work Items cuyo `parentWorkItemId` sea este, y `related` desde `work_item_related_links` en cualquiera de sus dos columnas (FR-009, FR-010) — contracts/work-item-relationships.md
- [X] T013 [P] [F5-US3] Agregar la sección de relaciones a `components/work-items/WorkItemDetailPanel.tsx`: lista de padre (si existe), hijos y relacionados, cada uno navegable al Work Item correspondiente (FR-010), con un estado vacío explícito cuando no hay ninguna relación (FR-009, edge case de spec.md)
- [X] T014 [P] [F5-US3] Test e2e: abrir un Work Item con padre, hijos y relacionados y verificar que las tres listas se muestran y son navegables; abrir uno sin relaciones y verificar el estado vacío, en `tests/e2e/work-item-relationships.spec.ts` (quickstart.md bloque 3)

**Checkpoint**: las relaciones creadas son visibles y navegables desde el panel de detalle.

---

## Phase 5: [F5-US4] Quitar una relación entre dos Work Items (Priority: P2)

**Goal**: Un miembro quita una relación (padre/hijo o "relacionado con") sin
afectar a los Work Items involucrados.

**Independent Test**: Quitar una relación existente entre dos Work Items y
verificar que ambos dejan de listarse mutuamente, sin que ninguno se elimine.

**Depends on**: Phase 2, Phase 3 y Phase 4 (necesita relaciones ya creadas y
visibles desde donde disparar la acción de quitar).

- [X] T015 [F5-US4] Implementar Server Action `removeWorkItemParent(workItemId)` en `lib/actions/work-item-relationships.ts`: idempotente (si ya era `null`, no hace nada); si había un padre, pone `parentWorkItemId = null` y registra una fila en `work_item_activity` (`type='parent_unlinked'`, `payload={ previousParentWorkItemId }`) en la misma transacción (FR-008, FR-014) — contracts/work-item-relationships.md
- [X] T016 [P] [F5-US4] Implementar Server Action `unlinkRelatedWorkItems(workItemIdX, workItemIdY)` en `lib/actions/work-item-relationships.ts`: ordena los IDs canónicamente igual que T009, borra la fila correspondiente de `work_item_related_links` si existe (idempotente), y registra una fila en `work_item_activity` para cada Work Item (`type='related_unlinked'`, `payload={ relatedWorkItemId }`) solo si había un vínculo que borrar (FR-008, FR-014) — contracts/work-item-relationships.md
- [X] T017 [P] [F5-US4] Agregar un control "Quitar" a cada elemento de la sección de relaciones de `components/work-items/WorkItemDetailPanel.tsx` (padre, cada hijo listado como opción de desvincular no aplica — el hijo se desvincula desde sí mismo — y cada relacionado), invocando `removeWorkItemParent`/`unlinkRelatedWorkItems` según corresponda
- [X] T018 [P] [F5-US4] Test e2e: quitar una relación "relacionado con" y una relación padre/hijo, verificar que ninguno de los Work Items se elimina; eliminar un Work Item que tiene hijos (usando `deleteWorkItem` ya existente de 004-work-items) y verificar que los hijos permanecen en el tablero sin padre (huérfanos, FR-012), en `tests/e2e/work-item-relationships.spec.ts` (quickstart.md bloque 4)

**Checkpoint**: el ciclo de vida completo de ambas relaciones (crear, ver, quitar) funciona de punta a punta.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Endurecer lo construido en las 4 historias anteriores.

- [X] T019 [P] Correr manualmente el flujo completo de `quickstart.md` de punta a punta y registrar los resultados — los 4 tests e2e (`tests/e2e/work-item-relationships.spec.ts`, 1:1 con los 4 bloques de quickstart.md) pasan en verde tras el fix descrito en la nota de "Tests" arriba.
- [X] T020 [P] Test de escala: sembrar un Work Item con ~50 hijos directos y una cadena de ~20 niveles de profundidad, verificar que la detección de ciclos (T004) y `getWorkItemRelations` (T012) no degradan perceptiblemente (SC-001 a SC-004 de spec.md) — *Hecho 2026-09-22*: `tests/e2e/work-item-relationships-scale.spec.ts` siembra 50 hijos directos y una cadena de 20 niveles; la detección de ciclos (2 consultas `WITH RECURSIVE`) queda bajo 2 s, el detalle con 50 hijos bajo 10 s (umbrales holgados: Neon remoto + `next dev`), y cerrar el ciclo desde la UI sigue rechazándose.
- [X] T021 [P] Pasada de accesibilidad de los nuevos controles de relaciones en `WorkItemDetailPanel.tsx` (foco por teclado, `aria-label`), consistente con la pasada ya hecha en la Fase 1 (T118 de 001-accounts-invitations/tasks.md)
- [X] T022 [P] Actualizar `README.md` § Roadmap marcando el punto 5 de la Fase 2 (relaciones entre Work Items) como implementado

---

## Dependencies & Execution Order

```
Phase 1 (Foundational) ── BLOQUEA todas las historias
    ↓
Phase 2 [F5-US1] Vincular padre/hijo         (P1 · MVP) ─┐
Phase 3 [F5-US2] Vincular "relacionado con"  (P1 · MVP) ─┘ independientes entre sí
    ↓
Phase 4 [F5-US3] Ver relaciones              (P2) ── requiere Phase 2 y 3 para tener datos reales que mostrar
    ↓
Phase 5 [F5-US4] Quitar una relación         (P2) ── requiere Phase 2, 3 y 4
    ↓
Final Phase (Polish)
```

Las Phases 2 y 3 (P1) pueden trabajarse en paralelo por distintas personas o
agentes una vez completada la Phase 1, ya que padre/hijo y "relacionado con"
son mecanismos de datos independientes (columna vs. tabla de unión) que no
comparten código.

## Parallel Execution Examples

**Dentro de Foundational (Phase 1)**: T001 y T002 son `[P]` (mismo criterio
que Fase 1 — adiciones independientes al mismo `db/schema.ts`); T003
(migración) depende de ambas.

**Entre historias P1**: una vez cerrada Phase 1, Phase 2 (`[F5-US1]`) y
Phase 3 (`[F5-US2]`) pueden avanzar en paralelo por completo — no comparten
ninguna tarea ni archivo de esquema nuevo entre sí (solo el ya compartido
`lib/actions/work-item-relationships.ts`, en funciones distintas).

**Dentro de una historia** (ej. Phase 2, `[F5-US1]`): T006 (UI), T007 (test
unitario) y T008 (test e2e) son `[P]` entre sí y pueden avanzar en paralelo
una vez que T005 (Server Action) está lista, ya que los tests necesitan la
acción real para pasar.

## Implementation Strategy

### MVP First (Phase 2 + Phase 3)

1. Completar Phase 1: Foundational.
2. Completar Phase 2 (`[F5-US1]`) y Phase 3 (`[F5-US2]`), en paralelo o en
   secuencia.
3. **STOP and VALIDATE**: con solo esto, ya se pueden crear ambos tipos de
   relación (aunque sin una sección dedicada para verlas más allá de lo que
   exponga el propio flujo de creación) — es el MVP de esta feature.
4. Continuar con Phase 4 y Phase 5 para el ciclo de vida completo
   (visualización y remoción).

### Incremental Delivery

1. Foundational → esquema listo.
2. `[F5-US1]` + `[F5-US2]` → ambos tipos de relación se pueden crear (MVP).
3. `[F5-US3]` → las relaciones creadas se vuelven visibles y navegables.
4. `[F5-US4]` → el ciclo de vida se cierra (quitar relaciones sin afectar
   los Work Items).
5. Polish → validación de escala, accesibilidad y documentación.
