# Implementation Plan: Animaciones de Carga y un Esqueleto por Página

**Branch**: `015-loading-animations` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-loading-animations/spec.md`

**Nota de alcance**: extiende el mismo codebase y deploy. El stack, el hosting y
las convenciones de testing de
[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md) no se
reevalúan. Es una feature solo de presentación: sin datos, permisos, Server
Actions ni MCP.

## Summary

- **Un esqueleto por página**: `loading.tsx` nuevo en el detalle de Work Item,
  List, Table, Settings, Catálogos, My work y Connected agents, cada uno con la
  forma de su página. El `loading.tsx` del proyecto queda solo para el tablero.
- **Tablero "tarjetas que caen"**: `BoardSkeleton` pasa a Client Component,
  dibuja tantas columnas como recuerda `localStorage` para ese proyecto (3 por
  defecto, tope 8) y siluetas que caen en bucle. `Board` guarda el número de
  columnas y, solo al montarse, hace aterrizar tarjetas y encabezados de forma
  escalonada (< 500 ms).
- **Reglas comunes**: aparición diferida 150 ms, todo el movimiento bajo
  `prefers-reduced-motion: no-preference`, solo CSS, `role="status"`.

Sin migración, sin dependencias nuevas. Decisiones y alternativas en
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 20+ (sin cambios).

**Primary Dependencies**: Next.js 16 (App Router), React 19, Tailwind 4. Sin
dependencias nuevas (FR-013). Leído antes de diseñar:
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`.

**Storage**: ninguno en servidor. `localStorage` del navegador para el número de
columnas por proyecto (ver [data-model.md](data-model.md)).

**Testing**:

- Vitest `tests/unit/board-column-memory.test.ts` (nuevo): clave por proyecto,
  acotado (0/negativo/NaN → 3, > 8 → 8), lectura/escritura con un `Storage`
  falso, y que un `Storage` que lanza no rompe (devuelve 3 / no hace nada).
- Vitest `tests/unit/loading-states.test.ts` (nuevo): cada ruta que carga datos
  tiene su `loading.tsx` (lista fija de 8 segmentos) — evita que una página
  nueva vuelva a heredar el esqueleto del tablero.
- Playwright `tests/e2e/loading-states.spec.ts` (nuevo): contra `next dev`
  no se puede forzar una navegación lenta sin tocar la app, así que un
  `MutationObserver` registra qué esqueletos aparecen y qué animación corren las
  tarjetas al montarse el tablero: memoria de 5 columnas, `kb-land` solo al
  llegar, abrir un Work Item nunca muestra el esqueleto del tablero, y con
  `reducedMotion: "reduce"` no hay aterrizaje. La forma visual de cada
  esqueleto se revisa en el navegador con un retraso temporal en el servidor
  (quickstart.md).

**Target Platform**: Web, deploy de Render (sin cambios).

**Project Type**: aplicación web monolítica (sin cambios).

**Performance Goals**:

- Esqueletos sin JavaScript en el hilo principal salvo `BoardSkeleton` (una
  lectura de `localStorage`); animaciones de `opacity` y `translate`, que el
  navegador compone sin reflow.
- Tope de 8 columnas × 3 siluetas = 24 elementos animados como máximo en el
  tablero; ~10-14 en las demás páginas.
- Entrada del tablero ≤ 460 ms (260 ms + 200 ms de escalonado máximo).

**Constraints**:

1. **`@dnd-kit`** escribe `transform` inline en columnas y tarjetas: las
   animaciones usan la propiedad `translate` y `fill-mode: backwards`
   (research § 5).
2. **Sin repetición**: la entrada del tablero solo corre bajo la clase
   `kb-board-entering`, presente 600 ms tras montar `Board` (FR-005).
3. **Hidratación**: `BoardSkeleton` lee `localStorage` con
   `useSyncExternalStore` y snapshot de servidor 3; nunca en el render inicial
   del servidor.
4. **Ningún esqueleto falla sin almacenamiento** (modo privado, bloqueado):
   `try/catch` en `lib/board-column-memory.ts`.
5. **Tema**: solo tokens existentes (`bg-muted`, `bg-card`, `border-border`),
   que ya cambian con `.dark` (FR-011).

**Scale/Scope**: 3 historias y 13 requisitos. ~8 `loading.tsx` (7 nuevos), 1
módulo `lib/`, ~3 componentes nuevos en `components/loading/`, `Board`,
`StageColumn`, `WorkItemCard`, `globals.css`, README y 3 archivos de test.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | Es el objetivo de la feature: cada página carga con su forma, sin destellos (< 150 ms) y sin retrasar el contenido (FR-010). Respeta "reducir movimiento". |
| II. Colaboración sin Límites | PASS | Sin efecto. |
| III. Jerarquía de Datos Consistente | PASS | Sin cambios de datos. |
| IV. Aislamiento y Seguridad de Datos | PASS | Los esqueletos no leen datos del servidor; el número recordado solo existe en el navegador de quien ya vio el tablero y va con el `publicId`, no con la PK. Las páginas siguen verificando membresía igual que hoy (un no miembro ve el esqueleto un instante y luego el 404 de siempre). |
| V. Código Abierto / Sin Bloqueo | PASS | Sin dependencias ni integraciones. |
| VI. Simplicidad (YAGNI) | PASS | CSS puro, un solo módulo de memoria; sin sincronizar entre dispositivos, sin View Transitions, sin librería de animación. |
| Estándares § Auditoría | N/A | No toca Work Items. |
| Estándares § Roles | N/A | No toca permisos. |

Sin violaciones.

**Re-check post-diseño (Fase 1)**: se mantiene PASS. El diseño confirmó que
ningún `"use server"` cambia, que `action-permissions.test.ts` no necesita
entradas nuevas y que la memoria local no contiene nada más que un entero por
`publicId`.

## Project Structure

### Documentation (this feature)

```text
specs/015-loading-animations/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — loading por segmento, memoria de columnas, CSS, 150 ms, entrada sin repetir, a11y
├── data-model.md        # Phase 1 — sin esquema; la clave local
├── quickstart.md        # Phase 1 — validación manual y automática
├── contracts/
│   └── loading-states.md  # Qué esqueleto muestra cada ruta y cómo se anima
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
app/globals.css                                    # MODIFICADO: keyframes y clases kb-*
app/(workspace)/
├── my-work/loading.tsx                            # NUEVO
├── settings/agents/loading.tsx                    # NUEVO
└── projects/[projectPublicId]/
    ├── loading.tsx                                # MODIFICADO: BoardLoading (cabecera + BoardSkeleton)
    ├── list/loading.tsx                           # NUEVO
    ├── table/loading.tsx                          # NUEVO
    ├── settings/loading.tsx                       # NUEVO
    ├── settings/catalogs/loading.tsx              # NUEVO
    └── work-items/[displayNumber]/loading.tsx     # NUEVO

lib/board-column-memory.ts                         # NUEVO: clave, acotado, leer/escribir (Storage inyectable)

components/
├── loading/Skeleton.tsx                           # NUEVO: SkeletonFrame (role=status, aparición diferida), Bone (bloque que cae)
├── loading/PageSkeletons.tsx                      # NUEVO: ViewHeader, WorkItemDetail, List, Table, Settings, Catalogs, MyWork, Agents
├── board/BoardSkeleton.tsx                        # MODIFICADO: Client Component, N columnas, siluetas que caen
├── board/Board.tsx                                # MODIFICADO: recuerda columnas, clase kb-board-entering 600 ms
├── board/StageColumn.tsx                          # MODIFICADO: índice de columna → --kb-delay en encabezado y tarjetas
└── board/WorkItemCard.tsx                         # MODIFICADO: data-kb-land + --kb-delay

README.md                                          # MODIFICADO: Project Status (015)

tests/
├── unit/board-column-memory.test.ts               # NUEVO
├── unit/loading-states.test.ts                    # NUEVO
└── e2e/loading-states.spec.ts                     # NUEVO
```

**Structure Decision**: los esqueletos de página son Server Components en un
solo archivo (`PageSkeletons.tsx`) porque son estáticos y comparten primitivas;
solo el del tablero es Client Component (necesita `useParams` y
`localStorage`). `BoardSkeleton` se queda en `components/board/` porque también
lo usa el `Suspense` de la página del tablero.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
