import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage, Operator } from "@/components/Legal";
import { SITE_NAME } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        This page explains what personal data {SITE_NAME} collects, why, who sees it and what your rights are.{" "}
        {SITE_NAME} is run by <Operator /> (&quot;we&quot;, &quot;us&quot;), who is the controller of your personal data
        under UK data protection law. You can contact us at <ContactEmail />.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address, which we use to sign you in, and the username, display name
          and bio you choose.
        </li>
        <li>
          <strong>What you post:</strong> projects, releases, uploaded files and cover images, video links, comments,
          &quot;works for me&quot; reports (including the setup you describe), your likes and dislikes, the tags and
          projects you follow, and any reports you send us about content.
        </li>
        <li>
          <strong>Technical data:</strong> the cookies that keep you signed in, and the IP address, browser and device
          details that our hosting providers record in their logs. We count downloads, but we don&apos;t record who
          downloaded what.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>
          To run your account and show what you post. This is necessary to provide the service you signed up for.
        </li>
        <li>
          To keep {SITE_NAME} safe: reviewing reports, removing illegal or harmful content, and stopping spam and abuse.
          We do this because we have a legitimate interest in a safe site, and because the Online Safety Act 2023
          requires it.
        </li>
        <li>To reply when you contact us, which is in our legitimate interests and yours.</li>
      </ul>
      <p>We don&apos;t sell your data, we don&apos;t show ads, and we don&apos;t use your data to profile you.</p>

      <h2>What other people can see</h2>
      <p>
        Your username, display name, bio and everything you post are public, including your comments and &quot;works for
        me&quot; reports. Like and dislike totals are public, but which projects you liked or disliked is not shown to
        other people. Your email address and the tags and projects you follow are never shown to anyone else.
      </p>

      <h2>Who we share it with</h2>
      <p>We use these providers to run {SITE_NAME}. They process data on our behalf and under contract:</p>
      <ul>
        <li>Supabase, for our database, sign-in and file storage.</li>
        <li>Vercel, for hosting the website.</li>
        <li>Our email delivery provider, to send sign-in emails.</li>
      </ul>
      <p id="videos">
        Project videos are hosted on YouTube (Google). Until you choose to watch, we only show the video&apos;s thumbnail
        image, which your browser loads from YouTube&apos;s image server. The video player itself loads only when you
        tap play, or if you&apos;ve said yes to playing previews automatically. Once the player loads, YouTube receives
        your IP address and may store cookies or similar data on your device under{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google&apos;s privacy policy
        </a>
        . We use its privacy-enhanced mode (youtube-nocookie.com), which limits this.
      </p>
      <p>
        Some of these providers may process data outside the UK. When they do, we rely on safeguards recognised under UK
        law, such as the UK Extension to the EU-US Data Privacy Framework or standard contractual clauses with the UK
        Addendum. We will also share data with the police or other authorities when the law requires it.
      </p>

      <h2>Cookies</h2>
      <p>
        We only set the cookies needed to keep you signed in. They are strictly necessary for the site to work, so we
        don&apos;t ask for consent to them. We don&apos;t use analytics or advertising cookies. If you answer the
        &quot;Play video previews automatically?&quot; question, your answer is saved on your device so we don&apos;t ask
        again. You can change it at any time with the <strong>Video autoplay</strong> switch at the bottom of every page.
        For YouTube, see above.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your account and posts are kept until you delete them or delete your account.</li>
        <li>
          When you delete your account, your profile, projects, releases, files, comments, reports, likes and follows are
          deleted straight away. Copies can remain in our providers&apos; backups until those backups expire.
        </li>
        <li>Uploaded files that were never attached to a post are deleted automatically within about two days.</li>
        <li>Reports about content are kept for as long as we need them to deal with the problem.</li>
      </ul>

      <h2>Your rights</h2>
      <p>Under UK data protection law you have the right to:</p>
      <ul>
        <li>
          get a copy of your data. Use <strong>Download your data</strong> in <Link href="/settings">Settings</Link>.
        </li>
        <li>correct it. You can edit your profile and posts at any time.</li>
        <li>
          have it deleted. Use <strong>Delete account</strong> in <Link href="/settings">Settings</Link>.
        </li>
        <li>object to or restrict how we use it, and move it to another service.</li>
      </ul>
      <p>
        For anything you can&apos;t do yourself, email <ContactEmail />. We&apos;ll reply within one month. If
        you&apos;re unhappy with how we handle your data, you can complain to the Information Commissioner&apos;s Office
        at{" "}
        <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">
          ico.org.uk
        </a>{" "}
        or on 0303 123 1113.
      </p>

      <h2>Children</h2>
      <p>
        You must be at least 13 to create an account. If you&apos;re a parent or carer and think your child has an
        account they shouldn&apos;t, email us and we&apos;ll delete it.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy we&apos;ll update this page and the date at the top. If a change is significant,
        we&apos;ll tell you by email or on the site first.
      </p>
    </LegalPage>
  );
}
