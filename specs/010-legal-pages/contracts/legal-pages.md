# Contract: Páginas Legales Públicas

## Rutas públicas

| Ruta | Archivo | Sesión | Render |
|---|---|---|---|
| `GET /privacy` | `app/(legal)/privacy/page.tsx` | no requerida; con o sin sesión muestra lo mismo | dinámico (`await connection()`) |
| `GET /terms` | `app/(legal)/terms/page.tsx` | no requerida | dinámico |

- Responden 200 sin sesión. Nunca redirigen a `/sign-in` (SC-002).
- `metadata.title`: `"Privacy Policy · Kanban"` y `"Terms of Service · Kanban"`.
- Cada página enlaza a la otra y a `/` ("← Back to Kanban") desde el layout (FR-008).
- Muestran `Last updated: <LEGAL_LAST_UPDATED>` bajo el título.
- `/privacy` contiene una sección por punto de FR-003 de 010-legal-pages, en
  este orden: Who runs this instance · Data we store · How we use it · Who
  can see it · Service providers · What we don't do · Cookies · Keeping and
  deleting your data · Changes · Contact. La sección de Google cumple FR-004.
- `/terms` contiene los puntos de FR-005 de 010-legal-pages.

## Variables de entorno (opcionales)

| Variable | Ejemplo | Uso |
|---|---|---|
| `OPERATOR_NAME` | `Daniel Elis` | responsable de los datos en ambas páginas |
| `OPERATOR_CONTACT_EMAIL` | `privacy@example.com` | `mailto:` para consultas y pedidos de borrado |

Se leen en ejecución (no hace falta recompilar). La app arranca sin ellas.

## Módulo puro `lib/legal.ts`

```ts
export type Operator = { name: string | null; contactEmail: string | null };

/** Resolves the instance operator from env-like input; invalid/blank → null. */
export function getOperator(env: Record<string, string | undefined>): Operator;

/** ISO date (YYYY-MM-DD) the legal text last changed. Bump it with every text edit. */
export const LEGAL_LAST_UPDATED: string;
```

- Sin imports de servidor: probable en Vitest pasando un objeto.
- Las páginas lo llaman como `getOperator(process.env)` después de `await connection()`.

## Componente `components/legal/LegalLinks.tsx`

```ts
function LegalLinks(props: { consent?: boolean }): JSX.Element;
```

- Sin `consent`: `Privacy Policy · Terms of Service`, texto chico y atenuado.
- Con `consent`: `By creating an account or continuing with Google, you agree
  to the Terms of Service and acknowledge the Privacy Policy.`, con los dos
  enlaces dentro del texto.
- Enlaces con `target="_blank" rel="noopener noreferrer"` (research.md §
  Enlaces en pestaña nueva).
- Uso: `sign-in/page.tsx` → `<LegalLinks />`; `sign-up/page.tsx` →
  `<LegalLinks consent />`, en ambos casos al final de `<main>`.

## Fuera del contrato

- No hay Server Actions nuevas; `tests/unit/action-permissions.test.ts` no cambia.
- No hay cambios en `lib/auth.ts`.
