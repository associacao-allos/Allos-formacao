import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Key used in localStorage to store cookie data.
 * This avoids reading document.cookie (which hangs in Brave with shields).
 * The format is an array of { name, value } objects representing cookies.
 */
const STORAGE_KEY = "sb-auth-cookies";

function getStoredCookies(): { name: string; value: string }[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setStoredCookies(
  cookies: { name: string; value: string; options?: Record<string, unknown> }[]
) {
  if (typeof window === "undefined") return;

  // 1. Update localStorage (the primary storage for the browser client)
  const existing = getStoredCookies();
  const map = new Map(existing.map((c) => [c.name, c.value]));
  for (const c of cookies) {
    if (c.value) {
      map.set(c.name, c.value);
    } else {
      map.delete(c.name);
    }
  }
  const result: { name: string; value: string }[] = [];
  map.forEach((value, name) => result.push({ name, value }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result));

  // 2. Also try to write to document.cookie so the server can read them
  //    (needed for PKCE code_verifier). Wrapped in try/catch because
  //    Brave with aggressive shields might block this.
  try {
    for (const c of cookies) {
      const parts = [`${c.name}=${c.value}`];
      parts.push("path=/");
      if (c.options?.maxAge) parts.push(`max-age=${c.options.maxAge}`);
      if (!c.value) parts.push("max-age=0");
      parts.push("secure");
      parts.push("samesite=lax");
      document.cookie = parts.join("; ");
    }
  } catch {
    // Brave or other browsers may block document.cookie writes.
    // localStorage is the primary storage, so this is not critical
    // for session persistence. PKCE flow may fail if this is blocked,
    // but the session bridge will handle it.
    console.warn("[supabase/client] document.cookie write blocked");
  }
}

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return getStoredCookies();
      },
      setAll(
        cookies: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        setStoredCookies(cookies);
      },
    },
  });
  return client;
}

/**
 * Write session cookie chunks directly to localStorage.
 * Called from the callback bridge page to seed localStorage
 * before the main app loads.
 */
export function seedLocalStorageCookies(
  cookies: { name: string; value: string }[]
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cookies));
}

/**
 * Clear all stored auth cookies from localStorage.
 */
export function clearLocalStorageCookies() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Reset the singleton client so the next createClient() call
 * creates a fresh instance. Use after bfcache restore to avoid
 * stale internal auth state.
 */
export function resetClient() {
  client = null;
}
