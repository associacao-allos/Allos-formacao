// Auth client-side via decode direto de JWT, bypassa supabase.auth.* porque
// os métodos do @supabase/ssr travam em alguns navegadores (incidente Brave +
// shields, ver memory project_oauth_debug). Estratégia atual:
//
// 1. SSR injeta tokens via initialSession (mais confiável)
// 2. Fallback: lê access_token do localStorage (chave sb-auth-cookies, populada
//    pelo bridge em /formacao/auth/callback)
// 3. fetchProfile() consulta tabela `profiles` pra montar role/avatar/nome
//
// signOut() só faz POST pra /auth/sign-out + window.location.href pra limpar
// estado client-side; o middleware lida com cookies sb-*.

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { createElement } from "react";
import { createClient, resetClient } from "@/lib/supabase/client";
import { ehCookieDeSessao } from "@/lib/supabase/cookie";
import { logger } from "@/lib/logger";
import { cargosDe, temCargo } from "@/lib/cargos";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /**
   * O papel principal e os cargos extras, juntos.
   *
   * É o que o catálogo de áreas (`@/lib/areas`) consome para decidir o menu.
   * Os `isX` abaixo continuam existindo porque meia dúzia de telas pergunta
   * por um cargo só, mas quem pergunta "que áreas cabem a esta pessoa?" usa
   * este conjunto, a resposta passa a ser a mesma do middleware.
   */
  cargos: Set<string>;
  isAdmin: boolean;
  isInstructor: boolean;
  isStudent: boolean;
  isAssociado: boolean;
  /** Cargo dedicado a eventos do calendário, vê só essa área. */
  isEventos: boolean;
  /** Conduz um grupo: vê e ajusta só o próprio encontro. */
  isCondutor: boolean;
  /** Admin ou cargo de eventos. */
  canManageEvents: boolean;
}

interface InitialSession {
  access_token: string;
  refresh_token: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "sb-auth-cookies";
const PROFILE_CACHE_KEY = "sb-profile-cache";

interface CachedProfile {
  userId: string;
  profile: Profile;
  cachedAt: number;
}

function readProfileCache(userId: string): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedProfile = JSON.parse(raw);
    if (parsed.userId !== userId) return null;
    // 24h TTL, alem disso, refresh em background sempre roda mesmo com cache.
    if (Date.now() - parsed.cachedAt > 24 * 60 * 60 * 1000) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

function writeProfileCache(userId: string, profile: Profile) {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedProfile = { userId, profile, cachedAt: Date.now() };
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore (localStorage cheio/desabilitado)
  }
}

function clearProfileCache() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Decode a JWT payload without verification.
 * Safe because the token came from our own server.
 */
function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    // O payload vem em base64url e o JSON em UTF-8: atob direto falhava com
    // "-"/"_" e embaralhava nome acentuado em user_metadata.
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(payload), (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/**
 * Build a minimal User object from JWT payload.
 */
function userFromJWT(token: string): User | null {
  const payload = decodeJWT(token);
  if (!payload?.sub) return null;

  // Check expiration
  if (payload.exp && (payload.exp as number) * 1000 < Date.now()) {
    return null; // token expired
  }

  return {
    id: payload.sub as string,
    email: (payload.email as string) || "",
    user_metadata: (payload.user_metadata as Record<string, unknown>) || {},
    app_metadata: (payload.app_metadata as Record<string, unknown>) || {},
    aud: (payload.aud as string) || "authenticated",
    created_at: "",
  } as User;
}

/**
 * Try to get access_token from localStorage (the sb-auth-cookies store).
 * The cookies contain chunked session data that includes the tokens.
 *
 * @supabase/ssr 0.5+ prefixa o valor do cookie com "base64-" antes do
 * payload codificado. Versões mais antigas serializavam o JSON direto
 * (sem prefixo, sem base64). Lidamos com os dois pra não quebrar quem
 * já tem localStorage do formato anterior.
 */
function getTokenFromLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cookies: { name: string; value: string }[] = JSON.parse(raw);

    // Concatena chunks na ordem certa (.0, .1, ... ou nome principal sozinho).
    const authCookies = cookies
      // Só a sessão deste backend: a da época da Supabase, se ainda estiver no
      // armazenamento, colaria os pedaços dos dois tokens num JSON inválido.
      .filter((c) => ehCookieDeSessao(c.name) && !c.name.includes("code-verifier"))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (authCookies.length === 0) return null;

    let combined = authCookies.map((c) => c.value).join("");

    let sessionStr: string | null = null;
    if (combined.startsWith("base64-")) {
      const payload = combined.slice("base64-".length);
      try {
        sessionStr = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      } catch {
        return null;
      }
    } else if (combined.startsWith("{")) {
      sessionStr = combined;
    } else {
      // Compat: tenta base64url puro (sem prefixo); se falhar, JSON cru.
      try {
        sessionStr = atob(combined.replace(/-/g, "+").replace(/_/g, "/"));
      } catch {
        sessionStr = combined;
      }
    }

    const session = JSON.parse(sessionStr);
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export function AuthProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: InitialSession | null;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, role, cargos, certificate_name, created_at, updated_at")
          .eq("id", userId)
          .single();
        if (data) {
          setProfile(data);
          writeProfileCache(userId, data);
        }
      } catch (err) {
        logger.error("AUTH", "fetchProfile error:", err);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Strategy: decode JWT directly, never call supabase.auth.*
        // (those methods hang in Brave due to @supabase/ssr internals)

        let authUser: User | null = null;

        // 1. Try SSR-provided session (most reliable)
        if (initialSession?.access_token) {
          authUser = userFromJWT(initialSession.access_token);
          logger.debug("AUTH", "SSR session:", authUser ? authUser.email : "expired/invalid");
        }

        // 2. Try localStorage
        if (!authUser) {
          const lsToken = getTokenFromLocalStorage();
          if (lsToken) {
            authUser = userFromJWT(lsToken);
            logger.debug("AUTH", "localStorage session:", authUser ? authUser.email : "expired/invalid");
          } else {
            logger.debug("AUTH", "localStorage: empty");
          }
        }

        if (cancelled) return;

        if (authUser) {
          currentUserIdRef.current = authUser.id;
          setUser(authUser);

          // Stale-while-revalidate: usa cache do localStorage instantaneamente
          // pra desbloquear UI (avatar, role checks). fetchProfile roda em
          // background pra revalidar, qualquer mudanca de role/nome aparece
          // na proxima paint.
          const cached = readProfileCache(authUser.id);
          if (cached) {
            setProfile(cached);
            // Drop loading o quanto antes, UI pode renderizar com cache.
            setLoading(false);
            // Revalida em background, sem await.
            fetchProfile(authUser.id);
            return; // pula o setLoading no finally
          }
          await fetchProfile(authUser.id);
        } else {
          logger.debug("AUTH", "no valid session found");
        }
      } catch (err) {
        logger.error("AUTH", "init error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    // Detect bfcache restore, reset the Supabase singleton first so the
    // next createClient() rebuilds with fresh in-memory state (otherwise
    // the client can hold stale tokens / listeners from the prior page
    // load).
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        resetClient();
        init();
      }
    }
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [initialSession, fetchProfile]);

  const signOut = useCallback(async () => {
    currentUserIdRef.current = null;
    setUser(null);
    setProfile(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    clearProfileCache();
    // Server-side: invalida o refresh token no Supabase + limpa cookies
    // HttpOnly que o JS não consegue clarear sozinho.
    try {
      await fetch("/formacao/auth/sign-out", {
        method: "POST",
        credentials: "include",
        headers: { "X-Allos-Auth": "1" },
      });
    } catch (err) {
      logger.warn("useAuth", "sign-out endpoint failed:", err);
    }
    window.location.href = "/formacao/auth";
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signOut,
      cargos: cargosDe(profile),
      isAdmin: temCargo(profile, "admin"),
      isInstructor: temCargo(profile, "instructor"),
      isStudent: temCargo(profile, "student"),
      isAssociado: temCargo(profile, "associado"),
      isEventos: temCargo(profile, "eventos"),
      isCondutor: temCargo(profile, "condutor"),
      canManageEvents: temCargo(profile, "admin") || temCargo(profile, "eventos"),
    }),
    [user, profile, loading, signOut]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
