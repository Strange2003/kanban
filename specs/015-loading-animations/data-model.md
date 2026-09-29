# Data Model: Animaciones de Carga y un Esqueleto por Página

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## Base de datos

Sin cambios: ni tablas, ni columnas, ni migración.

## Memoria local: número de columnas por proyecto

Vive solo en el `localStorage` del navegador (Key Entity de la spec).

| Campo | Valor |
|---|---|
| Clave | `kanban:board-columns:<projectPublicId>` (el `publicId` nanoid del proyecto, nunca la PK) |
| Valor | Entero en texto, el número de columnas que tenía el tablero la última vez que se mostró |
| Escribe | `Board`, al montarse y cada vez que cambia su número de columnas |
| Lee | `BoardSkeleton`, mientras carga el tablero |

**Reglas de validación** (`lib/board-column-memory.ts`):

- Lectura: ausente, no numérico, `≤ 0` → `3` (`DEFAULT_BOARD_COLUMNS`);
  `> 8` → `8` (`MAX_SKELETON_COLUMNS`); decimales → parte entera.
- Escritura: se guarda el número real (el acotado se aplica al leer), pero `0`
  no se guarda (un tablero vacío no aporta forma; se conserva el anterior o el
  por defecto).
- Cualquier excepción del `Storage` (modo privado, cuota, bloqueado) se ignora:
  la lectura devuelve `3` y la escritura no hace nada.

**Ciclo de vida**: sin caducidad; un proyecto borrado deja una clave huérfana de
pocos bytes, inofensiva. Nada se envía al servidor ni se sincroniza entre
dispositivos.
