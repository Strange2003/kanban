# Implementation Plan: Páginas Legales Públicas (Privacidad y Condiciones)

**Branch**: `010-legal-pages` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-legal-pages/spec.md`

**Nota de alcance**: Esta feature extiende el mismo codebase y deploy de las
fases anteriores. El stack, la autenticación y el hosting (Render) ya están
decididos en [001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md)
y no se vuelven a evaluar. No es parte del roadmap de fases: es un requisito
de despliegue (Google OAuth en "Producción") surgido al publicar la primera
instancia.

## Summary

Agrega dos páginas públicas, `/privacy` y `/terms`, en un grupo de rutas
nuevo `app/(legal)/`, fuera del layout protegido de `(workspace)`. Las dos
son Server Components con texto estático en inglés.

Las páginas solo varían en el nombre y el email del operador. Esos datos se
leen **en tiempo de ejecución** de dos variables de entorno opcionales,
`OPERATOR_NAME` y `OPERATOR_CONTACT_EMAIL`, mediante `await connection()`.
Así cambiar esos valores no exige recompilar y una misma imagen sirve para
varias instancias. Si faltan, se usa un texto de reemplazo.

La lógica de resolución del operador vive en un módulo puro con tests,
`lib/legal.ts`. Las pantallas de iniciar sesión y crear cuenta suman un pie
con enlaces a las dos páginas (en una pestaña nueva, para no perder el
formulario). La de crear cuenta suma además el aviso de aceptación.

No hay cambios de esquema, ni Server Actions nuevas, ni dependencias nuevas.
Ver [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 20+ (sin cambios).

**Primary Dependencies**: Next.js 16 (App Router, Server Components,
`connection()` de `next/server`), React 19, Tailwind. No se agrega ninguna
dependencia; en particular, no se usa MDX ni un renderizador de markdown
para el texto legal (research.md § Contenido como JSX). Guías de Next.js
leídas: `01-app/02-guides/environment-variables.md` § Runtime Environment
Variables y `01-app/02-guides/self-hosting.md`.

**Storage**: N/A. **Sin cambios de esquema ni migraciones.** Las páginas no
leen la base de datos.

**Testing**:

- **Vitest (unidad):** `tests/unit/legal.test.ts` para `getOperator`: ambos
  valores presentes, cada uno ausente, valores vacíos o solo espacios,
  email inválido tratado como ausente.
- **Playwright (e2e):** `tests/e2e/legal-pages.spec.ts`, con los bloques
  1 a 3 de [quickstart.md](quickstart.md): acceso sin sesión, enlaces
  desde iniciar sesión y crear cuenta, y enlaces cruzados. No necesita
  crear usuarios; solo el bloque de "con sesión" usa el helper de login
  existente.

**Target Platform**: Web, el mismo Web Service de Render
(`https://kanban-3nt0.onrender.com`). Sin orden de despliegue especial.

**Project Type**: Aplicación web monolítica (sin cambios).

**Performance Goals**: Páginas de texto sin consultas; se renderizan en el
servidor por petición (costo despreciable).

**Constraints**:

1. **Públicas de verdad (SC-002):** fuera de `app/(workspace)/`, cuyo layout
   llama a `requireSession()`. No hay middleware/proxy que proteja otras
   rutas, así que no hace falta ninguna excepción.
2. **Variables leídas en ejecución, no inlineadas en el build:** sin prefijo
   `NEXT_PUBLIC_` y con `await connection()` antes de leerlas
   (research.md § Lectura en tiempo de ejecución).
3. **Opcionales:** a diferencia de `DATABASE_URL`, `RESEND_API_KEY` y
   `BETTER_AUTH_SECRET`, la app MUST arrancar sin ellas (spec Edge Cases).
4. **Sin datos de proyectos:** las páginas no llaman a `getSession` ni a
   nada de `lib/permissions.ts`. El enlace "volver" apunta a `/`, que ya
   redirige a iniciar sesión o muestra los proyectos (FR-008).

**Scale/Scope**: 1 feature, 3 historias, 10 requisitos funcionales. Toca:

- 2 rutas nuevas (`/privacy`, `/terms`) con un layout compartido.
- 1 módulo puro nuevo (`lib/legal.ts`).
- 1 componente nuevo (`LegalLinks`), usado en 2 páginas de autenticación.
- `.env.example` y `README.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | Páginas legibles en celular y escritorio (FR-010), con la misma tipografía y tema oscuro de la app. Los enlaces desde las pantallas de acceso abren en otra pestaña y no pierden el formulario (US3 escenario 3). |
| II. Colaboración sin Límites | PASS | Sin efecto. La política describe que los miembros de un proyecto ven nombre y email de los demás, sin cambiar ese comportamiento. |
| III. Jerarquía de Datos Consistente | PASS | No toca el modelo. |
| IV. Aislamiento y Seguridad de Datos | PASS | Las páginas no leen datos de usuarios ni de proyectos. El email del operador lo publica el propio operador a propósito. No se exponen ids. |
| V. Código Abierto / Sin Bloqueo | PASS | Sin dependencias nuevas. El texto no nombra proveedores concretos como obligatorios: habla de "proveedor de base de datos, de emails y de hosting", así sirve a cualquier self-hoster. El login con Google es un requisito existente de la constitución (Estándares § Autenticación), no un bloqueo nuevo. |
| VI. Simplicidad y Alcance Enfocado (YAGNI) | PASS | Nace de una necesidad confirmada (publicar el login con Google). Sin MDX, sin texto configurable, sin i18n, sin banner de cookies, sin autoborrado de cuenta. Solo dos variables de configuración. |
| Estándares § Auditoría | PASS | No aplica: no hay escrituras sobre Work Items. |
| Estándares § Roles | PASS | No aplica: no hay acciones nuevas. `tests/unit/action-permissions.test.ts` no cambia. |

Sin violaciones: la tabla de Complexity Tracking no aplica.

**Re-check post-diseño (Fase 1)**: se mantiene PASS. El diseño confirmó que
no hace falta ningún cambio de esquema ni ninguna Server Action, y que las
rutas nuevas quedan fuera del layout protegido sin tocar la autenticación.

## Project Structure

### Documentation (this feature)

```text
specs/010-legal-pages/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — ubicación de rutas, lectura en ejecución, contenido como JSX, enlaces en pestaña nueva, fecha de actualización
├── data-model.md        # Phase 1 — sin esquema; configuración del operador
├── quickstart.md        # Phase 1 — validación end-to-end + pasos en Google Cloud
├── contracts/
│   └── legal-pages.md   # rutas públicas, variables de entorno, módulo puro, componente LegalLinks
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks) — no creado por este comando
```

### Source Code (repository root)

```text
app/(legal)/
├── layout.tsx                  # NUEVO: contenedor de lectura (ancho máximo, padding, "← Back to Kanban" a "/")
├── privacy/page.tsx            # NUEVO: Server Component; await connection() → getOperator() → texto de FR-003/FR-004
└── terms/page.tsx              # NUEVO: Server Component; await connection() → getOperator() → texto de FR-005

app/(auth)/
├── sign-in/page.tsx            # MODIFICADO: <LegalLinks /> al pie
└── sign-up/page.tsx            # MODIFICADO: <LegalLinks consent /> al pie (aviso de aceptación + enlaces)

lib/
└── legal.ts                    # NUEVO (puro): getOperator(env), LEGAL_LAST_UPDATED

components/legal/
└── LegalLinks.tsx              # NUEVO: enlaces Privacy/Terms en pestaña nueva; variante `consent`

.env.example                    # MODIFICADO: OPERATOR_NAME, OPERATOR_CONTACT_EMAIL (opcionales)
README.md                       # MODIFICADO: variables nuevas + nota "no es asesoría legal" + paso de Google "Publish app"

tests/
├── unit/legal.test.ts          # NUEVO: getOperator
└── e2e/legal-pages.spec.ts     # NUEVO: quickstart.md bloques 1-3
```

**Structure Decision**: Es el mismo monolito Next.js. Un grupo de rutas
propio, `(legal)`, junto a `(auth)` y `(workspace)`, deja claro que es
público y le da un layout de lectura sin el shell de la app. La única lógica
con casos borde (la resolución del operador y sus reemplazos) vive en un
módulo puro con tests; las páginas solo presentan texto.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
