// Middleware Supabase: roda em cada request. Responsabilidades:
// 1. Refrescar sessão Supabase (set/update de cookies)
// 2. Bloquear rotas protegidas (/formacao/admin, /formacao/curso) sem login
//    redirecionando pra /formacao/auth?redirect=...
// 3. Em catch geral, limpa cookies sb-* e redireciona pra auth, evita loop
//    quando token está corrompido.

import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookie";
import { claimsVerificadas } from "@/lib/supabase/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { cargosDe } from "@/lib/cargos";
import { areaProibida, caminhosDoPainel, circulaLivre, homeDaPessoa, homeDoPainel } from "@/lib/areas";

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

function clearAuthRedirect(request: NextRequest, redirectPath: string) {
  const headers = new Headers({ Location: `${BASE_URL}${redirectPath}` });
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      headers.append(
        "Set-Cookie",
        `${cookie.name}=; Path=/; Max-Age=0; Secure; SameSite=Lax`
      );
    }
  }
  return new Response(null, { status: 307, headers });
}

// Public paths that don't need auth/profile checks. Skipping the middleware's
// supabase.auth.getUser() call here saves one Supabase round-trip (~200-500ms
// from Singapore region) per request to these endpoints.
const PUBLIC_PATH_PREFIXES = [
  "/formacao/api/home-data",
  "/formacao/auth/callback",
  "/formacao/auth/set-session",
  "/formacao/auth/sync-cookies",
  "/formacao/auth/forgot-password",
  "/formacao/auth/reset-password",
];

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) {
    // Pass through, let the route handler set its own Cache-Control
    // so CDN caching (s-maxage on home-data and ranking) actually works.
    return NextResponse.next({ request });
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: { name: AUTH_COOKIE_NAME },
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

    // A sessão é conferida localmente, sem round-trip pra /auth/v1/user em quase
    // toda chamada. Com SUPABASE_JWT_SECRET (GoTrue próprio, HS256) a conferência
    // é nossa, em @/lib/supabase/jwt; sem ele, getClaims() faz o mesmo quando o
    // token é assimétrico (era o caso na Supabase) e cai pra getUser() quando não.
    // getSession() lê o cookie e, se o token venceu, renova antes de devolver.
    let user: { id: string; role?: string | null; cargos?: string[] } | null = null;
    try {
      const segredoJwt = process.env.SUPABASE_JWT_SECRET;
      let claims: Record<string, unknown> | null | undefined;
      let claimsInvalidas = false;
      if (segredoJwt) {
        const { data: { session } } = await supabase.auth.getSession();
        claims = session ? await claimsVerificadas(session.access_token, segredoJwt) : null;
        claimsInvalidas = !!session && !claims;
      } else {
        const claimsResult = await supabase.auth.getClaims();
        claims = claimsResult.data?.claims;
        claimsInvalidas = !!claimsResult.error;
      }
      if (claims?.sub) {
        user = {
          id: claims.sub as string,
          role: (claims as Record<string, unknown>).user_role as string | null | undefined ?? null,
          // Cargos extras viajam no token junto do papel principal: sem isto o
          // middleware leria só um deles e mandaria a pessoa embora da área do
          // segundo cargo dela.
          cargos:
            ((claims as Record<string, unknown>).user_cargos as string[] | undefined) ?? [],
        };
      } else if (claimsInvalidas) {
        // claims invalido/expirado, tenta refresh via getUser
        const result = await supabase.auth.getUser();
        user = result.data.user ? { id: result.data.user.id } : null;
      }
    } catch (err) {
      // Corrupted/truncated sb-* cookies fazem getClaims/getUser quebrar e
      // propagar como 500 cru porque middleware errors bypassam error.tsx.
      // Tratar como nao autenticado e limpar cookies pra proxima request.
      console.error("[MIDDLEWARE] auth claims threw, clearing session:", err);
      const target = pathname.startsWith("/formacao/admin") || pathname.startsWith("/formacao/curso")
        ? `/formacao/auth?redirect=${encodeURIComponent(pathname)}`
        : pathname;
      return clearAuthRedirect(request, target);
    }

    // Protected routes that require authentication
    // /formacao/associados é a casa de quem conduz grupo, é associado ou cuida
    // dos eventos. Fica fora do painel de propósito: essas pessoas fazem o
    // trabalho delas, não administram a plataforma.
    const protectedPaths = ["/formacao/admin", "/formacao/curso", "/formacao/associados"];
    const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

    // If accessing a protected route without auth, redirect to login
    if (isProtected && !user) {
      return hardRedirect(`/formacao/auth?redirect=${encodeURIComponent(pathname)}`, supabaseResponse);
    }

    // Conta bloqueada (migration 045): o gate é aqui, não na interface, senão
    // bastaria digitar a URL. A consulta só roda em rota protegida, e a tela de
    // acesso suspenso fica de fora para não virar laço de redirecionamento.
    if (isProtected && user && !pathname.startsWith("/formacao/acesso-suspenso")) {
      const { data: perfilBloqueio } = await supabase
        .from("profiles")
        .select("bloqueado")
        .eq("id", user.id)
        .maybeSingle();
      if (perfilBloqueio?.bloqueado) {
        return hardRedirect("/formacao/acesso-suspenso", supabaseResponse);
      }
    }

    // Admin routes, check role (admin or instructor required).
    // Prefere claim `user_role` no JWT (custom_access_token_hook, função SQL
    // em supabase/migrations/078_cargos_acumulaveis.sql): zero round-trip. Cai pra query
    // em profiles so quando o claim nao existe (hook ainda nao habilitada).
    if (pathname.startsWith("/formacao/admin") && user) {
      let role: string | null = user.role ?? null;
      let cargos: string[] = user.cargos ?? [];

      if (!role) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, cargos")
          .eq("id", user.id)
          .single();
        role = profile?.role ?? null;
        cargos = profile?.cargos ?? [];
      }

      // Basta UM cargo servir, e a lista de quem-pode não mora aqui: vem do
      // catálogo em @/lib/areas, o mesmo de onde o menu do site e a navegação
      // do painel tiram a resposta. Enquanto essa lista estava escrita à mão
      // em cada um dos três lugares, eles envelheciam separados, e a falha
      // aparecia como área que existe, funciona, e some do menu.
      const meus = cargosDe({ role, cargos });
      const suas = caminhosDoPainel(meus);

      // Nenhuma área no painel: esta pessoa não tem o que fazer aqui. Vai para
      // a casa dela, e não para a home, despejar quem conduz um grupo em
      // /formacao a obrigaria a descobrir sozinha onde foi parar o trabalho.
      if (!suas.length) {
        return hardRedirect(homeDaPessoa(meus), supabaseResponse);
      }

      // Área com dono não se abre para quem circula livre.
      //
      // O professor circula livre para alcançar as dezenas de telas do painel
      // que não estão no catálogo, e isso vinha abrindo junto as que o catálogo
      // marca como exclusivas do administrador: Configurações some do menu
      // dele, e digitar o endereço mostrava a lista de contas com o botão de
      // trocar cargo. O menu dizia uma coisa e a rota fazia outra.
      if (areaProibida(pathname, meus)) {
        return hardRedirect(homeDoPainel(meus), supabaseResponse);
      }

      // Preso à própria área só quem não circula livre. Quem acumula eventos e
      // condução anda entre as duas, e o hub é uma delas.
      if (!circulaLivre(meus)) {
        // A comparação respeita a fronteira do caminho de propósito: com
        // `startsWith` cru, uma área que fosse `/formacao/admin` casaria com o
        // painel inteiro e abriria tudo para um cargo restrito.
        const dentro = suas.some((a) => pathname === a || pathname.startsWith(`${a}/`));
        if (!dentro) return hardRedirect(homeDoPainel(meus), supabaseResponse);
      }
    }

    // Cache-Control: admin tem dados sensiveis (roles, alunos, financeiro) e
    // nao pode ser cacheado em lugar nenhum. Demais rotas autenticadas (curso,
    // meus-cursos via subpath /curso/*) podem usar `private`, o navegador do
    // usuario reaproveita o HTML em back/forward navigation, mas nenhum proxy
    // intermediario (Cloudflare/Railway edge) cacheia entre usuarios.
    if (pathname.startsWith("/formacao/admin")) {
      supabaseResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      supabaseResponse.headers.set("Pragma", "no-cache");
    } else {
      supabaseResponse.headers.set("Cache-Control", "private, max-age=0, must-revalidate");
    }

    return supabaseResponse;
  } catch (err) {
    // Last-resort safety net so a thrown middleware never reaches the client
    // as a bare "Internal Server Error".
    console.error("[MIDDLEWARE] unexpected throw, clearing session:", err);
    return clearAuthRedirect(request, "/formacao/auth");
  }
}
