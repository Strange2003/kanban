# Implementation Plan: Tablero Kanban (Columnas/Stages)

**Branch**: `003-kanban-board` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

Esta feature forma parte de la Fase 1, que se planificó como un único
codebase/deploy junto con
[001-accounts-invitations](../001-accounts-invitations/spec.md),
[002-project-spaces](../002-project-spaces/spec.md) y
[004-work-items](../004-work-items/spec.md).

El plan técnico completo (Technical Context, Constitution Check, estructura
del proyecto, y las Acciones Manuales Requeridas) vive en
**[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md)**
para evitar repetir la misma investigación cuatro veces.

Lo específico de esta feature:

- **research.md**: ver especialmente las decisiones "Drag-and-drop y estado
  optimista" y "Sincronización entre miembros" en
  [001-accounts-invitations/research.md](../001-accounts-invitations/research.md).
- **data-model.md**: entidad `Stage/Columna`, documentada en
  [001-accounts-invitations/data-model.md](../001-accounts-invitations/data-model.md#stagecolumna-stages).
- **contracts/**: [001-accounts-invitations/contracts/board.md](../001-accounts-invitations/contracts/board.md).
- **quickstart.md**: bloque 3 de
  [001-accounts-invitations/quickstart.md](../001-accounts-invitations/quickstart.md#3-tablero-kanban-spec).
