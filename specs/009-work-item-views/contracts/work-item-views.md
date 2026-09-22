# Contratos: Vistas de Lista y Tabla

Cubre [009-work-item-views](../spec.md). Sigue el patrón de Server Actions con
`Result<T>` de
[001-accounts-invitations/contracts/](../../001-accounts-invitations/contracts/).
No hay endpoints HTTP nuevos ni acciones de escritura: las vistas son de solo
lectura (FR-011, FR-016, FR-018).

## Rutas

| Ruta | Página | Vista |
|---|---|---|
| `/projects/[projectPublicId]` | existente (`page.tsx`) | Tablero (sin cambios de comportamiento; ahora usa `ProjectViewHeader`) |
| `/projects/[projectPublicId]/list` | **nueva** (`list/page.tsx`) | Lista jerárquica |
| `/projects/[projectPublicId]/table` | **nueva** (`table/page.tsx`) | Tabla |

Las dos páginas nuevas:

1. Son Server Components.
2. Llaman a `getWorkItemsView(projectPublicId)`.
3. Convierten `NOT_FOUND`/`FORBIDDEN` en `notFound()`, igual que el tablero
   (FR-004, SC-004).
4. Pasan filas y opciones a un componente cliente.

Los filtros los lee el cliente con `useSearchParams`; la página no los usa en
el servidor. El `loading.tsx` existente del proyecto cubre las dos rutas.

## Permisos

Sin claves nuevas (FR-017). Leer, ordenar y filtrar exige solo membresía,
así que un Lector usa las vistas completas.

## Acción de lectura nueva

### `getWorkItemsView(projectPublicId: string): Promise<Result<WorkItemsViewData>>`

En `lib/actions/work-item-views.ts` (`"use server"`, un solo export).

```ts
type WorkItemsViewData = {
  rows: WorkItemViewRow[];          // data-model.md § Fila de vista
  options: WorkItemViewOptions;     // data-model.md § Opciones de filtro
  role: ProjectRole;                // para ProjectViewHeader (aviso de solo lectura)
  totalCount: number;               // = rows.length; para "N of M" (FR-008)
};
```

- Llama primero a `requireProjectMember(projectPublicId)`. Sin sesión da
  `UNAUTHENTICATED`, si el proyecto no existe `NOT_FOUND`, y si el usuario no
  es miembro `FORBIDDEN`.
- Todas las consultas se acotan por `project.id`. Los tags se leen con
  `work_item_tags ⋈ tags WHERE tags.project_id = project.id`.
- No hay escrituras.
- `tests/unit/action-permissions.test.ts` la registra en
  `MEMBERSHIP_ONLY_READS`.

## Módulo puro `lib/work-item-view.ts` (importable desde cliente y servidor)

```ts
export type SortKey = "id" | "title" | "stage" | "status" | "priority" | "severity" | "area"
  | "iteration" | "stakeholder" | "startDate" | "targetDate" | "createdAt" | "closedAt";
export type ViewQuery = { /* data-model.md § Consulta de vista */ };

export const DEFAULT_VIEW_QUERY: ViewQuery;
export function parseViewQuery(params: URLSearchParams, validStagePublicIds: ReadonlySet<string>): ViewQuery;
export function serializeViewQuery(query: ViewQuery, view: "list" | "table"): string;   // sin "?"; omite defaults; en "list" omite sort/dir
export function hasActiveFilters(query: ViewQuery): boolean;
export function filterWorkItems(rows: WorkItemViewRow[], query: ViewQuery, today: string | null): WorkItemViewRow[];
export function sortWorkItems(rows: WorkItemViewRow[], sort: SortKey, dir: "asc" | "desc"): WorkItemViewRow[];
export function buildWorkItemTree(rows: WorkItemViewRow[], matchingIds: ReadonlySet<number> | null): WorkItemTreeNode[];
```

- `filterWorkItems` con `query.overdue` y `today === null` devuelve `[]`. La
  UI muestra carga en ese caso (research.md § "Vencido").
- `sortWorkItems` no muta la entrada. Pone los vacíos al final en ambas
  direcciones y desempata por `displayNumber` ascendente.
- `buildWorkItemTree(rows, null)` arma el árbol completo. Con un conjunto,
  arma el árbol con esos Work Items más sus ancestros marcados como
  `isContext`.

Los tipos `WorkItemViewRow` y `WorkItemViewOptions` se declaran en este mismo
módulo puro y `work-item-views.ts` los importa. Así los componentes cliente
no importan tipos desde un archivo `"use server"`.

## Componentes

| Componente | Contrato |
|---|---|
| `components/views/ProjectViewHeader.tsx` (nuevo, cliente) | Props: `projectPublicId`, `role`, `active: "board" \| "list" \| "table"`. Renderiza el selector de vista como tres enlaces (`nav` con `aria-label="Views"` y `aria-current="page"` en el activo), el `ReadOnlyNotice` si el rol no puede editar el tablero, y el enlace a Ajustes. Los enlaces a Lista y Tabla **conservan los filtros** de la vista actual (salvo `sort`/`dir` al ir a Lista), así cambiar de vista no los pierde. |
| `components/views/ViewFilters.tsx` (nuevo, cliente) | Barra de filtros compartida por Lista y Tabla: búsqueda, estado, columna, prioridad, severidad, área, iteración, tag (selección múltiple con "None"), "Overdue only", contador "N of M" y "Clear filters" (FR-007, FR-008). Emite un `ViewQuery` nuevo; no toca la dirección por sí misma. |
| `components/views/useViewQuery.ts` (nuevo, hook cliente) | Lee `useSearchParams()`, devuelve `[query, setQuery]`. `setQuery` escribe con `window.history.replaceState` (research.md § Filtros). |
| `components/views/WorkItemsTable.tsx` (nuevo, cliente) | Tabla semántica (`<table>`, `<th scope="col">`). Los encabezados ordenables son botones con `aria-sort` (FR-006). Cada fila tiene el título como enlace al detalle (FR-003). Muestra estado vacío con "Clear filters" (US2 escenario 6). Solo lectura (FR-011). Reutiliza `PriorityBadge` y `TargetDateChip` de 008 y `LocalDate` para los instantes. |
| `components/views/WorkItemsList.tsx` (nuevo, cliente) | Árbol accesible (`role="tree"` / `treeitem` con `aria-expanded` y `aria-level`), un botón de plegado por nodo con hijos, que muestra `childCount`, y "Expand all" / "Collapse all" (FR-014). Los nodos `isContext` van atenuados y los cerrados, con su estado (FR-013, FR-015). |
| `app/(workspace)/projects/[projectPublicId]/page.tsx` (modificado) | Reemplaza su cabecera por `ProjectViewHeader active="board"`. El tablero no cambia. |
| `components/views/ViewEmptyState.tsx` (nuevo) | Proyecto sin Work Items, o sin columnas: mensaje y enlace al tablero (Edge Cases). |
