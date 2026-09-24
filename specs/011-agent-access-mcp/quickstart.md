# Quickstart: validar agentes de IA y asignación de principio a fin

Contratos: [mcp-tools.md](contracts/mcp-tools.md) y
[app-changes.md](contracts/app-changes.md). Modelo:
[data-model.md](data-model.md).

## 0. Prerrequisitos y migración

- Fases 1 a 3 ya validadas.
- **Tres cuentas**:
  - **Ana**: owner de "UMG ASISTENCIA".
  - **Beto**: Miembro de "UMG ASISTENCIA".
  - **Carla**: Lectora de "UMG ASISTENCIA".
- Ana tiene además un proyecto personal, "Personal Ana". Otro proyecto,
  "Ajeno", pertenece a una cuarta cuenta en la que Ana no es miembro.
- "UMG ASISTENCIA" tiene las columnas "To Do", "Doing" y "Done" (esta última
  marcada como de cierre).
- Un asistente compatible con MCP remoto instalado localmente, por ejemplo
  Claude Code.

Verificar la versión de Postgres en **las dos** ramas de Neon. Debe ser ≥15,
porque la FK compuesta usa `SET NULL (columna)`:

```sql
SHOW server_version;
```

Regenerar el esquema de Better Auth y la migración. Revisar
`db/migrations/0005_*.sql` contra [data-model.md § Migración](data-model.md#migración-0005),
incluida la edición manual de `ON DELETE SET NULL ("assignee_user_id")`:

```bash
npm run auth:generate
```

```bash
npm run db:generate
```

```bash
npm run db:migrate
```

Correr las suites: `npm test` y `npm run test:e2e`. **Los e2e vacían la base
de `.env.local`: confirmar antes que es la rama `dev`.**

## 1. Asignar desde la interfaz ([Historia 1](spec.md#user-story-1---asignar-un-work-item-a-un-miembro-del-proyecto-priority-p1))

1. Ana abre un Work Item de "UMG ASISTENCIA". El campo **Stakeholder** ya no
   existe. En **Assignee**, el desplegable lista a Ana, Beto, Carla y
   "Unassigned".
2. Elige a **Beto** y pulsa Save. La tarjeta del tablero muestra el avatar de
   Beto. El historial dice "Assigned to Beto — by Ana".
3. Beto recarga la app: la campana muestra "*Ana* assigned you *UMG-n …* in
   *UMG ASISTENCIA*". Al hacer clic llega al detalle, y la notificación
   desaparece de las no leídas.
4. Ana se asigna un Work Item a sí misma: **no** recibe notificación.
5. En la Tabla, la columna **Assignee** ordena por nombre. El filtro
   "Assigned to me" de Beto muestra solo lo suyo, y la URL lo refleja
   (`assignee=me`). "Unassigned" funciona igual.
6. Carla (Lectora) ve el asignado en el detalle, pero no puede cambiarlo.
7. Ana remueve a Beto del proyecto. Sus Work Items quedan **sin asignar**, y
   cada historial muestra "Unassigned (left the project)". Beto no recibe
   ninguna notificación por esto.

   Comprobación en SQL (esperado 0):

   ```sql
   SELECT count(*) FROM work_items wi
   LEFT JOIN project_members pm ON pm.project_id = wi.project_id AND pm.user_id = wi.assignee_user_id
   WHERE wi.assignee_user_id IS NOT NULL AND pm.user_id IS NULL;
   ```

8. Volver a invitar a Beto (como Miembro) para los bloques siguientes.

## 2. Conectar un agente ([Historia 2](spec.md#user-story-2---conectar-un-agente-de-ia-a-la-cuenta-priority-p1))

Con la app corriendo en local (`npm run dev`), agregar el servidor en el
asistente. En Claude Code:

```bash
claude mcp add --transport http kanban http://localhost:3000/api/mcp
```

1. Al primer uso, el asistente abre el navegador en `/sign-in`. Ana inicia
   sesión **con Google** en una prueba y **con email** en otra. En ambos
   casos llega a `/consent` sin perder el flujo.
2. La pantalla muestra el nombre del asistente, que podrá leer y modificar
   todos sus proyectos con sus permisos (incluido eliminar Work Items y
   columnas), y que **no** podrá administrar miembros ni proyectos. Allow y
   Deny tienen el mismo peso visual.
3. **Deny**: el asistente informa que no obtuvo acceso. Repetir y elegir
   **Allow**.
4. En el asistente: "lista mis proyectos del kanban". Aparecen "Personal
   Ana" (personal) y "UMG ASISTENCIA" (compartido, rol owner). **No**
   aparece "Ajeno".
5. Sin token, la ruta responde 401 con desafío:

   ```bash
   curl -i -X POST http://localhost:3000/api/mcp -H 'content-type: application/json' -d '{}'
   ```

   Esperado: `401` y un header `WWW-Authenticate` que apunta a los metadatos
   del recurso protegido.
6. Anotar qué rutas `.well-known` pidió el asistente (en los logs del
   servidor) y confirmar que todas respondieron 200. Esto verifica la nota de
   [mcp-tools.md § Autorización](contracts/mcp-tools.md#autorización).
7. Repetir la conexión desde el deploy de Render
   (`https://<instancia>/api/mcp`) antes de cerrar la feature.

## 3. Leer y verificar lo que existe ([Historia 3](spec.md#user-story-3---el-agente-consulta-proyectos-y-verifica-lo-que-ya-existe-priority-p1))

En el asistente conectado como Ana:

1. "Muéstrame el tablero de UMG ASISTENCIA": columnas en orden, "Done"
   marcada como de cierre, y cada Work Item con su ID, título y asignado.
2. "¿Qué tiene asignado Beto en UMG ASISTENCIA?": coincide con el filtro de
   la Tabla.
3. "Busca tareas que mencionen *login*": coincide con lo que se ve en la
   interfaz.
4. "Dame el detalle de UMG-1": campos, relaciones e historial.
5. "Lee el proyecto Ajeno" (dándole su id a mano): responde que no existe
   (`NOT_FOUND`), sin revelar nada.

## 4. Crear, asignar, mover y organizar ([Historia 4](spec.md#user-story-4---el-agente-crea-actualiza-y-organiza-el-trabajo-priority-p1))

1. "En UMG ASISTENCIA crea en To Do estas 5 tareas: … (incluida una que ya
   existe). Solo las que no existan, y asigna las de backend a Beto." El
   asistente busca primero, crea 4 con IDs consecutivos y asigna. Beto
   recibe una notificación por cada una, con "via *Nombre del asistente*".
2. En la interfaz, el historial de cada una muestra la creación y la
   asignación "by Ana via *asistente*".
3. "Pon UMG-n en Done": queda **cerrada**, con fecha de cierre y los eventos
   `stage_changed` y `closed`, igual que al arrastrarla.
4. "Haz UMG-a hija de UMG-b" y después "haz UMG-b hija de UMG-a": la segunda
   falla con `CYCLE_DETECTED`.
5. Pedir crear 3 tareas donde una está asignada a alguien que no es miembro:
   no se crea **ninguna** (`BATCH_ITEM_INVALID`, con el índice).
6. "Crea la columna *Review* entre Doing y Done", después "elimina la columna
   *Doing*" (con Work Items): la segunda se rechaza con `STAGE_NOT_EMPTY`.
7. "Elimina UMG-n": desaparece del tablero. Sus hijos quedan como Work Items
   independientes.
8. "Invita a x@y.com a UMG ASISTENCIA" y "cambia el rol de Beto": el
   asistente responde que no tiene herramientas para eso. El resultado de
   `tools/list` no incluye nada de administración.
9. Conectar el asistente con la cuenta de **Carla** (Lectora). Lee todo, pero
   cualquier escritura en "UMG ASISTENCIA" responde `ROLE_NOT_PERMITTED`, y
   la base de datos no cambia.
10. Con Beto conectado, Ana lo pasa a Lector mientras tanto. La siguiente
    escritura de su agente responde `ROLE_NOT_PERMITTED`.

## 5. Ver y revocar agentes ([Historia 5](spec.md#user-story-5---ver-y-revocar-los-agentes-conectados-priority-p2))

1. Ana abre **Settings → Connected agents**: aparece el asistente con "Authorized
   on" y "Last used" recientes.
2. **Revoke** y confirmar. La siguiente petición del asistente falla (401) y
   el asistente vuelve a pedir autorización. SC-008: sin esperar a que
   expire el token.
3. Un usuario sin agentes ve el estado vacío con la dirección de conexión y
   el botón de copiar.

## 6. Límite de velocidad

Con un script que llame `list_projects` 200 veces seguidas usando un token
válido, a partir de ~30 llamadas en ráfaga llegan errores `RATE_LIMITED` con
`retryAfterSeconds`. Mientras tanto, la interfaz web sigue respondiendo con
normalidad.

## 7. Rendimiento (SC-011)

En un proyecto sembrado con 500 Work Items, `get_board` y
`search_work_items` responden en menos de 2 s medidos desde el asistente o
con `curl` y un token válido.
