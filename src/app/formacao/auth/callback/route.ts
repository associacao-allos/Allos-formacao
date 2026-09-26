import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookie";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

const BASE_URL =
  process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";

/**
 * OAuth callback handler.
 *
 * After exchanging the code for a session, we return an HTML page that:
 * 1. Seeds localStorage with the session cookies (so the browser Supabase client can read them)
 * 2. Sets the same cookies via document.cookie (for SSR on subsequent requests)
 * 3. Navigates to the target page
 *
 * This avoids the chicken-and-egg problem where server-set cookies exist but
 * the client's localStorage-based cookie handler has no data.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") || "/formacao";

  if (code) {
    const cookieStore = await cookies();
    const collectedCookies: {
      name: string;
      value: string;
      options: Record<string, unknown>;
    }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: { name: AUTH_COOKIE_NAME },
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(
            cookiesToSet: {
              name: string;
              value: string;
              options?: Record<string, unknown>;
            }[]
          ) {
            cookiesToSet.forEach(({ name, value, options }) => {
              collectedCookies.push({ name, value, options: options || {} });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[AUTH CALLBACK] exchangeCodeForSession error:", error);

    if (!error && collectedCookies.length > 0) {
      // Build the bridge HTML page
      const targetUrl = `${BASE_URL}${redirectTo}`;

      // Prepare cookie data for localStorage seeding
      // Only include auth-token cookies (not code-verifier)
      const authCookies = collectedCookies
        .filter((c) => c.value && !c.name.endsWith("-code-verifier"))
        .map((c) => ({ name: c.name, value: c.value }));

      // Build Set-Cookie headers for the HTTP response too
      // This ensures the server can read them on subsequent SSR requests
      const setCookieHeaders: string[] = [];
      for (const c of collectedCookies) {
        const parts = [`${c.name}=${c.value}`];
        parts.push(`Path=${(c.options.path as string) || "/"}`);
        if (c.options.maxAge) parts.push(`Max-Age=${c.options.maxAge}`);
        if (c.options.domain) parts.push(`Domain=${c.options.domain}`);
        if (c.options.httpOnly) parts.push("HttpOnly");
        if (c.options.secure !== false) parts.push("Secure");
        parts.push(`SameSite=${(c.options.sameSite as string) || "Lax"}`);
        setCookieHeaders.push(parts.join("; "));
      }

      // Delete PKCE code-verifier cookie
      setCookieHeaders.push(
        `${collectedCookies[0]?.name?.split("-auth-token")[0] || "sb"}-auth-token-code-verifier=; Path=/; Max-Age=0; Secure; SameSite=Lax`
      );

      // Return an HTML page that bridges server cookies to client localStorage
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Autenticando...</title>
  <style>
    body {
      background: #111111;
      color: #FDFBF7;
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .loader {
      text-align: center;
      opacity: 0.5;
    }
  </style>
</head>
<body>
  <div class="loader">Autenticando...</div>
  <script>
    try {
      // Seed localStorage with session cookies so the Supabase browser client can read them
      var cookies = ${JSON.stringify(authCookies)};
      localStorage.setItem("sb-auth-cookies", JSON.stringify(cookies));
    } catch(e) {
      console.error("[AUTH BRIDGE] Failed to seed localStorage:", e);
    }
    // Navigate to the target page
    window.location.replace(${JSON.stringify(targetUrl)});
  </script>
</body>
</html>`;

      const headers = new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      });

      // Also set HTTP cookies so SSR works on the next request
      for (const sc of setCookieHeaders) {
        headers.append("Set-Cookie", sc);
      }

      console.log(
        "[AUTH CALLBACK] Serving bridge page, target:",
        targetUrl,
        "cookies:",
        authCookies.length
      );

      return new Response(html, { status: 200, headers });
    }

    console.log("[AUTH CALLBACK] FAILED, redirecting to auth page");
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `${BASE_URL}/formacao/auth` },
  });
}
