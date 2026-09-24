# Data Model: Detalle colaborativo

## `work_items`

- `estimate_minutes integer NULL`, `CHECK (estimate_minutes >= 0 AND estimate_minutes <= 600000)`.
- `NULL` = sin estimación; `0` = estimación explícita de cero.
- Toda modificación pasa por `updateWorkItem` y registra `fields_edited.estimateMinutes`.

## `work_item_comments`

- `id serial PK`, `public_id text UNIQUE NOT NULL`, `work_item_id integer NOT NULL REFERENCES work_items(id) ON DELETE CASCADE`.
- `author_user_id text NOT NULL`, `author_name text NOT NULL`, `body text NOT NULL`, `created_at timestamptz NOT NULL`.
- `CHECK (length(trim(body)) BETWEEN 1 AND 10000)`; índice `(work_item_id, created_at, id)`.
- `author_name` conserva un nombre legible tras salir del proyecto.

## `work_item_time_entries`

- `id serial PK`, `public_id text UNIQUE NOT NULL`, `work_item_id integer NOT NULL REFERENCES work_items(id) ON DELETE CASCADE`.
- `author_user_id text NOT NULL`, `author_name text NOT NULL`, `minutes integer NOT NULL`, `note text`, `created_at timestamptz NOT NULL`.
- `CHECK (minutes BETWEEN 1 AND 600000)`; `CHECK (note IS NULL OR length(note) <= 500)`; índice `(work_item_id, created_at, id)`.
- La suma visible se deriva de entradas vigentes; al borrar una entrada se escribe `time_entry_deleted` antes del borrado.

## Seguridad e identificadores

- Las tablas hijas no se consultan desde una acción pública sin verificar membresía del proyecto padre.
- `publicId` nanoid evita exponer seriales en parámetros externos.
- Eliminar WI o proyecto borra comentarios y entradas en cascada.
