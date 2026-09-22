# Implementation Plan: Roles y Permisos

**Branch**: `007-roles-permissions` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-roles-permissions/spec.md`

**Nota de alcance**: Esta feature extiende el mismo codebase y deploy de las
fases anteriores. El stack, la autenticación, el hosting y las convenciones
de testing ya decididos en
[001-accounts-invitations/plan.md](../001-accounts-invitations/plan.md) no
se vuelven a evaluar aquí. Lo que sí cambia es transversal: la verificación
de rol (hoy solo "es miembro" u "es owner") pasa a aplicarse a **todas** las
Server Actions de mutación de 001–005 según la matriz de permisos de la spec.

## Summary

Agrega un tercer rol, **Lector**, al enum de rol de membresía existente y
centraliza la matriz de permisos de la spec en un único módulo puro
(`lib/roles.ts`) que consumen tanto el servidor (helper
`requireProjectPermission`, que reemplaza a `requireProjectOwner` y se suma
a `requireProjectMember` en cada mutación) como la interfaz (para ocultar o
deshabilitar controles según el rol). El rol se lee de la base de datos en
cada acción — nunca de la sesión — así un cambio de rol aplica a la
siguiente acción sin cerrar sesión (SC-003). Las invitaciones pasan a llevar
el rol de ingreso; se agregan dos Server Actions nuevas (`changeMemberRole`,
`transferOwnership`) cuyas escrituras se serializan por proyecto, y la
invariante "exactamente un owner" (FR-002, SC-006) queda garantizada además
por un índice único parcial en la base de datos. Ver
[research.md](research.md) para cada decisión y sus alternativas descartadas.

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 20+ (sin cambios).

**Primary Dependencies**: Next.js 16 (App Router, Server Actions), React 19,
Drizzle ORM 0.45 + drizzle-kit, Better Auth (solo identidad/sesión — los roles
de proyecto no viven en él, ver research.md § Fuente única), zod 4, dnd-kit —
las ya instaladas; no se agrega ninguna dependencia nueva.

**Storage**: Neon (Postgres serverless). Cambios de esquema mínimos y
retrocompatibles: un valor nuevo (`viewer`) en el enum `project_role`, una
columna `role` en `invitations` (default `member`) y un índice único parcial
que impone un solo owner por proyecto — ver [data-model.md](data-model.md).
Sin migración de datos: las filas existentes ya son válidas (FR-015, SC-007).

**Testing**: Vitest (unidad: matriz de permisos exhaustiva, helper
`requireProjectPermission`, y un barrido tabla-por-tabla de todas las
Server Actions de mutación contra un Lector — SC-001/SC-002 — y las reglas
de `changeMemberRole`/`transferOwnership`) + Playwright
(e2e con varias cuentas: cambio de rol, modo lectura, invitar con rol,
transferir propiedad), mismas convenciones de
[001](../001-accounts-invitations/plan.md#technical-context).

**Target Platform**: Web, mismo deploy de Render. La migración debe correr
(`npm run db:migrate`) **antes** de desplegar el código nuevo — ver
research.md § Despliegue.

**Project Type**: Aplicación web monolítica (sin cambios).

**Performance Goals**: Cero costo perceptible añadido. La verificación de
rol reutiliza las dos consultas que ya hace `requireProjectMember` (proyecto
+ membresía); evaluar la matriz es una búsqueda en memoria O(1). Cambiar de
rol o transferir la propiedad se siente inmediato (SC-004: <15 s / <30 s de
punta a punta, dominado por la interacción humana, no por el servidor).

**Constraints**: (1) Principio IV — el rol se verifica en el servidor en
cada mutación; la interfaz solo refleja, nunca autoriza. (2) Un rechazo por
rol NO debe confundirse con "no eres miembro": las páginas convierten
`FORBIDDEN` en 404, así que se introduce un código propio
(`ROLE_NOT_PERMITTED`). (3) No encadenar una segunda Server Action desde el
cliente tras una mutación (lección de
[005 research.md § Hallazgo](../005-work-item-relationships/research.md)):
tras un rechazo por rol, el cliente usa `router.refresh()`, no otra acción.
(4) Ninguna dependencia ni concepto atado a un proveedor de Git/CI-CD
(Principio V).

**Scale/Scope**: 1 feature, 4 historias de usuario; toca 5 archivos de
Server Actions (todas las mutaciones de 001–005), ~8 componentes de UI, 1
migración y 1 módulo nuevo. Escala asumida: ≥100 miembros por proyecto con
roles mezclados (SC-008), sin cambios de consultas que dependan del número de
miembros.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. UX-First | PASS | Un Lector nunca ve controles que no puede usar: se ocultan las acciones estructurales (columnas, crear Work Item) y los campos del detalle pasan a solo lectura con un aviso visible del rol (research.md § Modo lectura). Tras un rechazo por rol (rol cambiado con la pantalla abierta) el cliente muestra el mensaje y se refresca a modo lectura sin acción adicional del usuario. La navegación de lectura (tarjetas → detalle → relaciones) no se degrada. |
| II. Colaboración sin Límites | PASS | Sin tope de miembros por rol ni total (FR-017); Owner **y Miembros** pueden invitar (Clarifications 2026-09-18). La clasificación Personal/Compartido sigue derivada del número de miembros, sin mirar el rol (FR-016). El límite de velocidad de invitaciones (001, FR-017) se mantiene por cuenta. |
| III. Jerarquía de Datos Consistente | PASS | No se toca la jerarquía Cuenta → Proyecto → Tablero → Stage → Work Item ni el par de relaciones; solo se amplía el atributo "rol" de la membresía. |
| IV. Aislamiento y Seguridad de Datos | PASS | Es el núcleo de la feature: toda mutación pasa por `requireProjectPermission(projectPublicId, permiso)`, que verifica membresía **y** rol vigente leído de la BD (FR-003). La matriz vive en un solo módulo (`lib/roles.ts`) para que no pueda desviarse entre acciones (hoy cada una decide por su cuenta). Defensas en profundidad en la BD: índice único parcial de un solo owner y `CHECK` de que una invitación nunca otorga `owner`. `publicId`/`cascade` sin cambios. |
| V. Código Abierto / Sin Bloqueo | PASS | Sin dependencias nuevas; se descarta el plugin de organizaciones de Better Auth y librerías de autorización de terceros (research.md § Fuente única). Nada relacionado con Git/CI-CD. |
| VI. Simplicidad y Alcance Enfocado (YAGNI) | PASS | Tres roles fijos, sin roles personalizables, sin admin intermedio, sin notificación de cambio de rol ni auditoría a nivel de proyecto (todo fuera de alcance por la spec). Se reutiliza el enum y la tabla de membresías existentes en vez de una tabla de roles/permisos. |
| Estándares § Auditoría | PASS | El log de actividad de Work Items no cambia: un Lector no puede generar esos cambios (queda demostrado por SC-001), y los permisos no alteran qué se registra. |
| Estándares § Roles | PASS | La constitución exigía documentar los permisos exactos antes de implementar: están en la matriz de [spec.md](spec.md#matriz-de-permisos) y se traducen 1:1 a claves de permiso en [contracts/roles-permissions.md](contracts/roles-permissions.md). |

Sin violaciones que requieran la tabla de Complexity Tracking. La única
pieza con algo de complejidad —serializar por proyecto las operaciones que
cambian roles— está justificada por SC-006 y se detalla en
[research.md](research.md#decisión-invariante-un-solo-owner-y-concurrencia).

**Re-check post-diseño (Fase 1)**: se mantiene PASS en todos los principios.
El diseño de contratos confirmó que ninguna acción de lectura existente
necesita cambiar de firma salvo agregar el rol del usuario a lo que ya
devuelven `getBoard` y `getWorkItemDetailData`, y que
`listPendingInvitations` pasa a exigir permiso (FR-018).

## Project Structure

### Documentation (this feature)

```text
specs/007-roles-permissions/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — decisiones técnicas (matriz, esquema, concurrencia, UI, pruebas, despliegue)
├── data-model.md        # Phase 1 — cambios de esquema y transiciones de rol
├── quickstart.md        # Phase 1 — validación end-to-end de las 4 historias
├── contracts/
│   └── roles-permissions.md   # matriz → claves de permiso; acciones nuevas y modificadas
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks) — no creado por este comando
```

### Source Code (repository root)

```text
db/
├── schema.ts                              # MODIFICADO: projectRoleEnum + "viewer"; invitations.role
│                                          #   (default "member", CHECK <> 'owner'); índice único parcial
│                                          #   de un solo owner por proyecto en project_members
└── migrations/
    └── 0003_<nombre>.sql (+ meta/)        # NUEVO (generado con `npm run db:generate`): ALTER TYPE ADD VALUE,
                                           #   ADD COLUMN invitations.role, CHECK, CREATE UNIQUE INDEX parcial

lib/
├── roles.ts                               # NUEVO: módulo puro (sin imports de servidor) con el tipo ProjectRole,
│                                          #   las claves de Permission, la matriz y can(role, permission) —
│                                          #   fuente única de verdad, importable desde cliente y servidor
├── permissions.ts                         # MODIFICADO: + requireProjectPermission(projectPublicId, permission);
│                                          #   - requireProjectOwner (todos sus usos migran al helper nuevo)
├── errors.ts                              # MODIFICADO: + isRolePermissionError(result) (helper de cliente para
│                                          #   refrescar la pantalla ante ROLE_NOT_PERMITTED)
└── actions/
    ├── projects.ts                        # MODIFICADO: rename/description/delete/removeMember → permisos;
    │                                      #   leaveProject usa el permiso "project:leave"; listProjectMembers
    │                                      #   tipa el rol de 3 valores; + changeMemberRole, + transferOwnership
    ├── accounts-invitations.ts            # MODIFICADO: sendInvitation exige permiso y recibe `role`;
    │                                      #   respondToInvitation usa invitation.role (hoy fijo "member");
    │                                      #   cancelInvitation aplica owner-cualquiera / miembro-propias;
    │                                      #   listPendingInvitations exige permiso (FR-018) y devuelve role +
    │                                      #   invitedByUserId
    ├── board.ts                           # MODIFICADO: createStage/reorderStages/renameStage/deleteStage →
    │                                      #   "board:edit"; getBoard devuelve también el rol del usuario
    ├── work-items.ts                      # MODIFICADO: create/move/reorder/update/deleteWorkItem → "workItem:edit"
    └── work-item-relationships.ts         # MODIFICADO: set/removeParent, link/unlinkRelated → "relationship:edit";
                                           #   getWorkItemDetailData devuelve también el rol del usuario

app/(workspace)/projects/[projectPublicId]/
├── page.tsx                               # MODIFICADO: pasa `role` de getBoard a <Board>
├── settings/page.tsx                      # MODIFICADO: controles y secciones según `can(role, …)`
│                                          #   (rename/descripción/eliminar: owner; invitaciones pendientes:
│                                          #   owner+miembro; salir: no-owner; transferir: owner)
└── work-items/[displayNumber]/page.tsx    # MODIFICADO: pasa `role` a <WorkItemDetailView>

components/
├── board/
│   ├── Board.tsx                          # MODIFICADO: prop `role`; deshabilita dnd-kit y oculta AddStageButton
│   │                                      #   para Lector; ante ROLE_NOT_PERMITTED muestra el toast y refresca
│   ├── StageColumn.tsx                    # MODIFICADO: prop `canEdit` — sin drag, sin renombrar in-place,
│   │                                      #   sin DeleteStageButton ni AddWorkItemButton para Lector
│   └── WorkItemCard.tsx                   # MODIFICADO: prop `canEdit` — sortable deshabilitado para Lector
│                                          #   (el clic de navegación al detalle se conserva)
├── work-items/
│   ├── WorkItemDetailView.tsx             # MODIFICADO: prop `role`; modo solo lectura (campos readOnly, sin
│   │                                      #   guardar/eliminar ni formularios de relaciones; los enlaces de
│   │                                      #   navegación entre relacionados se conservan)
│   └── TagPicker.tsx                      # MODIFICADO: prop `disabled` para el modo lectura
├── settings/
│   ├── MembersList.tsx                    # MODIFICADO: muestra el rol de cada miembro y el propio; owner: selector
│   │                                      #   Miembro↔Lector + "Transferir propiedad"; invitar solo con permiso
│   ├── PendingInvitationsList.tsx         # MODIFICADO: muestra el rol de ingreso; Cancelar según permiso
│   │                                      #   (owner: todas; miembro: solo las propias)
│   └── TransferOwnershipDialog.tsx        # NUEVO: confirmación explícita con la advertencia de FR-011
├── sidebar/
│   └── InviteMemberDialog.tsx             # MODIFICADO: selector de rol de ingreso (Miembro/Lector)
└── ui/
    └── read-only-notice.tsx               # NUEVO: aviso "Estás como Lector — solo lectura" reutilizable
                                           #   (tablero y detalle)

tests/
├── unit/
│   ├── roles.test.ts                      # NUEVO: la matriz completa, tabla contra spec.md
│   ├── permissions.test.ts                # MODIFICADO: requireProjectPermission (reemplaza el bloque de
│   │                                      #   requireProjectOwner)
│   ├── action-permissions.test.ts         # NUEVO: barrido de todas las mutaciones contra Lector/Miembro
│   │                                      #   (rechaza con ROLE_NOT_PERMITTED y sin escrituras)
│   └── member-roles.test.ts               # NUEVO: reglas de changeMemberRole / transferOwnership con db
│                                          #   mockeado (INVALID_ROLE, CANNOT_CHANGE_OWNER_ROLE, NOT_A_MEMBER,
│                                          #   CANNOT_TRANSFER_TO_SELF, orden bajar-antes-de-subir del owner)
└── e2e/
    ├── helpers.ts                         # MODIFICADO: + inviteAndAccept(ownerPage, inviteePage, projectUrl, role)
    └── roles-permissions.spec.ts          # NUEVO: escenarios de quickstart.md
```

**Structure Decision**: Mismo monolito Next.js de las fases anteriores; no se
crean rutas, proyectos ni servicios nuevos. Los únicos archivos nuevos son
`lib/roles.ts` (la matriz), un diálogo, un aviso de solo lectura, la
migración y los tests. Se elimina `requireProjectOwner` en vez de mantenerlo
como envoltorio: con `requireProjectPermission` queda sin usos y
conservarlo dejaría dos formas de decir "solo el owner" (Principio VI).

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
