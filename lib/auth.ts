import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { db } from "@/db/client";
import { applyPendingInvitationsForUser } from "@/lib/invitations";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set. Copy .env.example to .env.local and fill it in.");
}
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32");
}

const resend = new Resend(process.env.RESEND_API_KEY);
const emailFrom = process.env.EMAIL_FROM ?? "Kanban <onboarding@resend.dev>";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),

  // FR-001/FR-002/FR-003 of 001-accounts-invitations
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8, // FR-002 of 001
    requireEmailVerification: true,
    // FR-016 of 001: recover a forgotten password via an emailed link.
    // Better Auth's own reset-request endpoint already responds the same
    // way whether or not the email exists, so no extra work is needed here
    // to satisfy "don't reveal if the email exists" — verify this against
    // current Better Auth docs during first real run (see T067).
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: emailFrom,
        to: user.email,
        subject: "Reset your Kanban password",
        html: `<p>Someone requested a password reset for this account. Click below to choose a new password:</p><p><a href="${url}">Reset your password</a></p><p>If this wasn't you, you can safely ignore this email.</p>`,
      });
    },
  },

  // FR-015 of 001: email/password accounts must verify their email before
  // pending invitations addressed to them are applied.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from: emailFrom,
        to: user.email,
        subject: "Verify your email",
        html: `<p>Confirm your email to finish setting up your Kanban account:</p><p><a href="${url}">Verify email</a></p>`,
      });
    },
  },

  // FR-001 of 001: "Continuar con Google" — a Google account is considered
  // verified immediately (see FR-015 of 001 and data-model.md § Cuenta).
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },

  // FR-007 of 001: apply any pending invitation as soon as the invited
  // email becomes a verified account (signup via Google is verified
  // immediately; signup via email/password only once `emailVerified`
  // flips to true). Both cases funnel through this one hook.
  //
  // NOTE: this is the integration point flagged in AGENTS.md as worth
  // double-checking against Better Auth's current `databaseHooks` docs the
  // first time this actually runs against a real database — the shape
  // below reflects the stable `databaseHooks.user.create.after` /
  // `user.update.after` pattern, but hook payload details can shift
  // between versions.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user.emailVerified) {
            await applyPendingInvitationsForUser(user.id, user.email);
          }
        },
      },
      update: {
        after: async (user) => {
          if (user.emailVerified) {
            await applyPendingInvitationsForUser(user.id, user.email);
          }
        },
      },
    },
  },
});

export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Redirects to /sign-in when there's no session — use in Server Components/Actions that require auth. */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}
