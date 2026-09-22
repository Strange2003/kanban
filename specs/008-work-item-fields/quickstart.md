# Quickstart: Validar campos extendidos y fechas de punta a punta

## 0. Prerrequisitos y migración

Fases 1 y 2 ya validadas (ver
[007-roles-permissions/quickstart.md](../007-roles-permissions/quickstart.md)).
Hacen falta **dos cuentas**: **Ana** (owner) y **Carla** (Lectora en el
proyecto de Ana). También hace falta un proyecto "Tablero Demo" de Ana con
tres columnas ("To Do", "Doing", "Done") y al menos tres Work Items **creados
antes de aplicar la migración**, para validar el bloque 6. Un segundo proyecto
de Ana, "Otro", sirve para el bloque 5.

Generar la migración y revisar el SQL de `db/migrations/0004_*.sql` contra
[data-model.md § Migración](data-model.md#migración) antes de aplicarla:

```bash
npm run db:generate
```

```bash
npm run db:migrate
```

Después de aplicarla, la invariante de cierre ya se cumple:

```sql
SELECT count(*) FROM work_items wi JOIN stages s ON s.id = wi.stage_id
WHERE s.is_closing <> (wi.closed_at IS NOT NULL);
-- Esperado: 0
```

Correr las suites automáticas: los tests unitarios con `npm test` y los e2e
con `npm run test:e2e`. **Los e2e vacían la base de datos de `.env.local`:
confirmar que es desechable antes de correrlos.**

## 1. Prioridad y severidad ([Historia 1](spec.md#user-story-1---clasificar-un-work-item-por-prioridad-y-severidad-priority-p1))

1. Ana abre un Work Item, elige Priority **High** y Severity **Medium**, y
   pulsa Save.
2. Recargar la página: los valores persisten.
3. Volver al tablero: la tarjeta muestra un indicador "High". La severidad
   **no** aparece en la tarjeta (FR-016).
4. En el detalle, la actividad muestra "Priority: None → High" y
   "Severity: None → Medium".
5. Poner ambas en **None** y guardar: la tarjeta deja de mostrar prioridad, y
   la actividad registra el cambio a None.

## 2. Fechas y vencimiento ([Historia 2](spec.md#user-story-2---planificar-con-fechas-priority-p1))

1. En el detalle de un Work Item, la sección Dates muestra **Created** y
   **Last modified**, que no se pueden editar.
2. Poner Start date = hoy + 5 días y Target date = hoy + 2 días, y guardar:
   se rechaza con un mensaje de rango inválido y no cambia nada (FR-009).
3. Dejar Start date vacía y poner Target date = **ayer**, y guardar. En el
   tablero, la fecha de la tarjeta aparece como **vencida**, y también en el
   detalle (FR-010).
4. Reordenar Work Items dentro de "To Do" y volver al detalle de uno que no
   se movió: **Last modified** no cambió (research.md § `updated_at`).

## 3. Columnas de cierre y botón "Cerrar" ([Historia 3](spec.md#user-story-3---cerrar-work-items-con-columnas-de-cierre-priority-p1))

1. Abrir el detalle de cualquier Work Item: el botón **Close** está
   deshabilitado y explica que primero hay que marcar una columna de cierre.
2. En el tablero, Ana marca **Done** como columna de cierre: la columna
   muestra su indicador.
3. Arrastrar el Work Item vencido del bloque 2 a **Done**. La marca de
   vencido desaparece al instante y, en el detalle, Status dice
   "Closed on <hoy> · Done". La actividad muestra "Closed (moved to Done)".
4. Arrastrarlo de vuelta a **Doing**: Status pasa a "Open", reaparece la
   marca de vencido, y la actividad registra "Reopened (moved to Doing)".
5. Desde el detalle de otro Work Item abierto, pulsar **Close**. El Work Item
   termina **al final** de "Done" y queda cerrado.
6. Marcar también **Doing** como columna de cierre. Todos los Work Items que
   estaban en Doing quedan cerrados con la fecha de hoy, y cada uno registra
   "Closed: column Doing marked as closing". Desmarcarla: todos se reabren.
7. Con "Doing" y "Done" marcadas, mover un Work Item cerrado de Done a Doing.
   Conserva su fecha de cierre original y no se registra ni cierre ni
   reapertura (Edge Cases). Luego desmarcar "Doing".
8. Crear un Work Item directamente en "Done": nace cerrado.
9. Comprobar la invariante con la consulta SQL del bloque 0. Esperado: `0`.

## 4. Área e iteración ([Historia 4](spec.md#user-story-4---organizar-por-área-e-iteración-priority-p2))

1. En el detalle de un Work Item, escribir "Frontend" en Area, elegir
   `Create "Frontend"` y guardar.
2. En otro Work Item del mismo proyecto, escribir "front" en Area: aparece la
   sugerencia **Frontend**. Escribir "FRONTEND" y guardar: se reutiliza el
   valor existente sin duplicarlo (FR-006).
3. Crear la iteración "Sprint 1" en un Work Item: **no** aparece como
   sugerencia en Area (catálogos separados).
4. Quitar el área de un Work Item y guardar: queda vacía, y la actividad
   registra "Area: Frontend → None".

## 5. Aislamiento entre proyectos

1. En el proyecto "Otro", abrir un Work Item y escribir "Front" en Area:
   **no** aparece "Frontend" del proyecto "Tablero Demo" (FR-021).
2. El caso de mover un Work Item a una columna de otro proyecto con una
   petición directa lo cubre el test unitario de `moveWorkItem`: devuelve
   `NOT_FOUND` y no escribe nada.

## 6. Datos anteriores a la migración y Lector

1. Abrir los Work Items creados antes de la migración: se ven con los campos
   nuevos vacíos, su fecha de creación real y Status "Open". Se editan y se
   mueven con normalidad (FR-018, SC-003).
2. Carla (Lectora) abre el tablero: ve las prioridades, las fechas y el
   indicador de columna de cierre, pero **no** ve el control para marcar
   columnas.
3. Carla abre un detalle: la sección Planning está en solo lectura y no hay
   botón **Close** (FR-019). El intento directo desde fuera de la interfaz lo
   cubre `tests/unit/action-permissions.test.ts`, que para un Lector debe dar
   `ROLE_NOT_PERMITTED` en `closeWorkItem` y `setStageClosing` sin ninguna
   escritura (SC-005).

## 7. Escala (SC-002, SC-007)

Con un tablero de ≥100 Work Items (el seed del e2e de escala de 005 sirve de
base), asignar prioridades y fechas mezcladas. El tablero y el detalle deben
abrir sin demora perceptible respecto de antes de la migración, y las
tarjetas Critical y las vencidas deben distinguirse a simple vista.
