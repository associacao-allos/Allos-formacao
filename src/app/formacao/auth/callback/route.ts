import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

const BASE_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";

function hardRedirect(path: string, setCookies?: { name: string; value: string; options?: Record<string, unknown> }[]) {
  const url = `${BASE_URL}${path}`;
  const headers = new Headers({ Location: url });
  if (setCookies) {
    for (const c of setCookies) {
      const parts = [`${c.name}=${c.value}`, "Path=/"];
      if (c.options?.httpOnly) parts.push("HttpOnly");
      if (c.options?.secure) parts.push("Secure");
      if (c.options?.sameSite) parts.push(`SameSite=${c.options.sameSite}`);
      if (c.options?.maxAge) parts.push(`Max-Age=${c.options.maxAge}`);
      headers.append("Set-Cookie", parts.join("; "));
    }
  }
  return new Response(null, { status: 307, headers });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") || "/formacao";

  if (code) {
    const cookieStore = await cookies();
    const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            pendingCookies.push(...cookiesToSet);
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // ignore if called from Server Component
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return hardRedirect(redirectTo, pendingCookies);
    }
  }

  return hardRedirect("/formacao/auth");
}
