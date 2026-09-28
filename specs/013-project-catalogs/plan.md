# Implementation Plan: Catálogos por Proyecto — Tags con Color, Áreas y Tamaño

**Branch**: `013-project-catalogs` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-project-catalogs/spec.md`

**Nota de alcance**: extiende el mismo codebase y deploy. El stack, la
autenticación, el hosting, la matriz de permisos y las convenciones de
testing de [001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md)
y [007-roles-permissions/plan.md](../007-roles-permissions/plan.md) no se
reevalúan. Reemplaza el candidato del README "Managing catalogs" y levanta
FR-007 de 008-work-item-fields ("los catálogos solo crecen").

## Summary

Vuelve administrables los tres catálogos por proyecto (tags, áreas y
tamaños):

- **Pantalla de catálogos** en
  `/projects/{id}/settings/catalogs`, con las secciones Tags, Areas y Size:
  crear, renombrar, reordenar (orden manual) y eliminar; en las tags, además,
  el color. Se llega desde la opción "Tags" anidada bajo el proyecto activo
  en el sidebar.
- **Color de tag** de una paleta fija de 10 (enum `tag_color`, gris por
  defecto): línea fina de colores al pie de cada tarjeta y chips con fondo de
  color en el detalle.
- **Size** es la tabla `iterations` renombrada (`sizes`, `work_items.size_id`),
  sin perder datos; el historial antiguo se lee como Size.
- **Crear desde el Work Item**: los pickers ofrecen "Create new", que abre un
  pop-up (nombre y, en tags, color) y crea el valor antes de guardar.
- **Eliminar un valor en uso** lo quita de todos los Work Items en una
  transacción, con un `fields_edited` por Work Item (`reason:
  "catalog_value_deleted"`) vía `logActivity`.

Una clave de permiso nueva (`catalog:manage`, Owner y Member), un archivo de
Server Actions nuevo y una migración (`0008`). Decisiones y alternativas en
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 20+ (sin cambios).

**Primary Dependencies**: Next.js 16 (App Router, Server Actions), React 19,
Tailwind 4, Drizzle ORM 0.45 + drizzle-kit, zod 4, lucide-react. Sin
dependencias nuevas (no se agrega librería de color picker ni de combobox).
Antes de implementar, leer en `node_modules/next/dist/docs/` las guías de
rutas anidadas/layouts y de Server Actions (AGENTS.md).

**Storage**: Neon Postgres. Migración `0008` escrita a mano (renombres):
enum `tag_color`, `tags.color`, `position` en los tres catálogos,
`iterations` → `sizes`, `iteration_id` → `size_id`. Ver
[data-model.md § Migración](data-model.md#migración-0008). Aplicar en `dev`
y en producción **antes** del push.

**Testing**: Vitest:

- `lib/tag-colors.ts`: paleta completa y contraste ≥ 4.5:1 de cada chip.
- `project-catalogs` (nuevo `tests/unit/project-catalogs.test.ts`): crear
  (reutiliza existente sin distinguir mayúsculas, posición al final), renombrar
  (`CATALOG_NAME_TAKEN`, solo mayúsculas permitido), reordenar (`CONFLICT` con
  lista desactualizada), eliminar (quita de los Work Items, un evento por
  Work Item con `reason`), aislamiento entre proyectos.
- `work-items.test.ts`: `sizeName`; `createMissingCatalogValues: false` →
  `CATALOG_VALUE_NOT_FOUND`.
- `work-item-view.test.ts`: orden por área/size según el catálogo, parámetro
  `size`.
- `work-item-activity`: claves `iteration`/`size` → "Size", "(value deleted)".
- `action-permissions.test.ts` y `roles.test.ts`: las 6 acciones nuevas y
  `catalog:manage`.
- `mcp-*.test.ts`: `size` y tags con color.

Playwright: `tests/e2e/project-catalogs.spec.ts` con los bloques 2 a 5 de
[quickstart.md](quickstart.md); actualizar `work-item-fields.spec.ts` y
`work-item-views.spec.ts` (Iteration → Size, creación vía pop-up).

**Target Platform**: Web, deploy de Render contra la rama Neon de
producción.

**Project Type**: aplicación web monolítica (sin cambios).

**Performance Goals**:

- `getBoard` suma una consulta (tags + color de todos los Work Items del
  proyecto), sin N+1.
- `getProjectCatalogs`: tres lecturas de catálogo con `count` agrupado, en
  un `Promise.all`.
- `deleteCatalogValue`: un `UPDATE`/`DELETE` y un `INSERT` en bloque de
  eventos, no uno por Work Item.
- La pantalla de catálogos es optimista (renombrar, color, reordenar), con
  reversión si falla.

**Constraints**:

1. **Principio IV**: cada acción resuelve el catálogo con `project_id` del
   proyecto de la ruta; ningún id interno sale del servidor (se identifica
   por nombre, research.md).
2. **Auditoría**: eliminar en uso escribe historial por Work Item en la misma
   transacción; siempre vía `logActivity`.
3. **`"use server"`**: nada sin control de acceso se exporta desde
   `lib/actions/project-catalogs.ts`; los helpers van en
   `lib/work-item-catalogs.ts` (servidor) y `lib/tag-colors.ts` (puro).
4. **Permisos**: `requireProjectPermission(…, "catalog:manage")` en toda
   escritura; `can()` solo para ocultar controles.
5. **MCP**: sin herramientas nuevas; solo renombre de campo y color en las
   lecturas.
6. **Tailwind 4**: las clases de la paleta se escriben literales.

**Scale/Scope**: 4 historias y 23 requisitos (FR-001–FR-022 y FR-003a).
Toca:

- 1 archivo de Server Actions nuevo y 4 modificados.
- 1 ruta nueva.
- ~6 componentes nuevos y ~8 modificados.
- 2 módulos de `lib/` nuevos o ampliados.
- 1 migración.
- Las herramientas MCP.

Escala asumida: catálogos de decenas de valores, tableros de ≥100 Work Items.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | La pantalla de catálogos es optimista con reversión. Reordenar funciona sin arrastrar (flechas con nombre accesible). La línea de colores es discreta y decorativa, y los nombres siguen llegando a los lectores de pantalla. La creación rápida no saca al usuario del Work Item. La paleta está elegida para contraste en claro y oscuro. |
| II. Colaboración sin Límites | PASS | Sin efecto sobre miembros ni invitaciones. |
| III. Jerarquía de Datos Consistente | PASS | Los catálogos cuelgan del proyecto; Size reutiliza la tabla de iteraciones con el mismo lugar en la jerarquía. Stages y relaciones no cambian. |
| IV. Aislamiento y Seguridad de Datos | PASS | Toda lectura pasa por `requireProjectMember` y toda escritura por `requireProjectPermission("catalog:manage")`. Las consultas siempre filtran por el `project_id` de la ruta. Se identifica por nombre, sin ids internos expuestos, con el mismo criterio que los Work Items. Los tres catálogos siguen en cascada con el proyecto. |
| V. Código Abierto / Sin Bloqueo | PASS | Sin dependencias nuevas ni integraciones. |
| VI. Simplicidad (YAGNI) | PASS | Solo lo confirmado por el product owner (Clarifications). Se reutilizan la tabla de iteraciones, el evento `fields_edited`, el patrón de `reorderStages` y el `Dialog` existente. No hay publicIds nuevos, ni lexorank, ni herramientas MCP de gestión, ni color en áreas o tamaños. |
| Estándares § Auditoría | PASS | Eliminar un valor en uso registra un `fields_edited` por Work Item, con autor y agente, vía `logActivity`. Renombrar, cambiar color y reordenar son cambios del catálogo (FR-005) y no del Work Item. El historial antiguo de iteración se sigue mostrando, como Size. |
| Estándares § Roles | PASS | La clave `catalog:manage` se agrega a la matriz única de `lib/roles.ts` y se documenta en [contracts/project-catalogs.md § Permisos](contracts/project-catalogs.md#permisos). El Viewer solo lee. |

Sin violaciones. Hay un riesgo operativo documentado: la migración renombra
tablas que el código viejo lee, así que entre migrar producción y terminar el
deploy hay una ventana corta de errores
([research.md § Migración](research.md#decisión-migración-0008)).

**Re-check post-diseño (Fase 1)**: se mantiene PASS. El diseño confirmó
cuatro cosas:

1. Los contratos existentes cambian solo por el renombre Iteration → Size y
   por campos de retorno nuevos (color y orden).
2. `updateWorkItem` gana una opción con default compatible.
3. No se exporta ningún helper sin control de acceso desde un `"use server"`.
4. No hay tipos de evento nuevos.

## Project Structure

### Documentation (this feature)

```text
specs/013-project-catalogs/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — Size, historial, identificación, orden, color, borrado, permiso, ruta, sidebar, pop-up, migración
├── data-model.md        # Phase 1 — enum, columnas, renombres, eventos, migración 0008
├── quickstart.md        # Phase 1 — validación end-to-end
├── contracts/
│   └── project-catalogs.md   # permisos, módulos, acciones nuevas y modificadas, MCP, UI
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks) — no creado por este comando
```

### Source Code (repository root)

```text
db/
├── schema.ts                              # MODIFICADO: pgEnum tag_color; tags + color, position;
│                                          #   areas + position; iterations → sizes (+ position);
│                                          #   work_items.iterationId → sizeId
└── migrations/0008_project_catalogs.sql   # NUEVO (a mano) + meta/ — data-model.md § Migración

lib/
├── tag-colors.ts                          # NUEVO (puro): TAG_COLORS, TagColor, TAG_COLOR_STYLES, DEFAULT_TAG_COLOR
├── roles.ts                               # MODIFICADO: + "catalog:manage": ["owner", "member"]
├── work-item-catalogs.ts                  # MODIFICADO: kind "tag" | "area" | "size"; orden (position, id);
│                                          #   resolveCatalogValue con { create } y alta al final
├── work-item-view.ts                      # MODIFICADO: iteration → size; orden por catálogo; tags con color
├── work-item-activity.ts                  # MODIFICADO: "Size" para iteration/size; "(value deleted)"
├── mcp/tools/read.ts, work-items.ts       # MODIFICADO: iteration → size; tags con color
└── actions/
    ├── project-catalogs.ts                # NUEVO: getProjectCatalogs, createCatalogValue, renameCatalogValue,
    │                                      #   setTagColor, reorderCatalog, deleteCatalogValue
    ├── work-items.ts                      # MODIFICADO: sizeName; createMissingCatalogValues; tags vía
    │                                      #   resolveCatalogValue; listProjectTags en orden y con color
    ├── board.ts                           # MODIFICADO: getBoard + tags { name, color } por Work Item
    ├── work-item-relationships.ts         # MODIFICADO: getWorkItemDetailData → sizes, orden, color
    └── work-item-views.ts                 # MODIFICADO: sizes, orden, color

app/(workspace)/projects/[projectPublicId]/settings/
├── page.tsx                               # MODIFICADO: enlace a "Tags, areas & sizes"
└── catalogs/page.tsx                      # NUEVO: pantalla de catálogos (requireProjectMember)

components/
├── sidebar/ProjectSidebarClient.tsx       # MODIFICADO: opciones anidadas bajo el proyecto activo ("Tags")
├── settings/CatalogSection.tsx            # NUEVO: lista, alta, renombre, color, orden, borrado con confirmación
├── ui/tag-color-picker.tsx                # NUEVO: radiogroup de la paleta
├── ui/tag-chip.tsx                        # NUEVO: chip con fondo de color
├── board/TagColorBar.tsx                  # NUEVO: línea de colores al pie de la tarjeta
├── board/WorkItemCard.tsx                 # MODIFICADO: <TagColorBar>, aria-label con tags (también la preview)
├── work-items/CreateCatalogValueDialog.tsx# NUEVO: pop-up "Create new"
├── work-items/TagPicker.tsx               # MODIFICADO: chips con color, "Create new" → diálogo
├── work-items/CatalogPicker.tsx           # MODIFICADO: "Create new" → diálogo
├── work-items/WorkItemDetailView.tsx      # MODIFICADO: Size; createMissingCatalogValues: false; aviso
│                                          #   CATALOG_VALUE_NOT_FOUND
└── views/WorkItemsTable.tsx, ViewFilters.tsx  # MODIFICADO: Size; color en filtro de tags

app/(legal)/privacy/page.tsx, README.md     # MODIFICADO: "iteration" → "size"; roadmap sin "Managing catalogs"

tests/
├── unit/project-catalogs.test.ts          # NUEVO
├── unit/tag-colors.test.ts                # NUEVO
├── unit/{work-items,work-item-view,work-item-views-action,action-permissions,roles,mcp-*}.test.ts  # MODIFICADOS
└── e2e/project-catalogs.spec.ts           # NUEVO; work-item-fields / work-item-views / setup.ts MODIFICADOS
```

**Structure Decision**: es el mismo monolito. Hay una sola ruta nueva, bajo
los ajustes del proyecto. `CatalogSection` es un componente genérico por
`kind`, porque las tres secciones se gestionan igual (FR-003); el color es
una fila extra que solo se muestra con `kind = "tag"`. `TagPicker` y
`CatalogPicker` siguen separados, igual que en 008: multiselección frente a
un solo valor. Ambos comparten solo el diálogo de creación.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
