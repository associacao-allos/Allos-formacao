import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  // 1. Save to localStorage (for client-side reads without document.cookie hang)
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

  // 2. Also write to document.cookie (so server can read them — e.g. PKCE code_verifier)
  for (const c of cookies) {
    const parts = [`${c.name}=${c.value}`];
    parts.push("path=/");
    if (c.options?.maxAge) parts.push(`max-age=${c.options.maxAge}`);
    if (!c.value) parts.push("max-age=0"); // delete cookie
    parts.push("secure");
    parts.push("samesite=lax");
    document.cookie = parts.join("; ");
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
      setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]) {
        setStoredCookies(cookies);
      },
    },
  });
  return client;
}
