# Quickstart: Páginas Legales Públicas

Guía de validación end-to-end. Contratos en
[contracts/legal-pages.md](contracts/legal-pages.md).

## Prerrequisitos

- `.env.local` apuntando a la base de **dev** (el e2e trunca la base).
- Para los bloques 1 a 3, agregar en `.env.local`:
  ```bash
  OPERATOR_NAME="Test Operator"
  OPERATOR_CONTACT_EMAIL="operator@example.com"
  ```
- `npm run dev` corriendo en `http://localhost:3000`.

## Bloque 1 — Acceso sin sesión (US1, US2, SC-002)

1. En una ventana privada, abrir `/privacy`.
   - **Esperado:** carga (no redirige a `/sign-in`); título "Privacy Policy";
     "Last updated: …"; aparece "Test Operator" y un enlace
     `mailto:operator@example.com`.
   - Revisar punto por punto que están todas las secciones de FR-003 de
     010-legal-pages (SC-005), usando la tabla de [data-model.md](data-model.md).
2. Abrir `/terms`. **Esperado:** carga sin sesión, con las secciones de FR-005
   y un enlace a `/privacy`.
3. Desde `/privacy`, seguir el enlace a Terms y volver; seguir "← Back to
   Kanban". **Esperado:** sin sesión, termina en `/sign-in`.

## Bloque 2 — Enlaces desde las pantallas de acceso (US3, SC-003)

1. En `/sign-in`: **esperado** enlaces "Privacy Policy" y "Terms of Service";
   cada uno abre una pestaña nueva con la página correcta.
2. En `/sign-up`: escribir un nombre y un email, hacer clic en "Terms of
   Service". **Esperado:** se abre en pestaña nueva y, al volver a la
   pestaña original, el formulario conserva lo escrito. Se ve el aviso "By
   creating an account or continuing with Google, you agree…".

## Bloque 3 — Con sesión (US1 escenario 2)

1. Iniciar sesión y abrir `/privacy`. **Esperado:** el mismo contenido;
   "← Back to Kanban" lleva a los proyectos.

## Bloque 4 — Operador sin configurar (Edge Cases)

1. Quitar `OPERATOR_NAME` y `OPERATOR_CONTACT_EMAIL` de `.env.local` y
   reiniciar `npm run dev`. **Esperado:** la app arranca; `/privacy` dice
   "the operator of this instance" y no muestra ningún `mailto:`.
2. Poner `OPERATOR_CONTACT_EMAIL="not-an-email"`. **Esperado:** mismo
   comportamiento que si faltara.

(Cubierto por `tests/unit/legal.test.ts`; aquí es la verificación manual.)

## Bloque 5 — Producción y Google (SC-001)

1. En Render, agregar `OPERATOR_NAME` y `OPERATOR_CONTACT_EMAIL`, desplegar
   la branch y abrir `https://kanban-3nt0.onrender.com/privacy` sin sesión.
2. En Google Cloud → Google Auth Platform → Información de la marca:
   - Página principal: `https://kanban-3nt0.onrender.com`
   - Política de privacidad: `https://kanban-3nt0.onrender.com/privacy`
   - Condiciones del servicio: `https://kanban-3nt0.onrender.com/terms`
   - Sin logotipo (evita la verificación).
3. Público → **Publicar app**. **Esperado:** pasa a "En producción".
4. Con una cuenta de Google que **no** esté en usuarios de prueba, usar
   "Continue with Google" en prd. **Esperado:** inicia sesión.

## Tests automáticos

```bash
npm test -- legal
```

```bash
npx dotenv -e .env.local -- playwright test tests/e2e/legal-pages.spec.ts
```
