import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookie";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
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
        setAll() {
          // read-only
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
  };

  if (!session) {
    return Response.json({ session: null, user: null }, { headers });
  }

  // Não retornar refresh_token (XSS pode roubá-lo). Cookies HttpOnly já
  // têm os tokens server-side; o cliente só precisa saber se há sessão.
  return Response.json(
    {
      session: { active: true },
      user: { id: session.user.id, email: session.user.email },
    },
    { headers }
  );
}
