"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Account page: profile (name is editable, email is not), a way to the
// connected agents, and Sign out.
export function AccountSettings({ name: initialName, email, image }: { name: string; email: string; image: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!trimmed) {
      setError("Enter your name.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await authClient.updateUser({ name: trimmed });
    setSaving(false);
    if (updateError) {
      setError(updateError.message ?? "Could not save your name.");
      return;
    }
    setName(trimmed);
    router.refresh();
  }

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    const { error: signOutError } = await authClient.signOut();
    if (signOutError) {
      setSigningOut(false);
      setError(signOutError.message ?? "Could not sign out.");
      return;
    }
    // Full navigation: drops every cached, per-user page of the router.
    window.location.assign("/sign-in");
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-sm font-semibold">
          Profile
        </h2>
        <div className="flex items-center gap-3">
          <Avatar name={initialName} image={image} className="h-12 w-12 text-base" />
          <p className="text-muted-foreground min-w-0 truncate text-sm">{email}</p>
        </div>
        <form onSubmit={handleSave} className="space-y-1.5" noValidate>
          <Label htmlFor="account-name">Name</Label>
          <div className="flex gap-2">
            <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <Button type="submit" disabled={saving || !trimmed || trimmed === initialName}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3" aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-sm font-semibold">
          More
        </h2>
        <Link
          href="/settings/agents"
          className="hover:bg-accent flex items-center gap-2 rounded-md border border-border p-3 text-sm"
        >
          <Bot className="h-4 w-4" aria-hidden />
          Connected agents
        </Link>
      </section>

      <section className="space-y-3" aria-labelledby="session-heading">
        <h2 id="session-heading" className="text-sm font-semibold">
          Session
        </h2>
        <Button type="button" variant="outline" onClick={handleSignOut} disabled={signingOut}>
          <LogOut className="h-4 w-4" aria-hidden />
          {signingOut ? "Signing out..." : "Sign out"}
        </Button>
      </section>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
