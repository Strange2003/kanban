import { cn } from "@/lib/utils";

// 011-agent-access-mcp FR-004/FR-007: a person next to a Work Item — their
// Google photo when they have one, else their initials. Always labelled with
// the name, so it never relies on the picture alone.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({
  name,
  image,
  size = "md",
  className,
}: {
  name: string;
  image: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const dimensions = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        "bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium",
        dimensions,
        className,
      )}
    >
      {image ? (
        // A plain <img>: avatars come from arbitrary OAuth hosts, which
        // next/image would need configured one by one.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
