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
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        currentUserIdRef.current = authUser?.id ?? null;
        setUser(authUser);
        if (authUser) {
          await fetchProfile(authUser.id);
        }
      } catch {
        // Auth fetch failed — continue with null user
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
