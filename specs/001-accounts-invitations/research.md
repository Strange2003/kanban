# Research: Fase 1 (Cuentas, Proyectos, Tablero, Work Items)

**Alcance**: Este research cubre las decisiones técnicas compartidas por las
4 specs de la Fase 1 —
[001-accounts-invitations](spec.md),
[002-project-spaces](../002-project-spaces/spec.md),
[003-kanban-board](../003-kanban-board/spec.md) y
[004-work-items](../004-work-items/spec.md) — porque forman un único
codebase/deploy, no cuatro servicios independientes. Las decisiones acá
aplican a las cuatro; los archivos `plan.md` de 002-004 solo agregan lo que
les es propio (entidades y contratos específicos) y referencian este
research en vez de repetirlo.

## Decisión: Framework y lenguaje

**Decision**: Next.js 14+ (App Router) con TypeScript, como aplicación web
monolítica (frontend + backend en el mismo proyecto, vía Server
Actions/Route Handlers).

**Rationale**: Better Auth (la librería de autenticación elegida — ver
Decisión: Autenticación) tiene soporte de primera clase para Next.js;
usarlo minimiza fricción de integración. React + App Router también da
soporte de primera clase para
Server Components (carga rápida del tablero) y Server Actions (mutaciones
sin tener que mantener una capa de API REST separada), lo que reduce
superficie de código — alineado con el Principio VI (YAGNI) de la
constitución.

**Alternatives considered**:
- SPA (Vite + React) + API separada (Express/Fastify): más piezas que
  mantener y desplegar por separado, sin beneficio claro para el alcance de
  la Fase 1.
- Remix / SvelteKit: viables, pero peor soporte documentado de Better Auth y
  del ecosistema de componentes (shadcn/ui, dnd-kit) que ya se evaluaron.

## Decisión: Base de datos y ORM

**Decision**: Neon (Postgres serverless) + Drizzle ORM, usando el driver
serverless de Neon (`@neondatabase/serverless`).

**Rationale**: Preferencia explícita del usuario por Neon. Drizzle es el ORM
más usado junto a Neon en proyectos Next.js (tipado end-to-end, migraciones
como SQL versionado, sin runtime pesado) y encaja con el Principio VI
(simplicidad) mejor que un ORM más pesado como Prisma para este alcance.

**Nota de alineación con el Principio V (código abierto, sin bloqueo de
ecosistema)**: Neon es Postgres estándar (protocolo wire compatible); el
esquema y las queries de Drizzle no usan ninguna extensión propietaria de
Neon. Cualquier fork del proyecto puede apuntar `DATABASE_URL` a otro
Postgres (local, Supabase, RDS, etc.) sin cambiar código de la aplicación.
El principio V habla de no atarse a un proveedor de *control de versiones o
CI/CD*, no de infraestructura de hosting — se documenta igual esta nota por
transparencia, ya que es una decisión de infraestructura no trivial para un
proyecto open source.

**Alternatives considered**:
- Prisma: más "batteries included" pero runtime más pesado y menos directo
  para el driver serverless de Neon.
- Postgres.js / node-postgres directo sin ORM: demasiado boilerplate para el
  volumen de entidades de la Fase 1.

## Decisión: Autenticación

**Decision**: Better Auth **self-hosted** (la librería open source, no el
wrapper gestionado "Neon Auth") para identidad — registro, login, Google
OAuth, verificación de email, recuperación de contraseña (FR-001 a FR-003 y
FR-015/FR-016 de [001](spec.md)). Corre dentro del mismo proceso Next.js
(un route handler más, `app/api/auth/[...all]/route.ts`), usando el
adaptador de Drizzle de Better Auth para persistir sus propias tablas
(`user`, `session`, `account`, `verification`) en la misma base Neon —
ninguna infraestructura adicional. Los emails de verificación y
recuperación de contraseña se envían con **Resend** (los dos callbacks que
Better Auth expone: `sendVerificationEmail` y `sendResetPassword`). Los
conceptos de Membresía, Invitación y Notificación (específicos de "invitar
a un proyecto", no genéricos de una librería de auth) se modelan en tablas
propias de la aplicación, igual que antes.

**Rationale**: Se evaluó primero "Neon Auth" (el mismo Better Auth, pero
como servicio gestionado por Neon). Al investigar su estado actual
(2026-09-10), se confirmó que sigue **en beta**, apuntando a
disponibilidad general "este trimestre" según su propio roadmap, con
advertencias explícitas de Neon de "rough edges, evolving limits" y sin
soporte aún para varios escenarios de red. Para un proyecto de código
abierto que otros van a clonar/fork-ear (Principio V), depender de un
servicio en beta sin SLA es un riesgo que no compensa el ahorro de código:
Better Auth self-hosted es *la misma librería*, funcionalmente idéntica,
sin esa dependencia. El costo adicional es acotado: instalar el paquete,
correr su CLI para generar la migración de sus tablas, y escribir ~10
líneas conectando sus dos callbacks de email a Resend — todo dentro del
mismo codebase y el mismo despliegue en Render, sin servicios nuevos que
levantar.

**Alternatives considered**:
- Neon Auth gestionado (Managed Better Auth): descartado por el riesgo de
  depender de una beta sin SLA en un proyecto open source; ver Rationale.
- Auth.js (NextAuth): buen soporte de OAuth pero manejo de
  email/password + verificación + reset requiere más código propio que
  Better Auth, que ya trae esos flujos resueltos como configuración.

## Decisión: Identificadores públicos

**Decision**: Cada entidad expuesta externamente (Proyecto, Invitación,
Stage/Columna) tiene un `id` serial interno (nunca expuesto) y un `publicId`
corto (nanoid) usado en URLs y respuestas — cumpliendo el Principio IV. Los
Work Items son la excepción intencional: su identificador visible es un
correlativo legible por proyecto (`PREFIJO-N`, ver FR-003 de
[004](../004-work-items/spec.md)), no un nanoid opaco, porque la spec pide
explícitamente que sea legible y reconocible (estilo Jira/Linear). Esto
sigue cumpliendo la intención del Principio IV (no filtra la clave primaria
interna ni un contador global de toda la tabla): el correlativo está
scopeado por proyecto, generado a partir de un contador propio de cada
proyecto, no del `id` interno de la fila.

**Rationale**: Balancea la regla de la constitución (no exponer PKs
internas/secuenciales globales) con el requisito de UX explícito de la
spec de Work Items (Principio I).

**Decisión de prefijo**: el prefijo del Work Item se deriva del nombre del
proyecto al crearse (primeras letras alfanuméricas, mayúsculas, 3-4
caracteres; ej. "Kanban App" → "KAN"), y queda fijo (inmutable) aunque el
proyecto se renombre después — evita recalcular IDs ya mostrados a usuarios.
Si dos proyectos del mismo usuario derivan el mismo prefijo, se sufija con
un número (`KAN2`, `KAN3`, ...) al crear el proyecto.

**Alternatives considered**:
- UUID/nanoid también para Work Items: más simple de implementar pero viola
  el requisito explícito de legibilidad de FR-003.
- Contador global de Work Items (no por proyecto): expondría cuántos Work
  Items existen en todo el sistema; peor para aislamiento percibido entre
  proyectos.

## Decisión: Drag-and-drop y estado optimista

**Decision**: `dnd-kit` en el cliente para arrastrar columnas y Work Items;
todas las mutaciones de orden/posición se aplican primero de forma optimista
en el estado del cliente y se confirman con una Server Action. Si la Server
Action falla, el cliente revierte al último estado confirmado y muestra un
error (ya especificado como FR-011 en
[003-kanban-board](../003-kanban-board/spec.md)).

**Rationale**: Es la única forma de cumplir el Principio I (fluidez
percibida, sin esperas) y, a la vez, el comportamiento ante fallo ya
clarificado explícitamente en la spec.

**Alternatives considered**:
- Confirmar en servidor antes de mover visualmente: más simple de
  implementar pero viola el Principio I (percibido como lento/con lag).
- Librerías de drag-and-drop más pesadas (react-beautiful-dnd, no
  mantenida): descartada por estar deprecada.

## Decisión: Sincronización entre miembros

**Decision**: Sin WebSockets ni sincronización en vivo en la Fase 1; cada
cambio se refleja para otros miembros "la próxima vez que abren el tablero"
(ya especificado así en SC-003 de 003 y SC-003 de 004), vía revalidación de
datos de Next.js al navegar/enfocar la pestaña.

**Rationale**: Es exactamente lo que las specs ya definen (no se dejó como
ambigüedad) y evita la complejidad de infraestructura en tiempo real
(canales, presencia, reconexión) que el Principio VI (YAGNI) desaconseja
para un MVP. Se puede evaluar sync en vivo como mejora de una fase
posterior si el uso real lo demanda.

**Alternatives considered**:
- WebSockets/Server-Sent Events con un canal por proyecto: se descarta para
  la Fase 1 por complejidad no solicitada por ninguna spec.

## Decisión: Rate limit de invitaciones

**Decision**: Se implementa a nivel de aplicación (no como tabla nueva):
antes de crear una invitación, se cuenta cuántas invitaciones envió esa
cuenta en la última hora; si supera el umbral (20/hora, valor ilustrativo
de FR-017 en [001](spec.md)), se rechaza con un mensaje claro.

**Rationale**: Evita una pieza de infraestructura adicional (ej. Redis) para
un límite que se puede resolver con una query sobre la tabla de
`invitations` ya existente, filtrando por `invitedByUserId` y `createdAt`.

**Alternatives considered**:
- Rate limiting con Redis/Upstash: más robusto para escala alta, pero
  innecesario para el volumen esperado de la Fase 1 (YAGNI).

## Decisión: Testing

**Decision**: Vitest para unidades (validaciones, helpers de permisos,
generación de prefijo/correlativo) y Playwright para los flujos end-to-end
que ya están descritos como "Independent Test" en cada historia de usuario
de las 4 specs.

**Rationale**: Cada "Independent Test" de las specs ya está redactado como
un escenario Given/When/Then ejecutable de punta a punta — Playwright los
traduce casi 1:1. Vitest cubre la lógica pura (cálculo de prefijo,
reglas de permisos) sin levantar un navegador.

**Alternatives considered**:
- Jest: viable, pero Vitest integra mejor con el tooling nativo de
  Vite/Next.js moderno y es más rápido en este stack.

## Decisión: Hosting/despliegue

**Decision**: Render, como "Web Service" persistente de Node.js corriendo
el build de Next.js (App Router con Server Actions), con variables de
entorno gestionadas en su dashboard. La base de datos sigue siendo Neon,
externa a Render (Render solo aloja el código de la app).

**Rationale**: Preferencia explícita del usuario, ya validada contra
alternativas (Vercel, Railway) el 2026-09-10:
- **Vercel** tiene la mejor integración nativa con Next.js y con Neon (son
  socios oficiales — Vercel migró su propio Postgres a Neon), pero corre
  como funciones serverless y su precio escala mal a medida que crece el
  uso ($200-1000+/mes en planes de equipo).
- **Railway** cobra por uso real (mejor para tráfico bajo/irregular de un
  proyecto nuevo) y tiene plantilla propia de un click para Next.js+Neon,
  pero el usuario ya tiene experiencia y preferencia establecida con
  Render.
- **Render** da un servicio web persistente (sin cold-starts), tiene guía
  oficial propia para Next.js con SSR/Server Actions, y cubre exactamente
  lo que se necesita ahora (un único Web Service; sin workers ni cron ni
  Redis en la Fase 1). Precio fijo y predecible (~$7/mes plan Starter).

Ningún proveedor introduce una dependencia de código: el proyecto sigue
siendo un Next.js + Better Auth + Drizzle estándar, desplegable en
cualquier proveedor compatible con Node.js si se decide migrar más
adelante (Principio V).

**Alternatives considered**:
- Vercel: ver Rationale — se descarta por costo a escala, no por
  capacidad técnica.
- Railway: alternativa igualmente válida (de hecho más económica al
  inicio); se deja documentada por si el costo de Render se vuelve un
  problema real más adelante.
- Self-hosting (Docker + VPS): totalmente viable y más "sin bloqueo de
  ecosistema" en espíritu, pero más trabajo operativo manual del que el
  usuario pidió resolver ahora; queda como alternativa documentada, no
  como decisión bloqueante.
