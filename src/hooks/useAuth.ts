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
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

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

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data);
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;

    async function getUser() {
      try {
        // 1. Try localStorage (via custom cookie handler — fast, no network)
        const { data: { session: localSession } } = await supabase.auth.getSession();
        console.log("[AUTH] localStorage session:", localSession ? "found" : "null");

        if (localSession?.user) {
          if (cancelled) return;
          currentUserIdRef.current = localSession.user.id;
          setUser(localSession.user);
          await fetchProfile(localSession.user.id);
          return;
        }

        // 2. No local session — bridge from server cookies to localStorage
        const res = await fetch("/formacao/auth/session", { cache: "no-store" });
        const body = await res.json();
        console.log("[AUTH] server bridge:", body.session ? "found" : "null");
        if (cancelled) return;

        if (body.session?.access_token) {
          await supabase.auth.setSession({
            access_token: body.session.access_token,
            refresh_token: body.session.refresh_token,
          });
          // Session bridged to localStorage — force hard navigation (bypass bfcache)
          window.location.replace(window.location.pathname + "?_=" + Date.now());
          return;
        }
      } catch (err) {
        console.error("[AUTH] error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      const newUser = session?.user ?? null;
      const newUserId = newUser?.id ?? null;

      // Skip if same user (avoids unnecessary profile re-fetch + re-renders)
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
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    currentUserIdRef.current = null;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
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
