# Data Model: Relaciones entre Work Items

Extiende el esquema de Fase 1 documentado en
[001-accounts-invitations/data-model.md](../001-accounts-invitations/data-model.md#work-item-work_items).
Solo se documenta aquí lo nuevo o modificado: una columna sobre `work_items`
y una tabla nueva. El resto de las tablas (`projects`, `stages`,
`work_item_activity`, `tags`, etc.) no cambian.

## Work Item (`work_items`) — columna añadida

| Campo | Tipo | Notas |
|---|---|---|
| `parentWorkItemId` | FK → `work_items.id`, nullable, `onDelete: set null` | FR-001/FR-002. `null` = sin padre. Autoreferencial: un Work Item puede ser padre de otros Work Items del mismo proyecto (anidación arbitraria, FR-004). Al eliminar el padre, esta columna vuelve a `null` en cada hijo (FR-012 — quedan huérfanos, no se borran en cascada). |

Restricción de aplicación (no expresable como `CHECK` simple por requerir
recorrer la cadena de ancestros): antes de escribir `parentWorkItemId`, se
valida en la Server Action que el nuevo padre pertenezca al mismo
`projectId` (FR-007) y que no cree un ciclo (FR-004) — ver
[research.md](research.md#decisión-detección-de-ciclos-en-la-jerarquía-padrehijo).
Restricción adicional: `parentWorkItemId != id` (un Work Item no puede ser su
propio padre).

## WorkItemRelatedLink (`work_item_related_links`)

Relación simétrica "relacionado con" entre dos Work Items del mismo proyecto
(FR-005, FR-006, FR-007).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | serial, PK | interno |
| `workItemIdA` | FK → `work_items.id`, `onDelete: cascade` | por convención, siempre el menor de los dos `id` involucrados |
| `workItemIdB` | FK → `work_items.id`, `onDelete: cascade` | siempre el mayor de los dos `id` involucrados |
| `createdAt` | timestamptz, not null | — |

Restricciones:
- Único `(workItemIdA, workItemIdB)` — evita duplicar el mismo vínculo
  (FR-006). Al escribir, la Server Action ordena los dos IDs
  (`workItemIdA = min(idX, idY)`, `workItemIdB = max(idX, idY)`) antes del
  `INSERT`, así el par `(A, B)` y el par `(B, A)` siempre colisionan con la
  misma fila sin importar en qué orden el usuario los seleccionó.
- `CHECK (workItemIdA <> workItemIdB)` — evita que un Work Item se relacione
  consigo mismo (FR-006).
- Ambas FK `onDelete: cascade` — si cualquiera de los dos Work Items se
  elimina, el vínculo desaparece con él, sin dejar referencias huérfanas
  (FR-011).

No lleva `projectId` propio: se deriva de cualquiera de los dos Work Items
(ambos MUST pertenecer al mismo proyecto, verificado en la Server Action —
FR-007).

## Diagrama de relaciones (resumen, solo lo nuevo)

```
work_items ──┬── parentWorkItemId (self-FK, nullable, set null) ──┐
             │                                                     │
             └── work_item_related_links ── workItemIdA/B ─────────┘
                 (ambos apuntan de vuelta a work_items)
```

## Datos expuestos para la futura vista de detalle dedicada

Por lo acordado en las Assumptions de la spec, `getWorkItemRelations` (ver
[contracts/work-item-relationships.md](contracts/work-item-relationships.md))
expone exactamente los datos que la vista de detalle dedicada (Fase 2, punto
6) necesitará sin cambios: el padre (si existe), la lista completa de hijos y
la lista completa de relacionados, cada uno con su `displayId` (identificador
visible) y `title` — suficiente para renderizarlos y navegar a cada uno sin
una consulta adicional por Work Item.

## Reglas de validez transversales (adicionales a las de 001)

- Toda lectura/escritura sobre `parentWorkItemId` o `work_item_related_links`
  MUST filtrar primero por membresía del usuario autenticado en
  `project_members` del proyecto de ambos Work Items involucrados (Principio
  IV, igual que el resto del esquema).
- Ninguna relación (padre/hijo o "relacionado con") MUST vincular Work Items
  de `projectId` distinto (FR-007).
