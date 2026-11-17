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
export const SITE_TAGLINE = "Find and share the things people build — mods, tools, hacks and tweaks.";
