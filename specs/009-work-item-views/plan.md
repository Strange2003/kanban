# Implementation Plan: Vistas de Lista y Tabla

**Branch**: `009-work-item-views` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-work-item-views/spec.md`

**Nota de alcance**: Esta feature extiende el mismo codebase y deploy de las
fases anteriores. El stack, la autenticación, el hosting, la matriz de
permisos y las convenciones de testing ya están decididos en
[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md) y
[007-roles-permissions/plan.md](../007-roles-permissions/plan.md), y no se
vuelven a evaluar. Es la segunda y última feature de la Fase 3. Usa los
campos, el estado de cierre y la regla de vencido de
[008-work-item-fields](../008-work-item-fields/plan.md).

## Summary

Agrega dos vistas de solo lectura junto al tablero de cada proyecto, cada
una con su propia ruta: `/table` y `/list`. Un selector compartido
(`ProjectViewHeader`) pasa entre Tablero, Lista y Tabla.

Cada página hace una sola lectura nueva, `getWorkItemsView`, que solo exige
membresía. Trae todos los Work Items del proyecto aplanados (columna,
estado, campos de 008, área, iteración y tags por nombre, padre) y las
opciones de filtro.

El orden, los filtros y el árbol se calculan en el navegador con un módulo
puro (`lib/work-item-view.ts`), probado tabla por tabla. El estado de
filtros y orden vive en la dirección y se actualiza con
`window.history.replaceState`, que Next.js sincroniza con `useSearchParams`.
Así la vista es recargable y compartible, y "atrás" desde el detalle la
conserva, sin volver al servidor en cada clic.

La **Tabla** es plana: todos los campos, orden por columna con los vacíos al
final y desempate estable, y filtros combinados con Y. La **Lista** es un
backlog jerárquico por padre/hijo, plegable, con los mismos filtros; muestra
los ancestros de lo que coincide, atenuados, como contexto. No hay cambios
de esquema. Ver [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 20+ (sin cambios).

**Primary Dependencies**: Next.js 16 (App Router, Server Components y
Actions, `useSearchParams` + History API nativa), React 19, Drizzle ORM 0.45,
lucide-react. No se agrega ninguna dependencia. En particular, no se usa una
librería de tablas: con 14 columnas fijas, sin edición ni virtualización, una
`<table>` semántica y funciones puras bastan (Principio VI). Guías de Next.js
leídas: `01-getting-started/04-linking-and-navigating.md` § Native History
API y `03-api-reference/03-file-conventions/page.md` § searchParams. Antes de
implementar hay que leer también la referencia de `useSearchParams`.

**Storage**: Neon (Postgres). **Sin cambios de esquema ni migraciones**
(research.md § Sin cambios de esquema). Solo lecturas acotadas por
`project_id` (índice existente).

**Testing**:

- **Vitest (unidad):**
  - `parseViewQuery` y `serializeViewQuery`: ida y vuelta, parámetros
    inválidos ignorados, valores por defecto omitidos.
  - `filterWorkItems`: cada filtro, "none", combinación Y/O, búsqueda,
    vencido con y sin `today`.
  - `sortWorkItems`: cada clave, vacíos al final en ambas direcciones,
    niveles no alfabéticos, columna por posición, desempate estable.
  - `buildWorkItemTree`: profundidad arbitraria, huérfanos, ancestros de
    contexto, cada Work Item una vez (SC-006), corte de ciclos.
  - `getWorkItemsView`: membresía y acotado por proyecto.
  - Registro en el barrido de permisos.
- **Playwright (e2e):** `tests/e2e/work-item-views.spec.ts`, con los
  bloques 1 a 5 de [quickstart.md](quickstart.md).

**Target Platform**: Web, mismo deploy de Render (todavía sin instancia).
Sin orden de despliegue especial: no hay migración.

**Project Type**: Aplicación web monolítica (sin cambios).

**Performance Goals**: SC-002. Ordenar o filtrar 500 filas en memoria es
O(n log n) y tarda milisegundos. Renderizar 500 filas de tabla sin
virtualizar es aceptable a esa escala. Filtrar y ordenar se memorizan con
`useMemo` por consulta. La carga inicial es una sola Server Action con 4
consultas acotadas.

**Constraints**:

1. **Principio IV:** membresía verificada antes de toda lectura. Las
   consultas se acotan por proyecto y no se exponen ids internos de columnas
   ni catálogos; las columnas se identifican por `publicId`.
2. **Solo lectura** (FR-011, FR-016, FR-018): ninguna escritura nueva, así
   que no hace falta auditoría ni claves de permiso.
3. **Sin encadenar Server Actions desde el cliente** (005 research.md §
   Hallazgo): los datos llegan con la página.
4. **Sin desajuste de hidratación:** "hoy" solo en el cliente, como en 008.
5. **Nada exportado sin control de acceso desde un archivo `"use server"`:**
   los tipos y funciones de vista viven en `lib/work-item-view.ts` (puro).

**Scale/Scope**: 1 feature, 3 historias y 18 requisitos funcionales. Toca:

- 2 rutas nuevas y la página del tablero.
- 1 acción de lectura nueva.
- 1 módulo puro nuevo.
- ~6 componentes nuevos.

Escala objetivo: 500 Work Items por proyecto (SC-002).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | Ordenar y filtrar sin ir al servidor (se siente inmediato, SC-002). La dirección se actualiza sin recargar. "Atrás" conserva la vista y los filtros (SC-005). Cambiar de vista conserva los filtros. Hay estados vacíos claros. El tablero, la experiencia principal, no cambia. |
| II. Colaboración sin Límites | PASS | Sin efecto sobre miembros. Una dirección con filtros se comparte entre miembros del proyecto. |
| III. Jerarquía de Datos Consistente | PASS | No toca la jerarquía. La Lista hace **visible y navegable** la relación padre/hijo de todo el proyecto, que el principio pone en el núcleo, y cada fila lleva a su detalle. |
| IV. Aislamiento y Seguridad de Datos | PASS | `getWorkItemsView` exige membresía antes de cualquier consulta y acota todo por `project.id`, incluidos los tags. Un no miembro recibe `notFound()`, igual que en el tablero (SC-004). Las columnas viajan por `publicId`; área, iteración y tags por nombre. No se exponen ids nuevos. |
| V. Código Abierto / Sin Bloqueo | PASS | Sin dependencias nuevas. Se descarta una librería de tablas. |
| VI. Simplicidad y Alcance Enfocado (YAGNI) | PASS | Sin migraciones, sin vistas guardadas, sin columnas configurables, sin edición en celda (confirmado por el product owner), sin paginación por ahora (documentada como evolución) y sin librerías nuevas. Se reutilizan `PriorityBadge`, `TargetDateChip`, `LocalDate`, `isOverdue` y `useLocalToday` de 008. |
| Estándares § Auditoría | PASS | No aplica: no hay escrituras. El log de actividad no cambia. |
| Estándares § Roles | PASS | Sin permisos nuevos. Leer ya está permitido a todo miembro en la matriz de 007. La acción nueva se registra en el barrido de permisos como lectura de membresía. |

Sin violaciones: la tabla de Complexity Tracking no aplica.

**Re-check post-diseño (Fase 1)**: se mantiene PASS en todos los principios.
El diseño confirmó cuatro cosas:

1. No hace falta ningún cambio de esquema.
2. La única acción nueva es de lectura con membresía.
3. Los tipos compartidos viven en un módulo puro y no en el archivo
   `"use server"`.
4. La página del tablero solo cambia de cabecera.

## Project Structure

### Documentation (this feature)

```text
specs/009-work-item-views/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — rutas, carga única + cliente, filtros en la URL, reglas puras, árbol, lectura, hidratación
├── data-model.md        # Phase 1 — sin esquema; modelos de vista (fila, opciones, ViewQuery, nodo de árbol)
├── quickstart.md        # Phase 1 — validación end-to-end de las 3 historias
├── contracts/
│   └── work-item-views.md   # rutas, acción de lectura, módulo puro, contratos de componentes
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks) — no creado por este comando
```

### Source Code (repository root)

```text
app/(workspace)/projects/[projectPublicId]/
├── page.tsx                               # MODIFICADO: cabecera → <ProjectViewHeader active="board">
├── list/page.tsx                          # NUEVO: Server Component → getWorkItemsView → <WorkItemsList>
└── table/page.tsx                         # NUEVO: Server Component → getWorkItemsView → <WorkItemsTable>

lib/
├── work-item-view.ts                      # NUEVO (puro): tipos WorkItemViewRow/Options/ViewQuery/TreeNode,
│                                          #   parse/serializeViewQuery, filter/sortWorkItems, buildWorkItemTree
└── actions/
    └── work-item-views.ts                 # NUEVO ("use server"): getWorkItemsView (solo membresía)

components/views/
├── ProjectViewHeader.tsx                  # NUEVO: selector Board/List/Table + aviso de solo lectura + Ajustes
├── useViewQuery.ts                        # NUEVO: ViewQuery ⇄ dirección (useSearchParams + history.replaceState)
├── ViewFilters.tsx                        # NUEVO: barra de filtros compartida + contador + "Clear filters"
├── WorkItemsTable.tsx                     # NUEVO: tabla ordenable de solo lectura
├── WorkItemsList.tsx                      # NUEVO: árbol plegable con ancestros de contexto
└── ViewEmptyState.tsx                     # NUEVO: proyecto sin Work Items/columnas → enlace al tablero

tests/
├── unit/
│   ├── work-item-view.test.ts             # NUEVO: parse/serialize, filtros, orden, árbol (SC-006)
│   ├── work-item-views-action.test.ts     # NUEVO: getWorkItemsView — membresía, acotado por proyecto
│   └── action-permissions.test.ts         # MODIFICADO: getWorkItemsView en MEMBERSHIP_ONLY_READS
└── e2e/
    └── work-item-views.spec.ts            # NUEVO: quickstart.md bloques 1-5
```

**Structure Decision**: Es el mismo monolito Next.js. Las dos rutas nuevas
son hermanas de `settings/` y `work-items/`. Los componentes de vista van en
una carpeta propia, `components/views/`, como `board/` y `work-items/`. La
lógica que puede fallar en silencio (orden, filtros, árbol, parseo de la
dirección) vive en un módulo puro con tests. Los componentes solo la
presentan.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
