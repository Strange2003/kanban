# Implementation Plan: Campos Extendidos y Fechas de Work Items

**Branch**: `008-work-item-fields` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-work-item-fields/spec.md`

**Nota de alcance**: Esta feature extiende el mismo codebase y deploy de las
fases anteriores. El stack, la autenticación, el hosting, la matriz de
permisos y las convenciones de testing ya decididos en
[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md) y
[007-roles-permissions/plan.md](../007-roles-permissions/plan.md) no se
vuelven a evaluar. Es la primera feature de la Fase 3. Las vistas de lista y
tabla (009) dependen de los datos que agrega esta.

## Summary

Agrega a cada Work Item un conjunto fijo de campos:

- **Prioridad** y **severidad**: dos enums de Postgres con cuatro niveles
  ordenados por urgencia.
- **Área** e **iteración**: dos catálogos por proyecto, creados en línea con
  el mismo algoritmo que los tags.
- **Fecha de inicio** y **fecha objetivo**: columnas `date`, con un `CHECK`
  de orden.

El **cierre** queda atado al tablero. Cada columna recibe la marca
`is_closing`. "Cerrado" no se guarda: se deriva de la columna. Solo se guarda
`closed_at`, que mantiene una única función pura de transiciones dentro de
todas las acciones que mueven Work Items o cambian la marca de una columna.
Esas acciones bloquean las filas de `stages` implicadas para que la invariante
(SC-006) se cumpla incluso con operaciones concurrentes.

Hay dos acciones nuevas: `closeWorkItem`, el botón "Cerrar", que mueve el Work
Item a la primera columna de cierre, y `setStageClosing`. `updateWorkItem` se
extiende con los campos nuevos y todo se audita en `work_item_activity`: los
campos en `fields_edited` y dos eventos nuevos, `closed` y `reopened`. La
tarjeta muestra la prioridad y la fecha objetivo, con la marca de vencido
calculada con la fecha local de quien mira. El detalle muestra y edita todo lo
demás. Ver [research.md](research.md) para cada decisión y sus alternativas
descartadas.

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 20+ (sin cambios).

**Primary Dependencies**: Next.js 16 (App Router, Server Actions), React 19,
Drizzle ORM 0.45 + drizzle-kit, zod 4, dnd-kit y lucide-react, todas ya
instaladas. No se agrega ninguna dependencia. En particular, no se añade una
librería de fechas: bastan `Intl.DateTimeFormat` y strings `"YYYY-MM-DD"`.
Antes de implementar se debe leer la guía de `node_modules/next/dist/docs/`
que corresponda (AGENTS.md: esta versión de Next.js difiere de la conocida).

**Storage**: Neon (Postgres serverless), con el driver `Pool` (WebSocket) ya
usado para transacciones. Los cambios de esquema son aditivos y están en
[data-model.md](data-model.md):

- 2 enums nuevos.
- 2 tablas de catálogo nuevas (`areas`, `iterations`).
- 7 columnas nullable nuevas en `work_items`, más un `CHECK`.
- 1 columna `boolean` con default en `stages`.

No hay backfill.

**Testing**: Vitest para unidad:

- `nextClosedAt` tabla por tabla y `isOverdue`.
- Validación de `updateWorkItem`: niveles, fechas, rango y resolución de
  catálogos sin distinguir mayúsculas.
- Rechazo de `moveWorkItem` hacia una columna de otro proyecto.
- `closeWorkItem`: `NO_CLOSING_STAGE` y `ALREADY_CLOSED`.
- `setStageClosing`: idempotencia.
- Barrido de permisos de `action-permissions.test.ts` ampliado con las dos
  acciones nuevas.

Playwright para e2e (`tests/e2e/work-item-fields.spec.ts`), con los
escenarios de [quickstart.md](quickstart.md) bloques 1 a 4 y 6.

**Target Platform**: Web, mismo deploy de Render (todavía sin instancia
desplegada). La migración `0004` se aplica **antes** del código nuevo.

**Project Type**: Aplicación web monolítica (sin cambios).

**Performance Goals**: Sin costo perceptible (SC-007).

- `getBoard` no cambia de consultas: las columnas nuevas llegan en el mismo
  `SELECT` de `work_items` y `stages`.
- `getWorkItemDetailData` suma dos lecturas de catálogo en su
  `Promise.all`, más una lectura de la columna actual y de la existencia de
  columnas de cierre.
- Mover una tarjeta suma un `SELECT … FOR SHARE` de dos filas de `stages`
  dentro de la transacción que ya existía.
- `setStageClosing` actualiza los Work Items de una columna en un solo
  `UPDATE` y un solo `INSERT` en bloque de eventos, no uno por fila.

**Constraints**:

1. **Principio IV**: toda escritura pasa por `requireProjectPermission`. Los
   catálogos se resuelven siempre dentro del proyecto del Work Item. Se
   corrige que `moveWorkItem` no validaba el proyecto de la columna destino.
2. **Auditoría (constitución)**: cada cambio de campo y cada transición de
   cierre escribe en `work_item_activity`, en la misma transacción que el
   cambio.
3. **No encadenar Server Actions desde el cliente** (005 research.md §
   Hallazgo): tras "Cerrar" o marcar una columna, se usa `router.refresh()`.
4. **Ningún helper sin control de acceso exportado desde un archivo
   `"use server"`**: los catálogos viven en `lib/work-item-catalogs.ts` y las
   transiciones en `lib/work-item-closing.ts`.
5. **Sin desajustes de hidratación**: "hoy" y los instantes se resuelven en
   el cliente con `useSyncExternalStore`.
6. **Principio V**: nada relacionado con Git ni CI/CD.

**Scale/Scope**: 1 feature, 4 historias de usuario, 21 requisitos
funcionales. Toca:

- 2 archivos de Server Actions.
- 1 acción de lectura compuesta.
- ~6 componentes existentes y 4 nuevos.
- 4 módulos nuevos de `lib/`.
- 1 migración.

Escala asumida: tableros de ≥100 Work Items (SC-002), igual que 005.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | La tarjeta muestra solo prioridad y fecha objetivo, para no saturar el tablero (FR-016). Mover una tarjeta a una columna de cierre actualiza el vencido y el cierre de forma optimista, con reversión si falla. Marcar una columna también es optimista. Los campos nuevos se guardan con el mismo botón "Save" del detalle. La marca de vencido usa la fecha local de quien mira y no parpadea al hidratar (research.md § Fechas y "hoy"). |
| II. Colaboración sin Límites | PASS | Sin efecto sobre miembros ni invitaciones. |
| III. Jerarquía de Datos Consistente | PASS | La jerarquía Cuenta → Proyecto → Tablero → Stage → Work Item no cambia. La marca de cierre vive en el stage, que sigue atado 1:1 a su columna. Los catálogos cuelgan del proyecto. Las relaciones padre/hijo y "relacionado con" no cambian. |
| IV. Aislamiento y Seguridad de Datos | PASS | Toda escritura pasa por `requireProjectPermission` con claves existentes (`workItem:edit`, `board:edit`). Toda lectura pasa por `getWorkItemDetailData` o `getBoard`, que exigen membresía. Área e iteración se resuelven por nombre **dentro del proyecto del Work Item**, así que no hay forma de referenciar un valor ajeno (FR-021). `areas` e `iterations` borran en cascada con el proyecto. Se corrige además un hueco previo: `moveWorkItem` aceptaba una columna destino de otro proyecto (research.md § Hallazgo). |
| V. Código Abierto / Sin Bloqueo | PASS | Sin dependencias nuevas. "Iteración" es solo un nombre, sin integración con ninguna herramienta de planificación ni de Git. |
| VI. Simplicidad y Alcance Enfocado (YAGNI) | PASS | Los campos son exactamente los confirmados por el product owner (roadmap Fase 3 § 9 y Clarifications). Se reutiliza el patrón de catálogo de tags, el evento `fields_edited` y las claves de permiso existentes. No hay índices especulativos para 009, ni triggers, ni campos configurables, ni gestión de catálogos. |
| Estándares § Auditoría | PASS | `fields_edited` registra valor anterior y nuevo de cada campo nuevo. `closed` y `reopened` registran cada transición, incluidas las masivas al marcar o desmarcar una columna, en la misma transacción. El detalle las muestra de forma legible (FR-020). |
| Estándares § Roles | PASS | No hay permisos nuevos que documentar. La tabla de [contracts/work-item-fields.md § Permisos](contracts/work-item-fields.md#permisos) asigna cada acción nueva a una clave existente de la matriz de 007. |

Sin violaciones que requieran la tabla de Complexity Tracking. La única
pieza con algo de complejidad, el bloqueo por fila de `stages` en mover,
crear, cerrar y marcar, está justificada por SC-006 y se detalla en
[research.md § Concurrencia](research.md#decisión-concurrencia-entre-mover-y-marcardesmarcar-una-columna).

**Re-check post-diseño (Fase 1)**: se mantiene PASS en todos los principios.
El diseño confirmó cuatro cosas:

1. Ningún contrato existente cambia de firma. `updateWorkItem` solo gana
   campos opcionales, y `getWorkItemDetailData` solo gana campos de retorno.
2. Las dos acciones nuevas usan claves de permiso existentes.
3. No se exporta ningún helper sin control de acceso desde un archivo
   `"use server"`.
4. El evento `stage_changed` existente no cambia de forma. Los eventos nuevos
   son aditivos.

## Project Structure

### Documentation (this feature)

```text
specs/008-work-item-fields/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — enums, catálogos, fechas, cierre derivado, concurrencia, auditoría, hidratación
├── data-model.md        # Phase 1 — enums y tablas nuevas, columnas, invariante de cierre, eventos, migración
├── quickstart.md        # Phase 1 — validación end-to-end de las 4 historias
├── contracts/
│   └── work-item-fields.md   # permisos, módulos puros, acciones modificadas y nuevas, contratos de UI
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks) — no creado por este comando
```

### Source Code (repository root)

```text
db/
├── schema.ts                              # MODIFICADO: pgEnums work_item_priority / work_item_severity
│                                          #   (desde WORK_ITEM_LEVELS); tablas areas e iterations (como tags);
│                                          #   work_items + priority, severity, area_id, iteration_id,
│                                          #   start_date, target_date (date, mode "string"), closed_at
│                                          #   + CHECK de orden de fechas; stages + is_closing
└── migrations/
    └── 0004_<nombre>.sql (+ meta/)        # NUEVO (npm run db:generate) — ver data-model.md § Migración

lib/
├── work-item-fields.ts                    # NUEVO (puro): WORK_ITEM_LEVELS, LEVEL_LABELS, isOverdue()
├── work-item-closing.ts                   # NUEVO (puro): nextClosedAt() — única tabla de transiciones de cierre
├── work-item-catalogs.ts                  # NUEVO (servidor, sin "use server"): listCatalog(),
│                                          #   resolveCatalogValue() — áreas e iteraciones por nombre
├── dates.ts                               # NUEVO (cliente): useLocalToday(), formatCalendarDate()
└── actions/
    ├── work-items.ts                      # MODIFICADO: updateWorkItem + campos nuevos e INVALID_DATE_RANGE;
    │                                      #   moveWorkItem valida el proyecto de la columna destino, bloquea
    │                                      #   los stages (FOR SHARE) y aplica nextClosedAt + eventos
    │                                      #   closed/reopened; createWorkItem cierra si nace en columna de
    │                                      #   cierre; reorderWorkItemsInStage deja de tocar updated_at;
    │                                      #   + closeWorkItem; helper NO exportado para mover dentro de tx
    ├── board.ts                           # MODIFICADO: + setStageClosing (board:edit, FOR UPDATE, UPDATE e
    │                                      #   INSERT en bloque)
    └── work-item-relationships.ts         # MODIFICADO: getWorkItemDetailData devuelve catálogos, área e
                                           #   iteración del Work Item, su columna y hasClosingStage

components/
├── board/
│   ├── Board.tsx                          # MODIFICADO: closedAt optimista al mover (nextClosedAt); handler
│   │                                      #   optimista con reversión para setStageClosing
│   ├── StageColumn.tsx                    # MODIFICADO: indicador de columna de cierre; <ClosingStageToggle>
│   │                                      #   si canEdit
│   ├── ClosingStageToggle.tsx             # NUEVO: botón aria-pressed para marcar/desmarcar
│   ├── WorkItemCard.tsx                   # MODIFICADO: <PriorityBadge> + <TargetDateChip> (vencido); aria-label
│   ├── PriorityBadge.tsx                  # NUEVO: indicador compacto por nivel (color + texto, no solo color)
│   └── TargetDateChip.tsx                 # NUEVO: fecha objetivo con estado vencido
├── work-items/
│   ├── WorkItemDetailView.tsx             # MODIFICADO: secciones Planning (editable, con Save) y Dates (solo
│   │                                      #   lectura), botón Close, describeActivity ampliado
│   └── CatalogPicker.tsx                  # NUEVO: selector de un valor con creación en línea (análogo a TagPicker)
└── ui/
    └── local-date.tsx                     # NUEVO: <LocalDate> sin desajuste de hidratación

tests/
├── unit/
│   ├── work-item-closing.test.ts          # NUEVO: nextClosedAt, todas las filas de la tabla de transiciones
│   ├── work-item-fields.test.ts           # NUEVO: isOverdue (límite de hoy, cerrado, sin fecha)
│   ├── work-items.test.ts                 # MODIFICADO: updateWorkItem (niveles, fechas, rango, catálogo
│   │                                      #   sin distinguir mayúsculas, evento fields_edited); moveWorkItem a
│   │                                      #   una columna de otro proyecto → NOT_FOUND; closeWorkItem →
│   │                                      #   NO_CLOSING_STAGE / ALREADY_CLOSED
│   └── action-permissions.test.ts         # MODIFICADO: + closeWorkItem (workItem:edit), + setStageClosing
│                                          #   (board:edit); mock con filas de areas/iterations si hace falta
└── e2e/
    └── work-item-fields.spec.ts           # NUEVO: escenarios de quickstart.md (bloques 1-4 y 6)
```

**Structure Decision**: Es el mismo monolito Next.js de las fases anteriores.
No se crean rutas ni servicios nuevos. Todo lo nuevo en `lib/` es puro o de
solo servidor sin `"use server"`, por la regla de endpoints públicos de
AGENTS.md. La UI nueva son componentes pequeños que se enchufan en la tarjeta,
la columna y el detalle existentes. `CatalogPicker` es un componente aparte
en vez de generalizar `TagPicker`: la selección única y la multiselección
tienen interacciones distintas (quitar el único valor frente a quitar uno de
varios), y forzar un solo componente con modos complicaría el que ya
funciona.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
