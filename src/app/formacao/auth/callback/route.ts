import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

const BASE_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";

const COOKIE_PREFIX = "sb-syiaushvzhgyhvsmoegt-auth-token";

function buildSetCookie(name: string, value: string, options: Record<string, unknown> = {}): string {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${(options.path as string) || "/"}`);
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${(options.sameSite as string) || "Lax"}`);
  return parts.join("; ");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") || "/formacao";

  if (code) {
    const cookieStore = await cookies();
    const allCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              allCookies.push({ name, value, options: options || {} });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const url = `${BASE_URL}${redirectTo}`;
      const headers = new Headers({ Location: url });

      // Set session cookies from Supabase SDK
      for (const c of allCookies) {
        headers.append("Set-Cookie", buildSetCookie(c.name, c.value, c.options));
      }

      // Delete the PKCE code-verifier cookie (prevents client from hanging)
      headers.append("Set-Cookie", `${COOKIE_PREFIX}-code-verifier=; Path=/; Max-Age=0; Secure; SameSite=Lax`);

      return new Response(null, { status: 302, headers });
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `${BASE_URL}/formacao/auth` },
  });
}
