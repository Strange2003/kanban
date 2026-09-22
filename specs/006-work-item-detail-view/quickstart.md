# Quickstart: Validar la vista de detalle de Work Item de punta a punta

## Prerrequisitos

Fase 1 y 005-work-item-relationships ya validadas: un proyecto con un
tablero, al menos una columna, y capacidad de crear relaciones entre Work
Items. Para este quickstart, en "Tablero Demo" crear tres Work Items en "Por
hacer": "Diseñar login", "Implementar formulario", "Escribir tests de
login", y vincular "Implementar formulario" como hijo de "Diseñar login".

## 1. Abrir un Work Item en su propia pantalla ([spec](spec.md#user-story-1---abrir-un-work-item-en-su-propia-pantalla-priority-p1))

1. Hacer clic en "Diseñar login" desde el tablero → confirmar que la URL
   cambia a una específica de ese Work Item (no un modal sobre el tablero).
2. Recargar la página → confirmar que sigue mostrando "Diseñar login" con
   toda su información.
3. Usar el control para volver al tablero (o el botón atrás del navegador)
   → confirmar que vuelve al tablero del mismo proyecto.

## 2. Editar los campos de un Work Item ([spec](spec.md#user-story-2---editar-los-campos-de-un-work-item-desde-su-vista-de-detalle-priority-p1))

1. En la vista de detalle de "Diseñar login", editar la descripción y
   guardar → recargar la página y confirmar que el cambio persiste.
2. Agregar un tag nuevo → volver al tablero y confirmar que la tarjeta de
   "Diseñar login" también lo refleja.

## 3. Navegar entre Work Items relacionados ([spec](spec.md#user-story-3---navegar-entre-work-items-relacionados-desde-la-vista-de-detalle-priority-p1))

1. Desde la vista de detalle de "Diseñar login", hacer clic en su hijo
   ("Implementar formulario") → confirmar que navega a la vista de detalle
   de ese Work Item (URL distinta).
2. Usar el botón atrás del navegador → confirmar que vuelve a la vista de
   "Diseñar login".
3. Desde "Implementar formulario", vincular "Escribir tests de login" como
   relacionado → confirmar que aparece de inmediato en la sección de
   relacionados, sin recargar la página.

## 4. Ver el historial de actividad ([spec](spec.md#user-story-4---ver-el-historial-de-actividad-de-un-work-item-priority-p2))

1. Abrir la vista de detalle de "Implementar formulario" (que ya tiene un
   cambio de relación del paso anterior) → confirmar que el historial
   muestra esa actividad, más reciente primero.

## Edge cases

1. Copiar la URL de la vista de detalle de un Work Item, eliminar ese Work
   Item desde otra pestaña/sesión, y luego abrir la URL copiada → confirmar
   un estado claro de "no encontrado" con una forma de volver al tablero (no
   una pantalla en blanco ni un error genérico).
2. Con una segunda cuenta que no pertenece al proyecto, intentar abrir la
   misma URL → confirmar que se le niega el acceso de la misma forma (no se
   filtra si el Work Item existe o no).

## Resultado esperado

Al completar los 4 bloques y los edge cases, quedó validado que la vista de
detalle reemplaza por completo al panel modal anterior: navegación real con
URL propia, edición de campos, gestión y navegación de relaciones con
historial del navegador, actividad, y manejo correcto de accesos inválidos —
sin haber tocado código, solo interacción con la UI/Server Actions ya
implementadas.
