# Quickstart: Animaciones de Carga y un Esqueleto por Página

**Feature**: [spec.md](spec.md) · **Contract**: [contracts/loading-states.md](contracts/loading-states.md)

## Prerrequisitos

- `npm install`, `.env.local` apuntando a la rama Neon `dev`.
- `npm run dev`, sesión iniciada, un proyecto con 5 columnas y algunos Work
  Items, y otro nunca abierto en este navegador.
- DevTools → Network → throttling "Slow 4G" (o "3G") para ver los esqueletos.

## 1. Tablero

1. Abre el proyecto de 5 columnas, ve a My work y vuelve a abrirlo con la red
   ralentizada → el esqueleto muestra **5 columnas** con siluetas que caen en
   bucle, con desfase entre columnas.
2. Al cargar → las tarjetas aterrizan escalonadas por columna; todo termina en
   menos de medio segundo.
3. Arrastra una tarjeta, crea un Work Item y aplica un filtro → nada repite la
   animación de entrada.
4. Abre el proyecto nunca visitado → el esqueleto muestra **3 columnas**.
5. Añade una columna al primer proyecto, sal y vuelve → el esqueleto muestra 6.

## 2. Un esqueleto por página

Con la red ralentizada, abre y comprueba que ninguno muestra columnas de tablero:

1. Un Work Item desde el tablero → cabecera con ID/título/pestañas, columna de
   campos y cuerpo.
2. List y Table → filas (y encabezados en Table).
3. Settings y "Manage tags, areas & sizes" → secciones con filas.
4. My work y el icono de agentes (Connected agents) → su propia forma.

## 3. Sin parpadeo y "reducir movimiento"

1. Sin throttling, navega entre tablero, List y un Work Item → no aparece ningún
   esqueleto en cargas rápidas.
2. Activa "Reducir movimiento" en el sistema (macOS: Accesibilidad → Pantalla)
   o en DevTools → Rendering → "prefers-reduced-motion: reduce", repite 1.1 y
   2.1 → esqueletos quietos, tarjetas sin aterrizaje.
3. Cambia a tema claro y oscuro → los esqueletos se ven bien en ambos.

## Automático

```bash
npm run test -- board-column-memory loading-states
```

```bash
npx dotenv -e .env.local -- playwright test tests/e2e/loading-states.spec.ts
```

(El e2e trunca la base de `.env.local`: solo contra la rama `dev`.)
