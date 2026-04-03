"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CourseBackground from "@/components/course/CourseBackground";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  Play,
  Search,
  ChevronDown,
  ChevronUp,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react";
import type { Course, Section, Lesson, LessonProgress, Enrollment } from "@/types";
import { formatDuration } from "@/lib/utils/format";

export default function CourseOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({});
  const [loading, setLoading] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"conteudos" | "sobre">("conteudos");

  const allLessons = useMemo(
    () => sections.flatMap((s) => s.lessons || []),
    [sections]
  );

  const requiredLessons = useMemo(
    () => sections.filter((s) => !s.is_extra).flatMap((s) => s.lessons || []),
    [sections]
  );

  const totalLessons = allLessons.length;
  const completedLessons = Object.values(progressMap).filter((p) => p.completed).length;
  const requiredTotal = requiredLessons.length;
  const requiredCompleted = requiredLessons.filter(
    (l) => progressMap[l.id]?.completed
  ).length;
  const progressPercent = requiredTotal > 0 ? Math.round((requiredCompleted / requiredTotal) * 100) : 0;

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const client = createClient();

        const { data: courseData } = await client
          .from("courses")
          .select(`
            *,
            instructor:profiles!courses_instructor_id_fkey(id, full_name, avatar_url, email)
          `)
          .eq("slug", slug)
          .single();

        if (cancelled) return;

        if (!courseData) {
          router.push("/formacao");
          return;
        }

        setCourse(courseData);

        const { data: sectionsData } = await client
          .from("sections")
          .select(`
            *,
            lessons(
              *,
              attachments:lesson_attachments(*)
            )
          `)
          .eq("course_id", courseData.id)
          .order("position")
          .order("position", { referencedTable: "lessons" });

        if (cancelled) return;

        if (sectionsData) {
          setSections(sectionsData);
          // Expand all sections by default
          const expanded: Record<string, boolean> = {};
          sectionsData.forEach((s) => { expanded[s.id] = true; });
          setExpandedSections(expanded);
        }

        const userId = user?.id;
        if (userId) {
          const { data: enrollData } = await client
            .from("enrollments")
            .select("*")
            .eq("course_id", courseData.id)
            .eq("user_id", userId)
            .single();

          if (cancelled) return;

          if (enrollData) {
            setEnrollment(enrollData);
          }

          const allLessonIds = sectionsData
            ?.flatMap((s) => s.lessons?.map((l: Lesson) => l.id) || [])
            || [];

          if (allLessonIds.length > 0) {
            const { data: progressData } = await client
              .from("lesson_progress")
              .select("*")
              .eq("user_id", userId)
              .in("lesson_id", allLessonIds);

            if (!cancelled && progressData) {
              const map: Record<string, LessonProgress> = {};
              progressData.forEach((p) => {
                map[p.lesson_id] = p;
              });
              setProgressMap(map);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar curso:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [slug, user?.id, router]);

  const handleAssistir = () => {
    if (!user) {
      toast.error("Faça login para acessar o curso.");
      return;
    }
    if (!enrollment && course && !course.is_free) {
      router.push(`/formacao/curso/${slug}/comprar`);
      return;
    }
    router.push(`/formacao/curso/${slug}/assistir`);
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        lessons: (s.lessons || []).filter((l) =>
          l.title.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.lessons.length > 0);
  }, [sections, searchQuery]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="relative min-h-screen">
        <CourseBackground />
        <div className="relative z-10">
          <div className="h-[400px] sm:h-[480px] animate-shimmer" style={{
            background: "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)",
            backgroundSize: "200% 100%",
          }} />
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!course) return null;

  const description = course.description || "";
  const longDescription = course.long_description || "";
  const isDescriptionLong = description.length > 200;
  const isEnrolled = !!enrollment;

  return (
    <div className="relative min-h-screen">
      <CourseBackground />

      <div className="relative z-10">
        {/* ─── Hero Banner ─── */}
        <div className="relative w-full h-[420px] sm:h-[500px] overflow-hidden">
          {/* Background image */}
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, #1C1414 0%, #2a1a1a 50%, #0F0F0F 100%)",
              }}
            />
          )}

          {/* Dark gradient overlay for text readability */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.2) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(15,15,15,1) 100%)",
            }}
          />

          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10 md:px-16 max-w-3xl">
            {/* Back button */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Link
                href="/formacao"
                className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors mb-6 font-dm"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </motion.div>

            {/* Course title */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-fraunces font-bold text-2xl sm:text-3xl md:text-4xl text-white leading-tight mb-4"
            >
              {course.title}
            </motion.h1>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-5"
            >
              <p className="font-dm text-sm sm:text-base text-white/70 leading-relaxed">
                {showFullDescription || !isDescriptionLong
                  ? description
                  : description.slice(0, 200) + "..."}
              </p>
              {isDescriptionLong && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-sm font-dm font-medium text-teal hover:text-teal-light transition-colors mt-1"
                >
                  {showFullDescription ? "Mostrar menos" : "Mostrar mais"}
                </button>
              )}
            </motion.div>

            {/* Progress + count */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex items-center gap-3 mb-6"
            >
              <span className="font-dm text-sm text-white/60">
                {totalLessons} conteúdo{totalLessons !== 1 ? "s" : ""}
                {isEnrolled && ` — ${progressPercent}%`}
              </span>
              {isEnrolled && (
                <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progressPercent}%`,
                      background: "linear-gradient(90deg, #2E9E8F, #3ECFBE)",
                    }}
                  />
                </div>
              )}
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center gap-5"
            >
              <Button onClick={handleAssistir} size="md">
                <Play className="h-4 w-4" />
                Assistir
              </Button>

              {course.certificate_enabled && isEnrolled && (
                <Link
                  href={`/formacao/curso/${slug}/certificado`}
                  className="flex flex-col items-center gap-1 text-white/50 hover:text-white/80 transition-colors"
                >
                  <Award className="h-6 w-6" />
                  <span className="font-dm text-xs">Certificado</span>
                </Link>
              )}
            </motion.div>
          </div>
        </div>

        {/* ─── Tabs + Content ─── */}
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8">
          {/* Tabs */}
          <div className="flex gap-6 border-b mb-8" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <button
              onClick={() => setActiveTab("conteudos")}
              className={`pb-3 font-dm font-semibold text-sm transition-colors relative ${
                activeTab === "conteudos" ? "text-cream" : "text-cream/40 hover:text-cream/60"
              }`}
            >
              Conteúdos
              {activeTab === "conteudos" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: "#2E9E8F" }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab("sobre")}
              className={`pb-3 font-dm font-semibold text-sm transition-colors relative ${
                activeTab === "sobre" ? "text-cream" : "text-cream/40 hover:text-cream/60"
              }`}
            >
              Sobre
              {activeTab === "sobre" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: "#2E9E8F" }} />
              )}
            </button>
          </div>

          {activeTab === "conteudos" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header + search */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-fraunces font-bold text-lg text-cream">
                  Todos os conteúdos
                </h2>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl w-64"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Search className="h-4 w-4 text-cream/30" />
                  <input
                    type="text"
                    placeholder="Buscar conteúdo"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-sm text-cream placeholder-cream/30 outline-none w-full font-dm"
                  />
                </div>
              </div>

              {/* Sections & Lessons list */}
              <div className="space-y-2">
                {filteredSections.map((section, sIdx) => {
                  const sectionLessons = section.lessons || [];
                  const sectionCompleted = sectionLessons.filter(
                    (l) => progressMap[l.id]?.completed
                  ).length;
                  const isExpanded = expandedSections[section.id] ?? true;
                  // Calculate global lesson index
                  let globalOffset = 0;
                  for (let i = 0; i < sIdx; i++) {
                    globalOffset += (sections[i]?.lessons?.length || 0);
                  }

                  return (
                    <div key={section.id}>
                      {/* Section header (only show if more than 1 section) */}
                      {sections.length > 1 && (
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1 transition-colors hover:bg-white/[0.03]"
                          style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-dm font-semibold text-sm text-cream">
                              {section.title}
                            </span>
                            {section.is_extra && (
                              <span
                                className="text-[10px] font-dm font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  background: "rgba(139,92,246,0.1)",
                                  color: "rgba(167,139,250,0.8)",
                                  border: "1px solid rgba(139,92,246,0.2)",
                                }}
                              >
                                Extra
                              </span>
                            )}
                            {isEnrolled && (
                              <span className="font-dm text-xs text-cream/30">
                                {sectionCompleted}/{sectionLessons.length}
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-cream/30" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-cream/30" />
                          )}
                        </button>
                      )}

                      {/* Lessons */}
                      {isExpanded && (
                        <div className="space-y-1">
                          {sectionLessons.map((lesson, lIdx) => {
                            const globalIndex = globalOffset + lIdx + 1;
                            const isCompleted = progressMap[lesson.id]?.completed;
                            const lessonProgress = isEnrolled
                              ? isCompleted
                                ? 100
                                : 0
                              : 0;

                            return (
                              <div
                                key={lesson.id}
                                className="group flex items-center gap-4 px-4 py-3 rounded-xl transition-colors hover:bg-white/[0.03] cursor-pointer"
                                onClick={() => {
                                  if (isEnrolled || course.is_free) {
                                    router.push(`/formacao/curso/${slug}/assistir`);
                                  } else {
                                    router.push(`/formacao/curso/${slug}/comprar`);
                                  }
                                }}
                              >
                                {/* Number / check */}
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{
                                    background: isCompleted
                                      ? "rgba(46,158,143,0.15)"
                                      : "rgba(255,255,255,0.05)",
                                    border: isCompleted
                                      ? "1px solid rgba(46,158,143,0.3)"
                                      : "1px solid rgba(255,255,255,0.08)",
                                  }}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-4 w-4 text-teal" />
                                  ) : (
                                    <span className="font-dm text-xs font-medium text-cream/50">
                                      {globalIndex}
                                    </span>
                                  )}
                                </div>

                                {/* Lesson info */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-dm text-sm text-cream group-hover:text-white transition-colors truncate">
                                    {lesson.title}
                                  </p>
                                  {/* Progress bar for enrolled users */}
                                  {isEnrolled && (
                                    <div className="w-full h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                                      <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                          width: `${lessonProgress}%`,
                                          background: "linear-gradient(90deg, #2E9E8F, #3ECFBE)",
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Duration */}
                                {lesson.duration_minutes && (
                                  <span className="flex items-center gap-1 text-xs text-cream/30 flex-shrink-0">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(lesson.duration_minutes)}
                                  </span>
                                )}

                                {/* Lock icon for non-enrolled paid courses */}
                                {!isEnrolled && !course.is_free && !lesson.is_preview && (
                                  <Lock className="h-4 w-4 text-cream/20 flex-shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredSections.length === 0 && searchQuery && (
                  <div className="text-center py-12">
                    <Search className="h-8 w-8 text-cream/20 mx-auto mb-3" />
                    <p className="font-dm text-sm text-cream/40">
                      Nenhum conteúdo encontrado para &ldquo;{searchQuery}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "sobre" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Long description */}
              {longDescription && (
                <div>
                  <h3 className="font-fraunces font-bold text-lg text-cream mb-4">
                    Sobre o curso
                  </h3>
                  <div
                    className="font-dm text-sm text-cream/60 leading-relaxed prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: longDescription.replace(/\n/g, "<br />"),
                    }}
                  />
                </div>
              )}

              {/* Learning points */}
              {course.learning_points && course.learning_points.length > 0 && (
                <div>
                  <h3 className="font-fraunces font-bold text-lg text-cream mb-4">
                    O que você vai aprender
                  </h3>
                  <ul className="space-y-3">
                    {course.learning_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-teal mt-0.5 flex-shrink-0" />
                        <span className="font-dm text-sm text-cream/60">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Instructor */}
              {course.instructor && (
                <div>
                  <h3 className="font-fraunces font-bold text-lg text-cream mb-4">
                    Instrutor
                  </h3>
                  <div className="flex items-center gap-4">
                    {course.instructor.avatar_url ? (
                      <Image
                        src={course.instructor.avatar_url}
                        alt={course.instructor.full_name || ""}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(200,75,49,0.1)" }}
                      >
                        <BookOpen className="h-5 w-5 text-accent/50" />
                      </div>
                    )}
                    <div>
                      <p className="font-dm font-semibold text-sm text-cream">
                        {course.instructor.full_name}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Course meta */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="font-dm text-xs text-cream/30 mb-1">Conteúdos</p>
                    <p className="font-dm text-sm font-medium text-cream">{totalLessons} aulas</p>
                  </div>
                  {course.total_duration_minutes && course.total_duration_minutes > 0 && (
                    <div>
                      <p className="font-dm text-xs text-cream/30 mb-1">Duração total</p>
                      <p className="font-dm text-sm font-medium text-cream">
                        {formatDuration(course.total_duration_minutes)}
                      </p>
                    </div>
                  )}
                  {course.certificate_enabled && (
                    <div>
                      <p className="font-dm text-xs text-cream/30 mb-1">Certificado</p>
                      <p className="font-dm text-sm font-medium text-cream">
                        {course.certificate_hours ? `${course.certificate_hours}h` : "Incluso"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
