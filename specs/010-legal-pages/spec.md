# Feature Specification: Páginas Legales Públicas (Privacidad y Condiciones)

**Feature Branch**: `010-legal-pages`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Páginas legales públicas: Política de Privacidad y Condiciones del Servicio. Motivo: Google OAuth exige una URL de página principal y una URL de política de privacidad válidas para pasar la app de modo "Prueba" a "Producción" (hoy solo usuarios de prueba pueden iniciar sesión con Google en https://kanban-3nt0.onrender.com). Alcance: (1) una página pública /privacy con la política de privacidad, accesible sin iniciar sesión; (2) una página pública /terms con las condiciones del servicio, también sin sesión; (3) enlaces a ambas desde las pantallas de autenticación (sign-in / sign-up) para que cualquier visitante las encuentre. Contexto del producto: es open source y self-hosted — no hay una instancia central; cada quien que despliega una instancia es el responsable de sus datos, así que el contenido debe describir qué datos guarda la app (cuenta: nombre, email, foto de Google si aplica; datos de proyectos y work items; sesiones; registro de actividad), para qué se usan, con qué terceros se comparten (Neon como base de datos, Resend para emails, Google solo para iniciar sesión, el proveedor de hosting), que no hay publicidad ni venta de datos, y cómo pedir el borrado de la cuenta, identificando al operador de la instancia y su email de contacto. Fuera de alcance: banners de cookies (la app solo usa cookies de sesión esenciales), flujos de borrado automático de cuenta, localización a múltiples idiomas, contenido de marketing o landing page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Leer la Política de Privacidad sin cuenta (Priority: P1)

Cualquier persona — un visitante que todavía no tiene cuenta, un usuario que está a punto de "Continuar con Google", o el revisor de Google que valida la pantalla de consentimiento — abre la dirección pública de la Política de Privacidad de una instancia y lee, sin iniciar sesión, qué datos guarda esa instancia, para qué los usa, con quién los comparte, y a quién escribir para pedir que borren su cuenta.

**Why this priority**: Es lo que desbloquea el objetivo inmediato: sin una URL pública de Política de Privacidad, Google no permite pasar la app a "Producción" y el login con Google queda limitado a usuarios de prueba. Por sí sola ya entrega valor.

**Independent Test**: Sin sesión iniciada, abrir la dirección de la Política de Privacidad de una instancia desplegada y comprobar que carga, que no redirige a iniciar sesión, y que contiene todas las secciones de FR-003 con el nombre y el email de contacto del operador de esa instancia.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión, **When** abre la dirección de la Política de Privacidad, **Then** ve la política completa, sin ser redirigido a iniciar sesión.
2. **Given** un usuario con sesión iniciada, **When** abre la misma dirección, **Then** ve la misma política (la sesión no cambia el contenido).
3. **Given** una instancia cuyo operador configuró su nombre y su email de contacto, **When** alguien lee la política, **Then** ve ese nombre como responsable de los datos y ese email como vía para consultas y para pedir el borrado de la cuenta.
4. **Given** la política, **When** alguien la lee, **Then** encuentra una fecha de "última actualización".

---

### User Story 2 - Leer las Condiciones del Servicio sin cuenta (Priority: P2)

Cualquier persona abre, sin iniciar sesión, la dirección pública de las Condiciones del Servicio de la instancia y lee las reglas básicas de uso: quién ofrece el servicio, que se ofrece "tal cual" y sin garantías, qué uso no está permitido, que el operador puede suspender cuentas que abusen del servicio, y a quién escribir.

**Why this priority**: Google no la exige para publicar, pero es el complemento habitual de la Política de Privacidad y aclara el uso aceptable de una instancia compartida con otras personas. No bloquea el objetivo inmediato.

**Independent Test**: Sin sesión, abrir la dirección de las Condiciones del Servicio y comprobar que carga sin redirigir y contiene las secciones de FR-005, con el operador y su contacto.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión, **When** abre la dirección de las Condiciones del Servicio, **Then** las ve completas, sin ser redirigido a iniciar sesión.
2. **Given** las Condiciones, **When** alguien las lee, **Then** encuentra un enlace a la Política de Privacidad, y viceversa.

---

### User Story 3 - Encontrar las páginas legales desde las pantallas de acceso (Priority: P2)

Un visitante en la pantalla de iniciar sesión o de crear cuenta ve enlaces discretos a la Política de Privacidad y a las Condiciones del Servicio, y puede abrirlos antes de registrarse o de continuar con Google.

**Why this priority**: Es donde la persona decide entregar sus datos; es el lugar natural para encontrar las páginas y lo que se espera de cualquier pantalla de registro. Depende de que existan las páginas (US1, US2).

**Independent Test**: Sin sesión, en las pantallas de iniciar sesión y de crear cuenta, hacer clic en cada enlace legal y llegar a la página correcta.

**Acceptance Scenarios**:

1. **Given** la pantalla de iniciar sesión o la de crear cuenta, **When** un visitante la mira, **Then** ve un enlace a "Privacy Policy" y otro a "Terms of Service".
2. **Given** la pantalla de crear cuenta, **When** un visitante la mira, **Then** ve un aviso breve de que, al crear la cuenta o continuar con Google, acepta las Condiciones y la Política, con enlace a ambas.
3. **Given** un visitante que abre un enlace legal desde una pantalla de acceso, **When** termina de leer, **Then** puede volver a la pantalla de acceso sin perder lo que ya había escrito en el formulario.

---

### Edge Cases

- **El operador no configuró su nombre o su email de contacto**: las páginas cargan igual; en lugar del nombre dicen "the operator of this instance" y, en lugar del email, indican que se contacte al administrador de la instancia. La instancia sigue arrancando normalmente (no es un requisito para funcionar, a diferencia de la base de datos).
- **Instancia sin login con Google configurado**: la mención de Google sigue presente, redactada como "si inicias sesión con Google" — no depende de si esa instancia lo tiene activo.
- **Un usuario con sesión abre las páginas desde dentro de la app**: se muestran igual; no hace falta cerrar sesión.
- **Pedido de borrado de cuenta**: la página indica el canal (email del operador); el borrado en sí lo realiza el operador manualmente y queda fuera de esta feature.
- **Pantallas de restablecer o recuperar contraseña**: no necesitan los enlaces; basta con iniciar sesión y crear cuenta (FR-007).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La instancia MUST ofrecer una página de **Política de Privacidad** en una dirección pública y estable (`/privacy`), accesible sin iniciar sesión.
- **FR-002**: La instancia MUST ofrecer una página de **Condiciones del Servicio** en una dirección pública y estable (`/terms`), accesible sin iniciar sesión.
- **FR-003**: La Política de Privacidad MUST cubrir, como mínimo:
  - **Responsable**: el operador de la instancia (nombre y email de contacto, FR-006), aclarando que este software es open source y self-hosted, y que cada instancia la opera quien la despliega, no los autores del proyecto.
  - **Datos que se guardan**: datos de la cuenta (nombre, email, contraseña almacenada de forma no legible si se usa email/contraseña, foto de perfil si se inicia sesión con Google); datos de sesión (dirección IP y navegador asociados a cada sesión); el contenido que el usuario crea (proyectos, columnas, Work Items con sus campos, tags, relaciones); membresías, invitaciones y notificaciones; y el registro de actividad de los Work Items.
  - **Para qué se usan**: únicamente para prestar el servicio — identificar al usuario, mantener su sesión, mostrarle sus proyectos y los de sus colaboradores, y enviarle emails de verificación y recuperación de contraseña.
  - **Visibilidad dentro de la app**: los demás miembros de un proyecto ven el nombre y el email del usuario, y el contenido y la actividad de ese proyecto.
  - **Terceros que procesan datos**: el proveedor de base de datos, el proveedor de envío de emails, Google (solo si se inicia sesión con Google, y solo para identificar al usuario) y el proveedor de hosting de la instancia.
  - **Lo que no se hace**: no hay publicidad, no hay rastreo de terceros ni analítica, y los datos no se venden ni se ceden a terceros para otros fines.
  - **Cookies**: solo cookies esenciales de sesión, necesarias para mantener la sesión iniciada.
  - **Conservación y borrado**: los datos se conservan mientras la cuenta exista; el usuario puede pedir al operador (por su email de contacto) acceder a sus datos, corregirlos o borrar su cuenta.
  - **Cambios** a la política y fecha de **última actualización**.
- **FR-004**: El uso de datos de Google descrito en la Política MUST limitarse a nombre, email y foto de perfil para identificar al usuario, y MUST declarar que no se usan para ningún otro fin.
- **FR-005**: Las Condiciones del Servicio MUST cubrir, como mínimo: quién ofrece el servicio (el operador, FR-006); que el software es open source bajo licencia MIT y se ofrece "tal cual", sin garantías; uso aceptable (no usarlo para actividades ilegales, abuso, spam ni para intentar acceder a datos de otros); que el contenido pertenece a quien lo crea y a los miembros del proyecto donde se crea; que el operador puede suspender o borrar cuentas que incumplan las condiciones; limitación de responsabilidad; cambios a las condiciones; contacto; y un enlace a la Política de Privacidad.
- **FR-006**: El operador de una instancia MUST poder indicar, como parte de la configuración de despliegue y sin modificar el código, su **nombre** (persona u organización) y su **email de contacto**, que las páginas legales muestran. Si faltan, las páginas MUST usar el texto de reemplazo descrito en Edge Cases.
- **FR-007**: Las pantallas de **iniciar sesión** y **crear cuenta** MUST mostrar enlaces a la Política de Privacidad y a las Condiciones del Servicio. La de crear cuenta MUST mostrar además el aviso de aceptación de US3 escenario 2.
- **FR-008**: Cada página legal MUST enlazar a la otra y ofrecer una forma de volver a la aplicación (a iniciar sesión si no hay sesión, a los proyectos si la hay).
- **FR-009**: El texto de las páginas legales MUST estar en el mismo idioma que el resto de la interfaz (inglés).
- **FR-010**: Las páginas legales MUST ser legibles en pantallas de celular y de escritorio, sin desplazamiento horizontal.

### Key Entities

- **Operador de la instancia**: la persona u organización que despliega y administra una instancia; responsable de los datos de sus usuarios. Atributos: nombre y email de contacto, ambos provistos por configuración de despliegue. No es una entidad almacenada en la base de datos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con la URL de la instancia como página principal y la dirección de FR-001 como Política de Privacidad, el operador puede pasar la app de Google de "Prueba" a "Producción", y una cuenta de Google que no figura como usuario de prueba puede iniciar sesión.
- **SC-002**: El 100% de las visitas sin sesión a las dos páginas legales las muestran completas, sin redirigir a iniciar sesión.
- **SC-003**: Desde las pantallas de iniciar sesión y crear cuenta, un visitante llega a cualquiera de las dos páginas legales en un clic.
- **SC-004**: Un operador nuevo deja las páginas legales con su nombre y su contacto configurando solo dos valores de despliegue, sin tocar el código.
- **SC-005**: Todas las categorías de datos y terceros de FR-003 aparecen en la Política de Privacidad (verificable con una revisión punto por punto).

## Assumptions

- La "página principal" que pide Google es la URL raíz de la instancia (por ejemplo, `https://kanban-3nt0.onrender.com`). Para un visitante sin sesión esa URL lleva a iniciar sesión, lo que alcanza para publicar la app sin verificación de marca. Una landing page pública queda fuera de alcance, como se pidió.
- El contenido legal es un texto genérico y único para todas las instancias, parametrizado solo por el nombre y el contacto del operador. Si un operador necesita un texto a medida (otra jurisdicción, requisitos de su empresa), modifica su propia copia del código; permitir texto personalizado por configuración queda fuera de alcance (Principio VI).
- El texto no es asesoría legal: es una base razonable para una instancia personal o de equipo, y así lo aclara el README a los operadores.
- El borrado de la cuenta sigue siendo manual, a cargo del operador; un flujo de autoborrado queda fuera de alcance, como se pidió.
- No se necesita banner de cookies: la app solo usa cookies esenciales de sesión, sin analítica ni publicidad.
- Solo inglés, igual que el resto de la UI; la localización queda fuera de alcance.
- No se agregan datos nuevos a la base de datos ni cambios de permisos: las páginas son públicas y no leen datos de ningún proyecto (Principio IV no se ve afectado).
