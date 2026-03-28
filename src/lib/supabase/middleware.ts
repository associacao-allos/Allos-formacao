import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const BASE_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";

function hardRedirect(path: string, cookieSource?: NextResponse) {
  const headers = new Headers({ Location: `${BASE_URL}${path}` });
  if (cookieSource) {
    for (const cookie of cookieSource.cookies.getAll()) {
      headers.append("Set-Cookie", `${cookie.name}=${cookie.value}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    }
  }
  return new Response(null, { status: 307, headers });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected routes that require authentication
  const protectedPaths = ["/formacao/admin", "/formacao/curso"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  // If accessing a protected route without auth, redirect to login
  if (isProtected && !user) {
    return hardRedirect(`/formacao/auth?redirect=${encodeURIComponent(pathname)}`, supabaseResponse);
  }

  // Admin routes — check role (admin or instructor required)
  if (pathname.startsWith("/formacao/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const allowedRoles = ["admin", "instructor"];
    if (!profile?.role || !allowedRoles.includes(profile.role)) {
      return hardRedirect("/formacao", supabaseResponse);
    }
  }

  return supabaseResponse;
}
