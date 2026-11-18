import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import Link from "next/link";
import { Header } from "@/components/Header";
import { VideoConsentToggle } from "@/components/VideoConsent";
import { env, LEGAL, SITE_NAME, SITE_TAGLINE } from "@/lib/env";
import "./globals.css";

// Body: Instrument Sans. Headings: Bricolage Grotesque. Metadata (versions, counts, tags): IBM Plex Mono.
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const heading = Bricolage_Grotesque({ variable: "--font-heading", subsets: ["latin"], display: "swap" });
const code = IBM_Plex_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  // Lets shared links resolve images and URLs to the real domain once NEXT_PUBLIC_SITE_URL is set.
  metadataBase: env.siteUrl ? new URL(env.siteUrl) : undefined,
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", title: SITE_NAME, description: SITE_TAGLINE },
  twitter: { card: "summary", title: SITE_NAME, description: SITE_TAGLINE },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edebe6" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${heading.variable} ${code.variable} font-sans antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-signal focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-signal-fg"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
          {children}
        </main>
        <footer className="border-t border-[var(--hairline)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-xs text-muted">
            <span>
              © {new Date().getFullYear()} {LEGAL.operator || SITE_NAME}
            </span>
            <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/terms" className="hover:text-text">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-text">
                Privacy
              </Link>
              <Link href="/contact" className="hover:text-text">
                Contact and takedowns
              </Link>
              <VideoConsentToggle />
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
