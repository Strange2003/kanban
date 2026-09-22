# Implementation Plan: Vista de Detalle de Work Item

**Branch**: `006-work-item-detail-view` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-work-item-detail-view/spec.md`

**Nota de alcance**: Esta feature extiende el mismo codebase y deploy de las
fases anteriores. El stack, la autenticación, el hosting y las convenciones
de testing ya decididos en
[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md) no
se vuelven a evaluar aquí. Tampoco se toca el modelo de datos ni las Server
Actions de mutación ya existentes de
[004-work-items](../004-work-items/spec.md) y
[005-work-item-relationships](../005-work-item-relationships/spec.md) — esta
es una feature de ruteo/UI sobre datos y acciones que ya funcionan.

## Summary

Reemplaza el panel modal `WorkItemDetailPanel` por una pantalla propia por
Work Item, con URL dedicada (`/projects/[projectPublicId]/work-items/[displayNumber]`),
de forma que abrir un Work Item, editarlo, gestionar sus relaciones y navegar
entre relacionados usa navegación real del navegador (URL, recarga, botón
atrás) en vez de estado local que solo reemplaza contenido dentro del mismo
diálogo. La carga inicial de datos ocurre en un Server Component (mismo
patrón que la página del tablero), y la interactividad (editar campos,
crear/quitar relaciones) reutiliza exactamente las Server Actions ya
existentes de 004 y 005 — ver [research.md](research.md) para las decisiones
de ruteo y por qué esto además simplifica el componente cliente respecto al
panel actual.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 20+ (sin cambios).

**Primary Dependencies**: Next.js 14+ (App Router, rutas dinámicas anidadas),
React 18 — mismas dependencias de las fases anteriores; no se agrega
ninguna nueva.

**Storage**: Neon (Postgres serverless) — sin cambios de esquema; esta
feature es de solo lectura adicional (una función de resolución de ruta) más
reutilización de las Server Actions de mutación ya existentes.

**Testing**: Vitest (unidad: resolución de `displayNumber` inválido/no
numérico) + Playwright (e2e: navegación, edición, relaciones y "volver" con
el botón atrás), mismas convenciones de
[001](../001-accounts-invitations/plan.md#technical-context).

**Target Platform**: Web, mismo deploy de Render.

**Project Type**: Aplicación web monolítica (sin cambios).

**Performance Goals**: Abrir la vista de detalle se percibe tan rápido como
abrir el panel modal actual (Principio I); Next.js prefetch de rutas
(comportamiento por defecto de `<Link>`/`router.push` con rutas ya
visitadas) ayuda a esto sin trabajo adicional.

**Constraints**: No se modifica el modelo de datos ni las Server Actions de
mutación de 004/005 (ver Assumptions de spec.md); el identificador en la URL
MUST seguir sin exponer el `id` interno serial de `work_items` (Principio IV
— ver research.md § Esquema de URL).

**Scale/Scope**: 1 feature, 4 historias de usuario; reutiliza la escala ya
asumida en fases anteriores.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | Es la razón de negocio de la feature: navegación con historial real (botón atrás) entre Work Items relacionados, en vez del reemplazo de contenido sin historial del panel modal actual. |
| III. Jerarquía de Datos Consistente | PASS | No se modifica el modelo; la ruta respeta la jerarquía Proyecto → Work Item ya existente (`/projects/[projectPublicId]/work-items/[displayNumber]`). |
| IV. Aislamiento y Seguridad de Datos | PASS | `getWorkItemByDisplayNumber` (nueva) exige membresía del proyecto antes de resolver la ruta, igual que `getBoard`; `notFound()` genérico ante `FORBIDDEN` (no revela si el Work Item existe a quien no es miembro), estado en línea con vuelta al tablero ante `NOT_FOUND` (FR-010/FR-011); el segmento de ruta usa el correlativo legible (`displayNumber`), no el `id` interno serial — ver research.md. |
| VI. Simplicidad y Alcance Enfocado (YAGNI) | PASS | Se elimina el panel modal en vez de mantener dos UIs para lo mismo (ver Clarifications de spec.md); no se agrega ningún dato ni Server Action de mutación nueva — todo lo mutante ya existe en 004/005. |
| Estándares de Producto y Datos § Auditoría | PASS | El historial de actividad (FR-007) se sigue mostrando con `listWorkItemActivity`, ya existente — sin cambios. |

Sin violaciones que requieran la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-work-item-detail-view/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — esquema de URL y decisiones de navegación
├── data-model.md         # Phase 1 — sin entidades nuevas; documenta el modelo de lectura de la página
├── quickstart.md         # Phase 1 — validación end-to-end de las 4 historias
├── contracts/
│   └── work-item-detail-view.md
└── tasks.md              # Phase 2 (/speckit-tasks) — no creado por este comando
```

### Source Code (repository root)

```text
app/
└── (workspace)/
    └── projects/
        └── [projectPublicId]/
            └── work-items/
                └── [displayNumber]/
                    └── page.tsx          # NUEVO: Server Component — resuelve el Work Item y renderiza
                                          #   WorkItemDetailView; notFound() sin membresía, estado en
                                          #   línea con vuelta al tablero si el Work Item no existe

lib/
└── actions/
    ├── work-items.ts                    # MODIFICADO: + getWorkItemByDisplayNumber (resolución de ruta)
    └── work-item-relationships.ts       # MODIFICADO: getWorkItemDetailData ahora también se usa
                                          #   desde el Server Component de la página (sin cambios de firma)

components/
├── board/
│   └── WorkItemCard.tsx                 # MODIFICADO: el clic navega (router.push) a la nueva ruta
                                          #   en vez de abrir WorkItemDetailPanel; se preserva el
                                          #   drag-and-drop existente (dnd-kit) sin cambios
└── work-items/
    ├── WorkItemDetailPanel.tsx          # ELIMINADO: su contenido se traslada a WorkItemDetailView
    └── WorkItemDetailView.tsx           # NUEVO: client component de la página — mismo formulario,
                                          #   relaciones y actividad que el panel actual, pero cada
                                          #   padre/hijo/relacionado es un <Link> real (no swap de estado)

tests/
├── unit/
│   └── work-items.test.ts               # NUEVO (o archivo existente ampliado): parseo de
                                          #   displayNumber inválido/no numérico
└── e2e/
    └── work-item-detail-view.spec.ts    # NUEVO: escenarios de quickstart.md
```

**Structure Decision**: Mismo monolito Next.js de las fases anteriores. La
única carpeta nueva es la ruta anidada `work-items/[displayNumber]` bajo el
proyecto ya existente — no se crean proyectos, paquetes ni servicios nuevos.
`WorkItemDetailPanel.tsx` se elimina en vez de dejarse sin uso (Principio
VI): mantener código muerto no está justificado cuando su reemplazo ya cubre
el 100% de su función.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
