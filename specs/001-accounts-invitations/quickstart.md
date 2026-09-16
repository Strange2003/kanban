# Quickstart: Validar la Fase 1 de punta a punta

Este flujo recorre las 4 specs del núcleo en orden (cuentas → proyectos →
tablero → work items), traduciendo los "Independent Test" de cada historia
de usuario en pasos ejecutables. Sirve tanto para probar manualmente como
de guía para los tests de Playwright de `tests/e2e/`.

## Prerrequisitos

- Variables de entorno configuradas (ver "Acciones Manuales Requeridas" en
  [plan.md](plan.md)): `DATABASE_URL` (Neon), `RESEND_API_KEY`, Google
  OAuth client id/secret, `BETTER_AUTH_SECRET`.
- Migraciones de Drizzle y de Better Auth aplicadas: `npm run db:migrate`.
- Servidor de desarrollo corriendo: `npm run dev`.

## 1. Cuentas e Invitaciones ([spec](spec.md))

1. Registrar la Cuenta A por email/contraseña (≥8 caracteres) →
   verificar que llega el email de verificación → confirmar el enlace.
2. Registrar la Cuenta B con "Continuar con Google" (queda verificada de
   inmediato).
3. Iniciar sesión con la Cuenta A: crear un proyecto de prueba "Proyecto Demo"
   (ver paso 2).
4. Desde el Proyecto Demo, invitar a la Cuenta B por su email → confirmar
   que aparece como invitación `pending`.
5. Iniciar sesión como Cuenta B → ver la notificación in-app → aceptarla.
6. Verificar: el proyecto pasa a "Compartido" para ambas cuentas
   (`GET listMyProjects` de ambas sesiones lo muestra en `shared`).
7. (Opcional) Repetir el paso 4 con un email sin cuenta todavía → registrar
   esa cuenta nueva y verificar su email → confirmar que la invitación se
   aplica sola (FR-007/FR-015).

## 2. Proyectos y Espacios ([spec](../002-project-spaces/spec.md))

1. Como Cuenta A, crear un proyecto sin nombre → confirmar que se rechaza.
2. Crear "Proyecto Demo" con nombre → confirmar que aparece en "Personal".
3. Buscar "Demo" en el buscador de la barra lateral → confirmar que
   aparece filtrado.
4. Renombrar el proyecto → confirmar que el nuevo nombre se ve para todos
   los miembros (usar la sesión de Cuenta B tras el paso 5 de la sección 1).
5. Como Cuenta B (miembro, no owner), intentar eliminar el proyecto →
   confirmar que se rechaza.
6. Como Cuenta B, salir del proyecto → confirmar que desaparece de su
   barra lateral y el proyecto vuelve a "Personal" para Cuenta A.
7. Como Cuenta A, eliminar el proyecto de prueba al terminar.

## 3. Tablero Kanban ([spec](../003-kanban-board/spec.md))

1. Crear un proyecto nuevo "Tablero Demo" (queda sin columnas, FR-010).
2. Crear tres columnas: "Por hacer", "En progreso", "Hecho".
3. Reordenar arrastrando "Hecho" al medio → confirmar que el orden
   persiste al recargar.
4. Intentar eliminar una columna vacía → confirmar que se elimina.
5. Crear un Work Item en "Por hacer" (ver sección 4), luego intentar
   eliminar esa columna → confirmar que el sistema lo impide (FR-007).

## 4. Work Items ([spec](../004-work-items/spec.md))

1. En "Tablero Demo", crear un Work Item sin título en "Por hacer" →
   confirmar que se rechaza.
2. Crear "Diseñar login" → confirmar que aparece con un id visible tipo
   `TAB-1` (prefijo derivado de "Tablero Demo").
3. Arrastrar el Work Item de "Por hacer" a "En progreso" → confirmar que
   su stage cambia de inmediato.
4. Abrir el detalle, agregar la descripción, el stakeholder, y un tag
   nuevo ("urgente") → confirmar que el tag queda disponible para otros
   Work Items del mismo proyecto.
5. Eliminar el Work Item → confirmar que desaparece del tablero.

## Resultado esperado

Al completar los 4 bloques, quedó validado el loop completo del MVP:
registro → verificación → creación de proyecto → invitación → aceptación →
colaboración en el tablero → gestión de Work Items — sin haber tocado
código, solo interacción con la UI/Server Actions ya implementadas.
