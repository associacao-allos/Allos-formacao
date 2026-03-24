"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_CATEGORIES } from "@/lib/constants";

export function useCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data, error } = await createClient()
        .from("categories")
        .select("name")
        .order("name");

      if (!error && data) {
        setCategories(data.map((c) => c.name));
      } else {
        // Fallback only if table doesn't exist or query fails
        setCategories(DEFAULT_CATEGORIES);
      }
      setLoading(false);
    }
    fetch().catch(() => { setCategories(DEFAULT_CATEGORIES); setLoading(false); });
  }, []);

  return { categories, loading };
}
