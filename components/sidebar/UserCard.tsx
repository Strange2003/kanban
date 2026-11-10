"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Mini card at the bottom of the side panel: who is signed in. It is the link
// to the account page (/settings/account), where signing out lives.
export function UserCard({ name, email, image }: { name: string; email: string; image: string | null }) {
  const pathname = usePathname();
  const current = pathname === "/settings/account";
  return (
    <Link
      href="/settings/account"
      aria-label="Account settings"
      aria-current={current ? "page" : undefined}
      className={cn(
        "hover:bg-accent focus-visible:ring-ring mx-2 mb-2 flex min-w-0 items-center gap-2 rounded-md border border-border p-2 focus-visible:ring-2 focus-visible:outline-none",
        current && "bg-accent",
      )}
    >
      <Avatar name={name} image={image} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="text-muted-foreground block truncate text-xs">{email}</span>
      </span>
    </Link>
  );
}
