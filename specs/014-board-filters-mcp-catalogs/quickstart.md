# Quickstart: Filtros del Tablero y Catálogos por MCP

Validación de punta a punta. No hay migración.

## Prerrequisitos

- `.env.local` apunta a la rama Neon `dev` (nunca a producción: e2e trunca
  todas las tablas).
- `npm run dev` levantado; un proyecto con 2+ miembros, 3 columnas (una de
  cierre), tags de colores ("Bug" rojo, "UI" rosa, "Feature" azul) y ~10 Work
  Items repartidos entre asignados y tags.

## 1. Pruebas automáticas

```bash
npm run test
```

```bash
npx tsc --noEmit
```

```bash
npm run lint
```

Esperado: verde, incluidos `work-item-view.test.ts` (predicado y
serialización `"board"`), `mcp-route.test.ts` (18 herramientas, esquemas
estrictos), `mcp-catalogs.test.ts` (nuevo: tags con color, `list_catalogs`,
`set_tag_color`) y `work-items.test.ts` (`newTagColors`).

## 2. Filtros del tablero (US1)

1. Abrir el tablero. Aparecen **Assignee** y **Tags** sobre las columnas.
2. Assignee → "Assigned to me": solo quedan mis tarjetas; los contadores
   muestran `visibles/total`; una columna sin coincidencias dice "Hidden by
   filters".
3. Tags → "Bug" y "UI": quedan mis tarjetas con Bug **o** UI.
4. El panel de Tags muestra los colores en el orden de la pantalla de
   catálogos, y "None" al final.
5. Quitar "UI" desde su etiqueta de filtro activo; luego "Clear filters":
   vuelven todas.
6. Como Viewer: los filtros funcionan igual.

## 3. Persistencia (US2)

1. Filtrar por "UI". La URL tiene `?tag=UI`. Recargar: sigue filtrado.
2. Abrir una tarjeta y pulsar "← Back to board": sigue filtrado.
3. Cambiar a Table: filtrada por "UI". Agregar Priority High; volver a Board:
   solo "UI" aplica y la URL del tablero ya no tiene `priority`.
4. Abrir `?tag=NoExiste`: el tablero no falla y muestra el filtro activo
   removible.

## 4. Trabajar con filtro (US3)

1. Con "Assigned to me", reordenar dos tarjetas visibles en una columna que
   tiene tarjetas ocultas entre ellas; moverlas por teclado (↑/↓).
2. Quitar el filtro: las ocultas conservan su orden relativo.
3. Con el filtro de tag "Bug", crear un Work Item: aparece el aviso de que quedó
   oculto.

## 5. Agente de IA (US4, US5)

Reconectar el conector MCP (el cliente guarda la lista de herramientas).

1. `list_catalogs` → tags con color, áreas y tamaños en orden manual, y `colors`.
2. `create_work_items` con `tags: [{ "name": "Mobile", "color": "green" }]` →
   la respuesta muestra `Mobile` verde; en la app, verde.
3. `update_work_item` con `tags: [{ "name": "bug", "color": "blue" }]` → se
   asigna "Bug" y la respuesta muestra `red` (no se recolorea).
4. `set_tag_color` `{ tag: "Mobile", color: "blue" }` → azul en la app.
5. `set_tag_color` con `color: "purple"` → error con los colores válidos.
6. `update_work_item` con `"colour": "red"` → error que nombra `colour`; el
   Work Item no cambió.
7. Con un usuario Viewer: `list_catalogs` funciona; `set_tag_color` →
   `ROLE_NOT_PERMITTED`.

## 6. e2e

```bash
npm run test:e2e -- board-filters
```

Cubre los bloques 2 a 4 (`tests/e2e/board-filters.spec.ts`).
