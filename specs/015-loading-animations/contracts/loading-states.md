# Contract: Estados de carga por ruta

**Feature**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md)

Contrato de UI: qué muestra cada ruta mientras carga y cómo se anima. Es lo que
verifican `tests/unit/loading-states.test.ts` (que existan) y
`tests/e2e/loading-states.spec.ts` (que se vean).

## Rutas y esqueletos

| Ruta | `loading.tsx` | Esqueleto | Forma | Texto para lectores |
|---|---|---|---|---|
| `/projects/{id}` | `projects/[projectPublicId]/loading.tsx` | `BoardLoading` | Cabecera de vista + N columnas (memoria local, 3 por defecto, tope 8) con 3 siluetas que caen | `Loading board…` |
| `/projects/{id}/work-items/{n}` | `…/work-items/[displayNumber]/loading.tsx` | `WorkItemDetailSkeleton` | Cabecera (volver, ID + chips, título, pestañas) + columna de campos (18rem) y cuerpo (descripción, checklist, comentarios) | `Loading Work Item…` |
| `/projects/{id}/list` | `…/list/loading.tsx` | `ListSkeleton` | Cabecera de vista + barra de filtros + 8 filas (ID, título, columna, prioridad) | `Loading list…` |
| `/projects/{id}/table` | `…/table/loading.tsx` | `TableSkeleton` | Cabecera de vista + barra de filtros + fila de encabezados + 8 filas de celdas | `Loading table…` |
| `/projects/{id}/settings` | `…/settings/loading.tsx` | `ProjectSettingsSkeleton` | Volver + título + 4 secciones (campo, catálogos, miembros con 3 filas) | `Loading settings…` |
| `/projects/{id}/settings/catalogs` | `…/settings/catalogs/loading.tsx` | `CatalogsSkeleton` | Volver + título + 3 secciones (Tags, Areas, Size) con 3 filas cada una | `Loading tags, areas and sizes…` |
| `/my-work` | `my-work/loading.tsx` | `MyWorkSkeleton` | Barra de título + 2 grupos por proyecto con 3 filas | `Loading your work…` |
| `/settings/agents` | `settings/agents/loading.tsx` | `ConnectedAgentsSkeleton` | Título + párrafo + bloque de conexión + 2 filas | `Loading connected agents…` |

Sin esqueleto (estáticas o casi): `/` del espacio de trabajo, autenticación y
páginas legales.

## Comportamiento común

1. **Raíz** (`SkeletonFrame`): `role="status"`, `aria-busy="true"`, texto
   `sr-only`; los bloques llevan `aria-hidden`. Clase `kb-skeleton`: invisible
   150 ms y luego fundido de 180 ms (también con "reducir movimiento").
2. **Bloques** (`Bone` con `fall`): con movimiento permitido, entran cayendo
   (`kb-fall-in`, una vez, escalonado por `--kb-delay`) y luego respiran
   suavemente mientras dure la carga. Las siluetas de tarjeta del tablero usan
   el bucle completo `kb-fall` (caer, asentarse, desvanecerse, repetir) con
   desfase por columna (140 ms) y por silueta (260 ms).
3. **Reducir movimiento**: sin `kb-fall`, `kb-fall-in` ni respiración; bloques
   estáticos con opacidad plena.
4. **Tema**: solo tokens `muted`, `card`, `border`.

## Entrada del tablero

- `Board` añade `kb-board-entering` al montarse y la quita a los 600 ms.
- Bajo esa clase, encabezados de columna y tarjetas (`data-kb-land`) corren
  `kb-land` (260 ms, `translate` de -14px a 0 y opacidad 0 → 1, `backwards`)
  con `--kb-delay = min(col·40 + pos·30, 200) ms`.
- Nada más anima: crear, mover, filtrar, arrastrar o `router.refresh()` no
  repiten la entrada.
- Con "reducir movimiento" no hay entrada.
