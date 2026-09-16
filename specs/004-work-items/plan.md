# Implementation Plan: Work Items

**Branch**: `004-work-items` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

Esta feature forma parte de la Fase 1, que se planificó como un único
codebase/deploy junto con
[001-accounts-invitations](../001-accounts-invitations/spec.md),
[002-project-spaces](../002-project-spaces/spec.md) y
[003-kanban-board](../003-kanban-board/spec.md).

El plan técnico completo (Technical Context, Constitution Check, estructura
del proyecto, y las Acciones Manuales Requeridas) vive en
**[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md)**
para evitar repetir la misma investigación cuatro veces.

Lo específico de esta feature:

- **research.md**: ver especialmente la decisión "Identificadores públicos"
  (formato `PREFIJO-N`) en
  [001-accounts-invitations/research.md](../001-accounts-invitations/research.md).
- **data-model.md**: entidades `Work Item`, `Tag` y `WorkItemTag`,
  documentadas en
  [001-accounts-invitations/data-model.md](../001-accounts-invitations/data-model.md#work-item-work_items).
- **contracts/**: [001-accounts-invitations/contracts/work-items.md](../001-accounts-invitations/contracts/work-items.md).
- **quickstart.md**: bloque 4 de
  [001-accounts-invitations/quickstart.md](../001-accounts-invitations/quickstart.md#4-work-items-spec).
