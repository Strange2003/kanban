# Quickstart: Validar las relaciones entre Work Items de punta a punta

## Prerrequisitos

Fase 1 ya validada (ver
[001-accounts-invitations/quickstart.md](../001-accounts-invitations/quickstart.md)):
un proyecto con al menos un tablero con columnas y varios Work Items
creados. Para este quickstart, en "Tablero Demo" crear tres Work Items en
"Por hacer": "Diseñar login", "Implementar formulario", "Escribir tests de
login".

## 1. Vincular padre/hijo ([spec](spec.md#user-story-1---vincular-un-work-item-como-hijo-de-otro-priority-p1))

1. Abrir "Implementar formulario" y convertirlo en hijo de "Diseñar login"
   → confirmar que la relación queda creada de inmediato.
2. Intentar asignarle un segundo padre a "Implementar formulario" → confirmar
   que el sistema lo rechaza (`ALREADY_HAS_PARENT`).
3. Convertir "Escribir tests de login" en hijo de "Implementar formulario"
   (formando una cadena de tres niveles: Diseñar login → Implementar
   formulario → Escribir tests de login) → confirmar que se acepta
   (anidación arbitraria).
4. Intentar convertir "Diseñar login" en hijo de "Escribir tests de login"
   (cerraría un ciclo en la cadena del paso 3) → confirmar que el sistema lo
   rechaza (`CYCLE_DETECTED`).

## 2. Vincular "relacionado con" ([spec](spec.md#user-story-2---vincular-dos-work-items-como-relacionado-con-priority-p1))

1. Crear un cuarto Work Item, "Documentar API de login", sin relación con
   los anteriores.
2. Vincularlo como "relacionado con" a "Diseñar login" → confirmar que
   ambos pasan a listarse mutuamente como relacionados.
3. Repetir el mismo vínculo (mismo par, cualquier orden) → confirmar que no
   se duplica.
4. Intentar relacionar "Documentar API de login" consigo mismo → confirmar
   que el sistema lo rechaza.

## 3. Ver las relaciones de un Work Item ([spec](spec.md#user-story-3---ver-las-relaciones-de-un-work-item-priority-p2))

1. Abrir "Implementar formulario" → confirmar que el panel de detalle
   muestra "Diseñar login" como padre y "Escribir tests de login" como
   único hijo.
2. Abrir "Diseñar login" → confirmar que muestra "Implementar formulario"
   como hijo y "Documentar API de login" como relacionado, sin padre.
3. Desde cualquiera de esas listas, navegar al Work Item vinculado →
   confirmar que abre el Work Item correcto.
4. Crear un quinto Work Item sin ninguna relación y abrirlo → confirmar que
   el panel indica claramente que no tiene relaciones (sin listas vacías
   confusas).

## 4. Quitar una relación ([spec](spec.md#user-story-4---quitar-una-relación-entre-dos-work-items-priority-p2))

1. Quitar la relación "relacionado con" entre "Diseñar login" y "Documentar
   API de login" → confirmar que ambos dejan de listarse como relacionados,
   sin que ninguno de los dos se elimine.
2. Quitar el padre de "Escribir tests de login" → confirmar que deja de
   listar a "Implementar formulario" como padre, sin afectar el vínculo
   entre "Implementar formulario" y "Diseñar login".
3. Eliminar el Work Item "Diseñar login" (que todavía tiene un hijo,
   "Implementar formulario") → confirmar que "Implementar formulario"
   permanece en el tablero y queda sin padre (huérfano), consistente con la
   clarificación de la spec.

## Resultado esperado

Al completar los 4 bloques, quedó validado el ciclo completo de esta
feature: crear ambos tipos de relación, verse impedido de crear ciclos o
duplicados, visualizar y navegar las relaciones desde el panel de detalle
existente, y quitarlas sin afectar a los Work Items involucrados — sin haber
tocado código, solo interacción con la UI/Server Actions ya implementadas.
