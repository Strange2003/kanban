# Data Model: Vista de Detalle de Work Item

Esta feature **no introduce ni modifica ninguna tabla**. Reutiliza
exactamente el esquema ya documentado en
[001-accounts-invitations/data-model.md § Work Item](../001-accounts-invitations/data-model.md#work-item-work_items)
y
[005-work-item-relationships/data-model.md](../005-work-item-relationships/data-model.md).
Lo único nuevo es un acceso de lectura adicional sobre una columna que ya
existe.

## Acceso nuevo: resolución por `(projectId, displayNumber)`

`work_items.displayNumber` ya existe (correlativo por proyecto, ver
data-model.md de 001) pero hasta ahora solo se usaba para *mostrar* el
`displayId` ("KAN-42"); ninguna consulta existente busca un Work Item *por*
ese número. Esta feature agrega esa búsqueda:

```
SELECT * FROM work_items WHERE project_id = :projectId AND display_number = :displayNumber
```

Restricción de unicidad ya garantizada por el diseño existente: `
displayNumber` se asigna desde el contador atómico `projects.nextWorkItemNumber`
(ver 001/data-model.md § Work Item), por lo que `(projectId, displayNumber)`
ya es único de hecho — no hace falta un índice único nuevo para la
corrección de esta consulta, aunque **si** el volumen de Work Items por
proyecto creciera lo suficiente para que un `WHERE` sin índice sea lento,
sería candidato a un índice compuesto `(project_id, display_number)`
(no incluido aquí por no estar justificado a la escala actual — Principio
VI, YAGNI; ver quickstart.md para la validación de que esto no degrada
perceptiblemente).

## Modelo de lectura de la página (no persistido, solo forma del response)

La página combina dos lecturas ya existentes o casi-existentes (ver
research.md § Carga de datos de la página):

```
WorkItemDetailPageView = {
  workItem: WorkItemWithDisplayId,       // de getWorkItemByDisplayNumber (nueva)
  catalogTags: string[],                 // de getWorkItemDetailData (ya existente)
  itemTags: string[],
  activity: WorkItemActivity[],
  relations: WorkItemRelations,          // { parent, children, related } — 005
  pickableWorkItems: WorkItemRelationRef[],
}
```

Ningún campo de esta forma se persiste — es exactamente lo que ya devuelve
`getWorkItemDetailData` (005-work-item-relationships) más el propio Work
Item resuelto por esta feature.
