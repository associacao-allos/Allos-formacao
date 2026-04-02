"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Archive, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useCategories } from "@/hooks/useCategories";
import CategoryCarousel from "@/components/formacao/CategoryCarousel";
import CourseBackground from "@/components/course/CourseBackground";
import type { Course } from "@/types";

export default function AcervoPage() {
  const { categories } = useCategories();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      const client = createClient();
      const { data } = await client
        .from("courses")
        .select(`
          *,
          instructor:profiles!courses_instructor_id_fkey(id, full_name, avatar_url)
        `)
        .eq("status", "published")
        .eq("is_discontinued", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (data) setCourses(data);
      setLoading(false);
    }
    fetchCourses();
  }, []);

  const coursesByCategory = useMemo(() => {
    const grouped: { title: string; courses: Course[] }[] = [];

    for (const cat of categories) {
      const catCourses = courses.filter((c) => c.category === cat);
      if (catCourses.length > 0) {
        grouped.push({ title: cat, courses: catCourses });
      }
    }

    const categorized = new Set(categories);
    const uncategorized = courses.filter(
      (c) => !c.category || !categorized.has(c.category)
    );
    if (uncategorized.length > 0) {
      grouped.push({ title: "Sem categoria", courses: uncategorized });
    }

    return grouped;
  }, [courses, categories]);

  return (
    <div className="relative">
      <CourseBackground />

      <div className="relative z-10">
        {/* Header */}
        <section className="pt-12 pb-8 px-5 sm:px-6 md:px-8">
          <div className="max-w-[1200px] mx-auto">
            <Link
              href="/formacao"
              className="inline-flex items-center gap-1.5 text-xs text-cream/30 hover:text-cream/50 transition-colors mb-6"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao catálogo
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Archive className="h-5 w-5 text-cream/30" />
              </div>
              <div>
                <h1 className="font-fraunces font-bold text-xl text-cream tracking-tight">
                  Acervo
                </h1>
                <p className="text-sm text-cream/30 mt-0.5">
                  Cursos e grupos que foram descontinuados.
                </p>
              </div>
            </motion.div>

            <div
              className="mt-6 p-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="font-dm text-sm text-cream/40 leading-relaxed">
                Estes são cursos e grupos de formação que tiveram suas atividades encerradas.
                As aulas gravadas continuam disponíveis para estudo, mas não geram certificado.
                O conteúdo não será removido.
              </p>
            </div>
          </div>
        </section>

        {/* Courses */}
        <section className="py-6 sm:py-10">
          {loading ? (
            <div className="px-5 sm:px-6 md:px-8">
              <div className="flex gap-4 overflow-hidden">
                {[0, 1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="flex-shrink-0 w-[220px] sm:w-[250px] md:w-[280px] lg:w-[300px] aspect-[3/4] rounded-2xl bg-white/[0.03] animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : coursesByCategory.length > 0 ? (
            <div style={{ opacity: 0.7 }}>
              {coursesByCategory.map((group, i) => (
                <CategoryCarousel
                  key={group.title}
                  title={group.title}
                  courses={group.courses}
                  index={i}
                />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 px-5"
            >
              <Archive className="h-10 w-10 text-cream/10 mx-auto mb-4" />
              <p className="text-cream/25 text-sm">
                Nenhum curso descontinuado no momento.
              </p>
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
