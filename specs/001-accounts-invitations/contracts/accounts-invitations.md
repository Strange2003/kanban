# Contratos: Cuentas e Invitaciones

Todas las acciones son Server Actions de Next.js (no hay API pública REST en
esta fase). "Sesión" = usuario autenticado vía Better Auth (self-hosted,
ver research.md § Autenticación). Los flujos de
registro/login/OAuth/verificación/reset de contraseña en sí (FR-001 a
FR-003, FR-015, FR-016) los provee Better Auth directamente (configuración
+ los callbacks `sendVerificationEmail`/`sendResetPassword` conectados a
Resend) y no se recontractan acá — solo lo que la app construye encima.

## `sendInvitation(input): Result<Invitation>`

**Cubre**: FR-005, FR-006, FR-007, FR-009, FR-012, FR-013, FR-017 de
[spec.md](../spec.md).

- **Input**: `{ projectId: string (publicId), email: string }`
- **Auth**: sesión requerida; el usuario MUST ser `owner` del proyecto
  (FR-009).
- **Reglas aplicadas, en orden**:
  1. `email` con formato válido (si no, error `INVALID_EMAIL`).
  2. Rate limit: máx. 20 invitaciones del `invitedByUserId` en la última
     hora (si excede, error `RATE_LIMITED` con el tiempo de espera).
  3. Email ya es miembro del proyecto → error `ALREADY_MEMBER`.
  4. Invitación pendiente ya existente para ese `(projectId, email)` →
     error `ALREADY_INVITED`.
  5. Crea `invitations` con `status='pending'`.
  6. Si el email corresponde a una cuenta existente y verificada → crea
     `notifications` (type `invitation`) de inmediato.
  7. Si el email no tiene cuenta, o la cuenta existe pero no está
     verificada → la invitación queda pendiente sin notificación (se
     resuelve en `applyPendingInvitationsForUser`, ver abajo).
- **Output**: la invitación creada.

## `applyPendingInvitationsForUser(userId, email)`

**Cubre**: FR-007, FR-015. Se invoca automáticamente tras un signup o tras
una verificación de email exitosa (hook `databaseHooks`/`after` de Better
Auth sobre `user`/`verification`), no expuesta al cliente.

- Busca `invitations` con `status='pending'` y `invitedEmail = email`.
- Para cada una: crea `notifications` (type `invitation`) dirigida a
  `userId`.

## `respondToInvitation(input): Result<void>`

**Cubre**: FR-008, FR-010 de [spec.md](../spec.md).

- **Input**: `{ invitationId: string (publicId), action: 'accept' | 'reject' }`
- **Auth**: sesión requerida; el `invitedEmail` de la invitación MUST
  coincidir con el email de la sesión actual (si no, error `FORBIDDEN`).
- **`accept`**: crea `project_members` con `role='member'`; marca la
  invitación `status='accepted'`, `respondedAt=now()`; marca la
  `notification` asociada como leída.
- **`reject`**: marca la invitación `status='rejected'`; no crea membresía.
- **Errores**: invitación no encontrada o ya resuelta → `INVITATION_NOT_PENDING`.

## `cancelInvitation(invitationId): Result<void>`

**Cubre**: FR-011.

- **Auth**: sesión requerida; MUST ser quien envió la invitación
  (`invitedByUserId`) o el owner actual del proyecto.
- Marca `status='cancelled'` si `status='pending'`; si ya no está pendiente,
  error `INVITATION_NOT_PENDING`.

## `listMyNotifications(): Notification[]`

**Cubre**: FR-006, US3 de [spec.md](../spec.md).

- **Auth**: sesión requerida.
- Devuelve notificaciones del usuario actual, más recientes primero, con el
  detalle de la invitación asociada (nombre del proyecto, quién invitó).
