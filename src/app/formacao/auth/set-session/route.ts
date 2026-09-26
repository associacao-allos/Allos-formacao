import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookie";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /formacao/auth/set-session
 *
 * Client sends { access_token, refresh_token } after a successful
 * signInWithPassword / signUp / OAuth exchange. This route calls
 * supabase.auth.setSession() which triggers the ssr cookie handler to
 * emit real HttpOnly `Set-Cookie` headers. Without this bridge the
 * browser-side cookie writes get silently blocked in Brave/Safari shields,
 * leaving the server without any session, middleware loops users back
 * to /formacao/auth even though localStorage says they are logged in.
 *
 * Client is expected to only navigate after this call succeeds.
 */
const CSRF_HEADER = "x-allos-auth";

export async function POST(request: NextRequest) {
  if (request.headers.get(CSRF_HEADER) !== "1") {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  let body: { access_token?: string; refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const access_token = typeof body.access_token === "string" ? body.access_token : "";
  const refresh_token = typeof body.refresh_token === "string" ? body.refresh_token : "";

  if (!access_token || !refresh_token) {
    return NextResponse.json(
      { error: "Missing access_token or refresh_token" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message || "Failed to set session" },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { user: { id: data.user?.id, email: data.user?.email } },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
