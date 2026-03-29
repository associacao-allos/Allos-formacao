"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  Play,
  CheckCircle2,
  Clock,
  Award,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDuration } from "@/lib/utils/format";
import CourseBackground from "@/components/course/CourseBackground";
import Skeleton from "@/components/ui/Skeleton";
import type { Course, EnrollmentStatus } from "@/types";

interface EnrolledCourse {
  course: Course;
  enrollmentStatus: EnrollmentStatus;
  completedLessons: number;
  totalLessons: number;
  enrolledAt: string;
}

type Tab = "active" | "completed";

export default function MeusCursosPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("active");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/formacao/auth");
      return;
    }

    async function fetchMyCourses() {
      const client = createClient();

      const { data: enrollments } = await client
        .from("enrollments")
        .select(`
          course_id,
          status,
          enrolled_at,
          course:courses!enrollments_course_id_fkey(
            id, title, slug, thumbnail_url, total_duration_minutes, certificate_enabled, status,
            instructor:profiles!courses_instructor_id_fkey(full_name)
          )
        `)
        .eq("user_id", user!.id)
        .in("status", ["active", "completed"])
        .order("enrolled_at", { ascending: false });

      if (!enrollments || enrollments.length === 0) {
        setLoading(false);
        return;
      }

      // Filter out archived courses
      const validEnrollments = enrollments.filter(
        (e) => (e.course as unknown as { status?: string })?.status !== "archived"
      );
      if (validEnrollments.length === 0) {
        setLoading(false);
        return;
      }

      const courseIds = validEnrollments.map((e) => e.course_id);

      const [sectionsRes, progressRes] = await Promise.all([
        client
          .from("sections")
          .select("course_id, lessons(id)")
          .in("course_id", courseIds),
        client
          .from("lesson_progress")
          .select("lesson_id")
          .eq("user_id", user!.id)
          .eq("completed", true),
      ]);

      const completedSet = new Set(progressRes.data?.map((p) => p.lesson_id) || []);

      const courseLessons: Record<string, { total: number; completed: number }> = {};
      sectionsRes.data?.forEach((s) => {
        const cid = s.course_id;
        if (!courseLessons[cid]) courseLessons[cid] = { total: 0, completed: 0 };
        const lessons = (s.lessons as { id: string }[]) || [];
        courseLessons[cid].total += lessons.length;
        lessons.forEach((l) => {
          if (completedSet.has(l.id)) courseLessons[cid].completed += 1;
        });
      });

      const enriched: EnrolledCourse[] = enrollments
        .filter((e) => e.course)
        .map((e) => {
          const c = e.course as unknown as Course;
          const stats = courseLessons[c.id] || { total: 0, completed: 0 };
          return {
            course: c,
            enrollmentStatus: e.status as EnrollmentStatus,
            completedLessons: stats.completed,
            totalLessons: stats.total,
            enrolledAt: e.enrolled_at,
          };
        });

      setCourses(enriched);
      setLoading(false);
    }

    fetchMyCourses().catch(() => setLoading(false));
  }, [user, authLoading, router]);

  const activeCourses = courses.filter((c) => c.enrollmentStatus === "active");
  const completedCourses = courses.filter((c) => c.enrollmentStatus === "completed");
  const displayed = tab === "active" ? activeCourses : completedCourses;

  if (authLoading || loading) {
    return (
      <div className="relative min-h-screen">
        <CourseBackground />
        <div className="relative z-10 max-w-[1000px] mx-auto px-5 sm:px-6 md:px-10 py-16">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <CourseBackground />

      <div className="relative z-10 max-w-[1000px] mx-auto px-5 sm:px-6 md:px-10 py-12 sm:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(46,158,143,0.12)", border: "1px solid rgba(46,158,143,0.25)" }}
            >
              <GraduationCap className="h-5 w-5 text-teal" />
            </div>
            <div>
              <h1 className="font-fraunces font-bold text-2xl sm:text-3xl text-cream tracking-tight">
                Meus cursos
              </h1>
            </div>
          </div>
          <p className="text-sm text-cream/40 ml-[52px]">
            {courses.length === 0
              ? "Você ainda não está matriculado em nenhum curso."
              : `${activeCourses.length} em andamento · ${completedCourses.length} concluído${completedCourses.length !== 1 ? "s" : ""}`}
          </p>
        </motion.div>

        {courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(200,75,49,0.08)", border: "1px solid rgba(200,75,49,0.15)" }}
            >
              <BookOpen className="h-7 w-7 text-accent/50" />
            </div>
            <h3 className="font-fraunces font-bold text-xl text-cream mb-2">
              Nenhum curso ainda
            </h3>
            <p className="text-cream/40 text-sm mb-6 max-w-sm mx-auto">
              Explore nosso catálogo e comece sua formação clínica.
            </p>
            <Link
              href="/formacao#cursos"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-dm font-semibold text-sm text-white transition-all hover:scale-[1.03]"
              style={{
                background: "linear-gradient(135deg, #C84B31, #A33D27)",
                boxShadow: "0 4px 16px rgba(200,75,49,0.25)",
              }}
            >
              Ver cursos
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex gap-1 mb-8 p-1 rounded-xl w-fit"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {[
                { id: "active" as Tab, label: "Em andamento", count: activeCourses.length },
                { id: "completed" as Tab, label: "Concluídos", count: completedCourses.length },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-5 py-2 rounded-lg text-sm font-dm font-medium transition-all ${
                    tab === t.id
                      ? "text-white"
                      : "text-cream/40 hover:text-cream/60"
                  }`}
                  style={
                    tab === t.id
                      ? { background: "linear-gradient(135deg, #C84B31, #A33D27)", boxShadow: "0 2px 8px rgba(200,75,49,0.3)" }
                      : {}
                  }
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </motion.div>

            {/* Course list */}
            <div className="space-y-4">
              {displayed.length === 0 ? (
                <p className="text-cream/30 text-sm py-10 text-center">
                  {tab === "active"
                    ? "Nenhum curso em andamento."
                    : "Nenhum curso concluído ainda."}
                </p>
              ) : (
                displayed.map((item, i) => {
                  const pct = item.totalLessons > 0
                    ? Math.round((item.completedLessons / item.totalLessons) * 100)
                    : 0;
                  const isCompleted = item.enrollmentStatus === "completed";

                  return (
                    <motion.div
                      key={item.course.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4 }}
                    >
                      <Link
                        href={`/formacao/curso/${item.course.slug}`}
                        className="group flex gap-5 rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.03]"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {/* Thumbnail */}
                        <div className="relative w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden flex-shrink-0">
                          {item.course.thumbnail_url ? (
                            <Image
                              src={item.course.thumbnail_url}
                              alt={item.course.title}
                              fill
                              className="object-cover"
                              sizes="144px"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center"
                              style={{ background: "rgba(200,75,49,0.08)" }}
                            >
                              <BookOpen className="h-6 w-6 text-accent/40" />
                            </div>
                          )}
                          {/* Overlay */}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="h-6 w-6 text-white fill-white" />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-fraunces font-bold text-base text-cream line-clamp-1 mb-1 group-hover:text-teal-light transition-colors">
                            {item.course.title}
                          </h3>
                          {item.course.instructor && (
                            <p className="text-xs text-cream/35 mb-3">
                              {item.course.instructor.full_name}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-cream/40 mb-3">
                            <span className="flex items-center gap-1">
                              {isCompleted ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-teal" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                              {item.completedLessons}/{item.totalLessons} aulas
                            </span>
                            {item.course.total_duration_minutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDuration(item.course.total_duration_minutes)}
                              </span>
                            )}
                            {isCompleted && item.course.certificate_enabled && (
                              <Link
                                href={`/formacao/curso/${item.course.slug}/certificado`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-accent hover:text-accent-light transition-colors"
                              >
                                <Award className="h-3.5 w-3.5" />
                                Certificado
                              </Link>
                            )}
                          </div>

                          {/* Progress bar */}
                          {!isCompleted && (
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ background: "linear-gradient(90deg, #2E9E8F, #3ECFBE)" }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, delay: 0.2 + i * 0.06 }}
                                />
                              </div>
                              <span className="text-xs text-cream/30 font-medium w-10 text-right">{pct}%</span>
                            </div>
                          )}
                          {isCompleted && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-teal" />
                              <span className="text-xs text-teal font-medium">Concluído</span>
                            </div>
                          )}
                        </div>

                        <ChevronRight className="h-5 w-5 text-cream/15 group-hover:text-teal self-center flex-shrink-0 transition-colors" />
                      </Link>
                    </motion.div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
