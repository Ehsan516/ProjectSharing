import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage, Operator } from "@/components/Legal";
import { SITE_NAME } from "@/lib/env";

export const metadata: Metadata = { title: "Contact and takedowns" };

export default function ContactPage() {
  return (
    <LegalPage title="Contact and takedowns">
      <p>
        For anything about {SITE_NAME}, email <ContactEmail />.
      </p>

      <h2>Report a project</h2>
      <p>
        Open the project, choose the &quot;…&quot; menu, then <strong>Report</strong>. Or email us with the link and
        what&apos;s wrong. We review every report, and remove illegal content, malware and ROMs as quickly as we can.
      </p>

      <h2>Someone posted your work</h2>
      <p>
        Open the project, choose the &quot;…&quot; menu, then <strong>Report</strong>, and pick &quot;This is my work,
        posted without my permission&quot;. Include a link to where you originally posted it. Ownership claims go to the
        front of the queue. You can also send a formal copyright notice, below.
      </p>

      <h2>Copyright takedowns</h2>
      <p>
        If something on {SITE_NAME} infringes your copyright, email us with the following. This covers UK notices and
        notices under the US Digital Millennium Copyright Act (DMCA).
      </p>
      <ul>
        <li>Your name, and how to contact you.</li>
        <li>The work you own, or a link to it.</li>
        <li>The link to each project or file on {SITE_NAME} that infringes it.</li>
        <li>A statement that you believe in good faith the use isn&apos;t authorised by you, your agent or the law.</li>
        <li>
          A statement that the information in your notice is accurate and, under penalty of perjury, that you own the
          rights or are authorised to act for the owner.
        </li>
        <li>Your physical or electronic signature (typing your full name is enough).</li>
      </ul>
      <p>
        We&apos;ll remove the content and tell the person who posted it. If they believe the removal was a mistake, they
        can reply with a counter-notice explaining why, and we&apos;ll pass it on to you. Accounts that repeatedly post
        infringing content are closed, as set out in our <Link href="/terms">terms</Link>.
      </p>
      <p>
        Our designated agent for DMCA notices is <Operator />, reachable at <ContactEmail />.
      </p>

      <h2>Complaints and appeals</h2>
      <p>
        If you think we got a moderation decision wrong, including removing your content or closing your account, or you
        want to complain about how we handled a report, email us with the details. We aim to reply within 7 days and will
        tell you what we decided and why.
      </p>

      <h2>Your data</h2>
      <p>
        You can download or delete your data yourself in <Link href="/settings">Settings</Link>. For any other data
        request, see the <Link href="/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
