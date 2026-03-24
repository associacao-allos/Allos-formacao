"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import { Search, ChevronDown, Award } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import type { Certificate } from "@/types";

const CertFormacaoPage = dynamic(() => import("@/app/formacao/admin/certificados-formacao/page"), { ssr: false });
const EnviosPage = dynamic(() => import("@/app/formacao/admin/envios/page"), { ssr: false });

interface CourseOption {
  id: string;
  title: string;
}

export default function AdminCertificadosPage() {
  const { profile, isAdmin } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cursos" | "formacao" | "envios">("cursos");

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function load() {
      if (!profile) {
        setLoading(false);
        return;
      }
      const supabase = createClient();

      const [certRes, coursesRes] = await Promise.all([
        supabase
          .from("certificates")
          .select(`
            *,
            user:profiles!certificates_user_id_fkey(full_name, email),
            course:courses!certificates_course_id_fkey(id, title, instructor_id)
          `)
          .order("issued_at", { ascending: false }),
        supabase
          .from("courses")
          .select("id, title")
          .order("title"),
      ]);

      if (certRes.data) {
        const filtered = isAdmin
          ? certRes.data
          : certRes.data.filter((c) => c.course?.instructor_id === profile.id);
        setCertificates(filtered);
      }
      if (coursesRes.data) setCourses(coursesRes.data as CourseOption[]);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [profile, isAdmin]);

  const filtered = useMemo(() => {
    let result = certificates;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.user?.full_name?.toLowerCase().includes(s) ||
          c.user?.email?.toLowerCase().includes(s) ||
          c.course?.title?.toLowerCase().includes(s)
      );
    }

    if (selectedCourseId !== "all") {
      result = result.filter((c) => c.course_id === selectedCourseId);
    }

    if (dateFrom) {
      result = result.filter((c) => c.issued_at >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((c) => c.issued_at <= dateTo + "T23:59:59.999Z");
    }

    return result;
  }, [certificates, search, selectedCourseId, dateFrom, dateTo]);

  const uniqueCourses = useMemo(() => {
    const ids = new Set(certificates.map((c) => c.course_id));
    return ids.size;
  }, [certificates]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-40 mb-8" />
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
        className="mb-8"
      >
        <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
          Certificados
        </h1>
        <p className="text-sm text-cream/35 mt-1">
          Certificados emitidos na plataforma.
        </p>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setView("cursos")}
            className="font-dm text-xs px-4 py-2 rounded-full transition-all"
            style={{
              backgroundColor: view === "cursos" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: view === "cursos" ? "#C84B31" : "rgba(253,251,247,0.4)",
              border: `1px solid ${view === "cursos" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            Cursos
          </button>
          <button
            onClick={() => setView("formacao")}
            className="font-dm text-xs px-4 py-2 rounded-full transition-all"
            style={{
              backgroundColor: view === "formacao" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: view === "formacao" ? "#C84B31" : "rgba(253,251,247,0.4)",
              border: `1px solid ${view === "formacao" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            Formação
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
      </motion.div>

      {view === "formacao" && <CertFormacaoPage />}
      {view === "envios" && <EnviosPage />}

      {view === "cursos" && (<>
      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap items-center gap-3 mb-6 px-4 py-3 rounded-[12px]"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-accent" />
          <span className="text-sm text-cream/60">
            <span className="text-cream font-semibold">{certificates.length}</span> certificado{certificates.length !== 1 ? "s" : ""} emitido{certificates.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="text-cream/15">·</span>
        <span className="text-sm text-cream/60">
          <span className="text-cream font-semibold">{uniqueCourses}</span> curso{uniqueCourses !== 1 ? "s" : ""}
        </span>
      </motion.div>

      {/* Filters row */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-end gap-3 mb-6"
      >
        <div className="relative flex-1 min-w-[200px] max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Buscar por aluno, email ou curso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm"
            aria-label="Buscar certificados"
          />
        </div>

        <div className="relative">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="appearance-none pl-4 pr-9 py-2.5 rounded-[10px] text-sm text-cream bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <option value="all" className="bg-[#1a1a1a] text-cream">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#1a1a1a] text-cream">
                {c.title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/30 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <label className="text-[10px] text-cream/30 mb-1 uppercase tracking-wider">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-[10px] text-sm text-cream bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/40"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-cream/30 mb-1 uppercase tracking-wider">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-[10px] text-sm text-cream bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/40"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
            />
          </div>
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
                <th className="text-left px-4 py-3 font-semibold text-cream/50 hidden md:table-cell">Curso</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Emissão</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cert) => (
                <tr
                  key={cert.id}
                  className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <td className="px-4 py-3 text-cream">{cert.user?.full_name}</td>
                  <td className="px-4 py-3 text-cream/40 hidden md:table-cell">{cert.user?.email}</td>
                  <td className="px-4 py-3 text-cream/40 hidden md:table-cell">{cert.course?.title}</td>
                  <td className="px-4 py-3 text-cream/30 text-xs">{formatDate(cert.issued_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-cream/35">
                    Nenhum certificado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>)}
    </div>
  );
}
