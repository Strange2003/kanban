import { customAlphabet } from "nanoid";

// Unambiguous alphabet (no 0/O/1/I/l) for ids that might end up in a URL a
// human reads/types — used for publicId across projects, invitations, stages.
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, 14);

/** Opaque public identifier for projects/invitations/stages — Principle IV of the constitution. */
export function generatePublicId(): string {
  return generate();
}

/**
 * Derives the human-readable Work Item prefix for a project (e.g. "Kanban App" -> "KAN"),
 * per research.md § Identificadores públicos. `attempt` starts at 0; pass an
 * incrementing `attempt` (0, 1, 2, ...) when the caller finds the previous
 * candidate already taken by another project — attempt 0 has no numeric
 * suffix, attempt 1+ appends `attempt + 1` (so the sequence reads
 * KAN, KAN2, KAN3, ...).
 */
export function deriveWorkItemPrefix(projectName: string, attempt = 0): string {
  const letters = projectName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const base = (letters || "PRJ").slice(0, 3);
  return attempt === 0 ? base : `${base}${attempt + 1}`;
}
