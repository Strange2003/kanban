# Research: Detalle colaborativo

- `011-agent-access-mcp` ya agregó un único asignado y quitó stakeholder; se reutiliza `AssigneePicker`.
- `006-work-item-detail-view` fijó la ruta dedicada y navegación real entre relaciones. Se conserva.
- `008-work-item-fields` fijó descripción en texto plano, fechas sin zona horaria, cierre controlado por columnas y auditoría. Esta feature no toca el cierre.
- `007-roles-permissions` centraliza permisos en `lib/roles.ts`; se agrega `workItem:comment` para Owner, Member y Viewer. Tiempo y estimación reutilizan `workItem:edit`.
- La guía local de Next 16 `server-actions.md` exige tratar acciones como endpoints públicos. Se valida con Zod y se relee WI y permiso.
- La guía local `app-icons.md` admite `app/icon.svg` y genera el enlace automáticamente.
- El total gastado se deriva de entradas; no se guarda un contador que pueda divergir.
- Las capturas son referencias visuales, no funcionalidad de proveedores externos.
