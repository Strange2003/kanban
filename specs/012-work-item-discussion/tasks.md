---
description: "Task list for 012-work-item-discussion"
---

# Tasks: Detalle colaborativo

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md)

- [x] T001 Definir `estimate_minutes`, `work_item_comments` y `work_item_time_entries` en `db/schema.ts`.
- [x] T002 Generar y revisar la migración `db/migrations/0007_*.sql` y metadatos, sin aplicarla a producción.
- [x] T003 [F12-US2] Implementar comentario y consulta segura en `lib/actions/work-item-discussion.ts` y `lib/actions/work-item-relationships.ts`.
- [x] T004 [F12-US3] Implementar estimación y auditoría en `lib/actions/work-items.ts`.
- [x] T005 [F12-US3] Implementar alta y borrado de tiempo en `lib/actions/work-item-discussion.ts`.
- [x] T006 [F12-US2] Agregar `workItem:comment` a `lib/roles.ts` y cobertura en `tests/unit/action-permissions.test.ts`.
- [x] T007 [F12-US1] Rediseñar `components/work-items/WorkItemDetailView.tsx` con encabezado, panel lateral, descripción, relaciones y discusión adaptable.
- [x] T008 [F12-US4] Mover auditoría a pestaña secundaria en `components/work-items/WorkItemDetailView.tsx`.
- [x] T009 [F12-US5] Añadir icono en `app/icon.svg`.
- [x] T010 [P] [F12-US2] Verificar comentarios y permisos en `tests/unit/work-item-discussion.test.ts` y `tests/e2e/work-item-discussion.spec.ts`.
- [x] T011 [P] [F12-US3] Verificar estimación, suma, borrado y permisos en `tests/unit/work-item-discussion.test.ts` y `tests/e2e/work-item-discussion.spec.ts`.
- [x] T012 Ejecutar ESLint, TypeScript, Vitest, build y revisión visual; actualizar `specs/012-work-item-discussion/tasks.md`.

La migración `0007` se aplicó a la base desechable de `.env.local`. Con autorización del usuario se ejecutaron 19 escenarios e2e afectados: 18 pasaron inicialmente y el único fallo fue un error de navegación del propio test, corregido y aprobado al repetirlo. La migración `0007` se aplicó después también a producción (2026-09-24), y la feature está desplegada en Render.
