import Link from "next/link";

// Public reading layout for /privacy and /terms (010-legal-pages). It lives
// outside app/(workspace)/, whose layout requires a session, so both pages are
// reachable signed out (FR-001, FR-002). "Back to Kanban" goes to "/", which
// already sends signed-out visitors to /sign-in and members to their projects
// (FR-008).
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6">
      <Link href="/" className="text-muted-foreground hover:text-foreground w-fit text-sm">
        ← Back to Kanban
      </Link>

      <main className="text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </main>

      <footer className="text-muted-foreground mt-auto flex gap-4 border-t border-border pt-4 text-xs">
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
