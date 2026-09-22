# Implementation Plan: Relaciones entre Work Items

**Branch**: `005-work-item-relationships` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-work-item-relationships/spec.md`

**Nota de alcance**: Esta feature extiende el mismo codebase y deploy de la
Fase 1 (no crea un servicio nuevo). El stack, la autenticación, el hosting y
las convenciones de testing ya decididos en
[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md) y
[research.md](../001-accounts-invitations/research.md) no se vuelven a
evaluar aquí — este plan solo cubre lo específico de las relaciones entre
Work Items (modelo de datos nuevo, detección de ciclos, contratos nuevos).

## Summary

Añade dos tipos de vínculo entre Work Items de un mismo proyecto —
jerárquico (padre/hijo, con anidación arbitraria y sin ciclos) y simétrico
("relacionado con") — reutilizando el `WorkItemDetailPanel` ya existente
como superficie de creación/visualización/eliminación, sin introducir una
vista de detalle dedicada (eso es la siguiente feature, Fase 2 punto 6). El
enfoque técnico modela el padre/hijo como una columna auto-referencial en
`work_items` (para que Postgres imponga gratis "a lo sumo un padre" y "hijo
huérfano al borrar el padre") y "relacionado con" como una tabla de unión
simétrica separada, evitando una tabla de relaciones genérica que
reimplemente en la aplicación reglas de integridad que la base de datos ya
ofrece — ver [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 20+ (sin cambios respecto a
[001](../001-accounts-invitations/plan.md#technical-context))

**Primary Dependencies**: Next.js 14+ (App Router), Drizzle ORM +
`@neondatabase/serverless`, Zod (validación de Server Actions) — mismas
dependencias de la Fase 1; no se agrega ninguna nueva. La detección de
ciclos usa `WITH RECURSIVE` (CTE recursiva estándar de Postgres, soportada
por Neon sin configuración adicional), no una librería de grafos.

**Storage**: Neon (Postgres serverless) — mismo esquema, con una columna y
una tabla nuevas (ver [data-model.md](data-model.md)).

**Testing**: Vitest (unidad: función de detección de ciclos) + Playwright
(e2e: escenarios de [quickstart.md](quickstart.md)), mismas convenciones de
[001](../001-accounts-invitations/plan.md#technical-context).

**Target Platform**: Web, mismo deploy de Render que el resto de la app.

**Project Type**: Aplicación web monolítica (sin cambios).

**Performance Goals**: Crear o quitar una relación se percibe como
instantáneo (UI optimista, consistente con SC-001/SC-004 de la spec); la
verificación de ciclos (CTE recursiva) corre en el servidor antes de
confirmar la relación y debe resolver en <200ms percibido para árboles de
profundidad razonable (decenas de niveles) — ver research.md para por qué no
se justifica una tabla de clausura transitiva en este volumen.

**Constraints**: Relaciones solo entre Work Items del mismo proyecto
(FR-007); sin límite de hijos ni de relacionados (Assumptions de la spec);
sin roles diferenciados todavía (cualquier miembro puede crear/quitar
relaciones, igual que en 004-work-items).

**Scale/Scope**: 1 feature, 4 historias de usuario; reutiliza la escala ya
asumida en Fase 1 (≥100 Work Items por columna).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | Las relaciones se crean/quitan desde el `WorkItemDetailPanel` ya existente, sin recargar la página ni bloquear la UI; SC-001 exige <10s percibidos. |
| II. Colaboración sin Límites | PASS | Sin límite de hijos ni de relacionados por Work Item (ver Assumptions de la spec). |
| III. Jerarquía de Datos Consistente | PASS | `data-model.md` modela explícitamente los dos tipos de relación exigidos por la constitución (anidación vía `parentWorkItemId`, asociación vía `work_item_related_links`), ambos expuestos por `getWorkItemRelations` para ser navegables. |
| IV. Aislamiento y Seguridad de Datos | PASS | Toda Server Action de `lib/actions/work-item-relationships.ts` valida membresía del proyecto antes de leer/escribir (mismo patrón que `work-items.ts`); FR-007 impide relaciones cross-proyecto explícitamente; `onDelete: set null` (padre) y `onDelete: cascade` (relacionados) evitan registros huérfanos apuntando a un Work Item inexistente. |
| VI. Simplicidad y Alcance Enfocado (YAGNI) | PASS | Se descarta una tabla de relaciones genérica y una tabla de clausura transitiva para detección de ciclos (ver research.md) por no estar justificadas en este volumen; no se construye la vista de detalle dedicada (queda para la siguiente spec). |
| Estándares de Producto y Datos § Auditoría | PASS | FR-014 exige registrar cada cambio de relación en `work_item_activity`, mismo mecanismo ya usado por `moveWorkItem`/`updateWorkItem` (ver contracts/work-item-relationships.md). |

Sin violaciones que requieran la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-work-item-relationships/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — modelo de relaciones y detección de ciclos
├── data-model.md         # Phase 1 — columna/tabla nuevas sobre el esquema de 001
├── quickstart.md         # Phase 1 — validación end-to-end de las 4 historias
├── contracts/
│   └── work-item-relationships.md
└── tasks.md              # Phase 2 (/speckit-tasks) — no creado por este comando
```

### Source Code (repository root)

```text
db/
└── schema.ts                        # MODIFICADO: + work_items.parentWorkItemId (self-FK, nullable,
                                      #   onDelete: set null) + tabla work_item_related_links

lib/
└── actions/
    └── work-item-relationships.ts   # NUEVO: setWorkItemParent, removeWorkItemParent,
                                      #   linkRelatedWorkItems, unlinkRelatedWorkItems,
                                      #   getWorkItemRelations (ver contracts/)

components/
└── work-items/
    └── WorkItemDetailPanel.tsx      # MODIFICADO: + sección de relaciones (padre, hijos,
                                      #   relacionados), reutilizando el panel ya existente de 004

tests/
├── unit/
│   └── work-item-relationships.spec.ts  # NUEVO: detección de ciclos, dedupe de "relacionado con"
└── e2e/
    └── work-item-relationships.spec.ts  # NUEVO: escenarios de quickstart.md
```

**Structure Decision**: Se mantiene el mismo monolito Next.js de la Fase 1
(mismo `db/schema.ts`, misma carpeta `lib/actions/`) — no se crean proyectos,
paquetes ni servicios nuevos. El único archivo de UI existente que cambia es
`WorkItemDetailPanel.tsx`, porque las relaciones se muestran ahí hasta que
exista la vista de detalle dedicada (Fase 2, punto 6).

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
