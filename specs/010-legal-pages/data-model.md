# Data Model: Páginas Legales Públicas

## Sin cambios de esquema

Esta feature no agrega tablas, columnas ni migraciones, y las páginas no
leen la base de datos.

La Política de Privacidad **describe** datos que ya existen. Esta es la
referencia punto por punto para escribir FR-003 de 010-legal-pages y para
revisar SC-005:

| Lo que dice la política | Dónde está hoy |
|---|---|
| Nombre, email, foto de perfil | `user.name`, `user.email`, `user.image` (Better Auth; `image` solo viene de Google) |
| Contraseña almacenada de forma no legible | `account.password` (hash de Better Auth), solo en cuentas con email/contraseña |
| Tokens del proveedor de login | `account.access_token`, `refresh_token`, `id_token` (solo Google) |
| Dirección IP y navegador de cada sesión | `session.ip_address`, `session.user_agent` |
| Tokens de verificación y recuperación | `verification` (temporales, con vencimiento) |
| Proyectos y su contenido | `projects`, `stages`, `work_items`, `tags`, `work_item_tags`, `areas`, `iterations`, `work_item_related_links` |
| Membresías, invitaciones, notificaciones | `project_members`, `invitations`, `notifications` |
| Registro de actividad (con autor y agente, desde 011) | `work_item_activity` (`actor_user_id`, `agent_client_id`, `agent_name`) |
| Agentes de IA conectados (011-agent-access-mcp) | `oauth_client`, `oauth_consent`, `oauth_access_token`, `oauth_refresh_token`, `agent_last_used`, `jwks` (clave de firma de la instancia, no dato personal) |
| Cookies | solo la cookie de sesión de Better Auth |

Si una feature futura agrega datos personales nuevos, hay que actualizar la
política y `LEGAL_LAST_UPDATED` (ver [contracts/legal-pages.md](contracts/legal-pages.md)).

## Configuración: Operador de la instancia

No es una entidad persistida: se lee de variables de entorno en cada
petición.

| Campo | Origen | Regla | Si falta o es inválido |
|---|---|---|---|
| `name` | `OPERATOR_NAME` | texto recortado, no vacío | `null` → "the operator of this instance" |
| `contactEmail` | `OPERATOR_CONTACT_EMAIL` | texto recortado con forma de email | `null` → "contact the administrator of this instance" (sin `mailto:`) |

Tipo resultante (en `lib/legal.ts`):

```ts
type Operator = { name: string | null; contactEmail: string | null };
```
