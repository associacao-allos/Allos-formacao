import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  // Verify the caller is an admin
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { userId, role } = await request.json();

  if (!userId || !role) {
    return Response.json({ error: "userId e role são obrigatórios" }, { status: 400 });
  }

  // Prevent self-demotion
  if (userId === session.user.id && role !== "admin") {
    return Response.json({ error: "Não pode remover sua própria permissão" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
