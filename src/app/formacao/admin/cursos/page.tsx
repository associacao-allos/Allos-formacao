"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import {
  Plus,
  Edit,
  Archive,
  Search,
  RotateCcw,
  Copy,
  Star,
  AlertTriangle,
  ImageOff,
  FileText,
  Layers,
  ArrowUpDown,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Course } from "@/types";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

type SortOption = "created_at" | "enrollments" | "title";

const sortLabels: Record<SortOption, string> = {
  created_at: "Data de criação",
  enrollments: "Mais alunos",
  title: "Título A-Z",
};

interface EnrichedCourse extends Course {
  _enrollCount?: number;
  _completedCount?: number;
  _avgRating?: number | null;
  _reviewsCount?: number;
  _sectionsCount?: number;
  _lessonsCount?: number;
}

export default function AdminCursosPage() {
  const { profile, isAdmin } = useAuth();
  const [courses, setCourses] = useState<EnrichedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("created_at");
  const [archiveTarget, setArchiveTarget] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");

  useEffect(() => {
    async function fetch() {
      if (!profile) {
        setLoading(false);
        return;
      }
      const supabase = createClient();

      let query = supabase
        .from("courses")
        .select(`
          *,
          instructor:profiles!courses_instructor_id_fkey(id, full_name)
        `)
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("instructor_id", profile.id);
      }

      const { data } = await query;
      if (data) {
        const ids = data.map((c) => c.id);

        // Fetch enrollment counts + completion counts
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("course_id, status")
          .in("course_id", ids);

        const enrollCounts: Record<string, number> = {};
        const completedCounts: Record<string, number> = {};
        enrollments?.forEach((e) => {
          enrollCounts[e.course_id] = (enrollCounts[e.course_id] || 0) + 1;
          if (e.status === "completed") {
            completedCounts[e.course_id] = (completedCounts[e.course_id] || 0) + 1;
          }
        });

        // Fetch average ratings
        const { data: reviews } = await supabase
          .from("reviews")
          .select("course_id, rating")
          .in("course_id", ids);

        const ratingAcc: Record<string, { sum: number; count: number }> = {};
        reviews?.forEach((r) => {
          if (!ratingAcc[r.course_id]) {
            ratingAcc[r.course_id] = { sum: 0, count: 0 };
          }
          ratingAcc[r.course_id].sum += r.rating;
          ratingAcc[r.course_id].count += 1;
        });

        // Fetch sections count + lessons count per course
        const { data: sections } = await supabase
          .from("sections")
          .select("id, course_id")
          .in("course_id", ids);

        const sectionCounts: Record<string, number> = {};
        const sectionIds: string[] = [];
        sections?.forEach((s) => {
          sectionCounts[s.course_id] = (sectionCounts[s.course_id] || 0) + 1;
          sectionIds.push(s.id);
        });

        let lessonCounts: Record<string, number> = {};
        if (sectionIds.length > 0) {
          const { data: lessons } = await supabase
            .from("lessons")
            .select("id, section_id")
            .in("section_id", sectionIds);

          // Map section_id -> course_id
          const sectionToCourse: Record<string, string> = {};
          sections?.forEach((s) => {
            sectionToCourse[s.id] = s.course_id;
          });

          lessons?.forEach((l) => {
            const courseId = sectionToCourse[l.section_id];
            if (courseId) {
              lessonCounts[courseId] = (lessonCounts[courseId] || 0) + 1;
            }
          });
        }

        setCourses(
          data.map((c) => ({
            ...c,
            _enrollCount: enrollCounts[c.id] || 0,
            _completedCount: completedCounts[c.id] || 0,
            _avgRating: ratingAcc[c.id]
              ? ratingAcc[c.id].sum / ratingAcc[c.id].count
              : null,
            _reviewsCount: ratingAcc[c.id]?.count || 0,
            _sectionsCount: sectionCounts[c.id] || 0,
            _lessonsCount: lessonCounts[c.id] || 0,
          }))
        );
      }
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, [profile, isAdmin]);

  async function archiveCourse() {
    if (!archiveTarget) return;
    const { error } = await createClient()
      .from("courses")
      .update({ status: "archived" })
      .eq("id", archiveTarget.id);

    if (error) {
      toast.error("Erro ao arquivar curso.");
      return;
    }

    setCourses((prev) =>
      prev.map((c) => (c.id === archiveTarget.id ? { ...c, status: "archived" as const } : c))
    );
    setArchiveTarget(null);
    toast.success("Curso arquivado.");
  }

  async function deleteCourse() {
    if (!deleteTarget) return;
    const supabase = createClient();
    // Delete dependent data first (enrollments don't cascade)
    await supabase.from("enrollments").delete().eq("course_id", deleteTarget.id);
    await supabase.from("exam_questions").delete().eq("course_id", deleteTarget.id);

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Erro ao apagar curso: " + error.message);
      return;
    }

    setCourses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Curso apagado permanentemente.");
  }

  async function restoreCourse(id: string) {
    const { error } = await createClient()
      .from("courses")
      .update({ status: "draft" })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao restaurar curso.");
      return;
    }

    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "draft" as const } : c))
    );
    toast.success("Curso restaurado como rascunho.");
  }

  async function toggleFeatured(course: EnrichedCourse) {
    const supabase = createClient();
    const newFeatured = !course.featured;
    const defaultLabel = course.course_type === "sync" ? "Ao vivo" : "Em destaque";
    const { error } = await supabase
      .from("courses")
      .update({
        featured: newFeatured,
        featured_label: newFeatured ? (course.featured_label || defaultLabel) : null,
      })
      .eq("id", course.id);

    if (error) {
      console.error("Erro ao atualizar destaque:", error);
      toast.error(`Erro ao atualizar destaque: ${error.message}`);
      return;
    }

    setCourses((prev) =>
      prev.map((c) =>
        c.id === course.id
          ? { ...c, featured: newFeatured, featured_label: newFeatured ? (course.featured_label || defaultLabel) : null }
          : c
      )
    );
    toast.success(newFeatured ? "Curso marcado como destaque!" : "Destaque removido.");
  }

  async function updateFeaturedLabel(courseId: string, label: string) {
    const { error } = await createClient()
      .from("courses")
      .update({ featured_label: label || null })
      .eq("id", courseId);

    if (error) {
      console.error("Erro ao atualizar label:", error);
      toast.error(`Erro ao salvar label: ${error.message}`);
      return;
    }

    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, featured_label: label || null } : c))
    );
  }

  async function togglePublishStatus(course: EnrichedCourse) {
    const newStatus = course.status === "published" ? "draft" : "published";
    setTogglingStatus(course.id);

    const { error } = await createClient()
      .from("courses")
      .update({ status: newStatus })
      .eq("id", course.id);

    setTogglingStatus(null);

    if (error) {
      toast.error(`Erro ao ${newStatus === "published" ? "publicar" : "despublicar"} curso.`);
      return;
    }

    setCourses((prev) =>
      prev.map((c) =>
        c.id === course.id ? { ...c, status: newStatus as Course["status"] } : c
      )
    );
    toast.success(
      newStatus === "published" ? "Curso publicado com sucesso." : "Curso movido para rascunho."
    );
  }

  async function duplicateCourse(course: EnrichedCourse) {
    setDuplicating(course.id);
    const supabase = createClient();
    const timestamp = Date.now();

    try {
      // 1. Create the duplicated course
      const {
        id: _id,
        created_at: _ca,
        updated_at: _ua,
        instructor,
        sections: _sec,
        enrollments_count: _ec,
        average_rating: _ar,
        reviews_count: _rc,
        _enrollCount,
        _completedCount,
        _avgRating,
        _reviewsCount,
        _sectionsCount,
        _lessonsCount,
        ...courseData
      } = course;

      const newCoursePayload = {
        ...courseData,
        title: `Cópia de ${course.title}`,
        slug: `${course.slug}-copia-${timestamp}`,
        status: "draft" as const,
      };

      const { data: newCourse, error: courseError } = await supabase
        .from("courses")
        .insert(newCoursePayload)
        .select(`
          *,
          instructor:profiles!courses_instructor_id_fkey(id, full_name)
        `)
        .single();

      if (courseError || !newCourse) {
        throw new Error(courseError?.message || "Erro ao duplicar curso.");
      }

      // 2. Copy sections
      const { data: originalSections } = await supabase
        .from("sections")
        .select("*")
        .eq("course_id", course.id)
        .order("position");

      if (originalSections && originalSections.length > 0) {
        const sectionInserts = originalSections.map((s) => ({
          course_id: newCourse.id,
          title: s.title,
          position: s.position,
        }));

        const { data: newSections, error: secError } = await supabase
          .from("sections")
          .insert(sectionInserts)
          .select("*")
          .order("position");

        if (secError) {
          throw new Error("Erro ao copiar seções.");
        }

        // 3. Copy lessons for each section
        if (newSections) {
          for (let i = 0; i < originalSections.length; i++) {
            const { data: originalLessons } = await supabase
              .from("lessons")
              .select("*")
              .eq("section_id", originalSections[i].id)
              .order("position");

            if (originalLessons && originalLessons.length > 0) {
              const lessonInserts = originalLessons.map((l) => ({
                section_id: newSections[i].id,
                title: l.title,
                description: l.description,
                video_url: l.video_url,
                video_source: l.video_source,
                thumbnail_url: l.thumbnail_url,
                duration_minutes: l.duration_minutes,
                position: l.position,
                is_preview: l.is_preview,
              }));

              await supabase.from("lessons").insert(lessonInserts);
            }
          }
        }
      }

      // Add new course to the list
      const enrichedNew: EnrichedCourse = {
        ...newCourse,
        _enrollCount: 0,
        _completedCount: 0,
        _avgRating: null,
        _reviewsCount: 0,
        _sectionsCount: course._sectionsCount || 0,
        _lessonsCount: course._lessonsCount || 0,
      };

      setCourses((prev) => [enrichedNew, ...prev]);
      toast.success(`Curso duplicado: "${enrichedNew.title}"`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao duplicar curso.");
    } finally {
      setDuplicating(null);
    }
  }

  // Filter
  const filtered = courses.filter((c) => {
    const matchSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "enrollments":
        return (b._enrollCount || 0) - (a._enrollCount || 0);
      case "title":
        return a.title.localeCompare(b.title, "pt-BR");
      case "created_at":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // Completeness warnings for draft courses
  function getCompletenessWarnings(course: EnrichedCourse): string[] {
    if (course.status !== "draft") return [];
    const warnings: string[] = [];
    if (!course.thumbnail_url) warnings.push("Sem imagem de capa");
    if (!course.description) warnings.push("Sem descrição");
    if ((!course._sectionsCount || course._sectionsCount === 0) && (!course._lessonsCount || course._lessonsCount === 0)) {
      warnings.push("Sem seções/aulas");
    }
    return warnings;
  }

  // Star rating renderer
  function renderRating(avg: number | null | undefined, count: number | undefined) {
    if (!avg || !count) {
      return <span className="text-cream/20 text-xs">--</span>;
    }
    return (
      <div className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
        <span className="text-cream/60 tabular-nums">{avg.toFixed(1)}</span>
        <span className="text-cream/25 text-xs">({count})</span>
      </div>
    );
  }

  // Completion rate renderer
  function renderCompletionRate(course: EnrichedCourse) {
    const total = course._enrollCount || 0;
    const completed = course._completedCount || 0;
    if (total === 0) {
      return <span className="text-cream/20 text-xs">--</span>;
    }
    const rate = Math.round((completed / total) * 100);
    return (
      <div className="flex items-center gap-1.5">
        <div
          className="w-12 h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${rate}%`,
              background:
                rate >= 70
                  ? "linear-gradient(90deg, #10b981, #34d399)"
                  : rate >= 40
                  ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                  : "linear-gradient(90deg, #ef4444, #f87171)",
            }}
          />
        </div>
        <span className="text-cream/50 tabular-nums text-xs">{rate}%</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-32 mb-8" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
            Cursos
          </h1>
          <p className="text-sm text-cream/35 mt-1">{courses.length} cursos no total</p>
        </div>
        <Link href="/formacao/admin/cursos/novo">
          <Button>
            <Plus className="h-4 w-4" />
            Novo curso
          </Button>
        </Link>
      </motion.div>

      {/* Filters + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Buscar por título ou professor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm"
            aria-label="Buscar cursos"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "published", "draft", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-2 rounded-[10px] text-xs font-semibold transition-all duration-200"
              style={{
                background: statusFilter === s
                  ? "linear-gradient(135deg, #C84B31, #A33D27)"
                  : "rgba(255,255,255,0.04)",
                color: statusFilter === s ? "#fff" : "rgba(253,251,247,0.45)",
                border: `1px solid ${statusFilter === s ? "#C84B31" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {s === "all" ? `Todos (${courses.length})` : `${statusLabels[s]} (${courses.filter((c) => c.status === s).length})`}
            </button>
          ))}

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-semibold transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(253,251,247,0.45)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortLabels[sortBy]}
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-[10px] py-1 shadow-xl"
                  style={{
                    background: "rgba(30,28,26,0.98)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSortBy(key);
                        setSortOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors duration-150"
                      style={{
                        color: sortBy === key ? "#C84B31" : "rgba(253,251,247,0.55)",
                        background: sortBy === key ? "rgba(200,75,49,0.08)" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (sortBy !== key) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        if (sortBy !== key) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {sortLabels[key]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Click-away for sort dropdown */}
      {sortOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
      )}

      {/* Table */}
      <div
        className="rounded-[16px] overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Curso</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50 hidden md:table-cell">Professor</th>
                <th className="text-center px-4 py-3 font-semibold text-cream/50 hidden lg:table-cell">Alunos</th>
                <th className="text-center px-4 py-3 font-semibold text-cream/50 hidden lg:table-cell">Rating</th>
                <th className="text-center px-4 py-3 font-semibold text-cream/50 hidden xl:table-cell">Conclusão</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-cream/50">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((course, i) => {
                const warnings = getCompletenessWarnings(course);
                return (
                  <motion.tr
                    key={course.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {course.thumbnail_url ? (
                          <img
                            src={course.thumbnail_url}
                            alt=""
                            className="w-16 h-10 rounded-[8px] object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-16 h-10 rounded-[8px] flex items-center justify-center flex-shrink-0"
                            style={{ background: "rgba(200,75,49,0.08)" }}
                          >
                            <span className="text-xs text-accent/40 font-bold">A</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-cream truncate">{course.title}</p>
                            {course.course_type === "sync" && (
                              <span
                                className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                                style={{ background: "rgba(46,158,143,0.15)", color: "#2E9E8F", border: "1px solid rgba(46,158,143,0.25)" }}
                              >
                                Síncrono
                              </span>
                            )}
                            {warnings.length > 0 && (
                              <div className="relative group flex-shrink-0">
                                <div
                                  className="flex items-center justify-center w-5 h-5 rounded-full"
                                  style={{ background: "rgba(245,158,11,0.15)" }}
                                >
                                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                                </div>
                                {/* Tooltip */}
                                <div
                                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 min-w-[180px] px-3 py-2 rounded-[8px] text-xs shadow-xl"
                                  style={{
                                    background: "rgba(30,28,26,0.98)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    backdropFilter: "blur(12px)",
                                  }}
                                >
                                  <p className="font-semibold text-amber-400 mb-1">Incompleto</p>
                                  {warnings.map((w, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 text-cream/50 py-0.5">
                                      {w === "Sem imagem de capa" && <ImageOff className="h-3 w-3 text-amber-400/60" />}
                                      {w === "Sem descrição" && <FileText className="h-3 w-3 text-amber-400/60" />}
                                      {w === "Sem seções/aulas" && <Layers className="h-3 w-3 text-amber-400/60" />}
                                      {w}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-cream/30">
                            {course.is_free ? "Gratuito" : `R$ ${((course.price_cents || 0) / 100).toFixed(2)}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-cream/40 hidden md:table-cell">
                      {course.instructor?.full_name}
                    </td>
                    <td className="px-4 py-3 text-center text-cream/50 hidden lg:table-cell tabular-nums">
                      {course._enrollCount || 0}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex justify-center">
                        {renderRating(course._avgRating, course._reviewsCount)}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex justify-center">
                        {renderCompletionRate(course)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={course.status}>
                        {statusLabels[course.status] || course.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick publish/unpublish toggle */}
                        {course.status !== "archived" && (
                          <button
                            onClick={() => togglePublishStatus(course)}
                            disabled={togglingStatus === course.id}
                            className="p-2 transition-colors rounded-lg hover:bg-white/[.03] disabled:opacity-40"
                            style={{
                              color:
                                course.status === "published"
                                  ? "rgba(16,185,129,0.7)"
                                  : "rgba(253,251,247,0.3)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color =
                                course.status === "published" ? "#f59e0b" : "#10b981";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color =
                                course.status === "published"
                                  ? "rgba(16,185,129,0.7)"
                                  : "rgba(253,251,247,0.3)";
                            }}
                            aria-label={
                              course.status === "published"
                                ? `Despublicar ${course.title}`
                                : `Publicar ${course.title}`
                            }
                            title={
                              course.status === "published"
                                ? "Despublicar (mover para rascunho)"
                                : "Publicar curso"
                            }
                          >
                            {course.status === "published" ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        )}

                        {/* Featured toggle */}
                        {course.status === "published" && (
                          <div className="relative flex items-center">
                            <button
                              onClick={() => toggleFeatured(course)}
                              className="p-2 transition-colors rounded-lg hover:bg-white/[.03]"
                              style={{ color: course.featured ? "#f59e0b" : "rgba(253,251,247,0.2)" }}
                              title={course.featured ? "Remover destaque" : "Marcar como destaque"}
                            >
                              <Sparkles className="h-4 w-4" />
                            </button>
                            {/* Inline label editor for featured courses */}
                            {course.featured && (
                              editingLabelId === course.id ? (
                                <input
                                  autoFocus
                                  value={editingLabelValue}
                                  onChange={(e) => setEditingLabelValue(e.target.value)}
                                  onBlur={() => {
                                    updateFeaturedLabel(course.id, editingLabelValue);
                                    setEditingLabelId(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      updateFeaturedLabel(course.id, editingLabelValue);
                                      setEditingLabelId(null);
                                    }
                                    if (e.key === "Escape") setEditingLabelId(null);
                                  }}
                                  className="w-24 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400 focus:outline-none"
                                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingLabelId(course.id);
                                    setEditingLabelValue(course.featured_label || "");
                                  }}
                                  className="text-[10px] font-bold text-amber-400/70 hover:text-amber-400 transition-colors truncate max-w-[80px]"
                                  title="Clique para editar label do destaque"
                                >
                                  {course.featured_label || "Em destaque"}
                                </button>
                              )
                            )}
                          </div>
                        )}

                        <Link href={`/formacao/admin/cursos/${course.id}/editar`}>
                          <button
                            className="p-2 text-cream/30 hover:text-accent transition-colors rounded-lg hover:bg-white/[.03]"
                            aria-label={`Editar ${course.title}`}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </Link>

                        {/* Duplicate button */}
                        <button
                          onClick={() => duplicateCourse(course)}
                          disabled={duplicating === course.id}
                          className="p-2 text-cream/30 hover:text-blue-400 transition-colors rounded-lg hover:bg-white/[.03] disabled:opacity-40"
                          aria-label={`Duplicar ${course.title}`}
                          title="Duplicar curso"
                        >
                          <Copy className={`h-4 w-4 ${duplicating === course.id ? "animate-pulse" : ""}`} />
                        </button>

                        {course.status === "archived" ? (
                          <button
                            onClick={() => restoreCourse(course.id)}
                            className="p-2 text-cream/30 hover:text-[#2E9E8F] transition-colors rounded-lg hover:bg-white/[.03]"
                            aria-label={`Restaurar ${course.title}`}
                            title="Restaurar como rascunho"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setArchiveTarget(course)}
                            className="p-2 text-cream/30 hover:text-red-400 transition-colors rounded-lg hover:bg-white/[.03]"
                            aria-label={`Arquivar ${course.title}`}
                            title="Arquivar"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => setDeleteTarget(course)}
                          className="p-2 text-cream/30 hover:text-red-500 transition-colors rounded-lg hover:bg-white/[.03]"
                          aria-label={`Apagar ${course.title}`}
                          title="Apagar permanentemente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-cream/35">
                    Nenhum curso encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Archive confirmation modal */}
      <Modal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title="Arquivar curso"
      >
        {archiveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-cream/50">
              Tem certeza que deseja arquivar <span className="font-medium text-cream">{archiveTarget.title}</span>?
              O curso não aparecerá mais no catálogo.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setArchiveTarget(null)}>Cancelar</Button>
              <Button variant="danger" onClick={archiveCourse}>Arquivar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Apagar curso"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-cream/50">
              Tem certeza que deseja apagar permanentemente <span className="font-medium text-red-400">{deleteTarget.title}</span>?
              Todos os módulos, aulas, matrículas e dados relacionados serão perdidos. Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" onClick={deleteCourse}>Apagar permanentemente</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
