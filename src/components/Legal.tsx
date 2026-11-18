import { LEGAL, SITE_NAME } from "@/lib/env";

/** Layout for the Terms, Privacy and Contact pages: readable line length, plain styling. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article
      className="mx-auto max-w-2xl text-[15px] leading-relaxed [&_a]:text-accent [&_a:hover]:underline [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="!mt-1 text-sm text-muted">
        {SITE_NAME} · Last updated {LEGAL.updated}
      </p>
      {children}
    </article>
  );
}

/** The operator's name. Shows a loud placeholder until NEXT_PUBLIC_OPERATOR_NAME is set. */
export function Operator() {
  return LEGAL.operator ? <>{LEGAL.operator}</> : <Missing what="NEXT_PUBLIC_OPERATOR_NAME" />;
}

/** The contact email as a mailto link. Shows a loud placeholder until NEXT_PUBLIC_CONTACT_EMAIL is set. */
export function ContactEmail() {
  return LEGAL.email ? <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> : <Missing what="NEXT_PUBLIC_CONTACT_EMAIL" />;
}

function Missing({ what }: { what: string }) {
  return <mark className="rounded bg-bad/15 px-1 font-mono text-xs text-bad">[set {what}]</mark>;
}
