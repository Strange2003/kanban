# Implementation Plan: Filtros del Tablero y Catálogos por MCP

**Branch**: `014-board-filters-mcp-catalogs` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-board-filters-mcp-catalogs/spec.md`

**Nota de alcance**: extiende el mismo codebase y deploy. El stack, la
autenticación, el hosting, la matriz de permisos, el servidor MCP y las
convenciones de testing de
[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md),
[007-roles-permissions/plan.md](../007-roles-permissions/plan.md) y
[011-agent-access-mcp/plan.md](../011-agent-access-mcp/plan.md) no se
reevalúan. Amplía FR-021 de 013-project-catalogs y la lista de capacidades de
FR-023 de 011-agent-access-mcp solo en lo pedido (spec FR-020).

## Summary

- **Filtros en el tablero**: Assignee y Tags, en el cliente, con las mismas
  reglas y parámetros de URL que List/Table (`lib/work-item-view.ts`). Las
  columnas se ven siempre; los contadores pasan a `visibles/total`; arrastrar y
  reordenar siguen funcionando con tarjetas ocultas.
- **Persistencia**: la URL (`?assignee=…&tag=…`), compartida con List/Table al
  cambiar de vista; `sessionStorage` solo para que "Back to board" vuelva
  filtrado.
- **MCP**: `list_catalogs` (lectura), `set_tag_color` (escritura con
  `catalog:manage`), tags `{ name, color }` al crear/editar Work Items (color
  solo para tags nuevas), respuestas con las tags reales y entradas estrictas
  (`z.strictObject`) en todas las herramientas.

Sin migración, sin tablas nuevas, sin claves de permiso nuevas y sin
dependencias nuevas. Decisiones y alternativas en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 20+ (sin cambios).

**Primary Dependencies**: Next.js 16 (App Router, Server Actions), React 19,
Tailwind 4, Drizzle ORM 0.45, zod 4.6, `@modelcontextprotocol/server` 2.0.0,
@dnd-kit. Sin dependencias nuevas. Antes de implementar, leer en
`node_modules/next/dist/docs/` lo de `useSearchParams` y el API de historial
nativo (AGENTS.md).

**Storage**: Neon Postgres, sin cambios de esquema (ver
[data-model.md](data-model.md)).

**Testing**: Vitest:

- `work-item-view.test.ts`: `matchesAssigneeAndTags` (O/Y, `me`, `none`,
  mayúsculas) y `serializeViewQuery(…, "board")`.
- `board.test.ts`: `getBoard` devuelve `currentUserId`, `members` y
  `tagCatalog` en orden manual.
- `work-items.test.ts`: `newTagColors` crea con color, no recolorea una tag
  existente, primer color gana, color inválido rechazado.
- `mcp-catalogs.test.ts` (nuevo): `list_catalogs` (orden, Viewer),
  `set_tag_color` (efecto, `NOT_FOUND`, `ROLE_NOT_PERMITTED`, color inválido),
  tags con color en create/update y la salida `tags`.
- `mcp-route.test.ts`: 18 herramientas, anotaciones, `additionalProperties:
  false` en todo el esquema y rechazo de un campo desconocido.

Playwright: `tests/e2e/board-filters.spec.ts` con los bloques 2 a 4 de
[quickstart.md](quickstart.md).

**Target Platform**: Web, deploy de Render contra la rama Neon de producción.

**Project Type**: aplicación web monolítica (sin cambios).

**Performance Goals**:

- `getBoard` suma dos lecturas (miembros, catálogo de tags) en paralelo, sin
  N+1.
- Filtrar es en memoria, `O(n)` sobre las tarjetas del proyecto, memoizado por
  query; inmediato con 500 Work Items (SC-002).
- Las respuestas de `create_work_items`/`update_work_item` leen las tags de
  todos los Work Items afectados en una sola consulta.

**Constraints**:

1. **Principio IV**: `getBoard` y `getProjectCatalogs` ya verifican membresía;
   `listWorkItemTags` filtra por `project_id`; las herramientas resuelven ids
   después de `requireProjectMember`.
2. **Permisos**: `set_tag_color` usa `setTagColor`
   (`requireProjectPermission(…, "catalog:manage")`); no se agrega ninguna
   comprobación de rol inline.
3. **`"use server"`**: `listWorkItemTags` va en `lib/work-item-catalogs.ts`
   (servidor, no `"use server"`); `matchesAssigneeAndTags` en el módulo puro
   `lib/work-item-view.ts`.
4. **MCP**: las herramientas nuevas no escriben con `db`; la lista fija de
   herramientas y las exclusiones se actualizan en el test y en el contrato.
5. **Auditoría**: sin tipos de evento nuevos; crear una tag al asignarla sigue
   registrando `fields_edited` vía `logActivity`.
6. **URL**: `replaceState`, nunca `pushState`, al cambiar filtros (FR-009).

**Scale/Scope**: 5 historias y 25 requisitos. Toca ~4 archivos de `lib/`, 2
Server Actions, ~4 archivos de `lib/mcp/` (1 nuevo), ~8 componentes (1 nuevo),
la página del tablero, el README y ~6 archivos de test (2 nuevos).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | Filtrar es instantáneo (en el cliente); las columnas no desaparecen; contadores y mensaje "Hidden by filters" explican por qué no se ve una tarjeta; aviso al crear una oculta; filtros accesibles por teclado (mismo `MultiSelectFilter` de 009). |
| II. Colaboración sin Límites | PASS | Sin efecto sobre miembros ni invitaciones. |
| III. Jerarquía de Datos Consistente | PASS | Sin cambios de datos. |
| IV. Aislamiento y Seguridad de Datos | PASS | Toda lectura nueva pasa por la membresía del proyecto de la ruta; `set_tag_color` por `catalog:manage`; las tags se resuelven por nombre dentro del proyecto (`resolveCatalogValue`), nunca por id del cliente. Un agente de otro proyecto recibe `NOT_FOUND`. |
| V. Código Abierto / Sin Bloqueo | PASS | Sin dependencias ni integraciones nuevas. |
| VI. Simplicidad (YAGNI) | PASS | Solo los dos filtros pedidos; se reutilizan `ViewQuery`, `MultiSelectFilter`, `getProjectCatalogs` y `setTagColor`. Sin preferencias guardadas, sin herramientas de gestión de catálogo más allá del color. |
| Estándares § Auditoría | PASS | Sin eventos nuevos; `set_tag_color` es un cambio del catálogo (como en 013). |
| Estándares § Roles | PASS | Sin claves nuevas; la matriz de `lib/roles.ts` no cambia. |

Sin violaciones.

**Re-check post-diseño (Fase 1)**: se mantiene PASS. El diseño confirmó que:

1. No hay cambios de esquema ni de la matriz de permisos.
2. `WorkItemFieldsInput` gana un campo opcional compatible (`newTagColors`).
3. Las entradas estrictas las valida el SDK antes de ejecutar la herramienta,
   así que una llamada rechazada no toca datos.
4. No se exporta ningún helper sin control de acceso desde un `"use server"`.

## Project Structure

### Documentation (this feature)

```text
specs/014-board-filters-mcp-catalogs/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — filtro en cliente, reglas compartidas, URL, volver del detalle,
│                        #   mover con ocultas, aviso, esquemas estrictos, color, respuestas, alcance MCP
├── data-model.md        # Phase 1 — sin esquema; query del tablero, getBoard, entradas/salidas MCP
├── quickstart.md        # Phase 1 — validación end-to-end
├── contracts/
│   └── board-filters-mcp-catalogs.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
lib/
├── work-item-view.ts                  # MODIFICADO: matchesAssigneeAndTags; serializeViewQuery "board"
├── work-item-catalogs.ts              # MODIFICADO: + listWorkItemTags
├── actions/board.ts                   # MODIFICADO: getBoard + currentUserId, members, tagCatalog
├── actions/work-items.ts              # MODIFICADO: newTagColors
└── mcp/
    ├── server.ts                      # MODIFICADO: registerCatalogTools, instrucciones
    └── tools/
        ├── catalogs.ts                # NUEVO: list_catalogs, set_tag_color
        ├── read.ts, columns.ts        # MODIFICADO: z.strictObject
        └── work-items.ts              # MODIFICADO: z.strictObject, tags con color, salida con tags

app/(workspace)/projects/[projectPublicId]/page.tsx   # MODIFICADO: props nuevas, Suspense

components/
├── board/BoardFilters.tsx             # NUEVO
├── board/Board.tsx                    # MODIFICADO
├── board/StageColumn.tsx              # MODIFICADO
├── board/AddWorkItemButton.tsx        # MODIFICADO
├── views/ViewFilters.tsx              # MODIFICADO: exporta MultiSelectFilter / opciones de asignado
├── views/useViewQuery.ts              # MODIFICADO: "board"
├── views/ProjectViewHeader.tsx        # MODIFICADO: conserva assignee/tag
└── work-items/WorkItemDetailView.tsx  # MODIFICADO: Back to board con la query guardada

README.md                              # MODIFICADO: Features (Board), AI agents (herramientas, reconectar)

tests/
├── unit/mcp-catalogs.test.ts          # NUEVO
├── unit/{work-item-view,board,work-items,mcp-route}.test.ts  # MODIFICADOS
└── e2e/board-filters.spec.ts          # NUEVO
```

**Structure Decision**: mismo monolito, sin rutas nuevas. `BoardFilters` es un
componente propio (y no `ViewFilters` con una bandera) porque el tablero solo
tiene dos filtros y no tiene búsqueda, estado ni "More filters"; comparte con
`ViewFilters` el `MultiSelectFilter` y las opciones de asignado, que es donde
vive el comportamiento.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
