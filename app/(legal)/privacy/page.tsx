import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OperatorContact, OperatorName } from "@/components/legal/OperatorContact";
import { getOperator, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy · Kanban" };

// FR-001/FR-003/FR-004 of 010-legal-pages. What "Data we store" lists is mapped
// to real tables in specs/010-legal-pages/data-model.md — update both (and
// LEGAL_LAST_UPDATED) whenever a feature starts storing new personal data.
export default async function PrivacyPage() {
  // Read the operator at request time, not at build time, so one build can
  // serve instances with different operators (research.md of 010-legal-pages).
  await connection();
  const operator = getOperator(process.env);

  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: {LEGAL_LAST_UPDATED}</p>

      <h2>Who runs this instance</h2>
      <p>
        Kanban is open-source, self-hosted software. There is no central service: every instance is run by
        whoever deploys it, not by the authors of the software. This instance is run by{" "}
        <OperatorName operator={operator} />, who is responsible for the data stored in it and for this policy.
      </p>

      <h2>Data we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name and email address. If you sign up with email and password, your
          password is stored only in hashed form, never in a readable form. If you sign in with Google, we also
          store your profile picture and the sign-in tokens Google returns.
        </li>
        <li>
          <strong>Your sessions:</strong> for each active session, the IP address and browser (user agent) it was
          started from, and when it expires.
        </li>
        <li>
          <strong>Short-lived codes:</strong> the links we email you to verify your address or reset your password.
          They expire on their own.
        </li>
        <li>
          <strong>What you create:</strong> projects, board columns, Work Items and all their fields, tags, areas,
          iterations and the links between Work Items.
        </li>
        <li>
          <strong>Collaboration:</strong> which projects you belong to and with which role, the invitations you
          send or receive, and your in-app notifications.
        </li>
        <li>
          <strong>Activity history:</strong> a log of changes made to each Work Item and who made them.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to provide the service: to identify you and keep you signed in, to show you your projects and the
        ones you were invited to, and to send you email address verification and password reset emails. We don&apos;t
        use your data for anything else.
      </p>

      <h2>Who can see it</h2>
      <p>
        Other members of a project you belong to can see your name and email address, and the content and activity
        history of that project. People who don&apos;t share a project with you can&apos;t see any of it.
      </p>

      <h2>Service providers</h2>
      <p>To run, this instance relies on a few providers that process data on its behalf:</p>
      <ul>
        <li>A database provider, which stores all the data listed above.</li>
        <li>An email delivery provider, which sends verification and password reset emails to your address.</li>
        <li>A hosting provider, which runs the application and receives your requests.</li>
        <li>
          Google, only if you choose to sign in with Google. We receive only your name, email address and profile
          picture, and use them only to identify you. We don&apos;t use Google data for any other purpose.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>No advertising.</li>
        <li>No third-party tracking or analytics.</li>
        <li>We don&apos;t sell your data or share it with anyone for any other purpose.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We only use essential cookies that keep you signed in. There are no advertising or analytics cookies.
      </p>

      <h2>Keeping and deleting your data</h2>
      <p>
        Your data is kept for as long as your account exists. To get a copy of your data, correct it, or have your
        account deleted, <OperatorContact operator={operator} />. Deleting your account removes your personal data;
        content in shared projects may remain available to their other members.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the updated version will be published on this page with a new &ldquo;Last
        updated&rdquo; date.
      </p>

      <h2>Contact</h2>
      <p>
        For any question about this policy or your data, <OperatorContact operator={operator} />. See also the{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    </article>
  );
}
