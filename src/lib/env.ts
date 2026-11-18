function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill in your Supabase keys.`,
    );
  }
  return value;
}

// Accessed with literal `process.env.X` so Next.js can inline NEXT_PUBLIC_ values.
export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  },
};

export const SITE_NAME = "Forkyard";
export const SITE_TAGLINE = "Find, download and follow the mods, romhacks, tools and tweaks fans build for the things they love.";

/**
 * Who runs the site and how to reach them. Shown on the Privacy, Terms and Contact pages,
 * which UK law requires to name the operator and give a contact. Set these in your env vars.
 */
export const LEGAL = {
  operator: process.env.NEXT_PUBLIC_OPERATOR_NAME || "",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  updated: "18 November 2026",
};
