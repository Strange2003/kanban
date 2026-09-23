import { describe, expect, it } from "vitest";
import { getOperator } from "@/lib/legal";

// data-model.md § Configuración: Operador de la instancia (010-legal-pages, FR-006).
describe("getOperator", () => {
  it("returns both values, trimmed, when they are set", () => {
    expect(
      getOperator({ OPERATOR_NAME: "  Jane Doe ", OPERATOR_CONTACT_EMAIL: " privacy@example.com  " }),
    ).toEqual({ name: "Jane Doe", contactEmail: "privacy@example.com" });
  });

  it("returns nulls when neither variable is set", () => {
    expect(getOperator({})).toEqual({ name: null, contactEmail: null });
  });

  it("resolves each value independently", () => {
    expect(getOperator({ OPERATOR_NAME: "Jane Doe" })).toEqual({ name: "Jane Doe", contactEmail: null });
    expect(getOperator({ OPERATOR_CONTACT_EMAIL: "privacy@example.com" })).toEqual({
      name: null,
      contactEmail: "privacy@example.com",
    });
  });

  it("treats empty and whitespace-only values as missing", () => {
    expect(getOperator({ OPERATOR_NAME: "", OPERATOR_CONTACT_EMAIL: "" })).toEqual({
      name: null,
      contactEmail: null,
    });
    expect(getOperator({ OPERATOR_NAME: "   ", OPERATOR_CONTACT_EMAIL: " \t " })).toEqual({
      name: null,
      contactEmail: null,
    });
  });

  it("treats a value without an email shape as missing", () => {
    for (const value of ["not-an-email", "a@b", "@example.com", "jane doe@example.com"]) {
      expect(getOperator({ OPERATOR_CONTACT_EMAIL: value }).contactEmail).toBeNull();
    }
  });
});
