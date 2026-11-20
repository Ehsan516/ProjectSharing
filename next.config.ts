import type { NextConfig } from "next";

function buildCsp(isDev: boolean) {
  let supabaseOrigin = "https://*.supabase.co";
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
    }
  } catch {
    // Keep wildcard fallback if env var is unset or malformed during build.
  }

  const scriptEval = isDev ? " 'unsafe-eval'" : "";
  const devWs = isDev ? " ws: wss:" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${scriptEval} https://www.youtube.com https://s.ytimg.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin} https://*.supabase.co https://i.ytimg.com`,
    `connect-src 'self'${devWs} ${supabaseOrigin} https://*.supabase.co`,
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const headers = [
      { key: "Content-Security-Policy", value: buildCsp(isDev) },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (!isDev) {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
