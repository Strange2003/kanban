import { TAG_COLOR_STYLES, type TagColor } from "@/lib/tag-colors";

// FR-010 of 013-project-catalogs: a thin line along the card's bottom edge,
// one equal segment per tag, in the card's tag order. Decorative only — the
// card's aria-label names the tags for screen readers.
export function TagColorBar({ tags }: { tags: { name: string; color: TagColor }[] }) {
  if (tags.length === 0) return null;
  return (
    <div
      aria-hidden
      data-testid="tag-color-bar"
      className="pointer-events-none absolute inset-x-0 bottom-0 flex h-1 overflow-hidden rounded-b-md"
    >
      {tags.map((tag) => (
        <span key={tag.name} data-color={tag.color} className={`flex-1 ${TAG_COLOR_STYLES[tag.color].bar}`} />
      ))}
    </div>
  );
}
