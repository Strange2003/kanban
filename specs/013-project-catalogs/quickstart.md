# Quickstart: validar Catálogos por Proyecto

Guía para comprobar la feature de punta a punta. Detalles en
[contracts/project-catalogs.md](contracts/project-catalogs.md) y
[data-model.md](data-model.md).

## Preparación

1. Confirmar que `.env.local` apunta a la rama Neon `dev` (nunca producción).
2. `npm run db:migrate` (aplica `0008`) y `npm run dev`.
3. Tener un proyecto con dos columnas, un Owner, un Member y un Viewer, y
   antes de migrar: una iteración "Sprint 1" asignada a un Work Item y tags
   "backend" y "tamaño M".

**Advertencia**: `tests/e2e/setup.ts` trunca la base de `.env.local`;
confirmar la base explícitamente antes de correr Playwright.

## 1. Migración de Iteration a Size (US4)

- El Work Item que tenía "Sprint 1" muestra **Size: Sprint 1** en el detalle.
- Su History muestra el cambio antiguo como "Size: None → Sprint 1".
- La Table tiene la columna **Size** (sin "Iteration") y se filtra por "Sprint 1".
- Las tags existentes se ven grises; "tamaño M" sigue siendo una tag.
- Buscar "Iteration" en la interfaz: no aparece.

## 2. Pantalla de catálogos (US1)

- Con el proyecto abierto, el sidebar muestra **Tags** anidado bajo él;
  lleva a `/projects/{id}/settings/catalogs` con las secciones Tags, Areas y
  Size. La página de ajustes también enlaza aquí.
- En Size: crear S, M, XL, L; mover L arriba de XL → orden S, M, L, XL.
  Recargar: el orden se mantiene. El selector Size del detalle y el filtro
  de la Table siguen ese orden; ordenar la Table por Size da S, M, L, XL con
  los vacíos al final.
- Renombrar la tag "backend" → "Backend": el tablero, el detalle y la Table
  muestran "Backend"; el historial de los Work Items no suma entradas.
- Renombrar un área al nombre de otra existente → mensaje de nombre en uso.
- Eliminar el tamaño "Sprint 1": el diálogo dice "Used by 1 Work Item"; al
  confirmar, el Work Item queda sin Size y su History muestra
  "Size: Sprint 1 → None (value deleted)", con autor.

## 3. Colores (US2)

- Poner "Backend" en azul, crear "Bug" en rojo y "UX" en verde; asignar las
  tres a un Work Item.
- La tarjeta muestra una línea fina inferior azul | rojo | verde (orden
  alfabético de las tags: Backend, Bug, UX). Un Work Item sin tags no tiene línea.
- En el detalle, cada tag tiene fondo de su color y se lee en modo claro y
  oscuro.
- Cambiar "Bug" a violeta en la pantalla de catálogos → la tarjeta y el
  detalle se actualizan.

## 4. Crear desde el Work Item (US3)

- En Tags escribir "ba": solo aparece "Backend".
- Escribir "Mobile": aparece **Create new "Mobile"**; elegirlo abre el pop-up
  con el nombre editable y la paleta (gris preseleccionado). Elegir verde →
  Create: "Mobile" queda seleccionada en verde; tras Save persiste; aparece
  en la pantalla de catálogos al final de Tags.
- Repetir en Area y Size: el pop-up solo pide el nombre.
- Cancelar el pop-up: no se crea nada.
- Escribir "BACKEND": se ofrece "Backend", no "Create new".

## 5. Permisos y aislamiento

- Como Viewer: la pantalla de catálogos es de solo lectura; los pickers del
  detalle están deshabilitados.
- Llamar `renameCatalogValue` como Viewer → `ROLE_NOT_PERMITTED`.
- Desde otro proyecto, ninguna acción encuentra valores de este (nombre
  inexistente → `NOT_FOUND`).
- Un agente MCP con `get_work_item` ve `size` y `tags` con color;
  `update_work_item` con `size: "M"` asigna el tamaño.

## 6. Concurrencia

- Abrir el detalle de un Work Item con la tag "UX" en una pestaña; en otra,
  eliminar "UX" desde la pantalla de catálogos. En la primera, editar el
  título y guardar: aparece un aviso de que "UX" ya no existe y la tag no se
  recrea.

## Pruebas automatizadas

- `npx vitest run` — tests unitarios de catálogos, permisos y vistas.
- `npx playwright test tests/e2e/project-catalogs.spec.ts` — solo con la base
  confirmada.
