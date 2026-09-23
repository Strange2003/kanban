"use client";

import { Avatar } from "@/components/ui/avatar";
import type { AssigneeView } from "@/lib/work-item-view";

type Member = AssigneeView & { email?: string };

// 011-agent-access-mcp FR-004: pick one current member of the project, or
// nobody. A native <select> (like Priority/Severity next to it) keeps keyboard
// and screen-reader behavior for free; the avatar beside it shows who's picked.
export function AssigneePicker({
  id,
  members,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string;
  members: Member[];
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const selected = members.find((m) => m.userId === value) ?? null;
  // Same-named people are told apart by email when the viewer may see emails.
  const duplicated = new Set(
    members.map((m) => m.name).filter((name, index, names) => names.indexOf(name) !== index),
  );
  const label = (m: Member) => (duplicated.has(m.name) && m.email ? `${m.name} (${m.email})` : m.name);

  return (
    <div className="flex items-center gap-2">
      {selected ? (
        <Avatar name={selected.name} image={selected.image} />
      ) : (
        <span className="border-border inline-block h-7 w-7 shrink-0 rounded-full border border-dashed" aria-hidden />
      )}
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className={className}
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {label(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
