import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

function cleanPkceCookie() {
  if (typeof document !== "undefined") {
    const prefix = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL!.match(/\/\/([^.]+)/)?.[1]}-auth-token`;
    document.cookie = `${prefix}-code-verifier=; Max-Age=0; path=/`;
  }
}

export function createClient() {
  if (client) return client;
  cleanPkceCookie();
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
