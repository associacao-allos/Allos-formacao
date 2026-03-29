import { createClient as createJsClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let client: ReturnType<typeof createJsClient> | null = null;

/**
 * Auth-aware client using localStorage (not cookies).
 * Session is bridged from cookies via /api/auth/session on first load.
 */
export function createClient() {
  if (client) return client;
  client = createJsClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      storageKey: "sb-auth-token",
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });
  return client;
}

// Client for data-only queries (no auth, never hangs)
let dataClient: ReturnType<typeof createJsClient> | null = null;

export function createDataClient() {
  if (dataClient) return dataClient;
  dataClient = createJsClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return dataClient;
}
