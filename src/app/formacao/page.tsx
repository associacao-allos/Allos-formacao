"use client";

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Bell, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { createClient, createDataClient } from "@/lib/supabase/client";
import CourseCard from "@/components/course/CourseCard";
import CoursePreviewPopover from "@/components/course/CoursePreviewPopover";
import CourseFilters from "@/components/course/CourseFilters";
import { CourseCardSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import HeroFormacao from "@/components/formacao/HeroFormacao";
import ContinueStudying from "@/components/formacao/ContinueStudying";
import SyncGroupsSection from "@/components/formacao/SyncGroupsSection";
import FeaturedCourses from "@/components/formacao/FeaturedCourses";
import CourseBackground from "@/components/course/CourseBackground";
import { toast } from "sonner";
import type { Course } from "@/types";


export default function FormacaoPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState<"all" | "free" | "paid">("all");
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "popular">("recent");
  const [instructorCourseIds, setInstructorCourseIds] = useState<Set<string>>(new Set());

  // Notify email state
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySending, setNotifySending] = useState(false);

  const { ref: coursesRef, inView: coursesInView } = useInView({ triggerOnce: true, threshold: 0.08 });

  useEffect(() => {
    let cancelled = false;
    async function fetchCourses() {
      try {
        const client = createDataClient();
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

  useEffect(() => {
    async function fetchInstructorCourses() {
      if (!profile || profile.role === "student") return;
      const client = createClient();
      const { data } = await client
        .from("courses")
        .select("id")
        .eq("instructor_id", profile.id);
      if (data) {
        setInstructorCourseIds(new Set(data.map((c) => c.id)));
      }
    }
    fetchInstructorCourses();
  }, [profile]);

  const filteredCourses = useMemo(() => {
    let result = [...courses];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
      );
    }

    if (selectedCategories.length > 0) {
      result = result.filter(
        (c) => c.category && selectedCategories.includes(c.category)
      );
    }

    if (priceFilter === "free") result = result.filter((c) => c.is_free);
    if (priceFilter === "paid") result = result.filter((c) => !c.is_free);

    switch (sortBy) {
      case "rating":
        result.sort(
          (a, b) => (b.average_rating || 0) - (a.average_rating || 0)
        );
        break;
      case "popular":
        result.sort(
          (a, b) => (b.enrollments_count || 0) - (a.enrollments_count || 0)
        );
        break;
      default:
        break;
    }

    return result;
  }, [courses, search, selectedCategories, priceFilter, sortBy]);

  const hasFiltersActive = search || selectedCategories.length > 0 || priceFilter !== "all";

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

      {/* Continue studying (logged-in users with active enrollments) */}
      <ContinueStudying />

      {/* Featured courses */}
      <FeaturedCourses />

      {/* Course grid */}
      <section
        id="cursos"
        ref={coursesRef}
        className="relative py-16 sm:py-20 md:py-24 px-5 sm:px-6 md:px-10"
        style={{ background: "radial-gradient(ellipse at 50% 0%,rgba(200,75,49,.03) 0%,transparent 60%)" }}
      >
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={coursesInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
                className="font-dm font-semibold text-xs tracking-[.22em] text-[#C84B31] uppercase mb-3"
              >
                Catálogo completo
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                animate={coursesInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="font-fraunces font-bold text-[#FDFBF7] mb-2"
                style={{ fontSize: "clamp(24px,3vw,36px)" }}
              >
                Todos os <span className="italic text-[#C84B31]">cursos</span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={coursesInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.18, duration: 0.5 }}
                className="font-dm"
                style={{ fontSize: "15px", color: "rgba(253,251,247,0.5)" }}
              >
                Conteúdos para aprofundar a aptidão clínica e a presença terapêutica.
              </motion.p>
            </div>

            {/* Course count */}
            {!loading && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={coursesInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.3 }}
                className="font-dm text-sm"
                style={{ color: "rgba(253,251,247,0.3)" }}
              >
                {filteredCourses.length} {filteredCourses.length === 1 ? "curso disponível" : "cursos disponíveis"}
              </motion.p>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={coursesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.22, duration: 0.5 }}
          >
            <CourseFilters
              search={search}
              onSearchChange={setSearch}
              selectedCategories={selectedCategories}
              onCategoriesChange={setSelectedCategories}
              priceFilter={priceFilter}
              onPriceFilterChange={setPriceFilter}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />
          </motion.div>

          <div className="mt-8">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredCourses.length > 0 ? (
              <motion.div
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {filteredCourses.map((course, i) => (
                    <motion.div
                      key={course.id}
                      layout
                      initial={{ opacity: 0, scale: 0.94, y: 16 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -8 }}
                      transition={{
                        duration: 0.45,
                        delay: Math.min(i * 0.05, 0.3),
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <CoursePreviewPopover course={course}>
                        <CourseCard
                          course={course}
                          isInstructor={instructorCourseIds.has(course.id)}
                        />
                      </CoursePreviewPopover>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-24"
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
                  {hasFiltersActive
                    ? "Nenhum curso encontrado"
                    : "Em breve novos cursos"}
                </h3>
                <p className="text-cream/40 text-sm font-dm mb-6 max-w-sm mx-auto">
                  {hasFiltersActive
                    ? "Tente ajustar seus filtros para encontrar o que procura."
                    : "Estamos preparando conteúdos incríveis para você. Deixe seu email e seja o primeiro a saber!"}
                </p>

                {!hasFiltersActive && (
                  <div className="max-w-md mx-auto space-y-4">
                    {/* Email notification form */}
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

                    {/* Instagram link */}
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
                )}
              </motion.div>
            )}
          </div>
        </div>
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
