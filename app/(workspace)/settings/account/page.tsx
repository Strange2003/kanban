import { requireSession } from "@/lib/auth";
import { AccountSettings } from "@/components/settings/AccountSettings";

// Account settings: profile and Sign out. The user card in the side panel links here.
export default async function AccountPage() {
  const { user } = await requireSession();

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
        <h1 className="text-lg font-semibold">Account</h1>
        <AccountSettings name={user.name} email={user.email} image={user.image ?? null} />
      </div>
    </main>
  );
}
