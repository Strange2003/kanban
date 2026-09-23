# Research: Páginas Legales Públicas

Decisiones técnicas de [plan.md](plan.md). El stack general está en
[001-accounts-invitations/research.md](../001-accounts-invitations/research.md)
y no se vuelve a evaluar.

## Decisión: Grupo de rutas `(legal)`

**Decision**: `app/(legal)/privacy/page.tsx` y `app/(legal)/terms/page.tsx`,
con un `app/(legal)/layout.tsx` propio.

**Rationale**: El layout de `(workspace)` llama a `requireSession()`, así que
cualquier ruta dentro exige sesión. No hay middleware/proxy, por lo que una
ruta fuera de ese grupo ya es pública sin excepciones. Un grupo propio (y no
dentro de `(auth)`) evita mezclar páginas de lectura con los formularios de
acceso, y permite un layout de lectura (ancho máximo cómodo, enlace de
vuelta) compartido por ambas páginas. Los paréntesis no aparecen en la URL:
las direcciones quedan `/privacy` y `/terms` (FR-001, FR-002).

**Alternatives considered**:
- Dentro de `app/(auth)/`: funciona, pero `(auth)` es para formularios de
  cuenta; mezclarlo confunde.
- Rutas en la raíz de `app/` sin grupo: funciona, pero duplica el layout de
  lectura en cada página.

## Decisión: Lectura del operador en tiempo de ejecución

**Decision**: Variables `OPERATOR_NAME` y `OPERATOR_CONTACT_EMAIL`, sin
prefijo `NEXT_PUBLIC_`, leídas en el Server Component después de
`await connection()` (de `next/server`).

**Rationale**: Según la guía de Next.js 16 (Runtime Environment Variables),
una página sin APIs de petición se prerenderiza en el build y el valor de
`process.env` queda fijo en ese momento. En Render, cambiar una variable
redespliega y recompila, así que funcionaría igual; pero quien haga
self-hosting con una imagen Docker construida una vez vería el valor del
build. `connection()` fuerza el render dinámico y lee el valor real de cada
instancia. El costo (render por petición de una página de texto) es
despreciable.

**Alternatives considered**:
- Prerender estático: más rápido, pero rompe el caso "una imagen, varias
  instancias".
- `NEXT_PUBLIC_*`: se inlinea en el bundle del navegador en el build; peor en
  los dos sentidos.
- Guardar el operador en la base de datos con una pantalla de
  administración: no existe un rol de administrador de instancia y sería
  alcance nuevo (Principio VI).

## Decisión: Variables opcionales con reemplazo

**Decision**: `getOperator(env)` en `lib/legal.ts` devuelve
`{ name, contactEmail }`, donde cada campo es el valor recortado o `null`. Un
email que no tenga forma de email se trata como ausente. Las páginas usan
"the operator of this instance" y "the administrator of this instance"
cuando falta cada uno.

**Rationale**: El spec pide que la app arranque sin estos valores (Edge
Cases), a diferencia de las variables de `lib/auth.ts`, que lanzan un error
al importar. Recibir `env` como parámetro deja el módulo puro y probable sin
tocar `process.env` en los tests. Descartar un email mal formado evita
publicar un `mailto:` roto.

**Alternatives considered**:
- Hacerlas obligatorias y lanzar un error al arrancar: rompe instancias
  existentes que se actualicen, y el spec dice lo contrario.
- Reemplazar con el email de la cuenta de Resend o `EMAIL_FROM`: suele ser
  una dirección `no-reply`, no un contacto.

## Decisión: Contenido como JSX, no MDX ni markdown

**Decision**: El texto legal se escribe directamente en JSX dentro de cada
`page.tsx`, con elementos semánticos (`h1`, `h2`, `p`, `ul`) y clases de
Tailwind puestas a mano en el layout de `(legal)`. No se instala
`@tailwindcss/typography` (hoy no está en el proyecto).

**Rationale**: Son dos páginas que cambian muy poco. MDX o un
renderizador de markdown suman una dependencia y configuración para ahorrar
unas pocas etiquetas (Principio VI). JSX además permite intercalar el nombre
y el email del operador sin un sistema de plantillas.

**Alternatives considered**:
- MDX (`@next/mdx`): configuración extra de `next.config.ts` y del loader.
- Archivos `.md` + `react-markdown`: una dependencia nueva y una capa de
  interpolación para el operador.

## Decisión: Enlaces en pestaña nueva desde las pantallas de acceso

**Decision**: `LegalLinks` abre ambas páginas con `target="_blank"` y
`rel="noopener noreferrer"`. Dentro de las páginas legales, los enlaces
entre sí y "volver" usan navegación normal.

**Rationale**: US3 escenario 3 pide volver a la pantalla de acceso sin
perder lo escrito. Las pantallas de acceso son Client Components con estado
local (`useState`), que se pierde al navegar fuera y volver. Una pestaña
nueva lo resuelve sin persistir borradores.

**Alternatives considered**:
- Guardar el formulario en `sessionStorage`: más código y guardaría la
  contraseña en el navegador.
- Mostrar el texto en un diálogo modal: duplica el contenido o obliga a
  cargarlo en el cliente; además, Google necesita una URL propia de todos
  modos.

## Decisión: Fecha de "última actualización" como constante

**Decision**: `LEGAL_LAST_UPDATED` en `lib/legal.ts`, una fecha ISO que
ambas páginas muestran y que se actualiza a mano cuando cambia el texto.

**Rationale**: El texto vive en el código; su fecha de cambio también. Usar
la fecha del build o del último commit mostraría "actualizado" en cada
despliegue aunque el texto no cambie.

**Alternatives considered**:
- Fecha de build: engañosa, por lo anterior.
- Una fecha por página: las dos se revisan juntas, una sola alcanza.

## Decisión: Página principal para Google

**Decision**: La página principal que se registra en Google es la raíz de la
instancia (`https://kanban-3nt0.onrender.com`). No se agrega una landing.

**Rationale**: Para publicar sin verificación de marca, Google solo exige
una URL válida del dominio autorizado. La raíz ya existe y, sin sesión,
lleva a iniciar sesión, que ahora enlaza a las páginas legales. Una landing
pública quedó fuera de alcance en el spec.

**Alternatives considered**:
- Una landing de marketing: fuera de alcance.
- Usar `/privacy` como página principal: Google espera que la principal
  describa la app, no la política.
