# Quickstart: Validar roles y permisos de punta a punta

## 0. Prerrequisitos y migración

Fase 1 y las specs 005/006 ya validadas (ver
[001-accounts-invitations/quickstart.md](../001-accounts-invitations/quickstart.md)).
Para este quickstart hacen falta **tres cuentas** (usa tres ventanas o
perfiles de navegador distintos): **Ana** (owner), **Beto** (miembro) y
**Carla** (lectora). Y un proyecto "Tablero Demo" de Ana con dos columnas
("Por hacer", "Hecho") y al menos dos Work Items relacionados entre sí.

**Antes de aplicar la migración**, verificar que todo proyecto tiene
exactamente un owner (el índice único parcial nuevo fallaría si no):

```sql
SELECT project_id, count(*) FROM project_members
WHERE role = 'owner' GROUP BY project_id HAVING count(*) <> 1;
-- Esperado: 0 filas.
```

Generar y aplicar la migración (revisar el SQL generado en
`db/migrations/0003_*.sql` contra [data-model.md](data-model.md#migración)
antes de aplicarlo):

```bash
npm run db:generate
npm run db:migrate
```

**Esperado**: los miembros e invitaciones que ya existían siguen funcionando
igual (ver bloque 5).

## 1. El owner cambia el rol de un miembro ([spec](spec.md#user-story-1---el-owner-cambia-el-rol-de-un-miembro-priority-p1))

1. Ana invita a Beto y a Carla como **Miembro** (bloque 3 detalla la
   invitación con rol; aquí basta aceptar ambas para tener a los tres
   dentro).
2. En Ajustes del proyecto, Ana ve a Beto y a Carla con su rol. Cambia a
   Carla a **Lector** → confirmar que la lista muestra el nuevo rol.
3. Ana vuelve a poner a Carla como **Miembro** y luego otra vez como
   **Lector** → confirmar que ambos cambios se reflejan.
4. Beto (Miembro) abre Ajustes → confirmar que **no** ve el selector de rol
   ni "Transferir propiedad", pero sí ve el rol de cada persona y el suyo.
5. Ana intenta cambiar su propio rol → confirmar que no hay control para
   hacerlo (y que si se intenta por fuera de la UI, el sistema responde
   `CANNOT_CHANGE_OWNER_ROLE`, cubierto por `tests/unit/member-roles.test.ts`).

## 2. Un Lector consulta sin poder modificar ([spec](spec.md#user-story-2---un-lector-consulta-el-proyecto-sin-poder-modificarlo-priority-p1))

Con la sesión de Carla (Lectora):

1. **Tablero**: ver columnas y tarjetas. Confirmar que no hay "Añadir
   columna", "Añadir Work Item" ni botón de eliminar columna; que no se puede
   arrastrar una tarjeta ni una columna; que doble clic en el nombre de una
   columna no lo edita; y que aparece el aviso de solo lectura.
2. **Detalle**: hacer clic en una tarjeta. Confirmar que se abre el detalle,
   con campos, tags, relaciones e historial visibles, pero **sin** poder
   editar campos, sin Guardar/Eliminar y sin agregar/quitar relaciones.
   Navegar por un enlace de padre/hijo/relacionado → abre ese otro Work Item
   (y el botón atrás vuelve).
3. **Ajustes**: confirmar que no ve la sección de invitaciones pendientes, ni
   controles de renombrar/eliminar proyecto, ni "Invitar"; sí ve la lista de
   miembros y el botón de salir del proyecto.
4. **Cambio de rol con la pantalla abierta** (escenario 4 de la historia):
   Ana pasa a Beto de Miembro a Lector mientras Beto tiene el tablero
   abierto. Beto intenta mover una tarjeta → confirmar que ve un mensaje que
   explica que su rol cambió, que la tarjeta vuelve a su lugar y que la
   pantalla queda en modo lectura tras refrescar.
5. **Rechazo por fuera de la interfaz** (SC-001): ejecutar el barrido
   unitario, que invoca directamente cada Server Action de mutación con un
   Lector y verifica `ROLE_NOT_PERMITTED` y cero escrituras:

   ```bash
   npm run test -- tests/unit/action-permissions.test.ts
   ```

6. Carla (Lectora) sale del proyecto desde Ajustes → confirmar que puede
   hacerlo y que el proyecto desaparece de su barra lateral.

## 3. Invitar eligiendo el rol ([spec](spec.md#user-story-3---invitar-eligiendo-el-rol-y-quién-puede-invitar-priority-p2))

1. Ana abre "Invitar", ingresa un email y elige **Lector** → confirmar que la
   lista de invitaciones pendientes muestra el rol. Quien recibe la
   invitación (cuenta nueva, "Diego") la acepta → confirmar que ingresa como
   **Lector**.
2. Beto (Miembro) invita a otro email como **Miembro** → confirmar que puede
   (Owner y Miembro invitan). Ese invitado acepta y queda como Miembro.
3. Confirmar que el selector de rol de la invitación **no ofrece** "Owner".
4. Beto cancela una invitación que **él** envió → se cancela. Beto intenta
   cancelar una que envió Ana → no hay control para hacerlo (y por fuera de la
   UI: `ROLE_NOT_PERMITTED`). Ana cancela cualquiera → se cancela.
5. Carla (Lectora) → confirmar que no ve "Invitar" ni la lista de
   invitaciones pendientes (FR-018).

## 4. Transferir la propiedad ([spec](spec.md#user-story-4---transferir-la-propiedad-del-proyecto-priority-p3))

1. En un proyecto **Personal** (un solo miembro), Ana abre Ajustes →
   confirmar que "Transferir propiedad" no está disponible.
2. En "Tablero Demo", Ana elige "Transferir propiedad" → Beto. Confirmar que
   el diálogo advierte que perderá los permisos exclusivos de owner
   (renombrar/eliminar, remover miembros, cambiar roles, transferir).
   Confirmar.
3. Ana (ahora Miembro) recarga Ajustes → ya no ve los controles de owner;
   Beto (ahora Owner) sí. Confirmar que la lista de miembros muestra un solo
   Owner.
4. Ana sale del proyecto desde Ajustes → confirmar que puede (ya no es owner).
5. Repetir con un destinatario **Lector** (Carla como destinatario) →
   confirmar que pasa a Owner con todos los permisos.
6. Probar la carrera: dos ventanas del owner intentan transferir a dos
   miembros distintos casi a la vez → confirmar que solo una tiene éxito, que
   la otra recibe un mensaje claro y que queda exactamente un owner
   (SC-006).

## 5. Sin regresión con los datos existentes (SC-007)

1. En una base de datos con proyectos, miembros e invitaciones **anteriores a
   la migración**: confirmar que el creador de cada proyecto sigue como
   Owner, los miembros existentes siguen editando el tablero y los Work Items
   como antes, y que una invitación pendiente previa, al aceptarse, ingresa
   como **Miembro**.
2. Ejecutar la suite completa:

   ```bash
   npm run test        # unitarias (sin base de datos)
   npm run test:e2e    # e2e — usar una rama desechable de Neon, nunca datos reales
   ```

   **Esperado**: las pruebas de Fase 1 y de las specs 005/006 siguen en verde
   (los flujos de Owner y Miembro no cambian) y pasan las nuevas de esta
   feature (`tests/unit/roles.test.ts`, `tests/unit/permissions.test.ts`,
   `tests/unit/action-permissions.test.ts`, `tests/unit/member-roles.test.ts`,
   `tests/e2e/roles-permissions.spec.ts`).

## Resultado esperado

Al completar los 5 bloques quedó validado el ciclo completo de esta
feature: asignar y cambiar roles, un Lector que lee todo y no puede
modificar nada (ni desde la interfaz ni por fuera de ella), invitaciones que
llevan rol y que también pueden enviar los Miembros, transferencia de
propiedad que deja siempre exactamente un owner, y cero regresiones para los
datos existentes.
