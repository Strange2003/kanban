# Implementation Plan: Detalle colaborativo de Work Item

**Branch**: `codex/012-work-item-discussion` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

## Summary

Extender la vista dedicada de 006 con composición de dos columnas, comentarios, estimación y entradas de tiempo. Reutilizar `requireProjectPermission`, `logActivity`, `getWorkItemDetailData`, Drizzle y los campos existentes. Mantener la auditoría en una pestaña secundaria. Añadir `app/icon.svg` mediante la convención de Next 16.

## Technical Context

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Drizzle/Postgres.
- Server Actions en `lib/actions/`; cada exportación es un endpoint público y valida entrada, membresía y rol.
- Datos en `db/schema.ts`; migración Drizzle `0007`; aplicar primero en Neon `dev`, y producción antes del despliegue.
- Vitest para reglas y permisos; Playwright para flujos cuando se autorice e2e sobre `.env.local`.

## Constitution Check

| Principio | Decisión |
| --- | --- |
| UX primero | Encabezado y contenido priorizados, lateral compacto y feedback de guardado/publicación. |
| Colaboración | Comentarios de todo miembro, sin límites por proyecto. |
| Jerarquía | Comentarios y tiempo pertenecen al WI; relaciones siguen navegables. |
| Aislamiento | Lecturas con membresía; escrituras con `requireProjectPermission`; FKs en cascada. |
| Sin bloqueo | Sin APIs de Git/CI ni proveedor externo. |
| YAGNI | Solo campos solicitados, texto plano, sin adjuntos. |
| Auditoría | Eventos conservados y accesibles en Historial, separados de comentarios. |

## Project Structure

- `db/schema.ts`, `db/migrations/0007_*.sql`: estimate, comentarios y tiempo.
- `lib/actions/work-item-discussion.ts`: crear comentario y administrar entradas de tiempo.
- `lib/actions/work-item-relationships.ts`: incluir discusión y tiempo en carga del detalle.
- `lib/actions/work-items.ts`: editar estimación con campos existentes.
- `components/work-items/WorkItemDetailView.tsx`: nuevo layout, discusión, horas y pestaña Historial.
- `app/icon.svg`: icono de la app.
- `tests/unit/`, `tests/e2e/`: aislamiento, roles, sumas y flujos.

## Research Decisions

Ver [research.md](research.md) y [data-model.md](data-model.md). Se extiende la ruta actual, con carga del servidor por navegación.
