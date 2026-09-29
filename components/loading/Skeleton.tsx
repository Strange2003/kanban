import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

// 015-loading-animations (contracts/loading-states.md): the building blocks of
// every loading skeleton. The motion itself is CSS (app/globals.css, kb-*).

/** A skeleton's root: announced as loading (FR-012) and invisible for its first 150 ms (FR-008). */
export function SkeletonFrame({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn("kb-skeleton", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A placeholder block; `fall` drops it in after `delay` ms, then it breathes until the page arrives. */
export function Bone({ className, delay = 0, fall = true }: { className?: string; delay?: number; fall?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("rounded bg-muted", fall && "kb-fall-in", className)}
      style={{ "--kb-delay": `${delay}ms` } as CSSProperties}
    />
  );
}
