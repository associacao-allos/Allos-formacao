"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import Skeleton from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Download, Filter, Trash2, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import { toast } from "sonner";
import type { Profile, Enrollment, Course } from "@/types";

const EnviosPage = dynamic(() => import("@/app/formacao/admin/envios/page"), { ssr: false });

interface StudentWithEnrollments extends Profile {
  enrollments: (Enrollment & { course: Pick<Course, "id" | "title"> })[];
}

type StatusFilter = "all" | "active" | "completed" | "inactive";

function getActivityColor(enrollments: StudentWithEnrollments["enrollments"]): "green" | "yellow" | "red" {
  const now = new Date();
  const mostRecent = enrollments.reduce((latest, e) => {
    const d = new Date(e.enrolled_at);
    return d > latest ? d : latest;
  }, new Date(0));

  const daysDiff = Math.floor((now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
  const hasCompleted = enrollments.some((e) => e.status === "completed");

  if (daysDiff <= 7) return "green";
  if (daysDiff <= 30) return "yellow";
  if (!hasCompleted) return "red";
  return "yellow";
}

const activityDotStyles: Record<string, { bg: string; label: string }> = {
  green: { bg: "rgb(34,197,94)", label: "Ativo recentemente" },
  yellow: { bg: "rgb(234,179,8)", label: "Ativo há 7-30 dias" },
  red: { bg: "rgb(239,68,68)", label: "Inativo há mais de 30 dias" },
};

export default function AdminAlunosPage() {
  const { profile, isAdmin } = useAuth();
  const [view, setView] = useState<"alunos" | "envios">("alunos");
  const [students, setStudents] = useState<StudentWithEnrollments[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] =
    useState<StudentWithEnrollments | null>(null);
  const [studentProgress, setStudentProgress] = useState<
    Record<string, { total: number; completed: number }>
  >({});
  const [progressLoading, setProgressLoading] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [courses, setCourses] = useState<Pick<Course, "id" | "title">[]>([]);
  const [unenrollConfirm, setUnenrollConfirm] = useState<string | null>(null);
  const [unenrolling, setUnenrolling] = useState(false);

  useEffect(() => {
    async function fetch() {
      if (!profile) {
        setLoading(false);
        return;
      }

      const client = createClient();
      let courseIds: string[] = [];
      let courseList: Pick<Course, "id" | "title">[] = [];
      if (isAdmin) {
        const { data } = await client.from("courses").select("id, title");
        courseIds = data?.map((c) => c.id) || [];
        courseList = data || [];
      } else {
        const { data } = await client
          .from("courses")
          .select("id, title")
          .eq("instructor_id", profile.id);
        courseIds = data?.map((c) => c.id) || [];
        courseList = data || [];
      }

      setCourses(courseList);

      if (courseIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: enrollments } = await client
        .from("enrollments")
        .select(`
          *,
          user:profiles!enrollments_user_id_fkey(*),
          course:courses!enrollments_course_id_fkey(id, title)
        `)
        .in("course_id", courseIds);

      if (enrollments) {
        const studentMap = new Map<string, StudentWithEnrollments>();
        enrollments.forEach((e) => {
          if (!e.user) return;
          const existing = studentMap.get(e.user.id);
          const enrollment = { ...e, course: e.course };
          if (existing) {
            existing.enrollments.push(enrollment);
          } else {
            studentMap.set(e.user.id, {
              ...e.user,
              enrollments: [enrollment],
            });
          }
        });
        setStudents(Array.from(studentMap.values()));
      }

      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, [profile, isAdmin]);

  async function loadStudentProgress(student: StudentWithEnrollments) {
    setProgressLoading(true);
    const client = createClient();
    const progress: Record<string, { total: number; completed: number }> = {};

    // Batch: get all sections for all enrolled courses at once
    const courseIds = student.enrollments.map((e) => e.course_id);
    const { data: sections } = await client
      .from("sections")
      .select("id, course_id")
      .in("course_id", courseIds);

    if (sections && sections.length > 0) {
      const sectionIds = sections.map((s) => s.id);

      // Get all lessons count by section
      const { data: lessons } = await client
        .from("lessons")
        .select("id, section_id")
        .in("section_id", sectionIds);

      // Get completed lessons
      const lessonIds = lessons?.map((l) => l.id) || [];
      const { data: completed } = lessonIds.length > 0
        ? await client
            .from("lesson_progress")
            .select("lesson_id")
            .eq("user_id", student.id)
            .eq("completed", true)
            .in("lesson_id", lessonIds)
        : { data: [] };

      const completedSet = new Set(completed?.map((c) => c.lesson_id) || []);

      // Map sections to courses
      const sectionToCourse: Record<string, string> = {};
      sections.forEach((s) => { sectionToCourse[s.id] = s.course_id; });

      // Count per course
      const totalPerCourse: Record<string, number> = {};
      const completedPerCourse: Record<string, number> = {};

      lessons?.forEach((l) => {
        const cid = sectionToCourse[l.section_id];
        if (cid) {
          totalPerCourse[cid] = (totalPerCourse[cid] || 0) + 1;
          if (completedSet.has(l.id)) {
            completedPerCourse[cid] = (completedPerCourse[cid] || 0) + 1;
          }
        }
      });

      courseIds.forEach((cid) => {
        progress[cid] = {
          total: totalPerCourse[cid] || 0,
          completed: completedPerCourse[cid] || 0,
        };
      });
    }

    setStudentProgress(progress);
    setProgressLoading(false);
  }

  async function handleUnenroll(enrollmentId: string) {
    setUnenrolling(true);
    const client = createClient();
    const { error } = await client
      .from("enrollments")
      .delete()
      .eq("id", enrollmentId);

    if (error) {
      toast.error("Erro ao desmatricular aluno.");
      setUnenrolling(false);
      return;
    }

    // Update local state
    setStudents((prev) =>
      prev
        .map((s) => ({
          ...s,
          enrollments: s.enrollments.filter((e) => e.id !== enrollmentId),
        }))
        .filter((s) => s.enrollments.length > 0)
    );

    if (selectedStudent) {
      const updatedEnrollments = selectedStudent.enrollments.filter(
        (e) => e.id !== enrollmentId
      );
      if (updatedEnrollments.length === 0) {
        setSelectedStudent(null);
      } else {
        setSelectedStudent({ ...selectedStudent, enrollments: updatedEnrollments });
      }
    }

    setUnenrollConfirm(null);
    setUnenrolling(false);
    toast.success("Aluno desmatriculado com sucesso.");
  }

  function exportCSV() {
    const header = "Nome,Email,Cursos Matriculados,Data de Cadastro\n";
    const rows = students.map((s) =>
      `"${s.full_name}","${s.email}",${s.enrollments.length},"${formatDate(s.created_at)}"`
    ).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alunos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Lista exportada!");
  }

  const filtered = useMemo(() => {
    return students.filter((s) => {
      // Text search
      if (
        search &&
        !s.full_name.toLowerCase().includes(search.toLowerCase()) &&
        !s.email.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }

      // Course filter
      if (courseFilter !== "all") {
        if (!s.enrollments.some((e) => e.course_id === courseFilter)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === "active") {
        return s.enrollments.some((e) => e.status === "active");
      }
      if (statusFilter === "completed") {
        return s.enrollments.some((e) => e.status === "completed");
      }
      if (statusFilter === "inactive") {
        const now = new Date();
        return s.enrollments.every((e) => {
          if (e.status === "completed") return false;
          const enrolled = new Date(e.enrolled_at);
          const daysDiff = Math.floor(
            (now.getTime() - enrolled.getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysDiff > 30;
        }) && s.enrollments.some((e) => e.status !== "completed");
      }

      return true;
    });
  }, [students, search, courseFilter, statusFilter]);

  // Summary counts
  const summary = useMemo(() => {
    const total = students.length;
    let active = 0;
    let completed = 0;
    students.forEach((s) => {
      const hasCompleted = s.enrollments.some((e) => e.status === "completed");
      const hasActive = s.enrollments.some((e) => e.status === "active");
      if (hasCompleted) completed++;
      if (hasActive) active++;
    });
    return { total, active, completed };
  }, [students]);

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Em andamento" },
    { key: "completed", label: "Concluídos" },
    { key: "inactive", label: "Inativos" },
  ];

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-32 mb-8" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
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
            Alunos
          </h1>
          <p className="text-sm text-cream/35 mt-1">{students.length} alunos matriculados</p>
        </div>
        {students.length > 0 && (
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        )}
      </motion.div>

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setView("alunos")}
          className="font-dm text-xs px-4 py-2 rounded-full transition-all"
          style={{
            backgroundColor: view === "alunos" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
            color: view === "alunos" ? "#C84B31" : "rgba(253,251,247,0.4)",
            border: `1px solid ${view === "alunos" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
          }}
        >
          Alunos
        </button>
        <button
          onClick={() => setView("envios")}
          className="font-dm text-xs px-4 py-2 rounded-full transition-all"
          style={{
            backgroundColor: view === "envios" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
            color: view === "envios" ? "#C84B31" : "rgba(253,251,247,0.4)",
            border: `1px solid ${view === "envios" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
          }}
        >
          Envios
        </button>
      </div>

      {view === "envios" && <EnviosPage />}

      {view === "alunos" && (<>
      {/* Student count summary */}
      {students.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6 px-4 py-3 rounded-[12px] flex items-center gap-2 text-sm"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span className="text-cream font-medium">{summary.total} alunos</span>
          <span className="text-cream/20">·</span>
          <span className="text-cream/50">{summary.active} em andamento</span>
          <span className="text-cream/20">·</span>
          <span className="text-cream/50">{summary.completed} concluídos</span>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm"
          aria-label="Buscar alunos"
        />
      </div>

      {/* Filters row */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3 mb-6"
      >
        {/* Course filter */}
        <div className="relative flex items-center gap-2">
          <Filter className="h-4 w-4 text-cream/30 flex-shrink-0" />
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="dark-input rounded-[10px] text-sm py-2 pl-3 pr-8 appearance-none cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,248,240,0.7)",
            }}
            aria-label="Filtrar por curso"
          >
            <option value="all">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter tabs */}
        <div
          className="flex items-center gap-1 p-1 rounded-[10px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className="px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all"
              style={{
                background:
                  statusFilter === tab.key
                    ? "rgba(200,75,49,0.15)"
                    : "transparent",
                color:
                  statusFilter === tab.key
                    ? "rgb(200,75,49)"
                    : "rgba(255,248,240,0.4)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

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
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Aluno</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Cursos</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50 hidden md:table-cell">Desde</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => {
                const activityColor = getActivityColor(student.enrollments);
                const dotStyle = activityDotStyles[activityColor];
                return (
                  <tr
                    key={student.id}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onClick={() => {
                      setSelectedStudent(student);
                      loadStudentProgress(student);
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(200,75,49,0.1)" }}
                          >
                            {student.avatar_url ? (
                              <img src={student.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <User className="h-4 w-4 text-accent" />
                            )}
                          </div>
                          {/* Activity indicator dot */}
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#121212]"
                            style={{
                              backgroundColor: dotStyle.bg,
                            }}
                            title={dotStyle.label}
                          />
                        </div>
                        <span className="font-medium text-cream">{student.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-cream/40 hidden md:table-cell">{student.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {student.enrollments.slice(0, 3).map((e) => (
                          <Badge key={e.id} variant={e.status === "completed" ? "published" : "draft"}>
                            {e.course?.title?.substring(0, 20)}
                            {(e.course?.title?.length || 0) > 20 ? "..." : ""}
                          </Badge>
                        ))}
                        {student.enrollments.length > 3 && (
                          <Badge variant="archived">+{student.enrollments.length - 3}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-cream/30 text-xs hidden md:table-cell">
                      {formatDate(student.created_at)}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-cream/35">
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student detail modal */}
      <Modal
        open={!!selectedStudent}
        onClose={() => {
          setSelectedStudent(null);
          setUnenrollConfirm(null);
        }}
        title={selectedStudent?.full_name || ""}
        maxWidth="max-w-xl"
      >
        {selectedStudent && (
          <div className="space-y-4">
            <p className="text-sm text-cream/40">{selectedStudent.email}</p>

            <h3 className="font-semibold text-cream mt-4">
              Cursos matriculados ({selectedStudent.enrollments.length})
            </h3>
            <div className="space-y-3">
              {selectedStudent.enrollments.map((e) => {
                const progress = studentProgress[e.course_id];
                const percent =
                  progress && progress.total > 0
                    ? (progress.completed / progress.total) * 100
                    : 0;
                return (
                  <div
                    key={e.id}
                    className="p-3 rounded-[10px]"
                    style={{
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-cream">
                        {e.course?.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={e.status === "completed" ? "published" : "draft"}>
                          {e.status === "completed" ? "Concluído" : "Em andamento"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-cream/30 mb-2">
                      Matriculado em {formatDate(e.enrolled_at)}
                      {e.completed_at && ` · Concluído em ${formatDate(e.completed_at)}`}
                    </p>
                    {progressLoading ? (
                      <Skeleton className="h-2 w-full" />
                    ) : (
                      <ProgressBar value={percent} size="sm" />
                    )}

                    {/* Unenroll action */}
                    <div className="mt-2 flex justify-end">
                      <AnimatePresence mode="wait">
                        {unenrollConfirm === e.id ? (
                          <motion.div
                            key="confirm"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center gap-2"
                          >
                            <div className="flex items-center gap-1.5 mr-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                              <span className="text-xs text-cream/50">Confirmar?</span>
                            </div>
                            <button
                              onClick={() => handleUnenroll(e.id)}
                              disabled={unenrolling}
                              className="px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors"
                              style={{
                                background: "rgba(239,68,68,0.15)",
                                color: "rgb(239,68,68)",
                                border: "1px solid rgba(239,68,68,0.2)",
                              }}
                            >
                              {unenrolling ? "Removendo..." : "Sim, desmatricular"}
                            </button>
                            <button
                              onClick={() => setUnenrollConfirm(null)}
                              className="px-2.5 py-1 rounded-[6px] text-xs font-medium text-cream/40 transition-colors hover:text-cream/60"
                              style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.08)",
                              }}
                            >
                              Cancelar
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button
                            key="action"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={() => setUnenrollConfirm(e.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors hover:bg-red-500/10"
                            style={{
                              color: "rgba(239,68,68,0.7)",
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                            Desmatricular
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
      </>)}
    </div>
  );
}
