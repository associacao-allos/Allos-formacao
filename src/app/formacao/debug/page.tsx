"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/hooks/useAuth";

export default function DebugPage() {
  const auth = useAuth();
  const [results, setResults] = useState<Record<string, string>>({});

  function set(key: string, val: string) {
    setResults((prev) => ({ ...prev, [key]: val }));
  }

  useEffect(() => {
    set("cookies", document.cookie || "(vazio)");
    set("localStorage", Object.keys(localStorage).join(", ") || "(vazio)");

    // Test 1: raw fetch (no Supabase SDK)
    fetch("https://syiaushvzhgyhvsmoegt.supabase.co/rest/v1/courses?select=id,title&status=eq.published&limit=2", {
      headers: { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aWF1c2h2emhneWh2c21vZWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODU3ODMsImV4cCI6MjA5MDA2MTc4M30.8aLqek5JRvILounYZJr-lKqL7UVzbCV4KSeF73nYo-M" },
    })
      .then((r) => r.json())
      .then((d) => set("rawFetch", "OK: " + JSON.stringify(d)))
      .catch((e) => set("rawFetch", "ERRO: " + e.message));

    // Test 2: existing singleton client (uses cookies)
    try {
      const client = createClient();
      const timeoutId = setTimeout(() => set("singletonClient", "TIMEOUT (5s) - client travou"), 5000);
      client.from("courses").select("id,title").eq("status", "published").limit(2)
        .then(({ data, error }) => {
          clearTimeout(timeoutId);
          if (error) set("singletonClient", "ERRO: " + JSON.stringify(error));
          else set("singletonClient", "OK: " + JSON.stringify(data));
        });
    } catch (e: unknown) {
      set("singletonClient", "EXCEPTION: " + (e instanceof Error ? e.message : String(e)));
    }

    // Test 3: fresh client WITHOUT session persistence
    try {
      const freshClient = createBrowserClient(
        "https://syiaushvzhgyhvsmoegt.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aWF1c2h2emhneWh2c21vZWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODU3ODMsImV4cCI6MjA5MDA2MTc4M30.8aLqek5JRvILounYZJr-lKqL7UVzbCV4KSeF73nYo-M",
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );
      const timeoutId2 = setTimeout(() => set("freshClient", "TIMEOUT (5s) - client travou"), 5000);
      freshClient.from("courses").select("id,title").eq("status", "published").limit(2)
        .then(({ data, error }) => {
          clearTimeout(timeoutId2);
          if (error) set("freshClient", "ERRO: " + JSON.stringify(error));
          else set("freshClient", "OK: " + JSON.stringify(data));
        });
    } catch (e: unknown) {
      set("freshClient", "EXCEPTION: " + (e instanceof Error ? e.message : String(e)));
    }
  }, []);

  return (
    <div style={{ padding: 40, color: "white", fontFamily: "monospace", fontSize: 13, lineHeight: 2.2 }}>
      <h1>Debug v2</h1>
      <p><b>Auth loading:</b> {String(auth.loading)}</p>
      <p><b>Auth user:</b> {auth.user ? auth.user.email : "null"}</p>
      <p><b>Auth profile:</b> {auth.profile ? auth.profile.full_name + " (" + auth.profile.role + ")" : "null"}</p>
      <hr />
      <p><b>1. Raw fetch:</b> {results.rawFetch || "loading..."}</p>
      <p><b>2. Singleton client (com cookies):</b> {results.singletonClient || "loading..."}</p>
      <p><b>3. Fresh client (SEM cookies):</b> {results.freshClient || "loading..."}</p>
      <hr />
      <p><b>Cookies:</b></p>
      <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflow: "auto", background: "rgba(255,255,255,0.05)", padding: 10 }}>{results.cookies || "..."}</pre>
      <p><b>localStorage:</b> {results.localStorage || "..."}</p>
    </div>
  );
}
