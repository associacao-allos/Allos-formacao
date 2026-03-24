"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import {
  BookOpen,
  Users,
  Award,
  Star,
  Plus,
  Eye,
  Settings,
  CheckCircle,
  DollarSign,
  AlertTriangle,
  UserX,
  GraduationCap,
  MessageSquare,
  Pencil,
  Clock,
  FileText,
  TrendingUp,
  Trophy,
  Calendar,
  Activity,
  BarChart3,
  Flame,
} from "lucide-react";

interface DashboardStats {
  totalCourses: number;
  totalStudents: number;
  totalCertificates: number;
  avgRating: number;
  completionRate: number;
  totalRevenue: number;
  hasRevenue: boolean;
  inactiveStudents: number;
}

interface ActivityEvent {
  id: string;
  type: "enrollment" | "completion" | "review";
  userName: string;
  courseTitle: string;
  rating?: number;
  timestamp: string;
}

interface AttentionCourse {
  id: string;
  title: string;
  slug: string;
  reason: "empty_draft" | "low_rating" | "no_enrollments";
  avgRating?: number;
}

type DashPeriod = "week" | "month" | "quarter" | "semester" | "year";
const PERIOD_LABELS: Record<DashPeriod, string> = { week: "Semana", month: "Mês", quarter: "Trimestre", semester: "Semestre", year: "Ano" };

function getPeriodDate(p: DashPeriod): Date {
  const now = new Date();
  switch (p) {
    case 'week': { const d = new Date(now); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d; }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case 'semester': return new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
    case 'year': return new Date(now.getFullYear(), 0, 1);
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "há 1 dia";
  if (diffD < 30) return `há ${diffD} dias`;
  return `há ${Math.floor(diffD / 30)} mês${Math.floor(diffD / 30) > 1 ? "es" : ""}`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export default function AdminDashboard() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentEnrollments, setRecentEnrollments] = useState<
    { date: string; count: number }[]
  >([]);
  const [completionTrend, setCompletionTrend] = useState<
    { date: string; count: number }[]
  >([]);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [attentionCourses, setAttentionCourses] = useState<AttentionCourse[]>([]);
  const [loading, setLoading] = useState(true);

  // Formação Base stats
  const [dashPeriod, setDashPeriod] = useState<DashPeriod>("month");
  const [formacaoStats, setFormacaoStats] = useState<{
    totalFeedbacks: number;
    avgNotaGrupo: number;
    avgNotaCondutor: number;
    totalRelatos: number;
    topCondutores: { name: string; avg: number; count: number; relatos: { text: string; date: string }[] }[];
    topParticipantes: { nome: string; horas: number; count: number }[];
    enrollmentTrend: { date: string; count: number }[];
    submissionsTrend: { date: string; count: number }[];
    activityDist: { name: string; count: number }[];
    // Session metrics
    totalSessions: number;
    avgParticipantsPerSession: number;
    avgFrequencyPerStudent: number;
    // Retention & engagement
    uniqueParticipants: number;
    activeStudents: number;
    inactiveStudents: number;
    retentionRate: number;
    newStudentsThisPeriod: number;
    // Group rankings
    topGroups: { name: string; avgNota: number; count: number }[];
    topGroupsByParticipation: { name: string; count: number }[];
    // Rating distribution
    ratingDistribution: { rating: number; count: number }[];
    conductorRatingDist: { rating: number; count: number }[];
    // Heatmap
    heatmapData: { dia: number; hora: string; count: number }[];
    // Retention trend
    retentionByMonth: { month: string; active: number; churned: number }[];
  } | null>(null);
  const [selectedCondutor, setSelectedCondutor] = useState<string | null>(null);

  // Main dashboard fetch
  useEffect(() => {
    async function fetchStats() {
      if (!profile) {
        setLoading(false);
        return;
      }
      const supabase = createClient();

      // Published courses count
      let coursesQuery = supabase
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("status", "published");
      if (!isAdmin) {
        coursesQuery = coursesQuery.eq("instructor_id", profile.id);
      }
      const { count: courseCount } = await coursesQuery;

      // All course IDs (published) for stats
      let courseIdsQuery = supabase
        .from("courses")
        .select("id")
        .eq("status", "published");
      if (!isAdmin) {
        courseIdsQuery = courseIdsQuery.eq("instructor_id", profile.id);
      }
      const { data: courseIds } = await courseIdsQuery;
      const ids = courseIds?.map((c) => c.id) || [];

      let studentCount = 0;
      let certCount = 0;
      let avgRating = 0;
      let completionRate = 0;
      let totalRevenue = 0;
      let hasRevenue = false;
      let inactiveStudents = 0;

      if (ids.length > 0) {
        const [
          studentsRes,
          certsRes,
          reviewsRes,
          completedRes,
          paidEnrollmentsRes,
        ] = await Promise.all([
          supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .in("course_id", ids),
          supabase
            .from("certificates")
            .select("*", { count: "exact", head: true })
            .in("course_id", ids),
          supabase.from("reviews").select("rating").in("course_id", ids),
          supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .in("course_id", ids)
            .eq("status", "completed"),
          supabase
            .from("enrollments")
            .select("course_id, courses!inner(price_cents)")
            .in("course_id", ids)
            .eq("payment_status", "paid"),
        ]);

        studentCount = studentsRes.count || 0;
        certCount = certsRes.count || 0;
        const completedCount = completedRes.count || 0;

        if (reviewsRes.data && reviewsRes.data.length > 0) {
          avgRating =
            reviewsRes.data.reduce((sum, r) => sum + r.rating, 0) /
            reviewsRes.data.length;
        }

        if (studentCount > 0) {
          completionRate = (completedCount / studentCount) * 100;
        }

        // Revenue from paid enrollments
        if (paidEnrollmentsRes.data && paidEnrollmentsRes.data.length > 0) {
          totalRevenue = paidEnrollmentsRes.data.reduce((sum, e: any) => {
            const price = e.courses?.price_cents || 0;
            return sum + price;
          }, 0);
          hasRevenue = totalRevenue > 0;
        }

        // Inactive students: enrolled > 30 days ago, not completed
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { count: inactiveCount } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .in("course_id", ids)
          .neq("status", "completed")
          .lt("enrolled_at", thirtyDaysAgo.toISOString());
        inactiveStudents = inactiveCount || 0;
      }

      setStats({
        totalCourses: courseCount || 0,
        totalStudents: studentCount,
        totalCertificates: certCount,
        avgRating,
        completionRate,
        totalRevenue,
        hasRevenue,
        inactiveStudents,
      });

      // Enrollment chart + completion trend + activity feed
      if (ids.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [enrollmentsRes, completionsRes, recentEnrollFeed, recentReviewsFeed] =
          await Promise.all([
            supabase
              .from("enrollments")
              .select("enrolled_at")
              .in("course_id", ids)
              .gte("enrolled_at", thirtyDaysAgo.toISOString())
              .order("enrolled_at"),
            supabase
              .from("enrollments")
              .select("completed_at")
              .in("course_id", ids)
              .eq("status", "completed")
              .not("completed_at", "is", null)
              .gte("completed_at", thirtyDaysAgo.toISOString())
              .order("completed_at"),
            // Activity feed: recent enrollments + completions
            supabase
              .from("enrollments")
              .select("id, enrolled_at, status, completed_at, user:profiles!user_id(full_name), course:courses!course_id(title)")
              .in("course_id", ids)
              .order("enrolled_at", { ascending: false })
              .limit(12),
            supabase
              .from("reviews")
              .select("id, rating, created_at, user:profiles!user_id(full_name), course:courses!course_id(title)")
              .in("course_id", ids)
              .order("created_at", { ascending: false })
              .limit(5),
          ]);

        // Enrollment chart data
        if (enrollmentsRes.data) {
          const byDay: Record<string, number> = {};
          enrollmentsRes.data.forEach((e) => {
            const day = e.enrolled_at.split("T")[0];
            byDay[day] = (byDay[day] || 0) + 1;
          });
          setRecentEnrollments(
            Object.entries(byDay).map(([date, count]) => ({ date, count }))
          );
        }

        // Completion trend data
        if (completionsRes.data) {
          const byDay: Record<string, number> = {};
          completionsRes.data.forEach((e: any) => {
            if (e.completed_at) {
              const day = e.completed_at.split("T")[0];
              byDay[day] = (byDay[day] || 0) + 1;
            }
          });
          setCompletionTrend(
            Object.entries(byDay).map(([date, count]) => ({ date, count }))
          );
        }

        // Build activity feed
        const events: ActivityEvent[] = [];

        if (recentEnrollFeed.data) {
          recentEnrollFeed.data.forEach((e: any) => {
            const userName = e.user?.full_name || "Aluno";
            const courseTitle = e.course?.title || "Curso";

            events.push({
              id: `enroll-${e.id}`,
              type: "enrollment",
              userName,
              courseTitle,
              timestamp: e.enrolled_at,
            });

            if (e.status === "completed" && e.completed_at) {
              events.push({
                id: `complete-${e.id}`,
                type: "completion",
                userName,
                courseTitle,
                timestamp: e.completed_at,
              });
            }
          });
        }

        if (recentReviewsFeed.data) {
          recentReviewsFeed.data.forEach((r: any) => {
            events.push({
              id: `review-${r.id}`,
              type: "review",
              userName: r.user?.full_name || "Aluno",
              courseTitle: r.course?.title || "Curso",
              rating: r.rating,
              timestamp: r.created_at,
            });
          });
        }

        // Sort by timestamp descending and take 8
        events.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setActivityFeed(events.slice(0, 8));
      }

      // Courses needing attention
      let allCoursesQuery = supabase
        .from("courses")
        .select("id, title, slug, status");
      if (!isAdmin) {
        allCoursesQuery = allCoursesQuery.eq("instructor_id", profile.id);
      }
      const { data: allCourses } = await allCoursesQuery;

      const attention: AttentionCourse[] = [];

      if (allCourses) {
        // Draft courses with no lessons
        const draftCourses = allCourses.filter((c) => c.status === "draft");
        if (draftCourses.length > 0) {
          const draftIds = draftCourses.map((c) => c.id);
          const { data: sectionsWithLessons } = await supabase
            .from("sections")
            .select("course_id, lessons(id)")
            .in("course_id", draftIds);

          const coursesWithLessons = new Set<string>();
          sectionsWithLessons?.forEach((s: any) => {
            if (s.lessons && s.lessons.length > 0) {
              coursesWithLessons.add(s.course_id);
            }
          });

          draftCourses.forEach((c) => {
            if (!coursesWithLessons.has(c.id)) {
              attention.push({
                id: c.id,
                title: c.title,
                slug: c.slug,
                reason: "empty_draft",
              });
            }
          });
        }

        // Published courses with low rating or no enrollments
        const publishedCourses = allCourses.filter(
          (c) => c.status === "published"
        );
        if (publishedCourses.length > 0) {
          const pubIds = publishedCourses.map((c) => c.id);

          const [reviewsForAttention, enrollCountsForAttention] =
            await Promise.all([
              supabase
                .from("reviews")
                .select("course_id, rating")
                .in("course_id", pubIds),
              supabase
                .from("enrollments")
                .select("course_id")
                .in("course_id", pubIds),
            ]);

          // Avg rating per course
          const ratingMap: Record<string, { sum: number; count: number }> = {};
          reviewsForAttention.data?.forEach((r) => {
            if (!ratingMap[r.course_id]) {
              ratingMap[r.course_id] = { sum: 0, count: 0 };
            }
            ratingMap[r.course_id].sum += r.rating;
            ratingMap[r.course_id].count += 1;
          });

          // Enrollment count per course
          const enrollMap: Record<string, number> = {};
          enrollCountsForAttention.data?.forEach((e) => {
            enrollMap[e.course_id] = (enrollMap[e.course_id] || 0) + 1;
          });

          publishedCourses.forEach((c) => {
            const ratingData = ratingMap[c.id];
            if (ratingData && ratingData.count > 0) {
              const avg = ratingData.sum / ratingData.count;
              if (avg < 3.0) {
                attention.push({
                  id: c.id,
                  title: c.title,
                  slug: c.slug,
                  reason: "low_rating",
                  avgRating: avg,
                });
              }
            }

            if (!enrollMap[c.id]) {
              attention.push({
                id: c.id,
                title: c.title,
                slug: c.slug,
                reason: "no_enrollments",
              });
            }
          });
        }
      }

      setAttentionCourses(attention);
      setLoading(false);
    }

    fetchStats().catch(() => setLoading(false));
  }, [profile, isAdmin]);

  // Separate useEffect for Formação Base stats (re-fetches on dashPeriod change)
  useEffect(() => {
    async function fetchFormacaoStats() {
      if (!profile) return;
      const supabase = createClient();
      const periodStart = getPeriodDate(dashPeriod);

      try {
        const [subsRes, atividadesRes, enrollRes, slotsRes, horariosRes] = await Promise.all([
          supabase.from("certificado_submissions").select("nome_completo, atividade_nome, nota_grupo, nota_condutor, condutores, relato, created_at"),
          supabase.from("certificado_atividades").select("nome, carga_horaria"),
          supabase.from("enrollments").select("enrolled_at"),
          supabase.from("formacao_slots").select("id, status, dia_semana, horario_id, atividade_nome, formacao_horarios(hora)"),
          supabase.from("formacao_horarios").select("id, hora, ordem"),
        ]);

        const allSubs = subsRes.data || [];
        const atividades = atividadesRes.data || [];
        const enrollData = enrollRes.data || [];
        const slotsData = slotsRes.data || [];
        const horariosData = horariosRes.data || [];

        // Filter submissions by period
        const subs = allSubs.filter((s: any) => new Date(s.created_at) >= periodStart);

        const total = subs.length;
        const avgG = total > 0 ? subs.reduce((a: number, x: any) => a + (x.nota_grupo || 0), 0) / total : 0;
        const avgC = total > 0 ? subs.reduce((a: number, x: any) => a + (x.nota_condutor || 0), 0) / total : 0;
        const totalRelatos = subs.filter((s: any) => s.relato && s.relato.trim().length > 0).length;

        // Conductor ranking with relatos
        const cMap = new Map<string, { sum: number; count: number; relatos: { text: string; date: string }[] }>();
        subs.forEach((x: any) => {
          (x.condutores || []).forEach((c: string) => {
            const e = cMap.get(c) || { sum: 0, count: 0, relatos: [] };
            e.sum += x.nota_condutor || 0;
            e.count++;
            if (x.relato && x.relato.trim().length > 0) {
              e.relatos.push({ text: x.relato, date: x.created_at });
            }
            cMap.set(c, e);
          });
        });
        const topC = Array.from(cMap.entries())
          .map(([name, d]) => ({ name, avg: d.count > 0 ? d.sum / d.count : 0, count: d.count, relatos: d.relatos }))
          .sort((a, b) => b.avg - a.avg || b.count - a.count)
          .slice(0, 10);

        // Participant ranking (hours)
        const horasMap = new Map<string, number>();
        (atividades || []).forEach((a: any) => horasMap.set(a.nome.toLowerCase(), a.carga_horaria));
        const pMap = new Map<string, { count: number; horas: number }>();
        subs.forEach((s: any) => {
          const nome = (s.nome_completo || "").trim();
          if (!nome) return;
          const e = pMap.get(nome) || { count: 0, horas: 0 };
          e.count++;
          e.horas += horasMap.get(s.atividade_nome?.toLowerCase()) || 2;
          pMap.set(nome, e);
        });
        const topP = Array.from(pMap.entries())
          .map(([nome, d]) => ({ nome, count: d.count, horas: d.horas }))
          .sort((a, b) => b.horas - a.horas || b.count - a.count)
          .slice(0, 5);

        // Activity distribution
        const actMap = new Map<string, number>();
        subs.forEach((s: any) => {
          const name = s.atividade_nome || "Sem nome";
          actMap.set(name, (actMap.get(name) || 0) + 1);
        });
        const activityDist = Array.from(actMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        // Submissions trend (group by day within period)
        const subsByDay: Record<string, number> = {};
        subs.forEach((s: any) => {
          const day = s.created_at.split("T")[0];
          subsByDay[day] = (subsByDay[day] || 0) + 1;
        });
        const submissionsTrend = Object.entries(subsByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Enrollment trend (based on period window)
        const enrollByDay: Record<string, number> = {};
        (enrollData || []).forEach((e: any) => {
          if (new Date(e.enrolled_at) >= periodStart) {
            const day = e.enrolled_at.split("T")[0];
            enrollByDay[day] = (enrollByDay[day] || 0) + 1;
          }
        });
        const enrollmentTrend = Object.entries(enrollByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // ── New metrics ──

        // Session metrics: count slots with status='conduzido' in period
        const conductedSlots = (slotsData || []).filter(
          (s: any) => s.status === "conduzido" && new Date(s.created_at) >= periodStart
        );
        const totalSessions = conductedSlots.length;

        // Unique participants in period
        const uniqueNames = new Set<string>();
        subs.forEach((s: any) => {
          const nome = (s.nome_completo || "").trim();
          if (nome) uniqueNames.add(nome.toLowerCase());
        });
        const uniqueParticipants = uniqueNames.size;

        const avgParticipantsPerSession = totalSessions > 0 ? total / totalSessions : 0;
        const avgFrequencyPerStudent = uniqueParticipants > 0 ? total / uniqueParticipants : 0;

        // Active vs inactive (based on ALL submissions, not just period)
        const thirtyDaysAgoDate = new Date();
        thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);

        const allParticipantDates = new Map<string, { first: Date; last: Date }>();
        (allSubs || []).forEach((s: any) => {
          const nome = (s.nome_completo || "").trim().toLowerCase();
          if (!nome) return;
          const d = new Date(s.created_at);
          const existing = allParticipantDates.get(nome);
          if (!existing) {
            allParticipantDates.set(nome, { first: d, last: d });
          } else {
            if (d < existing.first) existing.first = d;
            if (d > existing.last) existing.last = d;
          }
        });

        let activeStudents = 0;
        let inactiveFormacaoStudents = 0;
        let newStudentsThisPeriod = 0;

        allParticipantDates.forEach((dates) => {
          if (dates.last >= thirtyDaysAgoDate) {
            activeStudents++;
          } else {
            inactiveFormacaoStudents++;
          }
          if (dates.first >= periodStart) {
            newStudentsThisPeriod++;
          }
        });

        const retentionRate = (activeStudents + inactiveFormacaoStudents) > 0
          ? (activeStudents / (activeStudents + inactiveFormacaoStudents)) * 100
          : 0;

        // Group rankings by avg nota_grupo
        const groupNotaMap = new Map<string, { sum: number; count: number }>();
        subs.forEach((s: any) => {
          const name = s.atividade_nome || "Sem nome";
          const e = groupNotaMap.get(name) || { sum: 0, count: 0 };
          e.sum += s.nota_grupo || 0;
          e.count++;
          groupNotaMap.set(name, e);
        });
        const topGroups = Array.from(groupNotaMap.entries())
          .map(([name, d]) => ({ name, avgNota: d.count > 0 ? d.sum / d.count : 0, count: d.count }))
          .sort((a, b) => b.avgNota - a.avgNota)
          .slice(0, 5);

        // Groups by participation count
        const topGroupsByParticipation = Array.from(groupNotaMap.entries())
          .map(([name, d]) => ({ name, count: d.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Rating distribution (nota_grupo 1-10)
        const ratingDistribution: { rating: number; count: number }[] = [];
        for (let r = 1; r <= 10; r++) {
          ratingDistribution.push({
            rating: r,
            count: subs.filter((s: any) => Math.round(s.nota_grupo || 0) === r).length,
          });
        }

        // Conductor rating distribution (nota_condutor 1-10)
        const conductorRatingDist: { rating: number; count: number }[] = [];
        for (let r = 1; r <= 10; r++) {
          conductorRatingDist.push({
            rating: r,
            count: subs.filter((s: any) => Math.round(s.nota_condutor || 0) === r).length,
          });
        }

        // Heatmap: dia × hora engagement
        // Map slots to (dia_semana, hora) and count submissions matching atividade_nome
        const heatmapMap = new Map<string, number>();
        const submissionCountByAtividade = new Map<string, number>();
        subs.forEach((s: any) => {
          const name = (s.atividade_nome || "").toLowerCase();
          submissionCountByAtividade.set(name, (submissionCountByAtividade.get(name) || 0) + 1);
        });

        const activeSlots = (slotsData || []).filter((s: any) => s.atividade_nome);
        activeSlots.forEach((slot: any) => {
          const hora = slot.formacao_horarios?.hora || "";
          const key = `${slot.dia_semana}-${hora}`;
          const atividadeName = (slot.atividade_nome || "").toLowerCase();
          const count = submissionCountByAtividade.get(atividadeName) || 0;
          heatmapMap.set(key, (heatmapMap.get(key) || 0) + count);
        });

        // Populate empty slots from horarios × dias
        if (heatmapMap.size === 0 && horariosData) {
          horariosData.forEach((h: any) => {
            for (let d = 0; d < 5; d++) {
              const key = `${d}-${h.hora}`;
              if (!heatmapMap.has(key)) heatmapMap.set(key, 0);
            }
          });
        }

        const heatmapData = Array.from(heatmapMap.entries()).map(([key, count]) => {
          const [dia, hora] = key.split("-");
          return { dia: parseInt(dia), hora, count };
        });

        // Retention by month (last 6 months)
        const retentionByMonth: { month: string; active: number; churned: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
          const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
          const prevMonthEnd = new Date(now.getFullYear(), now.getMonth() - i, 0, 23, 59, 59);

          const activeInMonth = new Set<string>();
          const activeInPrev = new Set<string>();

          (allSubs || []).forEach((s: any) => {
            const nome = (s.nome_completo || "").trim().toLowerCase();
            if (!nome) return;
            const d = new Date(s.created_at);
            if (d >= monthStart && d <= monthEnd) activeInMonth.add(nome);
            if (d >= prevMonthStart && d <= prevMonthEnd) activeInPrev.add(nome);
          });

          let churned = 0;
          activeInPrev.forEach((nome) => {
            if (!activeInMonth.has(nome)) churned++;
          });

          const monthLabel = monthStart.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
          retentionByMonth.push({ month: monthLabel, active: activeInMonth.size, churned });
        }

        setFormacaoStats({
          totalFeedbacks: total,
          avgNotaGrupo: avgG,
          avgNotaCondutor: avgC,
          totalRelatos,
          topCondutores: topC,
          topParticipantes: topP,
          enrollmentTrend,
          submissionsTrend,
          activityDist,
          totalSessions,
          avgParticipantsPerSession,
          avgFrequencyPerStudent,
          uniqueParticipants,
          activeStudents,
          inactiveStudents: inactiveFormacaoStudents,
          retentionRate,
          newStudentsThisPeriod,
          topGroups,
          topGroupsByParticipation,
          ratingDistribution,
          conductorRatingDist,
          heatmapData,
          retentionByMonth,
        });
      } catch {
        // Formação tables may not exist yet
      }
    }

    fetchFormacaoStats();
  }, [profile, dashPeriod]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-8">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Cursos publicados",
      value: stats?.totalCourses || 0,
      icon: BookOpen,
      iconBg: "rgba(200,75,49,0.1)",
      iconColor: "#C84B31",
    },
    {
      label: "Alunos matriculados",
      value: stats?.totalStudents || 0,
      icon: Users,
      iconBg: "rgba(212,133,74,0.1)",
      iconColor: "#D4854A",
    },
    {
      label: "Certificados emitidos",
      value: stats?.totalCertificates || 0,
      icon: Award,
      iconBg: "rgba(46,158,143,0.1)",
      iconColor: "#2E9E8F",
    },
    {
      label: "Rating médio",
      value: stats?.avgRating ? stats.avgRating.toFixed(1) : "—",
      icon: Star,
      iconBg: "rgba(251,191,36,0.1)",
      iconColor: "#F59E0B",
    },
    {
      label: "Taxa de conclusão",
      value: stats?.completionRate
        ? `${stats.completionRate.toFixed(1)}%`
        : "—",
      icon: CheckCircle,
      iconBg: "rgba(46,158,143,0.1)",
      iconColor: "#2E9E8F",
    },
  ];

  // Conditionally add revenue card
  if (stats?.hasRevenue) {
    statCards.push({
      label: "Receita total",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      iconBg: "rgba(34,197,94,0.1)",
      iconColor: "#22C55E",
    });
  }

  const quickActions = [
    {
      label: "Novo curso",
      href: "/formacao/admin/cursos/novo",
      icon: Plus,
      color: "#C84B31",
    },
    {
      label: "Ver alunos",
      href: "/formacao/admin/alunos",
      icon: Users,
      color: "#D4854A",
    },
    {
      label: "Ver site",
      href: "/formacao",
      icon: Eye,
      color: "#2E9E8F",
    },
    {
      label: "Configurações",
      href: "/formacao/admin/configuracoes",
      icon: Settings,
      color: "#5C5C5C",
    },
  ];

  const activityIcon = {
    enrollment: GraduationCap,
    completion: CheckCircle,
    review: MessageSquare,
  };

  const activityColor = {
    enrollment: "#D4854A",
    completion: "#2E9E8F",
    review: "#F59E0B",
  };

  const attentionReasonLabel = {
    empty_draft: "Rascunho sem aulas",
    low_rating: "Avaliação baixa",
    no_enrollments: "Sem matrículas",
  };

  // Determine grid columns for stat cards
  const statGridCols = statCards.length <= 5 ? "lg:grid-cols-5" : "lg:grid-cols-6";

  // Selected conductor data for detail view
  const selectedCondutorData = selectedCondutor
    ? formacaoStats?.topCondutores.find((c) => c.name === selectedCondutor)
    : null;

  return (
    <div>
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
          {getGreeting()}, {profile?.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-cream/35 mt-1 font-dm">
          Aqui está o resumo da sua plataforma.
        </p>
      </motion.div>

      {/* Stat cards with staggered animation */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${statGridCols} gap-5 mb-8`}
      >
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.1 + i * 0.08,
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Card>
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
                  style={{ background: stat.iconBg }}
                >
                  <stat.icon
                    className="h-6 w-6"
                    style={{ color: stat.iconColor }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-cream tabular-nums truncate">
                    {stat.value}
                  </p>
                  <p className="text-xs text-cream/40">{stat.label}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Inactive students alert */}
      {stats && stats.inactiveStudents > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mb-8"
        >
          <div
            className="flex items-center gap-3 px-5 py-3.5 rounded-[12px]"
            style={{
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.15)",
            }}
          >
            <UserX className="h-5 w-5 flex-shrink-0" style={{ color: "#F59E0B" }} />
            <div>
              <p className="text-sm font-dm text-cream">
                <span className="font-semibold">{stats.inactiveStudents}</span>{" "}
                aluno{stats.inactiveStudents !== 1 ? "s" : ""} inativo
                {stats.inactiveStudents !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-cream/35 mt-0.5">
                Matriculados há mais de 30 dias sem concluir o curso.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Chart + Activity feed row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Chart section — 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="lg:col-span-2 space-y-5"
        >
          <Card>
            <h2 className="font-fraunces font-bold text-lg text-cream mb-4">
              Matrículas nos últimos 30 dias
            </h2>
            {recentEnrollments.length > 0 ? (
              <div className="flex items-end gap-1 h-40">
                {recentEnrollments.map((item) => {
                  const maxCount = recentEnrollments.length > 0
                    ? Math.max(...recentEnrollments.map((e) => e.count))
                    : 1;
                  const height =
                    maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  const dateLabel = item.date.split("-").slice(1).join("/");
                  return (
                    <div
                      key={item.date}
                      className="flex-1 flex flex-col items-center justify-end group relative"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div
                          className="px-2 py-1 rounded-md text-[10px] font-dm font-medium text-cream whitespace-nowrap"
                          style={{
                            background: "rgba(30,30,30,0.95)",
                            border: "1px solid rgba(200,75,49,0.2)",
                          }}
                        >
                          {item.count} matrícula{item.count !== 1 ? "s" : ""} ·{" "}
                          {dateLabel}
                        </div>
                      </div>
                      <div
                        className="w-full rounded-t min-h-[4px] transition-all duration-200 bg-[rgba(200,75,49,0.2)] hover:bg-[rgba(200,75,49,0.5)]"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      {recentEnrollments.indexOf(item) % 5 === 0 && (
                        <span className="text-[9px] text-cream/20 mt-1 font-dm">
                          {dateLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-cream/35 text-center py-8">
                Nenhuma matrícula nos últimos 30 dias.
              </p>
            )}
          </Card>

          {/* Completion trend mini-chart */}
          <Card padding="sm">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4" style={{ color: "#2E9E8F" }} />
              <h3 className="font-dm font-semibold text-sm text-cream/70">
                Conclusões nos últimos 30 dias
              </h3>
            </div>
            {completionTrend.length > 0 ? (
              <div className="flex items-end gap-[3px] h-16">
                {completionTrend.map((item) => {
                  const maxCount = Math.max(
                    ...completionTrend.map((e) => e.count)
                  );
                  const height =
                    maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div
                      key={item.date}
                      className="flex-1 flex flex-col items-center justify-end group relative"
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div
                          className="px-2 py-0.5 rounded text-[9px] font-dm font-medium text-cream whitespace-nowrap"
                          style={{
                            background: "rgba(30,30,30,0.95)",
                            border: "1px solid rgba(46,158,143,0.2)",
                          }}
                        >
                          {item.count} · {item.date.split("-").slice(1).join("/")}
                        </div>
                      </div>
                      <div
                        className="w-full rounded-t min-h-[3px] transition-all duration-200 bg-[rgba(46,158,143,0.2)] hover:bg-[rgba(46,158,143,0.5)]"
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-cream/30 text-center py-3">
                Nenhuma conclusão nos últimos 30 dias.
              </p>
            )}
          </Card>
        </motion.div>

        {/* Right column: Activity feed + Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="space-y-5"
        >
          {/* Activity feed */}
          <Card>
            <h2 className="font-fraunces font-bold text-lg text-cream mb-3">
              Atividade recente
            </h2>
            {activityFeed.length > 0 ? (
              <div className="space-y-1">
                {activityFeed.map((event) => {
                  const Icon = activityIcon[event.type];
                  const color = activityColor[event.type];
                  let description = "";
                  if (event.type === "enrollment") {
                    description = `${event.userName} se matriculou em ${event.courseTitle}`;
                  } else if (event.type === "completion") {
                    description = `${event.userName} concluiu ${event.courseTitle}`;
                  } else if (event.type === "review") {
                    description = `Nova avaliação ${"★".repeat(event.rating || 0)}${event.rating && event.rating < 5 ? "☆".repeat(5 - event.rating) : ""} em ${event.courseTitle}`;
                  }

                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-2.5 px-2 py-2 rounded-[8px] hover:bg-white/[.02] transition-colors duration-150"
                    >
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${color}15` }}
                      >
                        <Icon
                          className="h-3 w-3"
                          style={{ color }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-dm text-cream/70 leading-snug line-clamp-2">
                          {description}
                        </p>
                        <p className="text-[10px] text-cream/25 mt-0.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {relativeTime(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-cream/35 text-center py-6">
                Nenhuma atividade recente.
              </p>
            )}
          </Card>

          {/* Quick actions — compact */}
          <Card padding="sm">
            <h2 className="font-fraunces font-bold text-sm text-cream mb-2">
              Ações rápidas
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-xs font-dm text-cream/60 hover:text-cream hover:bg-white/[.03] transition-all duration-200"
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${action.color}15`,
                      border: `1px solid ${action.color}25`,
                    }}
                  >
                    <action.icon
                      className="h-3 w-3"
                      style={{ color: action.color }}
                    />
                  </div>
                  {action.label}
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Formação Base section
         ════════════════════════════════════════════════════════════════════ */}
      {formacaoStats && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5" style={{ color: "#C84B31" }} />
            <h2 className="font-fraunces font-bold text-lg text-cream">Formação Base</h2>
          </div>

          {/* Period filter bar */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(Object.keys(PERIOD_LABELS) as DashPeriod[]).map(p => (
              <button key={p} onClick={() => { setDashPeriod(p); setSelectedCondutor(null); }}
                className="font-dm text-xs px-3 py-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: dashPeriod === p ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
                  color: dashPeriod === p ? "#C84B31" : "rgba(253,251,247,0.4)",
                  border: `1px solid ${dashPeriod === p ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Stats cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Feedbacks",
                value: String(formacaoStats.totalFeedbacks),
                icon: FileText,
                iconColor: "#C84B31",
                iconBg: "rgba(200,75,49,0.1)",
              },
              {
                label: "Nota Grupo",
                value: formacaoStats.avgNotaGrupo.toFixed(1),
                suffix: "/10",
                icon: Star,
                iconColor: "#C84B31",
                iconBg: "rgba(200,75,49,0.1)",
              },
              {
                label: "Nota Condutores",
                value: formacaoStats.avgNotaCondutor.toFixed(1),
                suffix: "/10",
                icon: Users,
                iconColor: "#2E9E8F",
                iconBg: "rgba(46,158,143,0.1)",
              },
              {
                label: "Relatos",
                value: formacaoStats.totalFeedbacks > 0
                  ? `${Math.round((formacaoStats.totalRelatos / formacaoStats.totalFeedbacks) * 100)}%`
                  : "0%",
                subtitle: `${formacaoStats.totalRelatos} de ${formacaoStats.totalFeedbacks}`,
                icon: MessageSquare,
                iconColor: "#D4854A",
                iconBg: "rgba(212,133,74,0.1)",
              },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{ background: card.iconBg }}
                    >
                      <card.icon className="h-5 w-5" style={{ color: card.iconColor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-fraunces font-bold text-xl text-cream tabular-nums">
                        <span style={{ color: card.iconColor }}>{card.value}</span>
                        {(card as any).suffix && <span className="text-sm text-cream/30">{(card as any).suffix}</span>}
                      </p>
                      <p className="text-[11px] font-dm text-cream/40">{card.label}</p>
                      {(card as any).subtitle && (
                        <p className="text-[10px] font-dm text-cream/25">{(card as any).subtitle}</p>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Two-column grid: Rankings + distributions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Left column */}
            <div className="space-y-4">
              {/* Conductor ranking */}
              {!selectedCondutor ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                >
                  <Card>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4" style={{ color: "#C84B31" }} />
                      <h3 className="font-dm text-sm font-semibold text-cream/70">Ranking Condutores</h3>
                    </div>
                    {formacaoStats.topCondutores.length > 0 ? (
                      <div className="space-y-0.5">
                        {formacaoStats.topCondutores.map((c, i) => (
                          <button
                            key={c.name}
                            onClick={() => setSelectedCondutor(c.name)}
                            className="flex items-center gap-3 py-2 px-2 w-full text-left rounded-[8px] hover:bg-white/[.03] transition-colors duration-150"
                          >
                            <span
                              className="font-dm text-sm font-bold w-5 text-center"
                              style={{ color: i < 3 ? "#C84B31" : "rgba(253,251,247,0.3)" }}
                            >
                              {i + 1}
                            </span>
                            <span className="font-dm text-sm flex-1 text-cream/70 truncate">{c.name}</span>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3" fill="#C84B31" stroke="#C84B31" />
                              <span className="font-dm text-sm font-bold" style={{ color: "#C84B31" }}>
                                {c.avg.toFixed(1)}
                              </span>
                            </div>
                            <span
                              className="font-dm text-xs px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(253,251,247,0.4)" }}
                            >
                              {c.count}x
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-cream/30 text-center py-4">Nenhum condutor no período.</p>
                    )}
                    <p className="text-[10px] text-cream/20 mt-3 font-dm text-center">
                      Ranking pondera nota e volume
                    </p>
                  </Card>
                </motion.div>
              ) : (
                /* Conductor detail view */
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-fraunces font-bold text-base text-cream">{selectedCondutor}</h3>
                        {selectedCondutorData && (
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3" fill="#C84B31" stroke="#C84B31" />
                              <span className="font-dm text-sm font-bold" style={{ color: "#C84B31" }}>
                                {selectedCondutorData.avg.toFixed(1)}
                              </span>
                              <span className="text-xs text-cream/30">/10</span>
                            </div>
                            <span className="text-xs text-cream/40 font-dm">
                              {selectedCondutorData.count} feedback{selectedCondutorData.count !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedCondutor(null)}
                        className="font-dm text-xs px-3 py-1.5 rounded-full transition-all hover:bg-white/[.05]"
                        style={{
                          color: "rgba(253,251,247,0.5)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        Voltar
                      </button>
                    </div>

                    {selectedCondutorData && selectedCondutorData.relatos.length > 0 ? (
                      <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                        {selectedCondutorData.relatos.map((r, i) => (
                          <div
                            key={i}
                            className="px-3 py-2.5 rounded-[10px]"
                            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                          >
                            <p className="font-dm text-xs text-cream/60 leading-relaxed italic">
                              &ldquo;{r.text}&rdquo;
                            </p>
                            <p className="font-dm text-[10px] text-cream/20 mt-1.5">
                              {new Date(r.date).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-cream/30 text-center py-6">Nenhum relato para este condutor.</p>
                    )}
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Participant ranking */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85, duration: 0.4 }}
              >
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-4 w-4" style={{ color: "#FBBC05" }} />
                    <h3 className="font-dm text-sm font-semibold text-cream/70">Top Participantes</h3>
                  </div>
                  {formacaoStats.topParticipantes.length > 0 ? (
                    <div className="space-y-2">
                      {formacaoStats.topParticipantes.map((p, i) => {
                        const medals = ["#FFD700", "#C0C0C0", "#CD7F32"];
                        const isMedal = i < 3;
                        const maxHoras = formacaoStats.topParticipantes[0]?.horas || 1;
                        const barWidth = (p.horas / maxHoras) * 100;
                        return (
                          <div key={p.nome} className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span
                                className="font-dm text-sm font-bold w-5 text-center"
                                style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.3)" }}
                              >
                                {i + 1}
                              </span>
                              <span className="font-dm text-sm flex-1 text-cream/70 truncate">{p.nome}</span>
                              <span
                                className="font-fraunces font-bold text-sm"
                                style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.4)" }}
                              >
                                {p.horas}h
                              </span>
                              <span className="font-dm text-[10px] text-cream/25">{p.count}x</span>
                            </div>
                            <div className="ml-8 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${barWidth}%`,
                                  background: isMedal ? medals[i] : "rgba(253,251,247,0.15)",
                                  opacity: isMedal ? 0.6 : 0.3,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-cream/30 text-center py-4">Nenhum participante no período.</p>
                  )}
                </Card>
              </motion.div>

              {/* Activity distribution */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.4 }}
              >
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="h-4 w-4" style={{ color: "#2E9E8F" }} />
                    <h3 className="font-dm text-sm font-semibold text-cream/70">Distribuição por Atividade</h3>
                  </div>
                  {formacaoStats.activityDist.length > 0 ? (
                    <div className="space-y-2.5">
                      {formacaoStats.activityDist.map((act) => {
                        const totalAct = formacaoStats.activityDist.reduce((s, a) => s + a.count, 0);
                        const pct = totalAct > 0 ? (act.count / totalAct) * 100 : 0;
                        return (
                          <div key={act.name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-dm text-xs text-cream/60 truncate flex-1 mr-2">{act.name}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="font-dm text-xs font-bold text-cream/50 tabular-nums">{act.count}</span>
                                <span className="font-dm text-[10px] text-cream/25 tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: "rgba(46,158,143,0.5)" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-cream/30 text-center py-4">Nenhuma atividade no período.</p>
                  )}
                </Card>
              </motion.div>
            </div>
          </div>

          {/* ── A. Session Metrics Row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Sessões realizadas", value: String(formacaoStats.totalSessions), icon: Calendar, iconColor: "#C84B31", iconBg: "rgba(200,75,49,0.1)" },
              { label: "Média por sessão", value: formacaoStats.avgParticipantsPerSession.toFixed(1), icon: Users, iconColor: "#2E9E8F", iconBg: "rgba(46,158,143,0.1)" },
              { label: "Frequência média", value: formacaoStats.avgFrequencyPerStudent.toFixed(1) + "x", icon: TrendingUp, iconColor: "#D4854A", iconBg: "rgba(212,133,74,0.1)" },
              { label: "Participantes únicos", value: String(formacaoStats.uniqueParticipants), icon: GraduationCap, iconColor: "#C84B31", iconBg: "rgba(200,75,49,0.1)" },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.05 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{ background: card.iconBg }}
                    >
                      <card.icon className="h-5 w-5" style={{ color: card.iconColor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-fraunces font-bold text-xl text-cream tabular-nums">
                        <span style={{ color: card.iconColor }}>{card.value}</span>
                      </p>
                      <p className="text-[11px] font-dm text-cream/40">{card.label}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* ── B. Retention & Growth Row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Novos no período", value: String(formacaoStats.newStudentsThisPeriod), icon: Plus, iconColor: "#22C55E", iconBg: "rgba(34,197,94,0.1)" },
              { label: "Ativos (30d)", value: String(formacaoStats.activeStudents), icon: CheckCircle, iconColor: "#22C55E", iconBg: "rgba(34,197,94,0.1)" },
              { label: "Inativos", value: String(formacaoStats.inactiveStudents), icon: UserX, iconColor: "#EF4444", iconBg: "rgba(239,68,68,0.1)" },
              {
                label: "Taxa de retenção",
                value: formacaoStats.retentionRate.toFixed(0) + "%",
                icon: TrendingUp,
                iconColor: formacaoStats.retentionRate > 70 ? "#22C55E" : formacaoStats.retentionRate > 40 ? "#F59E0B" : "#EF4444",
                iconBg: formacaoStats.retentionRate > 70 ? "rgba(34,197,94,0.1)" : formacaoStats.retentionRate > 40 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
              },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{ background: card.iconBg }}
                    >
                      <card.icon className="h-5 w-5" style={{ color: card.iconColor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-fraunces font-bold text-xl text-cream tabular-nums">
                        <span style={{ color: card.iconColor }}>{card.value}</span>
                      </p>
                      <p className="text-[11px] font-dm text-cream/40">{card.label}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* ── C. Group Rankings (two-column) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.55, duration: 0.4 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4" style={{ color: "#C84B31" }} />
                  <h3 className="font-fraunces text-sm font-bold text-cream/70">Grupos mais bem avaliados</h3>
                </div>
                {formacaoStats.topGroups.length > 0 ? (
                  <div className="space-y-2">
                    {formacaoStats.topGroups.map((g, i) => (
                      <div key={g.name} className="flex items-center gap-3 py-1.5 px-2 rounded-[8px] hover:bg-white/[.02] transition-colors">
                        <span className="font-dm text-sm font-bold w-5 text-center" style={{ color: i < 3 ? "#C84B31" : "rgba(253,251,247,0.3)" }}>
                          {i + 1}
                        </span>
                        <span className="font-dm text-sm flex-1 text-cream/70 truncate">{g.name}</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3" fill="#C84B31" stroke="#C84B31" />
                          <span className="font-fraunces font-bold text-sm" style={{ color: "#C84B31" }}>
                            {g.avgNota.toFixed(1)}
                          </span>
                        </div>
                        <span className="font-dm text-xs text-cream/30">{g.count}x</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-cream/30 text-center py-4">Sem dados</p>
                )}
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.4 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4" style={{ color: "#2E9E8F" }} />
                  <h3 className="font-fraunces text-sm font-bold text-cream/70">Grupos com maior adesão</h3>
                </div>
                {formacaoStats.topGroupsByParticipation.length > 0 ? (
                  <div className="space-y-2.5">
                    {formacaoStats.topGroupsByParticipation.map((g) => {
                      const maxCount = formacaoStats.topGroupsByParticipation[0]?.count || 1;
                      const barWidth = (g.count / maxCount) * 100;
                      return (
                        <div key={g.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-dm text-xs text-cream/60 truncate flex-1 mr-2">{g.name}</span>
                            <span className="font-fraunces font-bold text-xs text-cream/50 tabular-nums">{g.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${barWidth}%`, background: "rgba(46,158,143,0.5)" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-cream/30 text-center py-4">Sem dados</p>
                )}
              </Card>
            </motion.div>
          </div>

          {/* ── D. Rating Distribution (two-column) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.65, duration: 0.4 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4" style={{ color: "#C84B31" }} />
                  <h3 className="font-fraunces text-sm font-bold text-cream/70">Distribuição Nota Grupo</h3>
                </div>
                {(() => {
                  const maxRatingCount = Math.max(...formacaoStats.ratingDistribution.map(r => r.count), 1);
                  return formacaoStats.ratingDistribution.some(r => r.count > 0) ? (
                    <div className="space-y-1.5">
                      {formacaoStats.ratingDistribution.map((r) => {
                        const barWidth = maxRatingCount > 0 ? (r.count / maxRatingCount) * 100 : 0;
                        // Color gradient: red(1) → amber(5) → green(10)
                        const hue = ((r.rating - 1) / 9) * 120; // 0=red, 120=green
                        const barColor = `hsl(${hue}, 70%, 50%)`;
                        return (
                          <div key={r.rating} className="flex items-center gap-2">
                            <span className="font-fraunces font-bold text-xs text-cream/50 w-5 text-right tabular-nums">{r.rating}</span>
                            <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <div
                                className="h-full rounded transition-all duration-500"
                                style={{ width: `${barWidth}%`, background: barColor, opacity: 0.7 }}
                              />
                            </div>
                            <span className="font-dm text-[10px] text-cream/30 w-6 text-right tabular-nums">{r.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-cream/30 text-center py-4">Sem dados</p>
                  );
                })()}
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7, duration: 0.4 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4" style={{ color: "#2E9E8F" }} />
                  <h3 className="font-fraunces text-sm font-bold text-cream/70">Distribuição Nota Condutores</h3>
                </div>
                {(() => {
                  const maxRatingCount = Math.max(...formacaoStats.conductorRatingDist.map(r => r.count), 1);
                  return formacaoStats.conductorRatingDist.some(r => r.count > 0) ? (
                    <div className="space-y-1.5">
                      {formacaoStats.conductorRatingDist.map((r) => {
                        const barWidth = maxRatingCount > 0 ? (r.count / maxRatingCount) * 100 : 0;
                        const hue = ((r.rating - 1) / 9) * 120;
                        const barColor = `hsl(${hue}, 70%, 50%)`;
                        return (
                          <div key={r.rating} className="flex items-center gap-2">
                            <span className="font-fraunces font-bold text-xs text-cream/50 w-5 text-right tabular-nums">{r.rating}</span>
                            <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <div
                                className="h-full rounded transition-all duration-500"
                                style={{ width: `${barWidth}%`, background: barColor, opacity: 0.7 }}
                              />
                            </div>
                            <span className="font-dm text-[10px] text-cream/30 w-6 text-right tabular-nums">{r.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-cream/30 text-center py-4">Sem dados</p>
                  );
                })()}
              </Card>
            </motion.div>
          </div>

          {/* ── E. Heatmap: Engagement by Day × Time ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.75, duration: 0.4 }}
            className="mb-6"
          >
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Flame className="h-4 w-4" style={{ color: "#C84B31" }} />
                <h3 className="font-fraunces text-sm font-bold text-cream/70">Mapa de engajamento por horário</h3>
              </div>
              {formacaoStats.heatmapData.length > 0 ? (() => {
                const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex"];
                const horas = Array.from(new Set(formacaoStats.heatmapData.map(h => h.hora))).sort();
                const maxHeat = Math.max(...formacaoStats.heatmapData.map(h => h.count), 1);

                const getCount = (dia: number, hora: string) => {
                  const found = formacaoStats.heatmapData.find(h => h.dia === dia && h.hora === hora);
                  return found ? found.count : 0;
                };

                return (
                  <div className="overflow-x-auto">
                    <div className="min-w-[400px]">
                      {/* Header row */}
                      <div className="flex items-center gap-1 mb-2">
                        <div className="w-14" />
                        {dayLabels.map((d) => (
                          <div key={d} className="flex-1 text-center font-dm text-[10px] text-cream/40 font-semibold">{d}</div>
                        ))}
                      </div>
                      {/* Data rows */}
                      {horas.map((hora) => (
                        <div key={hora} className="flex items-center gap-1 mb-1">
                          <div className="w-14 text-right pr-2 font-dm text-[10px] text-cream/40 flex-shrink-0">{hora}</div>
                          {[1, 2, 3, 4, 5].map((dia) => {
                            const count = getCount(dia, hora);
                            const intensity = maxHeat > 0 ? count / maxHeat : 0;
                            const bg = count === 0
                              ? "rgba(255,255,255,0.02)"
                              : intensity < 0.33
                                ? "rgba(200,75,49,0.1)"
                                : intensity < 0.66
                                  ? "rgba(200,75,49,0.3)"
                                  : "rgba(200,75,49,0.6)";
                            return (
                              <div
                                key={dia}
                                className="flex-1 h-8 rounded-[6px] flex items-center justify-center group relative transition-all duration-200"
                                style={{ background: bg }}
                              >
                                {count > 0 && (
                                  <span className="font-fraunces font-bold text-[10px] text-cream/60">{count}</span>
                                )}
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  <div
                                    className="px-2 py-0.5 rounded text-[9px] font-dm font-medium text-cream whitespace-nowrap"
                                    style={{ background: "rgba(30,30,30,0.95)", border: "1px solid rgba(200,75,49,0.2)" }}
                                  >
                                    {dayLabels[dia - 1]} {hora}: {count} feedback{count !== 1 ? "s" : ""}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })() : (
                <p className="text-xs text-cream/30 text-center py-6">Sem dados</p>
              )}
            </Card>
          </motion.div>

          {/* ── F. Retention Trend ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.4 }}
            className="mb-6"
          >
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4" style={{ color: "#2E9E8F" }} />
                <h3 className="font-fraunces text-sm font-bold text-cream/70">Retenção mensal</h3>
              </div>
              {formacaoStats.retentionByMonth.length > 0 && formacaoStats.retentionByMonth.some(m => m.active > 0 || m.churned > 0) ? (() => {
                const maxVal = Math.max(
                  ...formacaoStats.retentionByMonth.map(m => Math.max(m.active, m.churned)),
                  1
                );
                return (
                  <div className="space-y-3">
                    <div className="flex items-end gap-3 h-36">
                      {formacaoStats.retentionByMonth.map((m) => {
                        const activeH = maxVal > 0 ? (m.active / maxVal) * 100 : 0;
                        const churnedH = maxVal > 0 ? (m.churned / maxVal) * 100 : 0;
                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
                            <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: "100%" }}>
                              <div className="flex flex-col items-center justify-end flex-1" style={{ height: "100%" }}>
                                <div
                                  className="w-full rounded-t min-h-[2px] transition-all duration-500"
                                  style={{ height: `${Math.max(activeH, 2)}%`, background: "rgba(34,197,94,0.5)" }}
                                />
                              </div>
                              <div className="flex flex-col items-center justify-end flex-1" style={{ height: "100%" }}>
                                <div
                                  className="w-full rounded-t min-h-[2px] transition-all duration-500"
                                  style={{ height: `${Math.max(churnedH, 2)}%`, background: "rgba(239,68,68,0.4)" }}
                                />
                              </div>
                            </div>
                            <span className="text-[8px] text-cream/30 font-dm mt-1 whitespace-nowrap">{m.month}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-center gap-6">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(34,197,94,0.5)" }} />
                        <span className="font-dm text-[10px] text-cream/40">Ativos</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(239,68,68,0.4)" }} />
                        <span className="font-dm text-[10px] text-cream/40">Saíram</span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <p className="text-xs text-cream/30 text-center py-6">Sem dados</p>
              )}
            </Card>
          </motion.div>

          {/* Full-width trend charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Submissions trend */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95, duration: 0.4 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4" style={{ color: "#C84B31" }} />
                  <h3 className="font-dm text-sm font-semibold text-cream/70">Submissões no Período</h3>
                </div>
                {formacaoStats.submissionsTrend.length > 0 ? (
                  <div className="flex items-end gap-1 h-28">
                    {formacaoStats.submissionsTrend.map((item, idx) => {
                      const maxCount = Math.max(...formacaoStats.submissionsTrend.map((e) => e.count));
                      const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                      const dateLabel = item.date.split("-").slice(1).join("/");
                      return (
                        <div
                          key={item.date}
                          className="flex-1 flex flex-col items-center justify-end group relative"
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <div
                              className="px-2 py-0.5 rounded text-[9px] font-dm font-medium text-cream whitespace-nowrap"
                              style={{ background: "rgba(30,30,30,0.95)", border: "1px solid rgba(200,75,49,0.2)" }}
                            >
                              {item.count} · {dateLabel}
                            </div>
                          </div>
                          <div
                            className="w-full rounded-t min-h-[3px] transition-all duration-200 bg-[rgba(200,75,49,0.2)] hover:bg-[rgba(200,75,49,0.5)]"
                            style={{ height: `${Math.max(height, 5)}%` }}
                          />
                          {idx % Math.max(1, Math.floor(formacaoStats.submissionsTrend.length / 6)) === 0 && (
                            <span className="text-[8px] text-cream/20 mt-1 font-dm">{dateLabel}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-cream/30 text-center py-6">Nenhuma submissão no período.</p>
                )}
              </Card>
            </motion.div>

            {/* Enrollment growth */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.4 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4" style={{ color: "#2E9E8F" }} />
                  <h3 className="font-dm text-sm font-semibold text-cream/70">Matrículas no Período</h3>
                </div>
                {formacaoStats.enrollmentTrend.length > 0 ? (
                  <div className="flex items-end gap-1 h-28">
                    {formacaoStats.enrollmentTrend.map((item, idx) => {
                      const maxCount = Math.max(...formacaoStats.enrollmentTrend.map((e) => e.count));
                      const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                      const dateLabel = item.date.split("-").slice(1).join("/");
                      return (
                        <div
                          key={item.date}
                          className="flex-1 flex flex-col items-center justify-end group relative"
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <div
                              className="px-2 py-0.5 rounded text-[9px] font-dm font-medium text-cream whitespace-nowrap"
                              style={{ background: "rgba(30,30,30,0.95)", border: "1px solid rgba(46,158,143,0.2)" }}
                            >
                              {item.count} · {dateLabel}
                            </div>
                          </div>
                          <div
                            className="w-full rounded-t min-h-[3px] transition-all duration-200 bg-[rgba(46,158,143,0.2)] hover:bg-[rgba(46,158,143,0.5)]"
                            style={{ height: `${Math.max(height, 5)}%` }}
                          />
                          {idx % Math.max(1, Math.floor(formacaoStats.enrollmentTrend.length / 6)) === 0 && (
                            <span className="text-[8px] text-cream/20 mt-1 font-dm">{dateLabel}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-cream/30 text-center py-6">Nenhuma matrícula no período.</p>
                )}
              </Card>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Courses needing attention */}
      {attentionCourses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mb-8"
        >
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle
                className="h-5 w-5"
                style={{ color: "#F59E0B" }}
              />
              <h2 className="font-fraunces font-bold text-lg text-cream">
                Cursos que precisam de atenção
              </h2>
            </div>
            <div className="space-y-1">
              {attentionCourses.map((course) => (
                <div
                  key={`${course.id}-${course.reason}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-[10px] hover:bg-white/[.02] transition-colors duration-150"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background:
                          course.reason === "low_rating"
                            ? "#EF4444"
                            : course.reason === "empty_draft"
                              ? "#F59E0B"
                              : "#6B7280",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-dm text-cream/80 truncate">
                        {course.title}
                      </p>
                      <p className="text-[11px] text-cream/30">
                        {attentionReasonLabel[course.reason]}
                        {course.reason === "low_rating" && course.avgRating
                          ? ` (${course.avgRating.toFixed(1)}★)`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/formacao/admin/cursos/${course.slug}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-dm text-cream/50 hover:text-accent hover:bg-[rgba(200,75,49,0.08)] transition-all duration-200 flex-shrink-0"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
