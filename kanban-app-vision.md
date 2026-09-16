# App Kanban Colaborativa — Documento de Contexto y Visión

> Documento de partida para iniciar una planificación tipo **SDD (Spec-Driven Development)** en Claude Code. Recoge la idea general, las decisiones de producto ya tomadas, y las referencias técnicas investigadas hasta ahora. No es una especificación técnica cerrada — es el contexto necesario para empezar a especificar.

---

## 1. Motivación

Existen muchas herramientas de tablero kanban (Trello, Jira, Linear, Monday, Azure DevOps, GitHub/GitLab Issues, Notion), pero ninguna cumple bien con la necesidad de un tablero de tareas **simple**, con organizaciones/invitaciones, tags, roles y descripciones, que además sea **gratis o barato** y no esté atado a un ecosistema ajeno (como un repositorio de código).

Se investigaron alternativas open source existentes (**Kan.bn**, **Kaneo**, **Vikunja**, **Planka**, **WeKan**, **Kanboard**) para verificar que no exista ya algo que cumpla el objetivo. Conclusión: hay proyectos cercanos (especialmente **Kan.bn**, muy alineado en features, pero licenciado AGPL-3.0; y **Kaneo**, MIT pero más joven), pero ninguno cubre exactamente la combinación deseada — en particular el modelo de espacios personal/compartido descrito en la sección 3, y el sistema de relaciones entre work items al estilo Azure DevOps. El proyecto tiene sentido como iniciativa propia, de código abierto y bajo licencia **MIT**.

### Referencias técnicas de la investigación previa

De las herramientas open source analizadas (ver investigación previa) se rescatan patrones de diseño reutilizables, aunque el stack final se decidirá en la etapa de especificación:

- **Jerarquía de datos común**: Tenant/Organización → Proyecto/Tablero → Columna/Lista → Card/Work Item → Labels, Miembros, Comentarios, Activity Log.
- **Patrón `id` interno + `publicId`/`slug` externo** para no exponer claves primarias secuenciales en URLs/API.
- **Delegar identidad, invitaciones y roles a una librería de auth ya resuelta** (ej. Better Auth + plugin `organization`) en lugar de reinventar ese flujo desde cero.
- **Activity log / audit trail** por cambios en work items, modelado como tabla de eventos (`type`, `payload`, `createdAt`).
- **Aislamiento de datos por organización/proyecto** con `onDelete: cascade` en las foreign keys.

---

## 2. Alcance explícitamente EXCLUIDO

Para evitar ambigüedad desde el inicio:

- **No** habrá integración con Git, GitHub, GitLab, Azure Repos ni ningún sistema de control de versiones.
- **No** habrá conceptos de Pull Requests, Commits, Pipelines, Branches ni nada relacionado a CI/CD.
- Las capturas de Azure DevOps adjuntas se usan **solo como referencia de la estructura de un work item y su vista de detalle** (campos, relaciones, discusión), no como funcionalidad a replicar en su totalidad.

---

## 3. Modelo conceptual de espacios: Personal vs. Compartido

Inspirado en la barra lateral de Notion:

- La barra lateral tiene **dos secciones**: **Personal** y **Compartido**.
- La entidad de mayor jerarquía dentro de cada espacio es el **Proyecto** (el "Rey" — el objeto que gobierna todo lo demás dentro de él).
- **Un proyecto no se crea eligiendo si es personal o compartido.** Esa clasificación es automática y dinámica:
  - Al crearse, un proyecto solo tiene como miembro a su creador → aparece en **Personal**.
  - En el momento en que se invita a **cualquier otra persona** al proyecto, este pasa automáticamente a la sección **Compartido** (para todos los miembros, incluido el creador).
  - Es decir, "personal" y "compartido" no son un campo que el usuario setea, sino una propiedad **derivada del número de miembros** del proyecto (1 = personal, 2+ = compartido).

---

## 4. Estructura de un Proyecto

Cada proyecto tiene:

- **Configuración individual propia** (no hay configuración global compartida entre proyectos distintos).
- Una **vista principal tipo tablero (kanban)**.
- Miembros, con roles a definir en la etapa de especificación (al menos: creador/owner y miembro invitado).

### 4.1 Tablero (Kanban)

- El tablero permite **crear y eliminar columnas** libremente.
- **Cada columna está atada 1:1 a un "stage"** (etapa) del proyecto:
  - Crear una columna → crea automáticamente un stage.
  - Crear un stage → crea automáticamente su columna correspondiente.
  - Ejemplos de stages: `stage-abierta`, `stage-en-progreso`, `stage-cerrada`, etc. (nombres configurables por el usuario, no fijos).
- Las columnas deben ser **visualmente reordenables** (drag and drop del orden de las columnas en el tablero).

---

## 5. Work Items (tarjetas)

Cada tarjeta dentro de una columna es un **Work Item (WI)**. Un WI tiene, como mínimo:

- **ID** del work item (identificador único, visible).
- **Título**.
- **Descripción**.
- **Tags** (etiquetas).
- **Stakeholder** / quién lo solicitó (similar al concepto usado en Azure DevOps, ver capturas adjuntas).
- Estado/stage (determinado por la columna en la que está).

*(Otros campos vistos en las capturas de Azure DevOps — Área, Iteración, Prioridad, Severidad, Root Cause Analysis, Developer Notes, Discusión/Comentarios — quedan como candidatos a evaluar en la especificación, no como requisitos confirmados aún.)*

### 5.1 Relaciones entre Work Items

Se necesitan **dos tipos de relación distintos**:

1. **Relación de anidación (padre/hijo o subtarea)**:
   - Un WI puede tener uno o varios WI "hijos" (subtareas).
   - Cada WI hijo es **un work item independiente y completo** (tiene su propio título, descripción, asignación, tags, etc.), pero se visualiza/agrupa dentro del WI padre.
2. **Relación de asociación simple ("relacionado con")**:
   - Un WI puede vincularse a otro WI sin jerarquía, solo como referencia de que "tiene algo que ver" con él (similar a la sección "Related Work" de Azure DevOps, sin los sub-tipos de link técnicos como PR o commit).

---

## 6. Autenticación e Invitaciones

- **Login** con:
  - Cuenta de Google (OAuth).
  - Credenciales propias (email/password).
- **Flujo de invitación a un proyecto**:
  1. El dueño/miembro con permiso invita a otra persona **ingresando su email**.
  2. La invitación **no se envía por correo electrónico** — aparece como una **notificación dentro de la app** para el usuario invitado (asumiendo que ya tiene cuenta, o quedando pendiente hasta que la cree — a definir en la especificación).
  3. Al aceptar la invitación, el proyecto aparece automáticamente en la sección **Proyectos Compartidos** del invitado.
  4. Como se describió en la sección 3, el proyecto también pasa a "Compartido" para el resto de sus miembros en ese momento.

---

## 7. UI/UX

- La calidad visual e interacción de la interfaz es un **requisito de primer nivel**, no un detalle secundario.
- Referencias de estilo mencionadas: barra lateral estilo Notion (simple, con secciones colapsables), tablero kanban con drag-and-drop fluido tipo Trello/Azure DevOps.
- Se debe cuidar especialmente: la experiencia de reordenar columnas, la vista de detalle de un work item (con sus relaciones padre/hijo y relacionados visibles y navegables), y la app en general debe ser rápida y clara.

---

## 8. Preguntas abiertas para la etapa de especificación (SDD)

Estas son decisiones que aún no se han tomado y que conviene resolver durante la planificación en Claude Code:

- Roles y permisos exactos dentro de un proyecto compartido (¿todos los miembros pueden invitar? ¿hay un rol de solo lectura?).
- Qué pasa si se invita a un email que no tiene cuenta todavía (¿invitación pendiente hasta registro, o requiere cuenta previa?).
- Límite de niveles de anidación de work items (¿solo un nivel padre-hijo, o anidación arbitraria?).
- Qué ocurre con los work items hijos cuando se borra o mueve el work item padre entre columnas/stages.
- Vistas adicionales más allá del kanban (lista, tabla, calendario) — ¿están en el alcance inicial (MVP) o son fase 2?
- Stack tecnológico definitivo (frontend, backend, base de datos, ORM, proveedor de auth) — a decidir según lo que se explore en Claude Code, considerando las referencias de la sección 1.
- Modelo de datos concreto (tablas, relaciones, claves) para: proyectos, membresías, stages/columnas, work items, relaciones entre work items, invitaciones, tags.
- Licencia definitiva del repositorio (MIT es la preferencia declarada).

---

## 9. Siguiente paso

Este documento se usará como entrada para una sesión de planificación **Spec-Driven Development (SDD)** en Claude Code, donde se definirán: especificación funcional detallada, modelo de datos, arquitectura técnica y plan de implementación por fases (MVP primero, según lo discutido en la conversación previa).
