"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Star,
  Users,
  MessageSquare,
  TrendingUp,
  Calendar,
  ChevronDown,
  Activity,
} from "lucide-react";
import type { CertificadoSubmission, CertificadoAtividade } from "@/types";

interface CondutorStats {
  nome: string;
  notaMedia: number;
  totalAvaliacoes: number;
  feedbacks: {
    nome_completo: string;
    nota_condutor: number;
    relato: string | null;
    created_at: string;
  }[];
}

export default function AtividadeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [atividade, setAtividade] = useState<CertificadoAtividade | null>(null);
  const [submissions, setSubmissions] = useState<CertificadoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCondutor, setExpandedCondutor] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [atvRes, subRes] = await Promise.all([
        supabase
          .from("certificado_atividades")
          .select("*")
          .eq("id", id)
          .single(),
        supabase
          .from("certificado_submissions")
          .select("*")
          .eq("atividade_nome", "") // placeholder, will filter after getting name
          .order("created_at", { ascending: false }),
      ]);

      if (atvRes.data) {
        setAtividade(atvRes.data);
        // Now fetch submissions with the correct activity name
        const { data: subs } = await supabase
          .from("certificado_submissions")
          .select("*")
          .eq("atividade_nome", atvRes.data.nome)
          .order("created_at", { ascending: false });
        if (subs) setSubmissions(subs);
      }
      setLoading(false);
    }
    if (id) load().catch(() => setLoading(false));
  }, [id]);

  const stats = useMemo(() => {
    if (submissions.length === 0)
      return { notaGrupoMedia: 0, notaCondutorMedia: 0, totalFeedbacks: 0, condutores: [] as CondutorStats[] };

    const totalFeedbacks = submissions.length;
    const notaGrupoMedia =
      submissions.reduce((sum, s) => sum + s.nota_grupo, 0) / totalFeedbacks;
    const notaCondutorMedia =
      submissions.reduce((sum, s) => sum + s.nota_condutor, 0) / totalFeedbacks;

    // Aggregate by conductor
    const condMap = new Map<string, CondutorStats>();
    submissions.forEach((s) => {
      (s.condutores || []).forEach((nome) => {
        if (!condMap.has(nome)) {
          condMap.set(nome, { nome, notaMedia: 0, totalAvaliacoes: 0, feedbacks: [] });
        }
        const c = condMap.get(nome)!;
        c.totalAvaliacoes++;
        c.feedbacks.push({
          nome_completo: s.nome_completo,
          nota_condutor: s.nota_condutor,
          relato: s.relato,
          created_at: s.created_at,
        });
      });
    });

    const condutores = Array.from(condMap.values())
      .map((c) => ({
        ...c,
        notaMedia:
          c.feedbacks.reduce((sum, f) => sum + f.nota_condutor, 0) /
          c.totalAvaliacoes,
      }))
      .sort((a, b) => b.notaMedia - a.notaMedia);

    return { notaGrupoMedia, notaCondutorMedia, totalFeedbacks, condutores };
  }, [submissions]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-dm text-[#FDFBF7]/50">Acesso restrito.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!atividade) {
    return (
      <div className="text-center py-20">
        <Activity className="h-10 w-10 text-[#FDFBF7]/15 mx-auto mb-3" />
        <p className="text-[#FDFBF7]/40 font-dm">Atividade não encontrada.</p>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mt-4">
          <ArrowLeft size={16} className="mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/formacao/admin/atividades")}
          className="p-2 rounded-lg text-[#FDFBF7]/40 hover:text-[#FDFBF7] hover:bg-[rgba(255,255,255,0.04)] transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-fraunces font-semibold text-[#FDFBF7]">
            {atividade.nome}
          </h1>
          <p className="text-sm text-[#FDFBF7]/40 font-dm">
            {atividade.carga_horaria}h por sessão
            {atividade.descricao && ` · ${atividade.descricao}`}
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="p-5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-[#C84B31]" />
            <span className="text-xs text-[#FDFBF7]/40 font-dm">Total de Feedbacks</span>
          </div>
          <p className="text-3xl font-fraunces font-bold text-[#FDFBF7]">
            {stats.totalFeedbacks}
          </p>
        </div>

        <div
          className="p-5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Star size={16} className="text-[#C84B31]" />
            <span className="text-xs text-[#FDFBF7]/40 font-dm">Nota Média (Grupo)</span>
          </div>
          <p className="text-3xl font-fraunces font-bold text-[#FDFBF7]">
            {stats.notaGrupoMedia > 0 ? stats.notaGrupoMedia.toFixed(1) : "—"}
          </p>
        </div>

        <div
          className="p-5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Star size={16} className="text-[#C84B31]" />
            <span className="text-xs text-[#FDFBF7]/40 font-dm">
              Nota Média (Condutor)
            </span>
          </div>
          <p className="text-3xl font-fraunces font-bold text-[#FDFBF7]">
            {stats.notaCondutorMedia > 0 ? stats.notaCondutorMedia.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      {/* Conductors section */}
      <div>
        <h2 className="text-lg font-fraunces font-semibold text-[#FDFBF7] mb-4 flex items-center gap-2">
          <Users size={18} className="text-[#C84B31]" />
          Condutores
        </h2>

        {stats.condutores.length === 0 ? (
          <p className="text-sm text-[#FDFBF7]/30 font-dm">Nenhuma avaliação de condutor ainda.</p>
        ) : (
          <div className="space-y-3">
            {stats.condutores.map((c) => {
              const isExp = expandedCondutor === c.nome;
              return (
                <div
                  key={c.nome}
                  className="rounded-xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {/* Conductor summary */}
                  <button
                    onClick={() => setExpandedCondutor(isExp ? null : c.nome)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-dm"
                        style={{ background: "rgba(200,75,49,0.1)", color: "#C84B31" }}
                      >
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#FDFBF7] font-dm">{c.nome}</p>
                        <p className="text-xs text-[#FDFBF7]/40 font-dm">
                          {c.totalAvaliacoes} avaliação{c.totalAvaliacoes !== 1 ? "ões" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#FDFBF7] font-dm">
                          {c.notaMedia.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-[#FDFBF7]/30 font-dm">média</p>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-[#FDFBF7]/30 transition-transform ${isExp ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  {/* Expanded feedbacks */}
                  <AnimatePresence>
                    {isExp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2 border-t border-[rgba(255,255,255,0.06)]">
                          <div className="pt-3" />
                          {c.feedbacks.map((f, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-lg"
                              style={{ background: "rgba(255,255,255,0.02)" }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-[#FDFBF7]/70 font-dm">
                                  {f.nome_completo}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[#C84B31] font-dm font-bold">
                                    {f.nota_condutor}/10
                                  </span>
                                  <span className="text-[10px] text-[#FDFBF7]/30 font-dm">
                                    {new Date(f.created_at).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                              </div>
                              {f.relato && (
                                <p className="text-xs text-[#FDFBF7]/50 font-dm leading-relaxed mt-1">
                                  {f.relato}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All feedbacks */}
      <div>
        <h2 className="text-lg font-fraunces font-semibold text-[#FDFBF7] mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-[#C84B31]" />
          Todos os Feedbacks
        </h2>

        {submissions.length === 0 ? (
          <p className="text-sm text-[#FDFBF7]/30 font-dm">Nenhum feedback enviado ainda.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-[#FDFBF7] font-dm">
                      {s.nome_completo}
                    </p>
                    <p className="text-xs text-[#FDFBF7]/40 font-dm">{s.email}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-xs text-[#FDFBF7]/30 font-dm">Grupo</p>
                      <p className="text-sm font-bold text-[#FDFBF7] font-dm">{s.nota_grupo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#FDFBF7]/30 font-dm">Condutor</p>
                      <p className="text-sm font-bold text-[#FDFBF7] font-dm">{s.nota_condutor}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={12} className="text-[#FDFBF7]/30" />
                      <span className="text-xs text-[#FDFBF7]/40 font-dm">
                        {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </div>

                {s.condutores && s.condutores.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {s.condutores.map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-2 py-0.5 rounded-full text-[#FDFBF7]/60 font-dm"
                        style={{ background: "rgba(200,75,49,0.08)", border: "1px solid rgba(200,75,49,0.12)" }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {s.relato && (
                  <p className="text-sm text-[#FDFBF7]/50 font-dm leading-relaxed">
                    &ldquo;{s.relato}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
