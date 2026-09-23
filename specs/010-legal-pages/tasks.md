---

description: "Task list for 010-legal-pages implementation"
---

# Tasks: Páginas Legales Públicas (Privacidad y Condiciones)

**Input**: Design documents from `specs/010-legal-pages/`
(plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅,
quickstart.md ✅ (todos generados por `/speckit-plan`).

**Tests**: Se incluyen pruebas unitarias y e2e, mismo criterio que
[009-work-item-views/tasks.md](../009-work-item-views/tasks.md). La unitaria
cubre `getOperator` (los reemplazos, que es donde un error pasaría
desapercibido). Las e2e cubren que las páginas sean públicas y que los
enlaces lleguen; **no** comprueban el nombre del operador, porque depende del
`.env.local` de quien corra la suite.

**Organization**: Tareas agrupadas por historia de usuario de
[spec.md](spec.md). US1 es P1; US2 y US3 son P2. Cada historia usa la
etiqueta `[F10-US<m>]` (`F10` = 010-legal-pages), siguiendo la convención de
[AGENTS.md](../../AGENTS.md#working-with-tasksmd).

**Sin fase de Setup separada**: no hay dependencias, herramientas ni
migraciones nuevas (plan.md § Technical Context).

**Antes de escribir código Next.js**: [AGENTS.md](../../AGENTS.md) exige leer
la guía relevante de `node_modules/next/dist/docs/`. Para esta feature:
`01-app/02-guides/environment-variables.md` § Runtime Environment Variables
(ya leída en el plan) y la referencia de `connection` en
`01-app/03-api-reference/04-functions/connection.md`.

**Base de datos**: los e2e vacían la base de `.env.local`, que ahora apunta a
la branch `dev` de Neon (la de prd es otra, configurada solo en Render).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin
  dependencias de tareas incompletas).
- **[Story]**: `[F10-US<m>]` indica a qué historia de esta spec pertenece.
- Cada descripción incluye la ruta exacta de archivo.

## Path Conventions

Mismo monolito Next.js (plan.md § Project Structure). Todo el texto visible
va en inglés, como el resto de la UI: Privacy Policy, Terms of Service, Last
updated, ← Back to Kanban.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: La resolución del operador y el layout de lectura que comparten
las dos páginas.

**⚠️ CRITICAL**: ninguna historia de usuario puede empezar hasta completar
esta fase.

- [X] T001 Crear `lib/legal.ts` (módulo **puro**: sin imports de `next/*`, `db` ni `lib/auth`) según contracts/legal-pages.md § Módulo puro:
  - `export type Operator = { name: string | null; contactEmail: string | null }`.
  - `getOperator(env: Record<string, string | undefined>): Operator`: lee `OPERATOR_NAME` y `OPERATOR_CONTACT_EMAIL`. Regla de data-model.md: "texto recortado, no vacío" para `name`; "texto recortado con forma de email" para `contactEmail`. Vacío, solo espacios o email sin forma de email → `null`.
  - `LEGAL_LAST_UPDATED = "2026-09-22"` con un comentario que pida actualizarla con cada cambio del texto.
- [X] T002 Crear `tests/unit/legal.test.ts` para `getOperator`: ambos valores presentes (y recortados), cada uno ausente, cadena vacía, solo espacios, `OPERATOR_CONTACT_EMAIL="not-an-email"` → `null`, y un email válido con espacios alrededor → recortado.
- [X] T003 [P] Crear `app/(legal)/layout.tsx`: contenedor de lectura sin el shell de la app. `<main>` con ancho máximo cómodo (~`max-w-2xl`), padding lateral que no provoque scroll horizontal a 375 px (FR-010), estilos de lectura puestos a mano para `h1`, `h2`, `p`, `ul`, `a` (research.md § Contenido como JSX; **no** instalar `@tailwindcss/typography`). Arriba, un enlace "← Back to Kanban" a `/`; abajo, un pie con enlaces a `/privacy` y `/terms` (FR-008, navegación normal, sin pestaña nueva).

**Checkpoint**: `npm test -- legal` en verde.

---

## Phase 2: [F10-US1] Leer la Política de Privacidad sin cuenta (Priority: P1) 🎯 MVP

**Goal**: `/privacy` pública con todo el contenido de FR-003 y FR-004 de 010-legal-pages.

**Independent Test**: sin sesión, abrir `/privacy`: carga sin redirigir, muestra "Last updated" y todas las secciones de FR-003 (quickstart.md bloque 1).

- [X] T004 [F10-US1] Crear `app/(legal)/privacy/page.tsx` (Server Component, `async`):
  - `await connection()` (de `next/server`) y luego `getOperator(process.env)`.
  - `metadata.title = "Privacy Policy · Kanban"`.
  - `h1` "Privacy Policy" y "Last updated: {LEGAL_LAST_UPDATED}".
  - Una sección `h2` por punto, en el orden de contracts/legal-pages.md: Who runs this instance · Data we store · How we use it · Who can see it · Service providers · What we don't do · Cookies · Keeping and deleting your data · Changes · Contact.
  - "Data we store" enumera cada fila de la tabla de data-model.md § Sin cambios de esquema, en lenguaje llano (incluidas la IP y el navegador de cada sesión, y la contraseña guardada de forma no legible).
  - "Who runs this instance" aclara que el software es open source y self-hosted y que la instancia la opera `operator.name` (o "the operator of this instance"), no los autores del proyecto.
  - "Service providers": proveedor de base de datos, de emails, de hosting, y Google "only if you sign in with Google" (FR-004: solo nombre, email y foto, solo para identificarte, para ningún otro fin).
  - "What we don't do": sin publicidad, sin rastreo ni analítica de terceros, sin venta ni cesión de datos.
  - "Cookies": solo cookies esenciales de sesión.
  - Contacto: `mailto:` a `operator.contactEmail` si existe; si no, "contact the administrator of this instance" sin enlace.
  - *Nota de implementación*: el nombre y el contacto con sus reemplazos quedaron en `components/legal/OperatorContact.tsx` (`OperatorName`, `OperatorContact`), compartido con `/terms`, para no duplicar la regla en las dos páginas.
- [X] T005 [F10-US1] Crear `tests/e2e/legal-pages.spec.ts` con el bloque 1 de quickstart.md para `/privacy`: en un contexto sin sesión, `goto("/privacy")` queda en `/privacy` (no redirige a `/sign-in`), se ve el `h1` "Privacy Policy", "Last updated" y los `h2` de las diez secciones.

**Checkpoint**: la URL de `/privacy` ya sirve para Google (SC-001, junto con la raíz como página principal).

---

## Phase 3: [F10-US2] Leer las Condiciones del Servicio sin cuenta (Priority: P2)

**Goal**: `/terms` pública con FR-005 de 010-legal-pages.

**Independent Test**: sin sesión, abrir `/terms`: carga sin redirigir, con las secciones de FR-005 y enlace a `/privacy`.

- [X] T006 [F10-US2] Crear `app/(legal)/terms/page.tsx` (Server Component, `async`, `await connection()`, `getOperator(process.env)`, `metadata.title = "Terms of Service · Kanban"`, "Last updated"). Secciones `h2`: Who provides this service (operador) · The software (open source, licencia MIT, "as is", sin garantías) · Acceptable use (nada ilegal, abuso, spam ni intentos de acceder a datos de otros) · Your content (pertenece a quien lo crea y a los miembros del proyecto donde se crea) · Suspension (el operador puede suspender o borrar cuentas que incumplan) · Limitation of liability · Changes · Contact. Enlace en el texto a `/privacy`.
- [X] T007 [F10-US2] En `tests/e2e/legal-pages.spec.ts`, agregar: sin sesión, `/terms` carga sin redirigir con su `h1`; desde `/privacy` el enlace del pie lleva a `/terms` y viceversa; "← Back to Kanban" sin sesión termina en `/sign-in` (quickstart.md bloque 1, paso 3).

---

## Phase 4: [F10-US3] Encontrar las páginas legales desde las pantallas de acceso (Priority: P2)

**Goal**: enlaces a las dos páginas en iniciar sesión y crear cuenta, y el aviso de aceptación en crear cuenta.

**Independent Test**: en `/sign-in` y `/sign-up`, cada enlace abre la página correcta en una pestaña nueva y el formulario original conserva lo escrito (quickstart.md bloque 2).

- [X] T008 [F10-US3] Crear `components/legal/LegalLinks.tsx` según contracts/legal-pages.md § Componente: prop `consent?: boolean`; sin ella, "Privacy Policy · Terms of Service" en texto chico y atenuado; con ella, "By creating an account or continuing with Google, you agree to the Terms of Service and acknowledge the Privacy Policy." con los dos enlaces dentro del texto. Todos los enlaces con `target="_blank" rel="noopener noreferrer"`. Puede ser Server Component (no tiene estado) aunque se use dentro de páginas cliente.
- [X] T009 [P] [F10-US3] En `app/(auth)/sign-in/page.tsx`, renderizar `<LegalLinks />` al final de `<main>`, debajo de los enlaces existentes.
- [X] T010 [P] [F10-US3] En `app/(auth)/sign-up/page.tsx`, renderizar `<LegalLinks consent />` al final del `<main>` del formulario (después de "Already have an account?"). No agregarlo a la pantalla de "revisa tu email" que se muestra tras registrarse.
- [X] T011 [F10-US3] En `tests/e2e/legal-pages.spec.ts`, agregar el bloque 2 de quickstart.md: en `/sign-in` y `/sign-up`, cada enlace abre una pestaña nueva (`context.waitForEvent("page")`) en la URL correcta; en `/sign-up`, tras escribir nombre y email y abrir un enlace, los campos de la pestaña original conservan su valor; el aviso de aceptación es visible.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T012 [P] Actualizar `.env.example`: sección "Instance operator (optional)" con `OPERATOR_NAME=""` y `OPERATOR_CONTACT_EMAIL=""`, comentando que aparecen en `/privacy` y `/terms` y que la app arranca sin ellas.
- [X] T013 [P] Actualizar `README.md`:
  - § Environment variables: las dos variables nuevas, marcadas como opcionales.
  - § Prerequisites, paso de Google: registrar en la pantalla de consentimiento la página principal (`<your-domain>`), la política (`<your-domain>/privacy`) y las condiciones (`<your-domain>/terms`), no subir logo, y "Publish app".
  - Nota: el texto legal es una base genérica y no es asesoría legal; quien opere una instancia es responsable de revisarlo.
  - § Project status: mencionar `specs/010-legal-pages`.
- [X] T014 [P] Actualizar `AGENTS.md`: agregar `010-legal-pages` a la lista de specs (§ Start here) y `lib/legal.ts` entre los módulos puros; en § Current state, la primera instancia desplegada en Render.
- [X] T015 Desde la raíz del repositorio, correr `npm run lint`, `npm run test` y `npx tsc --noEmit`, y corregir cualquier fallo.
- [X] T016 Correr `npm run test:e2e` contra la base `dev`: todas las suites existentes y `tests/e2e/legal-pages.spec.ts` deben quedar en verde. Registrar el resultado en esta tarea. — *Hecho 2026-09-22*: **56/56 en verde** (15.5 min), incluidos los 5 tests nuevos de `legal-pages.spec.ts`.
- [ ] T017 Correr manualmente `quickstart.md` de punta a punta (bloques 1 a 5), incluido el bloque 5 en producción: variables del operador en Render, URLs en Google y "Publicar app", y login con una cuenta de Google que no sea usuario de prueba (SC-001). Registrar los resultados.

---

## Dependencies & Execution Order

```
Phase 1 (Foundational) ── BLOQUEA todas las historias
    ↓
Phase 2 [F10-US1] /privacy                    (P1 · MVP)
    ↓
Phase 3 [F10-US2] /terms                      (P2) ─┐ independientes entre sí
Phase 4 [F10-US3] Enlaces en pantallas acceso (P2) ─┘
    ↓
Final Phase (Polish)
```

- **Foundational**: T002 requiere T001. T003 es independiente de T001.
- **US1**: T004 requiere T001 y T003. T005 requiere T004.
- **US2**: T006 requiere T001 y T003. T007 requiere T006.
- **US3**: T009 y T010 requieren T008. T011 requiere T009 y T010. Los enlaces apuntan a `/privacy` y `/terms`, pero el componente se puede construir antes de que existan.
- **Archivos compartidos**: `tests/e2e/legal-pages.spec.ts` (T005, T007, T011) se trabaja en secuencia.
- **T016 y T017** requieren todo lo anterior. T017 además requiere desplegar la branch en Render.

## Parallel Execution Examples

**Dentro de Phase 1**: T001 y T003 en paralelo; T002 en cuanto esté T001.

**Entre US2 y US3**: con Foundational hecho, T006 (`/terms`) y T008-T010 (enlaces) tocan archivos distintos.

**Dentro de `[F10-US3]`**: T009 y T010 son `[P]` entre sí.

**Polish**: T012, T013 y T014 son `[P]` entre sí.

## Implementation Strategy

### MVP First (Phase 1 + Phase 2)

1. Foundational: `getOperator` probado y layout de lectura.
2. `[F10-US1]`: `/privacy`.
3. **STOP and VALIDATE**: con `/privacy` en prd, Google ya permite publicar
   la app. Es el MVP de la feature.
4. `[F10-US2]` y `[F10-US3]`: condiciones y enlaces.

### Orden de despliegue

Sin migración: el código se despliega directo. Antes de publicar la app en
Google, cargar `OPERATOR_NAME` y `OPERATOR_CONTACT_EMAIL` en Render, para que
la política ya muestre el contacto real cuando la vea Google.
