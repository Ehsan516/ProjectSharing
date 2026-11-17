import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";
import { postLoginPath } from "@/lib/auth";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

/**
 * Handles both email-link styles:
 *  - token_hash + type  (works in any browser/device; used by our email templates)
 *  - code               (PKCE; only works in the browser that requested the link)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeRedirectPath(searchParams.get("next"));
  const supabase = await createClient();

  let userId: string | undefined;
  let failure: string | undefined = searchParams.get("error_description") ?? undefined;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    userId = data.user?.id;
    failure = error?.message;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    userId = data.user?.id;
    failure = error?.message;
  }

  if (!userId) {
    console.error("[auth/callback] sign-in failed:", failure ?? "no token in URL");
    return NextResponse.redirect(`${origin}/login?error=link&next=${encodeURIComponent(next)}`);
  }

  return NextResponse.redirect(`${origin}${await postLoginPath(supabase, userId, next)}`);
}
