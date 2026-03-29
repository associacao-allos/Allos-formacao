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
import type { Profile } from "@/types";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isInstructor: boolean;
  isStudent: boolean;
  isAssociado: boolean;
}

interface InitialSession {
  access_token: string;
  refresh_token: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
  const [initCounter, setInitCounter] = useState(0);
  // Re-create client when initCounter changes (bfcache restore)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), [initCounter]);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        setProfile(data);
      } catch (err) {
        console.error("[AUTH] fetchProfile error:", err);
      }
    },
    [supabase]
  );

  /**
   * Apply a session: update user state, fetch profile, update ref.
   * Returns the user if successful, null otherwise.
   */
  const applySession = useCallback(
    async (session: Session | null) => {
      const authUser = session?.user ?? null;
      currentUserIdRef.current = authUser?.id ?? null;
      setUser(authUser);
      if (authUser) {
        await fetchProfile(authUser.id);
      } else {
        setProfile(null);
      }
      return authUser;
    },
    [fetchProfile]
  );

  // Re-initialize auth on bfcache restore (F5 / back-forward navigation).
  // When the browser restores a page from bfcache, the entire JS heap is
  // reused, so useEffect cleanup never ran and refs keep stale values.
  // The "pageshow" event with persisted=true detects this case.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        resetClient();
        setLoading(true);
        setInitCounter((c) => c + 1);
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Step 1: Try reading session from localStorage (via custom cookie handler).
        // This works on F5 refresh and tab reopen because localStorage persists.
        const {
          data: { session: localSession },
        } = await supabase.auth.getSession();

        if (localSession?.user && !cancelled) {
          await applySession(localSession);
          setLoading(false);
          return;
        }

        // Step 2: Use server-provided session (SSR reads HTTP cookies, passes as prop).
        // This handles the case where HTTP cookies exist but localStorage was cleared.
        if (initialSession?.access_token && !cancelled) {
          const { data } = await supabase.auth.setSession({
            access_token: initialSession.access_token,
            refresh_token: initialSession.refresh_token,
          });
          if (!cancelled && data.session) {
            await applySession(data.session);
            setLoading(false);
            return;
          }
        }

        // Step 3: Fallback - fetch session from server endpoint.
        // This handles edge cases where neither localStorage nor SSR props worked.
        if (!cancelled) {
          try {
            const res = await fetch("/formacao/auth/session", {
              credentials: "include",
              cache: "no-store",
            });
            if (res.ok) {
              const json = await res.json();
              if (json.session?.access_token && !cancelled) {
                const { data } = await supabase.auth.setSession({
                  access_token: json.session.access_token,
                  refresh_token: json.session.refresh_token,
                });
                if (!cancelled && data.session) {
                  await applySession(data.session);
                  setLoading(false);
                  return;
                }
              }
            }
          } catch {
            // Session endpoint not reachable (e.g., /api routes blocked by Cloudflare)
            // This is expected in some deployment configs
          }
        }

        // No session found anywhere
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        console.error("[AUTH] init error:", err);
        if (!cancelled) setLoading(false);
      }
    }

    init();

    // Listen for auth state changes (token refresh, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      const newUser = session?.user ?? null;
      const newUserId = newUser?.id ?? null;

      // Skip if the user hasn't changed
      if (newUserId === currentUserIdRef.current) return;

      currentUserIdRef.current = newUserId;
      setUser(newUser);
      if (newUser) {
        await fetchProfile(newUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile, initialSession, applySession, initCounter]);

  const signOut = useCallback(async () => {
    currentUserIdRef.current = null;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    // Also clear localStorage to prevent stale data on next visit
    try {
      localStorage.removeItem("sb-auth-cookies");
    } catch {
      // ignore
    }
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signOut,
      isAdmin: profile?.role === "admin",
      isInstructor: profile?.role === "instructor",
      isStudent: profile?.role === "student",
      isAssociado: profile?.role === "associado",
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
