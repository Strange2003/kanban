# Contratos: Vista de Detalle de Work Item

Cubre [006-work-item-detail-view](../spec.md). Reutiliza sin cambios los
contratos ya existentes de
[004-work-items](../../001-accounts-invitations/contracts/work-items.md) y
[005-work-item-relationships](../../005-work-item-relationships/contracts/work-item-relationships.md)
para toda la edición y gestión de relaciones. Esta feature solo agrega una
función de resolución de ruta.

## `getWorkItemByDisplayNumber(projectPublicId, displayNumber): Result<WorkItemWithDisplayId>`

**Cubre**: FR-001, FR-010, FR-011.

- **Auth**: cualquier miembro del proyecto (`requireProjectMember` primero,
  antes de intentar la búsqueda — Principio IV).
- **Reglas**:
  - `displayNumber` MUST ser un entero positivo; un valor no numérico o
    inválido en la ruta se trata igual que "no encontrado" (FR-011), no como
    un error distinto.
  - Rechaza con `NOT_FOUND` si no existe ningún Work Item con ese
    `displayNumber` dentro del proyecto resuelto por `projectPublicId`
    (cubre tanto "nunca existió" como "fue eliminado" — FR-011, primer edge
    case de spec.md).
  - Rechaza con `FORBIDDEN`/`NOT_FOUND` (según corresponda, vía
    `requireProjectMember`) si quien pide la página no es miembro del
    proyecto — segundo edge case de spec.md.
- **Output**: el Work Item resuelto, con `displayId` ya calculado (mismo
  shape que el resto de las Server Actions de Work Items).
- **Uso**: llamado directamente desde el Server Component de la página
  (`app/(workspace)/projects/[projectPublicId]/work-items/[displayNumber]/page.tsx`),
  no desde un cliente — ver research.md § Carga de datos de la página. La
  página traduce `FORBIDDEN` a `notFound()` de Next.js (mismo genérico, para
  no revelar si el Work Item existe a quien no es miembro — Principio IV);
  `NOT_FOUND` (Work Item eliminado, o `displayNumber` inválido) en cambio
  renderiza un estado en línea con un enlace de vuelta al tablero, ya que
  quien lo ve sí es miembro y tiene un tablero real al que volver (FR-011).
  La resolución server-side sigue el mismo patrón que la página del tablero
  con `getBoard`.

## Reutilizados sin cambios de firma ni de comportamiento

- `getWorkItemDetailData(workItemId, projectPublicId)` — 005-work-item-relationships.
  Se llama desde el mismo Server Component, después de resolver el Work Item
  con la función de arriba.
- `updateWorkItem`, `deleteWorkItem`, `listProjectTags`, `getWorkItemTags`,
  `listWorkItemActivity` — 004-work-items.
- `setWorkItemParent`, `removeWorkItemParent`, `linkRelatedWorkItems`,
  `unlinkRelatedWorkItems`, `listProjectWorkItems` — 005-work-item-relationships.
- `getWorkItemById` (005-work-item-relationships) queda **sin usar** tras
  esta feature: existía únicamente para que `WorkItemDetailPanel` pudiera
  "navegar" reemplazando su propio contenido (research.md § Navegación entre
  relaciones); con `<Link>` real esa necesidad desaparece. Se elimina en
  vez de dejarse como código muerto (mismo criterio que eliminar
  `WorkItemDetailPanel.tsx` — Principio VI).
