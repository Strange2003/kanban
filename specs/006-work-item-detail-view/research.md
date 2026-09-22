# Research: Vista de Detalle de Work Item

No queda ningún `NEEDS CLARIFICATION` en el Technical Context del plan. Esta
feature requiere resolver tres decisiones técnicas propias: el esquema de
URL, cómo reemplazar el modal por navegación real, y cómo cargar los datos
iniciales de la página.

## Decisión: Esquema de URL

**Decision**: `/projects/[projectPublicId]/work-items/[displayNumber]`,
donde `displayNumber` es el correlativo numérico del Work Item dentro de su
proyecto (el mismo número que ya se combina con el prefijo del proyecto para
formar el `displayId` visible, ej. "KAN-42" → `displayNumber = 42`) — no el
`id` interno serial de `work_items`.

**Rationale**: El proyecto ya es un segmento de la URL (`projectPublicId`),
así que el prefijo del `displayId` es redundante ahí — alcanza con el
número. Esto es consistente con la excepción ya documentada en
[001-accounts-invitations/research.md § Identificadores públicos](../001-accounts-invitations/research.md#decisión-identificadores-públicos):
los Work Items usan un correlativo legible por proyecto en vez de un
`publicId` nanoid, precisamente para URLs/IDs visibles como esta. Usar el
`id` interno en la URL en cambio sí violaría el Principio IV (no exponer la
clave primaria interna/secuencial), porque ese `id` es un contador global de
toda la tabla `work_items`, no scopeado por proyecto como el `displayNumber`.

**Alternatives considered**:
- Usar el `id` interno serial: más simple de resolver (una sola columna
  indexada, sin filtrar por proyecto), pero expone cuántos Work Items
  existen en total en el sistema entre todos los proyectos — exactamente lo
  que el Principio IV busca evitar, y lo que ya se evitó para Proyectos,
  Stages e Invitaciones con `publicId`.
- Usar el `displayId` completo ("KAN-42") como un único segmento de ruta:
  funciona igual de bien, pero obliga a parsear el prefijo del string en el
  servidor sin ningún beneficio — el prefijo no aporta información nueva
  dentro de una URL que ya tiene el proyecto como segmento padre.

## Decisión: Reemplazar el modal por navegación real

**Decision**: `WorkItemCard.tsx` deja de manejar un estado local `open`
para un `<Dialog>`; su `onClick` ahora llama a `router.push` (App Router,
`next/navigation`) hacia la nueva ruta. `WorkItemDetailPanel.tsx` se elimina
— su contenido (formulario de campos, sección de relaciones, actividad) se
traslada a un nuevo componente cliente (`WorkItemDetailView.tsx`) que renderiza
la página dedicada, sin el wrapper `<Dialog>`.

**Rationale**: La tarjeta ya distingue clic de arrastre mediante el
`activationConstraint: { distance: 8 }` del `PointerSensor` de dnd-kit — un
clic sin desplazamiento significativo llega al `onClick` normal, igual que
hoy abre el modal. Cambiar qué hace ese `onClick` (navegar en vez de abrir un
diálogo) es el cambio mínimo que logra FR-002, sin anidar un `<Link>` dentro
de un elemento ya interactivo (`role="button"`, con los listeners de
arrastre de dnd-kit encima) — anidar interactivos ahí complicaría el manejo
de eventos y la semántica de accesibilidad sin necesidad.

**Alternatives considered**:
- Envolver la tarjeta completa en un `<Link>` de Next.js: más "idiomático"
  para navegación pura, pero un `<a>` envolviendo un elemento con sus
  propios listeners de puntero (dnd-kit) y `role="button"` propio es un caso
  de anidamiento de interactivos que vale la pena evitar; `router.push` en
  el mismo `onClick` que ya existe logra el mismo resultado sin ese riesgo.
- Mantener el modal como capa de transición y navegar por debajo: se
  descartó explícitamente en la clarificación de spec.md (reemplazo
  completo, no coexistencia).

## Decisión: Navegación entre relaciones vía `<Link>`, no estado local

**Decision**: Dentro de `WorkItemDetailView.tsx`, cada padre/hijo/relacionado
listado se renderiza como un `<Link>` real hacia
`/projects/[projectPublicId]/work-items/[displayNumber]` de ese otro Work
Item — no como un botón que reemplaza el contenido del componente actual
(que es como funciona hoy `WorkItemDetailPanel`'s `navigateTo`/`activeWorkItem`).

**Rationale**: Con una URL real por Work Item, dejar que el navegador maneje
la navegación entre ellos da el botón atrás (FR-006) gratis, sin ningún
estado de "historial" propio en el cliente. Esto además **elimina por
completo** el estado `activeWorkItem` y la función `navigateTo` que hoy
existen en `WorkItemDetailPanel.tsx` únicamente para simular esa navegación
dentro de un mismo diálogo — el nuevo componente es más simple que el que
reemplaza, no solo funcionalmente equivalente.

**Alternatives considered**:
- Mantener un estado de "Work Item activo" en el cliente y actualizar la URL
  manualmente con `history.pushState` sin recargar: reimplementa a mano lo
  que `<Link>`/`router.push` de Next.js ya dan de fábrica; sin justificación
  (Principio VI).

## Decisión: Carga de datos de la página

**Decision**: La página (`page.tsx`, Server Component) resuelve el Work
Item en dos pasos, ambos ejecutados en el propio servidor durante el render
(no son llamadas de cliente):
1. `getWorkItemByDisplayNumber(projectPublicId, displayNumber)` (nueva,
   en `lib/actions/work-items.ts`) — verifica membresía, busca el Work Item
   por `(projectId, displayNumber)`, y da `NOT_FOUND` si no existe.
2. `getWorkItemDetailData(workItem.id, projectPublicId)` (ya existente de
   005-work-item-relationships) — trae tags, actividad, relaciones y el
   catálogo de Work Items para los selectores, en una sola función.

**Rationale**: Esto es exactamente el mismo patrón que ya usa
`app/(workspace)/projects/[projectPublicId]/page.tsx` con `getBoard`: un
Server Component llamando directo a una función server-side, sin pasar por
el límite de red cliente-servidor. La restricción encontrada en
[005-work-item-relationships/research.md § Hallazgo](../005-work-item-relationships/research.md)
(Server Actions consecutivas desde el **cliente** se cuelgan
intermitentemente) no aplica acá — ahí el problema era específicamente
llamadas iniciadas por el navegador; dos funciones `async` llamándose en
cadena dentro de un mismo Server Component es composición de funciones
normal en el mismo proceso, no una segunda petición de red.

**Alternatives considered**:
- Una única función combinada `getWorkItemDetailPageData(projectPublicId,
  displayNumber)` que internamente resuelva y agregue todo: técnicamente
  equivalente, pero acopla la resolución de ruta (una preocupación de esta
  feature) con el agregador de datos ya existente de 005 (una preocupación
  de esa feature) en una sola función nueva. Separarlas dos llamadas
  reutiliza `getWorkItemDetailData` tal cual está, sin tocarlo.

## Hallazgo: clics justo después de una navegación se pierden intermitentemente

**Contexto**: al escribir los tests e2e de esta feature (y adaptar los de
004/005 al reemplazo del modal), varios tests fallaban de forma intermitente
en pasos que a simple vista no deberían fallar nunca: un clic en una tarjeta
recién renderizada no navegaba, o un clic en "Back to board" no volvía al
tablero — dejando al test operando sobre la pantalla equivocada (con
consecuencias confusas, como que `getByRole("button", { name: "Delete" })`
sin `exact: true` terminara matcheando el botón "Delete column" del tablero
en vez del botón de la vista de detalle, porque **ese** sí seguía presente).
Investigado con capturas y HTML en vivo, se confirmó que el clic físico se
despacha correctamente pero React todavía no había terminado de adjuntar el
handler `onClick` a ese nodo exacto — una carrera de hidratación en
navegaciones del lado cliente (`router.push`), no un bug de lógica.

**Decision**: los helpers de test que abren una tarjeta (`openCard`) y
vuelven al tablero (`backToBoard`) reintentan el clic hasta 3 veces,
esperando a que la URL realmente cambie después de cada intento, en vez de
confiar en un único clic despachado. Ambos son navegaciones puras
(`router.push`/`<Link>`), así que reintentar es inofensivo. Para el botón
"Delete" → "Confirm" (un toggle de estado local, también idempotente) se
usa el mismo patrón vía `clickUntilVisible`. Para botones que sí disparan
una Server Action no idempotente (`Set`, `Link`, `Save`), en cambio, la
solución es un timeout más generoso en la aserción del resultado (15s), no
reintentar el clic — reintentar ahí arriesga un doble envío contra un
botón que ya se deshabilita mientras la petición está en curso.

**Rationale**: Este hallazgo es ortogonal al de 005 (Server Actions
encadenadas desde el cliente) — ese era sobre *cuántas* peticiones de red
concurrentes tolera este servidor de desarrollo; este es sobre *cuándo*
un nodo del DOM recién renderizado está realmente listo para recibir
eventos. Ambos son características de este entorno de desarrollo
específico (Next.js 16.3.5 canary + React 19), confirmadas también en una
máquina distinta a la de este sandbox, y ninguno de los dos es un defecto
en la lógica de negocio implementada (verificada además por separado
mediante consultas directas a la base de datos).

**Alternatives considered**:
- Agregar una espera fija (`waitForTimeout`) después de cada navegación:
  más simple, pero o bien es demasiado corta (no soluciona nada) o
  demasiado larga (ralentiza toda la suite sin necesidad la mayoría de las
  veces). Reintentar condicionado a que el efecto esperado (URL, elemento)
  realmente ocurra es más robusto y no penaliza el caso feliz.
- Ignorar el problema y aceptar la suite como "flaky": se descartó porque
  varias de estas fallas señalaban una causa real y diagnosticable (no
  aleatoriedad pura), y dejarlas sin investigar habría ocultado el defecto
  de las aserciones sin `exact: true` (una ambigüedad real de accesibilidad
  entre "Delete" y "Delete column" que vale la pena tener resuelta en los
  tests, más allá de esta causa raíz puntual).
