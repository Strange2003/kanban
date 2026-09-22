# Quickstart: Validar las vistas de Lista y Tabla de punta a punta

## 0. Prerrequisitos

Fase 2 y [008-work-item-fields](../008-work-item-fields/quickstart.md) ya
validadas. Esta feature **no tiene migración**. Hacen falta:

- **Dos cuentas**: **Ana** (owner) y **Carla** (Lectora en el proyecto de
  Ana), más una tercera cuenta **sin** membresía para el bloque 5.
- Un proyecto "Vistas Demo" de Ana con columnas "To Do", "Doing" y "Done"
  (esta última marcada como de cierre), y estos Work Items:
  - **Epic** (sin padre), con los hijos **Child A** y **Child B**. **Child
    A** tiene a su vez el hijo **Grandchild**.
  - **Loose** (sin padre ni hijos).
  - Prioridades, iteraciones y fechas variadas. Al menos un Work Item
    **Critical**, abierto, de la iteración "Sprint 12". Al menos uno con
    fecha objetivo **ayer** y abierto (vencido). Al menos uno en "Done"
    (cerrado).

Las suites automáticas son `npm test` (unitarias) y `npm run test:e2e`.
**Los e2e vacían la base de `.env.local`**: el product owner confirmó el
2026-09-22 que es la base de pruebas.

## 1. Cambiar de vista ([Historia 1](spec.md#user-story-1---cambiar-entre-tablero-lista-y-tabla-priority-p1))

1. En el tablero, el selector muestra "Board" activo. Elegir **Table**: la
   dirección termina en `/table` y se ven todos los Work Items.
2. Recargar y seguir en la Tabla. Elegir **List**: la dirección termina en
   `/list`.
3. Desde la Tabla, abrir un Work Item y pulsar "atrás" en el navegador:
   vuelve a la Tabla (FR-003).

## 2. Tabla: orden y filtros ([Historia 2](spec.md#user-story-2---tabla-ordenable-y-filtrable-priority-p1))

1. Clic en **Priority**: Critical → High → Medium → Low, y los que no tienen
   prioridad al final. Otro clic invierte el orden y los vacíos **siguen** al
   final (FR-006).
2. Clic en **Column**: el orden sigue el del tablero (To Do, Doing, Done), no
   el alfabético.
3. Filtrar Status = Open, Priority = Critical, Iteration = Sprint 12: solo
   quedan los que cumplen las tres condiciones, y el contador dice
   "N of M" (FR-007, FR-008).
4. Recargar: se mantienen los filtros. Copiar la dirección y abrirla en la
   ventana de Carla: mismo resultado (FR-009, SC-003).
5. Quitar filtros y activar **Overdue only**: queda solo el vencido, que
   tiene la misma marca que en el tablero (FR-010).
6. Buscar el ID de un Work Item en minúsculas (p. ej. `vis-3`): lo encuentra.
7. Filtrar Priority = Critical y Status = Closed, si no hay ninguno: aparece
   el estado vacío con "Clear filters".
8. Con filtros activos, abrir un Work Item y volver con "atrás": los filtros
   y el orden siguen (SC-005).
9. No hay ningún control para editar en la Tabla (FR-011).

## 3. Lista jerárquica ([Historia 3](spec.md#user-story-3---lista-jerárquica-backlog-priority-p2))

1. En **List**: en el primer nivel están **Epic** y **Loose**. Debajo de Epic
   están Child A y Child B, y debajo de Child A, Grandchild (FR-012).
2. Plegar **Epic**: desaparecen sus tres descendientes y Epic indica "2"
   hijos directos. Desplegar. Probar **Collapse all** y **Expand all**
   (FR-014).
3. Los Work Items cerrados se ven distintos y con su estado (FR-013).
4. Buscar "Grandchild": se ve Grandchild, y **Child A** y **Epic** atenuados
   como contexto (FR-015). "Loose" y "Child B" no aparecen.
5. Pasar a **Table** con la búsqueda activa: la búsqueda se conserva al
   cambiar de vista.
6. Eliminar **Epic** desde su detalle y volver a la Lista: Child A y Child B
   pasan al primer nivel (huérfanos, 005).

## 4. Lector

1. Carla abre la Tabla y la Lista del proyecto: ve, ordena y filtra igual que
   Ana, con el aviso de solo lectura en la cabecera (FR-017).

## 5. Aislamiento

1. Con la tercera cuenta, sin membresía, abrir directamente
   `/projects/<id>/table` y `/projects/<id>/list`: se ve la página de "no
   encontrado", igual que el tablero (FR-004, SC-004).

## 6. Escala (SC-002)

Con un proyecto de ≥500 Work Items (el seed del e2e de escala de 005 sirve
de base, ampliado), ordenar por prioridad y cambiar filtros en la Tabla:
el cambio se ve inmediato. Abrir la Lista con todo desplegado no tiene
demora perceptible.
