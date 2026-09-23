import Link from "next/link";

// Links to /privacy and /terms from the sign-in and sign-up screens (FR-007 of
// 010-legal-pages). They open in a new tab: those screens keep the form in
// local state, which navigating away would lose (research.md § Enlaces en
// pestaña nueva).
const linkProps = { target: "_blank", rel: "noopener noreferrer", className: "underline underline-offset-4" };

export function LegalLinks({ consent = false }: { consent?: boolean }) {
  if (consent) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        By creating an account or continuing with Google, you agree to the{" "}
        <Link href="/terms" {...linkProps}>
          Terms of Service
        </Link>{" "}
        and acknowledge the{" "}
        <Link href="/privacy" {...linkProps}>
          Privacy Policy
        </Link>
        .
      </p>
    );
  }

  return (
    <p className="text-center text-xs text-muted-foreground">
      <Link href="/privacy" {...linkProps}>
        Privacy Policy
      </Link>{" "}
      ·{" "}
      <Link href="/terms" {...linkProps}>
        Terms of Service
      </Link>
    </p>
  );
}
