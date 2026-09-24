// Pure module (010-legal-pages): no imports from next/*, db or lib/auth, so the
// operator rules can be tested by passing a plain object instead of process.env.

export type Operator = { name: string | null; contactEmail: string | null };

// ISO date the legal text in app/(legal)/ last changed. Bump it with every
// edit to /privacy or /terms — both pages show it as "Last updated".
export const LEGAL_LAST_UPDATED = "2026-09-23";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolves the instance operator shown on /privacy and /terms (FR-006 of
 * 010-legal-pages). Both values are optional: blank or missing → null, and an
 * email without an email shape is treated as missing so the pages never render
 * a broken mailto: link.
 */
export function getOperator(env: Record<string, string | undefined>): Operator {
  const name = env.OPERATOR_NAME?.trim() || null;
  const email = env.OPERATOR_CONTACT_EMAIL?.trim() || null;
  return {
    name,
    contactEmail: email && EMAIL_SHAPE.test(email) ? email : null,
  };
}
