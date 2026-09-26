// Supabase clients pra Server Components / Route Handlers / Server Actions.
//
// - createServerSupabaseClient(): respeita RLS. Lê cookies de auth do request.
// - createServiceRoleClient(): bypass total de RLS via SUPABASE_SERVICE_ROLE_KEY.
//   Use só em rotas server-side controladas (ex.: /admin/configuracoes/update-role).
//   NUNCA exponha esse cliente no browser.

import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookie";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Mesmo motivo do cliente de service role logo abaixo: no Next 14 o fetch
      // é cacheado por padrão, e uma sessão conferida contra o banco não pode
      // vir de uma resposta guardada.
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
      cookieOptions: { name: AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

export async function createServiceRoleClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      // O Supabase fala com o Postgres por fetch, e no App Router do Next 14 o
      // fetch é cacheado por padrão. O resultado de uma consulta ficava guardado
      // pela URL e devolvido de novo indefinidamente, mesmo depois de o banco
      // mudar, porque o cache não tem como saber que uma linha foi alterada.
      //
      // Foi assim que um certificado anulado continuou saindo como VÁLIDO na
      // verificação pública: bastava alguém ter consultado o código antes da
      // anulação para a resposta antiga ficar presa. Reproduzido em 05/08/2026,
      // inclusive falando direto com o Railway, o que descartou a CDN. É
      // exatamente o dano que a cláusula 8.7 dos Termos tenta evitar.
      //
      // Dado administrativo lido com service role nunca deve vir de cache: a
      // pergunta é sempre "como está agora".
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
