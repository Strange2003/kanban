import { describe, expect, it } from "vitest";
import { DEFAULT_TAG_COLOR, TAG_COLORS, TAG_COLOR_HEX, TAG_COLOR_STYLES, isTagColor } from "@/lib/tag-colors";

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("tag color palette (FR-008, SC-003 of 013-project-catalogs)", () => {
  it("has 10 unique colors including the gray default", () => {
    expect(TAG_COLORS).toHaveLength(10);
    expect(new Set(TAG_COLORS).size).toBe(10);
    expect(TAG_COLORS).toContain("gray");
    expect(DEFAULT_TAG_COLOR).toBe("gray");
  });

  it("defines styles and hex values for every color", () => {
    expect(Object.keys(TAG_COLOR_STYLES).sort()).toEqual([...TAG_COLORS].sort());
    expect(Object.keys(TAG_COLOR_HEX).sort()).toEqual([...TAG_COLORS].sort());
  });

  for (const color of TAG_COLORS) {
    it(`${color}: chip text contrast is at least 4.5:1 in light and dark mode`, () => {
      const { light, dark } = TAG_COLOR_HEX[color];
      expect(contrast(light.bg, light.text)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.bg, dark.text)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${color}: the Tailwind classes use the documented hex values`, () => {
      const { light, dark, solid } = TAG_COLOR_HEX[color];
      const { chip, bar, swatch } = TAG_COLOR_STYLES[color];
      expect(chip).toContain(`bg-[${light.bg}]`);
      expect(chip).toContain(`text-[${light.text}]`);
      expect(chip).toContain(`dark:bg-[${dark.bg}]`);
      expect(chip).toContain(`dark:text-[${dark.text}]`);
      expect(bar).toBe(`bg-[${solid}]`);
      expect(swatch).toBe(`bg-[${solid}]`);
    });
  }

  it("isTagColor accepts only palette keys", () => {
    expect(isTagColor("blue")).toBe(true);
    expect(isTagColor("#0000ff")).toBe(false);
    expect(isTagColor(undefined)).toBe(false);
  });
});
