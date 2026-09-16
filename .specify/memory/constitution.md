<!--
Sync Impact Report
Version change: (unratified template) → 1.0.0
Rationale: Initial ratification. The prior file only contained unfilled
[PLACEHOLDER] tokens from constitution-template.md — no governance content
existed yet, so this is the project's first adopted constitution (MAJOR
baseline, 1.0.0 per semver-for-governance convention).

Modified principles: N/A (initial adoption, no prior principles existed)

Added sections:
- Core Principles: I. Experiencia de Usuario Primero (UX-First)
- Core Principles: II. Colaboración sin Límites
- Core Principles: III. Jerarquía de Datos Consistente
- Core Principles: IV. Aislamiento y Seguridad de Datos
- Core Principles: V. Código Abierto y Sin Bloqueo de Ecosistema (NON-NEGOTIABLE)
- Core Principles: VI. Simplicidad y Alcance Enfocado (YAGNI)
- Estándares de Producto y Datos (Section 2)
- Flujo de Desarrollo (Section 3)
- Governance

Removed sections: none

Templates requiring follow-up (not modified by this command per scope guard —
dependent templates read the constitution at runtime):
- ⚠ .specify/templates/plan-template.md — verify its Constitution Check
  gate references these six principles when first used
- ⚠ .specify/templates/spec-template.md — no direct constitution
  references found; no action needed
- ⚠ .specify/templates/tasks-template.md — no direct constitution
  references found; no action needed
- ⚠ .specify/templates/checklist-template.md — no direct constitution
  references found; no action needed

Deferred/Follow-up TODOs: none. RATIFICATION_DATE set to the date this
constitution was first adopted (today), since no earlier ratification
record exists in the repository.
-->

# Kanban Colaborativo Constitution

## Core Principles

### I. Experiencia de Usuario Primero (UX-First)
La calidad visual y de interacción es un requisito de primer nivel, no un
detalle secundario que se resuelve al final. Toda funcionalidad de tablero
(crear/eliminar columnas, arrastrar Work Items, reordenar columnas) MUST
sentirse fluida e inmediata, con feedback visual optimista y sin bloqueos
de carga perceptibles. La vista de detalle de un Work Item MUST permitir
navegar sus relaciones (padre/hijo y relacionados) sin fricción. Cualquier
decisión técnica que degrade la claridad o la velocidad percibida por
conveniencia de implementación MUST justificarse explícitamente en el plan
correspondiente.
Rationale: La motivación del proyecto es que las herramientas existentes no
resuelven bien la experiencia simple y directa que se busca; si la UX se
trata como secundaria, el proyecto pierde su razón de ser frente a las
alternativas ya existentes.

### II. Colaboración sin Límites
Cualquier miembro con permiso de invitar MUST poder añadir un número
ilimitado de colaboradores a un proyecto mediante su email; el sistema
MUST NOT imponer límites artificiales de miembros por proyecto o por
cuenta. La clasificación de un proyecto como "Personal" (un solo miembro)
o "Compartido" (dos o más miembros) es siempre derivada del número de
miembros, nunca un campo que el usuario configure directamente. Las
invitaciones se notifican dentro de la app — no por correo electrónico — y
el proyecto MUST aparecer en "Compartido" para todos los miembros en cuanto
se acepta la invitación.
Rationale: La colaboración abierta y sin fricción es un diferenciador
explícito frente a herramientas que limitan miembros por plan o cobran por
asiento; es parte del propósito fundacional del proyecto.

### III. Jerarquía de Datos Consistente
El modelo de datos MUST seguir la jerarquía Cuenta → Proyecto → Tablero →
Stage/Columna → Work Item. Cada columna del tablero MUST estar atada 1:1 a
un stage del proyecto: no puede existir una sin la otra, y crear/renombrar
una MUST mantener sincronizada la otra. Los Work Items MUST soportar dos
tipos de relación explícitos y distintos entre sí — anidación (padre/hijo,
donde cada hijo es un Work Item completo e independiente con sus propios
campos) y asociación simple ("relacionado con", sin jerarquía) — y ambos
tipos MUST ser visibles y navegables desde la vista de detalle.
Rationale: Esta jerarquía y el par de relaciones (anidación vs. asociación)
son el núcleo conceptual del producto tal como se definió en la fase de
visión; cualquier ambigüedad aquí se propaga a toda la especificación.

### IV. Aislamiento y Seguridad de Datos
Todo acceso a los datos de un proyecto MUST verificar la membresía y el rol
del usuario solicitante; un usuario MUST NOT poder leer ni modificar datos
de un proyecto del cual no es miembro. Las relaciones entre entidades
(proyecto, stages, work items, invitaciones, tags) MUST usar borrado en
cascada (`onDelete: cascade`) para evitar registros huérfanos. Las
entidades expuestas externamente (URLs, API) MUST identificarse mediante un
identificador público (`publicId`/slug) distinto de su clave primaria
interna, para no filtrar información secuencial o interna del sistema.
Rationale: Un proyecto colaborativo sin límite de miembros multiplica la
superficie de riesgo de fuga de datos entre proyectos; el aislamiento no es
negociable una vez que existe colaboración multi-tenant.

### V. Código Abierto y Sin Bloqueo de Ecosistema (NON-NEGOTIABLE)
El proyecto se publica y mantiene bajo licencia MIT. MUST NOT introducirse
ninguna dependencia, integración o funcionalidad que ate el producto a un
proveedor de control de versiones (Git, GitHub, GitLab, Azure Repos) ni a
un sistema de CI/CD; estos quedan explícitamente fuera de alcance del
producto. Toda decisión técnica relevante (stack, modelo de datos,
proveedor de autenticación) MUST quedar documentada y ser auditable por la
comunidad.
Rationale: El proyecto nace explícitamente porque las alternativas
cercanas (p. ej. AGPL-3.0) o no existen bajo una licencia permisiva y sin
atadura a un ecosistema de código; diluir esto anula la motivación
fundacional declarada.

### VI. Simplicidad y Alcance Enfocado (YAGNI)
Toda funcionalidad o campo nuevo MUST resolver una necesidad ya confirmada
dentro del modelo Cuenta/Proyecto/Tablero/Work Item. Los candidatos aún no
confirmados (campos adicionales estilo Azure DevOps, vistas de
lista/tabla/calendario, niveles de anidación adicionales, etc.) MUST pasar
primero por la etapa de especificación o clarificación antes de
implementarse — no se agregan "por si acaso". Ante dos soluciones
equivalentes, se prefiere extender un patrón ya resuelto (p. ej. delegar
identidad e invitaciones a una librería de autenticación madura) en lugar
de reconstruirlo desde cero.
Rationale: Un proyecto de código abierto mantenido por una comunidad
crece en complejidad más rápido de lo que se puede revisar; mantener el
alcance enfocado en el modelo core es lo que permite sostener la calidad de
UX exigida por el Principio I.

## Estándares de Producto y Datos

- **Autenticación**: el sistema MUST soportar login con Google OAuth y con
  credenciales propias (email/password). La librería de autenticación se
  elige en la etapa de planificación técnica, pero MUST soportar
  organizaciones/invitaciones de forma nativa en lugar de reimplementarlas.
- **Auditoría**: todo cambio relevante sobre un Work Item (cambio de stage,
  edición de campos, cambios de relación) MUST registrarse en un log de
  actividad modelado como tabla de eventos (`type`, `payload`, `createdAt`),
  visible desde la vista de detalle del Work Item.
- **Roles**: todo proyecto MUST tener, como mínimo, un rol owner/creador y
  un rol de miembro invitado. Los permisos exactos de cada rol (p. ej.
  quién puede invitar, si existe un rol de solo lectura) se definen y
  documentan en la etapa de especificación antes de implementarse.

## Flujo de Desarrollo

- Este proyecto sigue un flujo de Spec-Driven Development (SDD): toda
  funcionalidad nueva MUST pasar por especificación (`/speckit-specify`) y,
  cuando aplique, por clarificación (`/speckit-clarify`) y plan
  (`/speckit-plan`) antes de generar tareas (`/speckit-tasks`) e
  implementar (`/speckit-implement`).
- Toda contribución externa (pull request) MUST incluir una descripción
  clara del cambio y, si modifica el modelo de datos o las relaciones
  entre entidades, MUST referenciar la especificación correspondiente.
- Todo cambio que afecte a los Principios Fundamentales de este documento
  MUST pasar por una enmienda explícita de la constitución antes de
  fusionarse; no se aceptan excepciones implícitas vía código o
  configuración.

## Governance

Esta Constitución prevalece sobre cualquier otra práctica, plantilla o
convención del repositorio. Toda enmienda MUST documentar: el principio
afectado, la razón del cambio y su impacto en los artefactos dependientes
(plantillas de spec/plan/tasks). El versionado de este documento sigue
semver: MAJOR para eliminaciones o redefiniciones incompatibles de
principios, MINOR para la adición de un principio o sección, PATCH para
aclaraciones o correcciones de redacción que no cambian el significado.
Toda revisión de código y todo plan de implementación MUST verificar
cumplimiento con esta Constitución; la complejidad no justificada por un
principio o por una necesidad de producto ya confirmada MUST rechazarse o
simplificarse antes de fusionarse.

**Version**: 1.0.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-09
