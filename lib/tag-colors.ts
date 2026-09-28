/**
 * The fixed tag color palette of 013-project-catalogs (FR-008). Deliberately
 * pure — no `db`, `next/*` or `lib/auth` imports — so `db/schema.ts` builds the
 * `tag_color` enum from it and client components style chips with it.
 *
 * Classes are written out literally (arbitrary hex values) because Tailwind 4
 * only generates classes it can see in the source; the hex values are the same
 * ones listed in TAG_COLOR_HEX, which tests/unit/tag-colors.test.ts checks for
 * a text contrast of at least 4.5:1 in light and dark mode (SC-003).
 */

export const TAG_COLORS = [
  "gray",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

// FR-009: existing tags, and tags created without picking a color.
export const DEFAULT_TAG_COLOR: TagColor = "gray";

// Chip background and text per mode, and the solid tone of the card's color bar.
export const TAG_COLOR_HEX: Record<
  TagColor,
  { light: { bg: string; text: string }; dark: { bg: string; text: string }; solid: string }
> = {
  gray: { light: { bg: "#f3f4f6", text: "#1f2937" }, dark: { bg: "#374151", text: "#f3f4f6" }, solid: "#6b7280" },
  red: { light: { bg: "#fee2e2", text: "#991b1b" }, dark: { bg: "#7f1d1d", text: "#fee2e2" }, solid: "#ef4444" },
  orange: { light: { bg: "#ffedd5", text: "#9a3412" }, dark: { bg: "#7c2d12", text: "#ffedd5" }, solid: "#f97316" },
  amber: { light: { bg: "#fef3c7", text: "#92400e" }, dark: { bg: "#78350f", text: "#fef3c7" }, solid: "#f59e0b" },
  green: { light: { bg: "#dcfce7", text: "#166534" }, dark: { bg: "#14532d", text: "#dcfce7" }, solid: "#22c55e" },
  teal: { light: { bg: "#ccfbf1", text: "#115e59" }, dark: { bg: "#134e4a", text: "#ccfbf1" }, solid: "#14b8a6" },
  blue: { light: { bg: "#dbeafe", text: "#1e40af" }, dark: { bg: "#1e3a8a", text: "#dbeafe" }, solid: "#3b82f6" },
  indigo: { light: { bg: "#e0e7ff", text: "#3730a3" }, dark: { bg: "#312e81", text: "#e0e7ff" }, solid: "#6366f1" },
  violet: { light: { bg: "#ede9fe", text: "#5b21b6" }, dark: { bg: "#4c1d95", text: "#ede9fe" }, solid: "#8b5cf6" },
  pink: { light: { bg: "#fce7f3", text: "#9d174d" }, dark: { bg: "#831843", text: "#fce7f3" }, solid: "#ec4899" },
};

// `chip`: background + text of a tag chip; `bar`: one segment of the card's
// color line; `swatch`: a color option in the picker. Must mirror TAG_COLOR_HEX.
export const TAG_COLOR_STYLES: Record<TagColor, { label: string; chip: string; bar: string; swatch: string }> = {
  gray: {
    label: "Gray",
    chip: "bg-[#f3f4f6] text-[#1f2937] dark:bg-[#374151] dark:text-[#f3f4f6]",
    bar: "bg-[#6b7280]",
    swatch: "bg-[#6b7280]",
  },
  red: {
    label: "Red",
    chip: "bg-[#fee2e2] text-[#991b1b] dark:bg-[#7f1d1d] dark:text-[#fee2e2]",
    bar: "bg-[#ef4444]",
    swatch: "bg-[#ef4444]",
  },
  orange: {
    label: "Orange",
    chip: "bg-[#ffedd5] text-[#9a3412] dark:bg-[#7c2d12] dark:text-[#ffedd5]",
    bar: "bg-[#f97316]",
    swatch: "bg-[#f97316]",
  },
  amber: {
    label: "Amber",
    chip: "bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f] dark:text-[#fef3c7]",
    bar: "bg-[#f59e0b]",
    swatch: "bg-[#f59e0b]",
  },
  green: {
    label: "Green",
    chip: "bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#dcfce7]",
    bar: "bg-[#22c55e]",
    swatch: "bg-[#22c55e]",
  },
  teal: {
    label: "Teal",
    chip: "bg-[#ccfbf1] text-[#115e59] dark:bg-[#134e4a] dark:text-[#ccfbf1]",
    bar: "bg-[#14b8a6]",
    swatch: "bg-[#14b8a6]",
  },
  blue: {
    label: "Blue",
    chip: "bg-[#dbeafe] text-[#1e40af] dark:bg-[#1e3a8a] dark:text-[#dbeafe]",
    bar: "bg-[#3b82f6]",
    swatch: "bg-[#3b82f6]",
  },
  indigo: {
    label: "Indigo",
    chip: "bg-[#e0e7ff] text-[#3730a3] dark:bg-[#312e81] dark:text-[#e0e7ff]",
    bar: "bg-[#6366f1]",
    swatch: "bg-[#6366f1]",
  },
  violet: {
    label: "Violet",
    chip: "bg-[#ede9fe] text-[#5b21b6] dark:bg-[#4c1d95] dark:text-[#ede9fe]",
    bar: "bg-[#8b5cf6]",
    swatch: "bg-[#8b5cf6]",
  },
  pink: {
    label: "Pink",
    chip: "bg-[#fce7f3] text-[#9d174d] dark:bg-[#831843] dark:text-[#fce7f3]",
    bar: "bg-[#ec4899]",
    swatch: "bg-[#ec4899]",
  },
};

export function isTagColor(value: unknown): value is TagColor {
  return typeof value === "string" && (TAG_COLORS as readonly string[]).includes(value);
}
