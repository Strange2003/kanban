# Research: Animaciones de Carga y un Esqueleto por Página

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

El stack (Next.js 16 App Router, React 19, Tailwind 4) no se reevalúa. Estas son
las decisiones propias de 015.

## 1. Un `loading.tsx` por página

**Decision**: Añadir `loading.tsx` en cada segmento que carga datos:
`work-items/[displayNumber]`, `list`, `table`, `settings`, `settings/catalogs`
(bajo `projects/[projectPublicId]`), `my-work` y `settings/agents`. El
`loading.tsx` actual de `projects/[projectPublicId]` queda solo para el tablero.

**Rationale**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`:
un `loading.js` "wraps the `page.js` file and any children below in a
`<Suspense>` boundary". Por eso hoy el detalle, List, Table, Settings y Catálogos
heredan el esqueleto del tablero. El `loading.js` más cercano a la página que
cambia es el que se muestra (el nuevo límite de Suspense se monta con su
fallback), y el fallback se precarga con el prefetch del `<Link>`, así que
aparece al instante.

**Alternatives considered**:
- Un único `loading.tsx` que elige el esqueleto según `usePathname()`: un solo
  archivo, pero mezcla ocho formas en un componente y rompe la convención de
  Next; y el prefetch del fallback es por segmento de todas formas.
- Mover las páginas a grupos de rutas para aislar el `loading.tsx` del tablero:
  cambia URLs internas y estructura sin beneficio sobre la opción elegida.

## 2. Número de columnas recordado

**Decision**: `localStorage`, clave `kanban:board-columns:<projectPublicId>`,
valor entero. `Board` lo escribe en un `useEffect` cada vez que cambia su número
de columnas. `BoardSkeleton` pasa a ser Client Component: toma el
`projectPublicId` con `useParams()` y lee el valor con `useSyncExternalStore`
(snapshot de servidor = 3). Lectura y escritura con `try/catch`; valor fuera de
`1..8` → se acota (0 o inválido → 3; > 8 → 8). La lógica pura (clave, acotado,
lectura/escritura sobre un `Storage` inyectable) vive en
`lib/board-column-memory.ts`, testeable en Vitest (entorno `node`).

**Rationale**: FR-001/FR-002 de la spec piden memoria en el navegador, por
proyecto, sin servidor. `useSyncExternalStore` con `getServerSnapshot` evita el
error de hidratación en una recarga completa (el servidor pinta 3 y el cliente
se ajusta), que es el caso límite descrito en la spec. `useParams` funciona en
el fallback de `loading.tsx` porque se renderiza dentro del segmento dinámico.

**Alternatives considered**:
- Cookie leída en `loading.tsx` con `cookies()`: haría dinámico el fallback, que
  entonces ya no se puede precargar con el prefetch (se perdería el "al
  instante"), y enviaría el dato en cada petición.
- Guardar el número en el servidor (columna o tabla): innecesario para una
  preferencia de presentación desechable (Principio VI).
- Pasar el número por el enlace de la barra lateral: no cubre los otros puntos
  de entrada (búsqueda, My work, notificaciones, enlace directo).

## 3. Animaciones solo con CSS

**Decision**: Keyframes en `app/globals.css` (`kb-fall`, `kb-land`,
`kb-appear`) y clases utilitarias (`kb-skeleton`, `kb-fall`, `kb-land`), con los
retrasos pasados como variable CSS inline (`--kb-delay`). Todo el movimiento se
declara dentro de `@media (prefers-reduced-motion: no-preference)`; fuera de
ella los esqueletos quedan estáticos y el contenido aparece sin desplazamiento
(FR-009). Sin dependencias (FR-013).

**Rationale**: Es lo que valida el prototipo aprobado; el navegador lo compone
en GPU (opacity + translate) sin JavaScript en el hilo principal mientras carga.

**Alternatives considered**: `framer-motion`/`motion` (dependencia nueva para
tres keyframes; rechazada por FR-013 y Principio VI); View Transitions (fuera de
alcance según la spec).

## 4. Aparición diferida (~150 ms)

**Decision**: El contenedor del esqueleto (`.kb-skeleton`) arranca con
`opacity: 0` vía `animation: kb-appear 180ms ease-out 150ms backwards`. Esta
aparición aplica también con "reducir movimiento" (es un fundido, no un
desplazamiento).

**Rationale**: Sin JavaScript ni temporizadores; si la página llega antes de
150 ms el esqueleto se desmonta sin haberse visto (FR-008, SC-003). `backwards`
solo aplica el primer fotograma durante el retraso, y al terminar no deja nada
fijado.

**Alternatives considered**: un `useEffect` con `setTimeout` que monta el
esqueleto: requiere Client Component en todos los esqueletos y parpadea si la
hidratación se retrasa.

## 5. Entrada del tablero sin repetir

**Decision**: `Board` monta con un estado `entering = true` que pone la clase
`kb-board-entering` en su contenedor y la quita a los 600 ms. Solo bajo esa clase
las tarjetas (`[data-kb-land]`) y encabezados de columna ejecutan `kb-land`,
con retraso `--kb-delay = min(columna·40 + posición·30, 200) ms` y duración
260 ms (total ≤ 460 ms < 500 ms, FR-004/SC-004). La animación usa la propiedad
CSS individual `translate` (no `transform`) y `animation-fill-mode: backwards`.

**Rationale**:
- Una tarjeta nueva, movida a otra columna (se vuelve a montar en otro
  `StageColumn`) o filtrada no anima, porque la clase ya no está (FR-005).
  `router.refresh()` no desmonta `Board`, así que tampoco la repite.
- `@dnd-kit` escribe `transform` inline en tarjetas y columnas; una animación de
  `transform` lo pisaría mientras corre y, con `forwards`, para siempre.
  `translate` es una propiedad independiente que se compone con `transform`, y
  `backwards` no deja estilos fijados al terminar.

**Alternatives considered**: animar solo si el esqueleto llegó a verse (no hay
forma fiable de saberlo desde `Board` sin estado global; la entrada es corta
e inofensiva también en cargas rápidas); animar un contenedor por columna
(pierde el escalonado por tarjeta que eligió el usuario).

## 6. Accesibilidad de los esqueletos

**Decision**: La raíz de cada esqueleto lleva `role="status"`,
`aria-busy="true"` y un texto solo para lectores ("Loading board…",
"Loading Work Item…", etc.); los bloques decorativos van con `aria-hidden`.

**Rationale**: FR-012: un lector de pantalla anuncia que carga, no una lista de
cajas vacías.
