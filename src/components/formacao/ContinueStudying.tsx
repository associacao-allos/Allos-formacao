"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Play, BookOpen, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDuration } from "@/lib/utils/format";
import type { Course } from "@/types";

interface EnrolledCourse {
  course: Course;
  completedLessons: number;
  totalLessons: number;
  lastLessonSlug?: string;
}

export default function ContinueStudying() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchEnrolled() {
      const client = createClient();

      // Get active enrollments
      const { data: enrollments } = await client
        .from("enrollments")
        .select(`
          course_id,
          course:courses!enrollments_course_id_fkey(
            id, title, slug, thumbnail_url, total_duration_minutes, status,
            instructor:profiles!courses_instructor_id_fkey(full_name)
          )
        `)
        .eq("user_id", user!.id)
        .eq("status", "active");

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

      // Get total lessons per course (via sections)
      const { data: sections } = await client
        .from("sections")
        .select("course_id, lessons(id)")
        .in("course_id", courseIds);

      // Get completed lessons
      const { data: progress } = await client
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", user!.id)
        .eq("completed", true);

      const completedSet = new Set(progress?.map((p) => p.lesson_id) || []);

      // Build lesson totals and completed counts per course
      const courseLessons: Record<string, { total: number; completed: number }> = {};
      sections?.forEach((s) => {
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
            completedLessons: stats.completed,
            totalLessons: stats.total,
          };
        })
        .filter((e) => e.totalLessons > 0 && e.completedLessons < e.totalLessons);

      setCourses(enriched);
      setLoading(false);
    }

    fetchEnrolled().catch(() => setLoading(false));
  }, [user]);

  if (loading || !user || courses.length === 0) return null;

  return (
    <section className="relative py-10 sm:py-14 px-5 sm:px-6 md:px-10">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(46,158,143,0.12)", border: "1px solid rgba(46,158,143,0.25)" }}
            >
              <Play className="h-3.5 w-3.5 text-teal" />
            </div>
            <h2 className="font-fraunces font-bold text-xl text-cream">
              Continue estudando
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((item, i) => {
              const pct = Math.round((item.completedLessons / item.totalLessons) * 100);
              return (
                <motion.div
                  key={item.course.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                >
                  <Link
                    href={`/formacao/curso/${item.course.slug}`}
                    className="group flex gap-4 rounded-2xl p-4 transition-all duration-300 hover:bg-white/[0.04]"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                      {item.course.thumbnail_url ? (
                        <Image
                          src={item.course.thumbnail_url}
                          alt={item.course.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: "rgba(200,75,49,0.08)" }}
                        >
                          <BookOpen className="h-5 w-5 text-accent/40" />
                        </div>
                      )}
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="h-5 w-5 text-white fill-white" />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-dm font-semibold text-sm text-cream line-clamp-2 mb-1 group-hover:text-teal-light transition-colors">
                        {item.course.title}
                      </h3>
                      <p className="text-xs text-cream/35 mb-2.5">
                        {item.completedLessons}/{item.totalLessons} aulas · {pct}%
                      </p>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: "linear-gradient(90deg, #2E9E8F, #3ECFBE)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: 0.3 + i * 0.08 }}
                        />
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-cream/20 group-hover:text-teal self-center flex-shrink-0 transition-colors" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
