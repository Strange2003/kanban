import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OperatorContact, OperatorName } from "@/components/legal/OperatorContact";
import { getOperator, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service · Kanban" };

// FR-002/FR-005 of 010-legal-pages.
export default async function TermsPage() {
  // Request-time read of the operator, same as /privacy.
  await connection();
  const operator = getOperator(process.env);

  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: {LEGAL_LAST_UPDATED}</p>

      <h2>Who provides this service</h2>
      <p>
        This instance of Kanban is provided by <OperatorName operator={operator} />. By creating an account or using
        this instance, you agree to these terms.
      </p>

      <h2>The software</h2>
      <p>
        Kanban is open-source software released under the MIT License. It is provided &ldquo;as is&rdquo;, without
        warranty of any kind: the service may change, be interrupted or stop being offered, and data could be lost.
        Keep your own copy of anything you can&apos;t afford to lose.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use this instance to:</p>
      <ul>
        <li>Do anything illegal.</li>
        <li>Harass or abuse other people, or send spam (including through invitations).</li>
        <li>Try to access projects or data you haven&apos;t been given access to.</li>
        <li>Disrupt or overload the service.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you create belongs to you and to the members of the project where you create it. The operator stores
        it only to provide the service, as described in the <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Suspension</h2>
      <p>The operator may suspend or delete accounts that break these terms.</p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, neither the operator of this instance nor the authors of the software are
        liable for any damages arising from the use of this service or the inability to use it.
      </p>

      <h2>Changes</h2>
      <p>
        If these terms change, the updated version will be published on this page with a new &ldquo;Last
        updated&rdquo; date. Continuing to use the service means you accept them.
      </p>

      <h2>Contact</h2>
      <p>
        For any question about these terms, <OperatorContact operator={operator} />.
      </p>
    </article>
  );
}
