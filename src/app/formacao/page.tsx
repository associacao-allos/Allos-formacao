"use client";

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Bell, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import HeroFormacao from "@/components/formacao/HeroFormacao";

import SyncGroupsSection from "@/components/formacao/SyncGroupsSection";
import CategoryCarousel from "@/components/formacao/CategoryCarousel";
import CourseBackground from "@/components/course/CourseBackground";
import { toast } from "sonner";
import type { Course } from "@/types";


export default function FormacaoPage() {
  const { profile } = useAuth();
  const { categories } = useCategories();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Notify email state
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySending, setNotifySending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchCourses() {
      try {
        const client = createClient();
        const { data, error: fetchError } = await client
          .from("courses")
          .select(`
            *,
            instructor:profiles!courses_instructor_id_fkey(id, full_name, avatar_url)
          `)
          .eq("status", "published")
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (fetchError) { console.error("Supabase error:", fetchError); setLoading(false); return; }
        if (!data || data.length === 0) { setLoading(false); return; }

        if (data.length > 0) {
          const courseIds = data.map((c) => c.id);

          const [enrollmentsRes, reviewsRes] = await Promise.all([
            client
              .from("enrollments")
              .select("course_id")
              .in("course_id", courseIds),
            client
              .from("reviews")
              .select("course_id, rating")
              .in("course_id", courseIds),
          ]);

          if (cancelled) return;

          const enrollCounts: Record<string, number> = {};
          enrollmentsRes.data?.forEach((e) => {
            enrollCounts[e.course_id] = (enrollCounts[e.course_id] || 0) + 1;
          });

          const reviewData: Record<string, { sum: number; count: number }> = {};
          reviewsRes.data?.forEach((r) => {
            if (!reviewData[r.course_id]) {
              reviewData[r.course_id] = { sum: 0, count: 0 };
            }
            reviewData[r.course_id].sum += r.rating;
            reviewData[r.course_id].count += 1;
          });

          const enriched: Course[] = data.map((c) => ({
            ...c,
            enrollments_count: enrollCounts[c.id] || 0,
            average_rating: reviewData[c.id]
              ? reviewData[c.id].sum / reviewData[c.id].count
              : 0,
            reviews_count: reviewData[c.id]?.count || 0,
          }));

          setCourses(enriched);
        }
      } catch (err) {
        console.error("Erro ao carregar cursos:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCourses();
    return () => { cancelled = true; };
  }, []);

  // Group courses by category
  const coursesByCategory = useMemo(() => {
    const grouped: { title: string; courses: Course[] }[] = [];

    // Featured courses first
    const featured = courses.filter((c) => c.featured);
    if (featured.length > 0) {
      grouped.push({ title: "Em destaque", courses: featured });
    }

    // Group by each known category
    for (const cat of categories) {
      const catCourses = courses.filter((c) => c.category === cat);
      if (catCourses.length > 0) {
        grouped.push({ title: cat, courses: catCourses });
      }
    }

    // Courses without category
    const uncategorized = courses.filter(
      (c) => !c.category && !c.featured
    );
    if (uncategorized.length > 0) {
      grouped.push({ title: "Outros cursos", courses: uncategorized });
    }

    return grouped;
  }, [courses, categories]);

  async function handleNotifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notifyEmail.trim()) return;
    setNotifySending(true);
    try {
      const client = createClient();
      await client.from("notify_subscribers").insert({ email: notifyEmail.trim() });
      toast.success("Pronto! Vamos te avisar quando novos cursos lançarem.");
      setNotifyEmail("");
    } catch {
      toast.error("Erro ao registrar. Tente novamente.");
    } finally {
      setNotifySending(false);
    }
  }

  return (
    <div className="relative">
      {/* Starfield + grain background */}
      <CourseBackground />

      {/* Hero */}
      <div className="relative z-10">
        <HeroFormacao />

        {/* Category carousels */}
        <section className="py-10 sm:py-14">
          {loading ? (
            // Skeleton carousels
            <div className="space-y-12">
              {[0, 1].map((i) => (
                <div key={i} className="px-5 sm:px-6 md:px-8">
                  <div className="h-6 w-48 rounded-md bg-white/5 mb-5 animate-pulse" />
                  <div className="flex gap-4 overflow-hidden">
                    {[0, 1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="flex-shrink-0 w-[240px] sm:w-[260px] md:w-[280px] aspect-[3/4] rounded-2xl bg-white/[0.03] animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : coursesByCategory.length > 0 ? (
            coursesByCategory.map((group, i) => (
              <CategoryCarousel
                key={group.title}
                title={group.title}
                courses={group.courses}
                index={i}
              />
            ))
          ) : (
            // Empty state
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24 px-5"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background: "linear-gradient(135deg, rgba(200,75,49,0.12), rgba(163,61,39,0.06))",
                  border: "1px solid rgba(200,75,49,0.15)",
                }}
              >
                <BookOpen className="h-7 w-7 text-accent" />
              </div>
              <h3 className="font-fraunces font-bold text-xl text-cream mb-2">
                Em breve novos cursos
              </h3>
              <p className="text-cream/40 text-sm font-dm mb-6 max-w-sm mx-auto">
                Estamos preparando conteúdos incríveis para você. Deixe seu email e seja o primeiro a saber!
              </p>

              <div className="max-w-md mx-auto space-y-4">
                <form onSubmit={handleNotifySubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-cream placeholder:text-cream/25 focus:outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1.5px solid rgba(255,255,255,0.08)",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "rgba(200,75,49,0.4)";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(200,75,49,0.08)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>
                  <motion.button
                    type="submit"
                    disabled={notifySending}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-6 py-3 rounded-xl font-dm font-semibold text-sm text-white transition-all disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #C84B31, #A33D27)",
                      boxShadow: "0 4px 16px rgba(200,75,49,0.25)",
                    }}
                  >
                    {notifySending ? "..." : "Notifique-me"}
                  </motion.button>
                </form>

                <a
                  href="https://instagram.com/associacaoallos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-dm font-medium text-xs text-cream/35 hover:text-accent transition-colors"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Ou acompanhe pelo Instagram
                </a>
              </div>
            </motion.div>
          )}
        </section>

        {/* Divider */}
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="divider-gradient" />
        </div>

        {/* Synchronous groups - live schedule */}
        <SyncGroupsSection />
      </div>
    </div>
  );
}
