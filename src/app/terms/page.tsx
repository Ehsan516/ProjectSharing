import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage, Operator } from "@/components/Legal";
import { SITE_NAME } from "@/lib/env";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms are the agreement between you and <Operator />, who runs {SITE_NAME}. By using {SITE_NAME} you agree
        to them. Our <Link href="/privacy">privacy policy</Link> explains how we handle your data.
      </p>

      <h2>Who can use {SITE_NAME}</h2>
      <ul>
        <li>You must be at least 13 to create an account. If you&apos;re under 18, get a parent or carer&apos;s OK first.</li>
        <li>One account per person. Keep access to your email secure, because anyone who can read it can sign in as you.</li>
        <li>You&apos;re responsible for what happens on your account.</li>
      </ul>

      <h2>What you can post</h2>
      <p>Only post things you made, or have the right to share. You must not post:</p>
      <ul>
        <li>
          ROMs, game files, or copyrighted art, music or code you don&apos;t have permission to share. Romhacks must be
          shared as patch files (such as IPS, BPS or xdelta), never as patched ROMs.
        </li>
        <li>Pirated or cracked software, key generators, or tools whose main purpose is piracy or cheating in online games.</li>
        <li>Malware, spyware, or anything that damages devices or data, steals information, or hides what it does.</li>
        <li>
          Anything illegal, including child sexual abuse material, terrorist content, fraud and scams, or content that
          encourages self-harm.
        </li>
        <li>Harassment, threats, hate, sexual content, or someone else&apos;s private information.</li>
        <li>Spam, or posts that misrepresent what a download does.</li>
      </ul>

      <h2>Sharing someone else&apos;s work</h2>
      <p>
        You can post a project someone else made only if they&apos;ve said you can. When you do, choose &quot;Sharing
        someone else&apos;s work&quot;, name the creator and link to where they posted it, so they get the credit. If
        you changed someone else&apos;s project, credit the original in your description. If a creator tells us their
        work was posted without permission, we&apos;ll take it down.
      </p>

      <h2>Repeat infringers</h2>
      <p>
        Each time we remove content because it infringed someone&apos;s rights, the account that posted it gets a strike.
        We close accounts that get three strikes, and we may close an account sooner for deliberate or large-scale
        infringement. Strikes are removed if a counter-notice is upheld.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of what you post. You give us a worldwide, non-exclusive, royalty-free licence to host, copy,
        display and distribute it on {SITE_NAME} so the site can work, for as long as it stays on the site. If you
        don&apos;t say which licence your project uses, other people may download and use it for their own personal use
        only.
      </p>

      <h2>Downloads are at your own risk</h2>
      <p>
        Everything on {SITE_NAME} is made and uploaded by users, not by us. We can remove things that break these terms,
        but we can&apos;t check everything, and we can&apos;t promise any download is safe, works, or does what it says.
        Check the source code and the &quot;works for me&quot; reports, scan files before running them, and back up your
        device or save files first. Modifying a game, console, phone or car can void warranties or break another
        service&apos;s rules. That&apos;s your decision and your responsibility.
      </p>

      <h2>Reports, moderation and complaints</h2>
      <ul>
        <li>
          Report anything that breaks these terms using <strong>Report</strong> in the &quot;…&quot; menu on a project,
          or email <ContactEmail />.
        </li>
        <li>
          We may remove content, or suspend or close accounts, that break these terms or the law. Where we can, we&apos;ll
          tell you what we removed and why.
        </li>
        <li>
          If you disagree with a decision we made about your content or account, or want to complain about how we handle
          reports, email us. See <Link href="/contact">Contact and takedowns</Link> for how we deal with complaints.
        </li>
      </ul>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time in <Link href="/settings">Settings</Link>. This permanently deletes your
        profile and everything you&apos;ve posted. We may close accounts that seriously or repeatedly break these terms.
      </p>

      <h2>Our responsibility to you</h2>
      <p>
        {SITE_NAME} is provided as it is, and it may sometimes be unavailable. We aren&apos;t responsible for loss or
        damage caused by files or content other users post, or for losses we couldn&apos;t reasonably have foreseen.
        Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or
        for anything else the law doesn&apos;t allow us to limit, and nothing affects your legal rights as a consumer.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. We&apos;ll change the date at the top, and tell you before a significant change
        takes effect. If you keep using {SITE_NAME} after that, you accept the new terms.
      </p>

      <h2>Law</h2>
      <p>
        These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland, you can
        also bring a claim in your local courts.
      </p>
    </LegalPage>
  );
}
