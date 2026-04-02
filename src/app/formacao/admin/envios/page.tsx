"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Download,
  Upload,
  Trash2,
  Calendar,
  FileSpreadsheet,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronDown,
  MessageSquare,
  Users,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import type { CertificadoSubmission, CertificadoAtividade } from "@/types";

const CertificateGenerator = dynamic(
  () => import("@/components/certificado/CertificateGenerator"),
  { ssr: false }
);

function horasExtenso(h: number): string {
  const unidades = ["zero","uma","duas","três","quatro","cinco","seis","sete","oito","nove"];
  const especiais = ["dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const dezenas = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  if (h < 0) return "zero";
  if (h < 10) return unidades[h];
  if (h < 20) return especiais[h - 10];
  if (h < 100) { const d = Math.floor(h / 10); const u = h % 10; return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`; }
  if (h === 100) return "cem";
  if (h < 200) return `cento e ${horasExtenso(h - 100)}`;
  return String(h);
}

type TimeFilter = "month" | "quarter" | "semester" | "year" | "all";

function getFilterDate(filter: TimeFilter): Date | null {
  const now = new Date();
  switch (filter) {
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), q, 1);
    }
    case "semester":
      return new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
      return null;
  }
}

export default function AdminEnviosPage() {
  const { profile, isAdmin } = useAuth();
  const [submissions, setSubmissions] = useState<CertificadoSubmission[]>([]);
  const [atividades, setAtividades] = useState<CertificadoAtividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [atividadeFilter, setAtividadeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCertFor, setShowCertFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      if (!profile) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [subRes, atiRes] = await Promise.all([
        supabase
          .from("certificado_submissions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("certificado_atividades")
          .select("*")
          .order("nome"),
      ]);
      if (subRes.data) setSubmissions(subRes.data);
      if (atiRes.data) setAtividades(atiRes.data);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [profile]);

  const filtered = useMemo(() => {
    let result = submissions;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.nome_completo.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      );
    }

    if (atividadeFilter !== "all") {
      result = result.filter((s) => s.atividade_nome === atividadeFilter);
    }

    if (timeFilter !== "all") {
      const cutoff = getFilterDate(timeFilter);
      if (cutoff) {
        result = result.filter((s) => new Date(s.created_at) >= cutoff);
      }
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((s) => new Date(s.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59");
      result = result.filter((s) => new Date(s.created_at) <= to);
    }

    return result;
  }, [submissions, search, atividadeFilter, timeFilter, dateFrom, dateTo]);

  const allSelected =
    filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("certificado_submissions")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir envio");
    } else {
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Envio excluido");
    }
    setDeleteId(null);
    setDeleting(false);
  }

  async function handleBulkDelete() {
    setDeleting(true);
    const ids = Array.from(selected);
    const supabase = createClient();
    const { error } = await supabase
      .from("certificado_submissions")
      .delete()
      .in("id", ids);
    if (error) {
      toast.error("Erro ao excluir envios");
    } else {
      setSubmissions((prev) => prev.filter((s) => !selected.has(s.id)));
      setSelected(new Set());
      toast.success(`${ids.length} envio(s) excluido(s)`);
    }
    setBulkDeleteOpen(false);
    setDeleting(false);
  }

  function exportCSV() {
    const headers = [
      "Nome",
      "Email",
      "Atividade",
      "Nota Grupo",
      "Condutores",
      "Nota Condutor",
      "Relato",
      "Data",
    ];
    const rows = filtered.map((s) => [
      s.nome_completo,
      s.email,
      s.atividade_nome,
      String(s.nota_grupo),
      s.condutores.join("; "),
      String(s.nota_condutor),
      (s.relato || "").replace(/"/g, '""'),
      new Date(s.created_at).toLocaleDateString("pt-BR"),
    ]);
    const csv =
      [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join(
        "\n"
      );
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `envios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  async function importCSV(file: File) {
    setImporting(true);
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      toast.error("CSV vazio ou invalido");
      setImporting(false);
      return;
    }

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(",").map((h) => h.trim().replace(/"/g, ""));

    const colMap = {
      nome: headers.findIndex((h) => h.includes("nome") || h.includes("name")),
      email: headers.findIndex((h) => h.includes("email")),
      atividade: headers.findIndex(
        (h) => h.includes("atividade") || h.includes("activity")
      ),
      nota_grupo: headers.findIndex(
        (h) => h.includes("nota grupo") || h.includes("group rating") || h.includes("nota_grupo")
      ),
      condutores: headers.findIndex(
        (h) => h.includes("condutor") || h.includes("condutores")
      ),
      nota_condutor: headers.findIndex(
        (h) => h.includes("nota condutor") || h.includes("nota_condutor")
      ),
      relato: headers.findIndex(
        (h) => h.includes("relato") || h.includes("feedback")
      ),
    };

    const supabase = createClient();
    let success = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const row = {
        nome_completo: colMap.nome >= 0 ? cols[colMap.nome] : "",
        email: colMap.email >= 0 ? cols[colMap.email] : "",
        atividade_nome: colMap.atividade >= 0 ? cols[colMap.atividade] : "",
        nota_grupo: colMap.nota_grupo >= 0 ? parseInt(cols[colMap.nota_grupo]) || 0 : 0,
        condutores:
          colMap.condutores >= 0
            ? cols[colMap.condutores].split(";").map((c) => c.trim()).filter(Boolean)
            : [],
        nota_condutor:
          colMap.nota_condutor >= 0 ? parseInt(cols[colMap.nota_condutor]) || 0 : 0,
        relato: colMap.relato >= 0 ? cols[colMap.relato] : null,
      };

      if (!row.nome_completo || !row.email) {
        errors++;
        continue;
      }

      const { error } = await supabase
        .from("certificado_submissions")
        .insert(row);
      if (error) errors++;
      else success++;
    }

    toast.success(`Importado: ${success} sucesso, ${errors} erro(s)`);

    // Refresh data
    const { data } = await supabase
      .from("certificado_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSubmissions(data);
    setImporting(false);
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-dm text-[#FDFBF7]/50">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const timeButtons: { label: string; value: TimeFilter }[] = [
    { label: "Este Mes", value: "month" },
    { label: "Trimestre", value: "quarter" },
    { label: "Semestre", value: "semester" },
    { label: "Ano", value: "year" },
    { label: "Todos", value: "all" },
  ];

  const inputStyle =
    "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#FDFBF7] font-dm placeholder:text-[#FDFBF7]/30 focus:outline-none focus:border-[#C84B31]/50 transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-fraunces font-semibold text-[#FDFBF7]">
          Envios de Feedback
        </h1>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importCSV(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload size={16} className="mr-1.5" />
            {importing ? "Importando..." : "Importar CSV"}
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCSV}>
            <Download size={16} className="mr-1.5" />
            Exportar CSV
          </Button>
          {selected.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 size={16} className="mr-1.5" />
              Excluir ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
        <FileSpreadsheet size={18} className="text-[#C84B31]" />
        <span className="font-dm text-sm text-[#FDFBF7]/70">
          Exibindo{" "}
          <span className="text-[#FDFBF7] font-medium">{filtered.length}</span> de{" "}
          <span className="text-[#FDFBF7] font-medium">{submissions.length}</span>{" "}
          envios
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FDFBF7]/30"
            />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputStyle} w-full pl-9`}
            />
          </div>

          <select
            value={atividadeFilter}
            onChange={(e) => setAtividadeFilter(e.target.value)}
            className={`${inputStyle} min-w-[180px]`}
          >
            <option value="all">Todas as atividades</option>
            {atividades.map((a) => (
              <option key={a.id} value={a.nome}>
                {a.nome}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[#FDFBF7]/30" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setTimeFilter("all");
              }}
              className={`${inputStyle} w-[140px]`}
            />
            <span className="text-[#FDFBF7]/30 text-xs">ate</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setTimeFilter("all");
              }}
              className={`${inputStyle} w-[140px]`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {timeButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => {
                setTimeFilter(btn.value);
                setDateFrom("");
                setDateTo("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-dm transition-colors ${
                timeFilter === btn.value
                  ? "bg-[#C84B31] text-white"
                  : "bg-[rgba(255,255,255,0.03)] text-[#FDFBF7]/50 hover:text-[#FDFBF7]/70 border border-[rgba(255,255,255,0.06)]"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#FDFBF7]/40 font-dm">
          <FileSpreadsheet size={40} className="mb-3 opacity-30" />
          <p>Nenhum envio encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.06)]">
          <table className="w-full text-sm font-dm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
                <th className="px-3 py-3 text-left">
                  <button onClick={toggleSelectAll} className="text-[#FDFBF7]/50 hover:text-[#FDFBF7]">
                    {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-[#FDFBF7]/50 font-medium">Nome</th>
                <th className="px-3 py-3 text-left text-[#FDFBF7]/50 font-medium">Email</th>
                <th className="px-3 py-3 text-left text-[#FDFBF7]/50 font-medium">Atividade</th>
                <th className="px-3 py-3 text-center text-[#FDFBF7]/50 font-medium">Nota Grupo</th>
                <th className="px-3 py-3 text-center text-[#FDFBF7]/50 font-medium">Nota Condutor</th>
                <th className="px-3 py-3 text-left text-[#FDFBF7]/50 font-medium">Data</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.map((s) => {
                  const isExpanded = expandedId === s.id;
                  const atv = atividades.find(a => a.nome === s.atividade_nome);
                  const ch = atv?.carga_horaria || 2;
                  return (
                    <motion.tr
                      key={s.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors align-top"
                    >
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => toggleSelect(s.id)}
                          className="text-[#FDFBF7]/50 hover:text-[#FDFBF7]"
                        >
                          {selected.has(s.id) ? (
                            <CheckSquare size={16} className="text-[#C84B31]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-[#FDFBF7]">{s.nome_completo}</td>
                      <td className="px-3 py-2.5 text-[#FDFBF7]/60">{s.email}</td>
                      <td className="px-3 py-2.5 text-[#FDFBF7]/70">{s.atividade_nome}</td>
                      <td className="px-3 py-2.5 text-center text-[#FDFBF7]/70">{s.nota_grupo}</td>
                      <td className="px-3 py-2.5 text-center text-[#FDFBF7]/70">{s.nota_condutor}</td>
                      <td className="px-3 py-2.5 text-[#FDFBF7]/50">
                        {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : s.id)}
                            className="text-[#FDFBF7]/30 hover:text-[#FDFBF7]/70 transition-colors"
                            title="Ver detalhes"
                          >
                            <ChevronDown size={15} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                          <button
                            onClick={() => setDeleteId(s.id)}
                            className="text-[#FDFBF7]/30 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {/* Expanded detail panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="col-span-8 mt-3 -mx-3"
                              style={{ width: "calc(100% + 1.5rem)" }}
                            >
                              <div className="p-4 rounded-xl space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                {/* Condutores */}
                                {s.condutores && s.condutores.length > 0 && (
                                  <div className="flex items-start gap-2">
                                    <Users size={14} className="text-[#C84B31] mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs text-[#FDFBF7]/40 mb-1">Condutores</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {s.condutores.map((c) => (
                                          <span key={c} className="text-xs px-2 py-0.5 rounded-full text-[#FDFBF7]/70" style={{ background: "rgba(200,75,49,0.1)", border: "1px solid rgba(200,75,49,0.15)" }}>
                                            {c}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Notas */}
                                <div className="flex items-start gap-2">
                                  <Star size={14} className="text-[#C84B31] mt-0.5 flex-shrink-0" />
                                  <div className="flex gap-4">
                                    <div>
                                      <p className="text-xs text-[#FDFBF7]/40">Nota Grupo</p>
                                      <p className="text-sm text-[#FDFBF7] font-medium">{s.nota_grupo}/10</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-[#FDFBF7]/40">Nota Condutor</p>
                                      <p className="text-sm text-[#FDFBF7] font-medium">{s.nota_condutor}/10</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Relato */}
                                {s.relato && (
                                  <div className="flex items-start gap-2">
                                    <MessageSquare size={14} className="text-[#C84B31] mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs text-[#FDFBF7]/40 mb-1">Relato</p>
                                      <p className="text-sm text-[#FDFBF7]/70 leading-relaxed">{s.relato}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Certificado */}
                                <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
                                  {showCertFor === s.id ? (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs text-[#FDFBF7]/40">Certificado de Participação</p>
                                        <button
                                          onClick={() => setShowCertFor(null)}
                                          className="text-xs text-[#FDFBF7]/30 hover:text-[#FDFBF7]/60"
                                        >
                                          Fechar preview
                                        </button>
                                      </div>
                                      <CertificateGenerator
                                        data={{
                                          nomeParticipante: s.nome_social || s.nome_completo,
                                          atividade: s.atividade_nome,
                                          data: s.created_at.split("T")[0],
                                          cargaHoraria: ch,
                                          cargaHorariaExtenso: horasExtenso(ch),
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setShowCertFor(s.id)}
                                      className="flex items-center gap-2 text-xs text-[#C84B31] hover:text-[#C84B31]/80 transition-colors font-dm font-medium"
                                    >
                                      <Download size={14} />
                                      Gerar e baixar certificado
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Individual delete modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-400" />
            <h2 className="font-fraunces text-lg text-[#FDFBF7]">Excluir envio</h2>
          </div>
          <p className="font-dm text-sm text-[#FDFBF7]/60">
            Tem certeza que deseja excluir este envio? Esta acao nao pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk delete modal */}
      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-400" />
            <h2 className="font-fraunces text-lg text-[#FDFBF7]">
              Excluir {selected.size} envio(s)
            </h2>
          </div>
          <p className="font-dm text-sm text-[#FDFBF7]/60">
            Tem certeza que deseja excluir {selected.size} envio(s) selecionado(s)? Esta
            acao nao pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setBulkDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? "Excluindo..." : `Excluir ${selected.size}`}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
