"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, Award, FileCheck, RotateCcw, User, Clock } from "lucide-react";
import type { CertificadoSubmission, CertificadoAtividade } from "@/types";

const CertificateGenerator = dynamic(
  () => import("@/components/certificado/CertificateGenerator"),
  { ssr: false }
);

const HORAS_MINIMO = 20;

interface ActivityBreakdown {
  count: number;
  horas: number;
  dataInicio: string;
  dataFim: string;
}

function horasExtenso(h: number): string {
  const unidades = [
    "zero", "uma", "duas", "três", "quatro",
    "cinco", "seis", "sete", "oito", "nove",
  ];
  const especiais = [
    "dez", "onze", "doze", "treze", "quatorze",
    "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
  ];
  const dezenas = [
    "", "", "vinte", "trinta", "quarenta",
    "cinquenta", "sessenta", "setenta", "oitenta", "noventa",
  ];

  if (h < 0) return "zero";
  if (h < 10) return unidades[h];
  if (h < 20) return especiais[h - 10];
  if (h < 100) {
    const d = Math.floor(h / 10);
    const u = h % 10;
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
  }
  if (h === 100) return "cem";
  if (h < 200) {
    const resto = h - 100;
    return `cento e ${horasExtenso(resto)}`;
  }
  return String(h);
}

export default function AdminCertificadosFormacaoPage() {
  const { isAdmin, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [submissions, setSubmissions] = useState<CertificadoSubmission[]>([]);
  const [atividades, setAtividades] = useState<CertificadoAtividade[]>([]);
  const [personName, setPersonName] = useState("");
  const [breakdown, setBreakdown] = useState<Record<string, ActivityBreakdown>>({});
  const [totalHoras, setTotalHoras] = useState(0);
  const [searched, setSearched] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchAtividades = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("certificado_atividades")
      .select("*")
      .eq("ativo", true);
    if (data) setAtividades(data);
  }, []);

  useEffect(() => {
    fetchAtividades();
  }, [fetchAtividades]);

  const handleSearch = useCallback(async () => {
    const term = search.trim();
    if (!term) {
      toast.error("Digite um nome para pesquisar.");
      return;
    }

    setLoading(true);
    setSearched(true);
    setShowPreview(false);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("certificado_submissions")
      .select("*")
      .ilike("nome_completo", `%${term}%`)
      .or("certificado_resgatado.is.null,certificado_resgatado.eq.false")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao buscar submissões.");
      setLoading(false);
      return;
    }

    setSubmissions(data ?? []);

    if (!data || data.length === 0) {
      setPersonName("");
      setBreakdown({});
      setTotalHoras(0);
      setLoading(false);
      return;
    }

    setPersonName(data[0].nome_completo);

    const map: Record<string, ActivityBreakdown> = {};
    let total = 0;

    for (const sub of data) {
      const atv = atividades.find((a) => a.nome === sub.atividade_nome);
      const horas = atv?.carga_horaria ?? 0;
      const dateStr = sub.created_at.split("T")[0];

      if (!map[sub.atividade_nome]) {
        map[sub.atividade_nome] = {
          count: 0,
          horas: 0,
          dataInicio: dateStr,
          dataFim: dateStr,
        };
      }

      map[sub.atividade_nome].count += 1;
      map[sub.atividade_nome].horas += horas;
      if (dateStr < map[sub.atividade_nome].dataInicio) {
        map[sub.atividade_nome].dataInicio = dateStr;
      }
      if (dateStr > map[sub.atividade_nome].dataFim) {
        map[sub.atividade_nome].dataFim = dateStr;
      }
      total += horas;
    }

    setBreakdown(map);
    setTotalHoras(total);
    setLoading(false);
  }, [search, atividades]);

  const handleClaim = useCallback(async () => {
    if (!personName) return;
    setClaiming(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("certificado_submissions")
      .update({ certificado_resgatado: true })
      .ilike("nome_completo", `%${personName}%`)
      .or("certificado_resgatado.is.null,certificado_resgatado.eq.false");

    if (error) {
      toast.error("Erro ao resgatar certificados.");
      setClaiming(false);
      return;
    }

    toast.success("Certificados resgatados com sucesso!");
    setClaiming(false);
    setSubmissions([]);
    setBreakdown({});
    setTotalHoras(0);
    setPersonName("");
    setSearch("");
    setSearched(false);
    setShowPreview(false);
  }, [personName]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-dm text-zinc-400">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const liberado = totalHoras >= HORAS_MINIMO;
  const progressPercent = Math.min((totalHoras / HORAS_MINIMO) * 100, 100);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="font-fraunces text-2xl font-bold text-zinc-100">
          Certificados de Formação
        </h1>
        <p className="font-dm text-sm text-zinc-400">
          Pesquise um participante para verificar horas e gerar certificados.
        </p>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Nome do participante..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 py-2.5 pl-10 pr-4 font-dm text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-[#C84B31]/40 transition focus:border-[#C84B31] focus:ring-2"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Pesquisar"}
        </Button>
      </motion.div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {/* No results */}
      {searched && !loading && submissions.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-8 text-center"
        >
          <User className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
          <p className="font-dm text-sm text-zinc-400">
            Nenhuma submissão encontrada para esta pesquisa.
          </p>
        </motion.div>
      )}

      {/* Results */}
      {!loading && submissions.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={personName}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Person header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C84B31]/20">
                <User className="h-5 w-5 text-[#C84B31]" />
              </div>
              <div>
                <h2 className="font-fraunces text-lg font-semibold text-zinc-100">
                  {personName}
                </h2>
                <p className="font-dm text-xs text-zinc-400">
                  {submissions.length} submissão(ões) encontrada(s)
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 font-dm text-sm text-zinc-300">
                  <Clock className="h-4 w-4" />
                  Horas acumuladas
                </span>
                <span className="font-dm text-sm font-semibold text-zinc-100">
                  {totalHoras}h / {HORAS_MINIMO}h
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-zinc-700">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    liberado ? "bg-emerald-500" : "bg-[#C84B31]"
                  }`}
                />
              </div>
              <p className="mt-2 font-dm text-xs text-zinc-500">
                {liberado
                  ? "Carga horária mínima atingida. Certificados liberados!"
                  : `Faltam ${HORAS_MINIMO - totalHoras}h para liberar os certificados.`}
              </p>
            </div>

            {/* Breakdown table */}
            <div className="overflow-hidden rounded-lg border border-zinc-700/50">
              <table className="w-full text-left font-dm text-sm">
                <thead className="border-b border-zinc-700/50 bg-zinc-800/60">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-400">Atividade</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Presenças</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Horas</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Período</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700/30">
                  {Object.entries(breakdown).map(([activityName, info]) => (
                    <tr key={activityName} className="bg-zinc-800/20">
                      <td className="px-4 py-3 text-zinc-200">{activityName}</td>
                      <td className="px-4 py-3 text-zinc-300">{info.count}</td>
                      <td className="px-4 py-3 text-zinc-300">{info.horas}h</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {info.dataInicio === info.dataFim
                          ? info.dataInicio
                          : `${info.dataInicio} a ${info.dataFim}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            {liberado && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => setShowPreview((p) => !p)}
                    variant="secondary"
                  >
                    <Award className="mr-2 h-4 w-4" />
                    {showPreview ? "Ocultar pré-visualização" : "Pré-visualizar certificados"}
                  </Button>

                  <Button onClick={handleClaim} disabled={claiming}>
                    <FileCheck className="mr-2 h-4 w-4" />
                    {claiming ? "Resgatando..." : "Resgatar certificados"}
                  </Button>
                </div>

                {/* Certificate previews */}
                <AnimatePresence>
                  {showPreview && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-6 overflow-hidden"
                    >
                      {Object.entries(breakdown).map(([activityName, info]) => (
                        <div
                          key={activityName}
                          className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-4"
                        >
                          <h3 className="mb-3 font-fraunces text-sm font-semibold text-zinc-200">
                            {activityName}
                          </h3>
                          <CertificateGenerator
                            data={{
                              nomeParticipante: personName,
                              atividade: activityName,
                              data: info.dataInicio,
                              dataFim: info.dataFim,
                              cargaHoraria: info.horas,
                              cargaHorariaExtenso: horasExtenso(info.horas),
                            }}
                          />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
