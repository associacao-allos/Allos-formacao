import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /formacao/api/home-data/revalidate
 *
 * Called by the admin UI right after toggling featured / is_structured /
 * publish status / display_order on a course, so the next /formacao home
 * load picks up the change instantly instead of waiting for the 30s cache
 * window. Authenticated as admin or instructor only.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: { name: AUTH_COOKIE_NAME },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // read-only, don't need to set cookies in this handler
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile?.role || !["admin", "instructor"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    revalidateTag("formacao-home-data");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "revalidate failed" },
      { status: 500 }
    );
  }
}
