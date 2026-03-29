import { createBrowserClient } from "@supabase/ssr";

function cleanPkceCookies() {
  if (typeof document === "undefined") return;
  document.cookie.split(";").forEach((c) => {
    const name = c.trim().split("=")[0];
    if (name.includes("code-verifier")) {
      document.cookie = `${name}=; path=/; max-age=0; secure; samesite=lax`;
    }
  });
}

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;
  cleanPkceCookies();
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: false,
      },
    }
  );
  return client;
}
