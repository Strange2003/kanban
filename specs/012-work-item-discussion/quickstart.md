# Quickstart: verificación manual

1. En una base de desarrollo aislada, aplicar `npm run db:migrate` y arrancar `npm run dev`.
2. Crear proyecto y WI. Comprobar encabezado, descripción, panel lateral y relaciones en escritorio y 390 px.
3. Guardar estimación de 8 h, registrar 1.5 h y 0.5 h; total 2 h. Borrar la entrada propia de 1.5 h; queda 0.5 h.
4. Publicar comentario como Member y Viewer; ambos aparecen con autor y fecha. Viewer no edita campos ni registra tiempo.
5. Abrir Historial: eventos técnicos separados de la conversación. Volver a Detalles.
6. Abrir WI como no miembro: sin lectura ni escritura. Confirmar icono del navegador.

**Advertencia**: `tests/e2e/setup.ts` trunca la base indicada por `.env.local`; confirmar explícitamente la base antes de Playwright.
