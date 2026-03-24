"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  CalendarDays,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Link as LinkIcon,
  X,
  UserPlus,
  ChevronDown,
  Check,
  Image as ImageIcon,
  Download,
  Send,
  MessageCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FormacaoHorario,
  FormacaoSlot,
  FormacaoAlocacao,
  CertificadoCondutor,
  CertificadoAtividade,
  CertificadoEvento,
  FormacaoCronograma,
} from "@/types";

// ─── Constants ──────────────────────────────────────────────────────────────
type SubTab = "calendario" | "horarios" | "cronograma" | "whatsapp" | "eventos";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;
const DIAS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendente:       { label: "Pendente",       color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  conduzido:      { label: "Conduzido",      color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  nao_conduzido:  { label: "Não conduzido",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  cancelado:      { label: "Cancelado",      color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  desmarcado:     { label: "Desmarcado",     color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
};

const SUB_TABS: { key: SubTab; label: string; icon: typeof Calendar }[] = [
  { key: "calendario", label: "Calendário", icon: Calendar },
  { key: "horarios",   label: "Horários",   icon: Clock },
  { key: "cronograma", label: "Cronograma", icon: ImageIcon },
  { key: "whatsapp",   label: "WhatsApp",   icon: Send },
  { key: "eventos",    label: "Eventos",     icon: CalendarDays },
];

// ─── StatusDropdown ─────────────────────────────────────────────────────────
function StatusDropdown({
  current,
  onChange,
}: {
  current: string;
  onChange: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = STATUS_CONFIG[current] || STATUS_CONFIG.pendente;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-dm transition-colors"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
        {cfg.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-30 rounded-lg py-1 min-w-[150px]"
          style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
        >
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-dm hover:bg-white/5 transition-colors"
              style={{ color: val.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: val.color }} />
              {val.label}
              {key === current && <Check className="h-3 w-3 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AtividadeDropdown ──────────────────────────────────────────────────────
function AtividadeDropdown({
  current,
  atividades,
  onChange,
}: {
  current: string | null;
  atividades: CertificadoAtividade[];
  onChange: (nome: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-dm transition-colors truncate max-w-[140px]"
        style={{ background: "rgba(255,255,255,0.05)", color: current ? "#FDFBF7" : "rgba(253,251,247,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {current || "Atividade"}
        <ChevronDown className="h-3 w-3 flex-shrink-0" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-30 rounded-lg py-1 min-w-[180px] max-h-[200px] overflow-y-auto"
          style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
        >
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs font-dm hover:bg-white/5 transition-colors text-cream/40"
          >
            Nenhuma
          </button>
          {atividades.map((a) => (
            <button
              key={a.id}
              onClick={() => { onChange(a.nome); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs font-dm hover:bg-white/5 transition-colors"
              style={{ color: "#FDFBF7" }}
            >
              {a.nome}
              {a.nome === current && <Check className="h-3 w-3 inline ml-2 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function CalendarioPage() {
  const { isAdmin } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("calendario");
  const [loading, setLoading] = useState(true);

  // Data
  const [horarios, setHorarios] = useState<FormacaoHorario[]>([]);
  const [slots, setSlots] = useState<FormacaoSlot[]>([]);
  const [alocacoes, setAlocacoes] = useState<FormacaoAlocacao[]>([]);
  const [condutores, setCondutores] = useState<CertificadoCondutor[]>([]);
  const [atividades, setAtividades] = useState<CertificadoAtividade[]>([]);
  const [eventos, setEventos] = useState<CertificadoEvento[]>([]);
  const [config, setConfig] = useState<FormacaoCronograma | null>(null);

  // UI state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [meetEditSlotId, setMeetEditSlotId] = useState<string | null>(null);
  const [meetLinkDraft, setMeetLinkDraft] = useState("");
  const [addCondutorSlotId, setAddCondutorSlotId] = useState<string | null>(null);

  // Horarios tab
  const [newHora, setNewHora] = useState("08:00");
  const [addingHorario, setAddingHorario] = useState(false);

  // Eventos tab
  const [eventoForm, setEventoForm] = useState({ titulo: "", descricao: "", data_inicio: "", data_fim: "" });
  const [addingEvento, setAddingEvento] = useState(false);
  const [deleteEventoTarget, setDeleteEventoTarget] = useState<CertificadoEvento | null>(null);

  // Cronograma canvas
  const cronogramaCanvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  // WhatsApp
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [whatsappInitialized, setWhatsappInitialized] = useState(false);

  // ─── Fetch all data ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    const [hRes, sRes, aRes, cRes, atRes, eRes, cfgRes] = await Promise.all([
      supabase.from("formacao_horarios").select("*").eq("ativo", true).order("ordem"),
      supabase.from("formacao_slots").select("*, formacao_horarios(hora, ordem)"),
      supabase.from("formacao_alocacoes").select("*, certificado_condutores(id, nome, telefone)"),
      supabase.from("certificado_condutores").select("*").eq("ativo", true).order("nome"),
      supabase.from("certificado_atividades").select("*").eq("ativo", true).order("nome"),
      supabase.from("certificado_eventos").select("*").order("data_inicio", { ascending: false }),
      supabase.from("formacao_cronograma").select("*").limit(1).single(),
    ]);
    if (hRes.data) setHorarios(hRes.data);
    if (sRes.data) setSlots(sRes.data);
    if (aRes.data) setAlocacoes(aRes.data);
    if (cRes.data) setCondutores(cRes.data);
    if (atRes.data) setAtividades(atRes.data);
    if (eRes.data) setEventos(eRes.data);
    if (cfgRes.data) setConfig(cfgRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll().catch(() => setLoading(false));
  }, [fetchAll]);

  // Load logo for canvas
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = "/Icone_Allos_Verde.png";
    img.onload = () => { logoRef.current = img; };
  }, []);

  // ─── Config upsert ────────────────────────────────────────────────────────
  async function upsertConfig(fields: Partial<FormacaoCronograma>) {
    const supabase = createClient();
    const { data: existing } = await supabase.from("formacao_cronograma").select("id").limit(1).single();
    if (existing) {
      const { data } = await supabase
        .from("formacao_cronograma")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (data) setConfig(data);
    } else {
      const { data } = await supabase
        .from("formacao_cronograma")
        .insert({ grupos_visiveis: true, duracao_minutos: 90, ...fields })
        .select("*")
        .single();
      if (data) setConfig(data);
    }
  }

  // ─── Cronograma canvas draw (matching Allos identity) ────────────────────
  const drawCronograma = useCallback(() => {
    const canvas = cronogramaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const activeH = horarios.filter((h) => h.ativo).sort((a, b) => a.ordem - b.ordem);
    const activeSlots = slots.filter((s) => s.ativo && s.atividade_nome);

    // Build data per day
    const dayData: { dia: string; items: string[] }[] = [];
    DIAS.forEach((dia, diaIdx) => {
      const items: string[] = [];
      activeH.forEach((h) => {
        const slot = activeSlots.find((s) => s.dia_semana === diaIdx && s.horario_id === h.id);
        if (slot && slot.atividade_nome) {
          items.push(`${h.hora.replace(":00", "h")}:  ${slot.atividade_nome}`);
        }
      });
      if (items.length > 0) dayData.push({ dia, items });
    });

    const W = 900;
    const margin = 50;
    const innerW = W - margin * 2;
    const logoH = 160;
    const barH = 48;
    const dayLabelW = 140;
    const lineH = 34;
    const dayPadY = 18;

    // Calculate content height
    let totalItemRows = 0;
    dayData.forEach((d) => { totalItemRows += d.items.length; });
    const contentH = dayData.length * (dayPadY * 2) + totalItemRows * lineH;
    const footerH = 80;
    const H = logoH + barH + contentH + footerH;

    canvas.width = W;
    canvas.height = H;

    // ── Background: rich teal gradient ──
    const bgGrad = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.5, H * 0.5, W);
    bgGrad.addColorStop(0, "#2a6b6b");
    bgGrad.addColorStop(0.4, "#1f5555");
    bgGrad.addColorStop(1, "#143838");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Texture: scattered subtle light dots
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const a = Math.random() * 0.04;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vignette overlay
    const vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.75);
    vigGrad.addColorStop(0, "rgba(0,0,0,0)");
    vigGrad.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Logo area ──
    // Draw logo from image if loaded
    if (logoRef.current) {
      const logoSize = 70;
      ctx.drawImage(logoRef.current, (W - logoSize) / 2, 30, logoSize, logoSize);
    } else {
      // Fallback: decorative circles (Allos logo style)
      const cx = W / 2;
      ctx.strokeStyle = "rgba(253,251,247,0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(cx, 65, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, 65, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#FDFBF7";
      ctx.beginPath(); ctx.arc(cx, 65, 5, 0, Math.PI * 2); ctx.fill();
    }

    // "ASSOCIAÇÃO" text under logo
    ctx.textAlign = "center";
    ctx.font = '600 14px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = "rgba(253,251,247,0.7)";
    ctx.letterSpacing = "6px";
    ctx.fillText("— ASSOCIAÇÃO —", W / 2, 125);
    ctx.letterSpacing = "0px";

    // ── "QUADRO DE HORÁRIOS" dark bar ──
    const barY = logoH;
    ctx.fillStyle = "rgba(15,15,15,0.75)";
    ctx.fillRect(margin, barY, innerW, barH);

    ctx.font = 'bold 18px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = "#FDFBF7";
    ctx.letterSpacing = "5px";
    ctx.fillText("QUADRO DE HORÁRIOS", W / 2, barY + 30);
    ctx.letterSpacing = "0px";

    // ── Day rows ──
    let curY = logoH + barH;
    dayData.forEach((day, dayIdx) => {
      const rowH = dayPadY * 2 + day.items.length * lineH;

      // Alternating row backgrounds
      ctx.fillStyle = dayIdx % 2 === 0 ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.08)";
      ctx.fillRect(margin, curY, innerW, rowH);

      // Separator line
      ctx.strokeStyle = "rgba(253,251,247,0.1)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(margin, curY);
      ctx.lineTo(margin + innerW, curY);
      ctx.stroke();

      // Vertical separator between day label and items
      ctx.strokeStyle = "rgba(253,251,247,0.08)";
      ctx.beginPath();
      ctx.moveTo(margin + dayLabelW, curY + 6);
      ctx.lineTo(margin + dayLabelW, curY + rowH - 6);
      ctx.stroke();

      // Day label (bold, centered vertically)
      ctx.textAlign = "center";
      ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = "#FDFBF7";
      ctx.fillText(day.dia.toUpperCase(), margin + dayLabelW / 2, curY + rowH / 2 + 6);

      // Items with bullet points
      ctx.textAlign = "left";
      ctx.font = '16px "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = "rgba(253,251,247,0.9)";
      day.items.forEach((item, itemIdx) => {
        const itemY = curY + dayPadY + itemIdx * lineH + 22;
        // Bullet
        ctx.fillStyle = "rgba(253,251,247,0.5)";
        ctx.beginPath();
        ctx.arc(margin + dayLabelW + 20, itemY - 5, 3, 0, Math.PI * 2);
        ctx.fill();
        // Text
        ctx.fillStyle = "rgba(253,251,247,0.9)";
        ctx.fillText(item, margin + dayLabelW + 32, itemY);
      });

      curY += rowH;
    });

    // Bottom border line
    ctx.strokeStyle = "rgba(253,251,247,0.1)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(margin, curY);
    ctx.lineTo(margin + innerW, curY);
    ctx.stroke();

    // ── Footer ──
    ctx.textAlign = "center";
    ctx.font = 'bold 16px Georgia, "Times New Roman", serif';
    ctx.fillStyle = "rgba(46,158,143,0.8)";
    ctx.fillText("Cronograma Geral", W / 2, H - 30);

    // Empty state
    if (dayData.length === 0) {
      ctx.font = '18px "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = "rgba(253,251,247,0.35)";
      ctx.fillText("Nenhum grupo cadastrado no calendário", W / 2, logoH + barH + 50);
    }
  }, [horarios, slots]);

  // Auto-draw cronograma when tab is active or data changes
  useEffect(() => {
    if (subTab === "cronograma" && !loading) {
      const t = setTimeout(() => drawCronograma(), 50);
      return () => clearTimeout(t);
    }
  }, [subTab, loading, horarios, slots, drawCronograma]);

  function downloadCronograma() {
    const canvas = cronogramaCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "Cronograma_Allos.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Cronograma baixado!");
  }

  // ─── WhatsApp template ──────────────────────────────────────────────────
  function buildWhatsAppMessage(): string {
    const activeH = horarios.filter((h) => h.ativo).sort((a, b) => a.ordem - b.ordem);
    const lines: string[] = [];

    lines.push("📋 *QUADRO DE HORÁRIOS — FORMAÇÃO BASE*");
    lines.push("_Associação Allos_");
    lines.push("");

    DIAS.forEach((dia, diaIdx) => {
      const daySlots = slots
        .filter((s) => s.ativo && s.dia_semana === diaIdx && s.atividade_nome)
        .sort((a, b) => {
          const hA = activeH.find((h) => h.id === a.horario_id);
          const hB = activeH.find((h) => h.id === b.horario_id);
          return (hA?.ordem || 0) - (hB?.ordem || 0);
        });

      if (daySlots.length === 0) return;

      lines.push(`*${dia}*`);
      daySlots.forEach((slot) => {
        const hora = activeH.find((h) => h.id === slot.horario_id)?.hora || "";
        const allocs = alocacoes.filter((a) => a.slot_id === slot.id);
        const condNames = allocs.map((a) => a.certificado_condutores?.nome || "").filter(Boolean).join(", ");
        lines.push(`  🕐 ${hora} — ${slot.atividade_nome}${condNames ? ` (${condNames})` : ""}`);
      });
      lines.push("");
    });

    lines.push("🔗 Grupo WhatsApp: https://chat.whatsapp.com/JpZtYWJovU03VlrZJ5oUxQ");
    lines.push("");
    lines.push("_Sua participação fortalece nossos projetos!_ 💚");

    return lines.join("\n");
  }

  // Initialize whatsapp message when tab is opened or data changes
  useEffect(() => {
    if (subTab === "whatsapp" && !loading) {
      if (!whatsappInitialized) {
        setWhatsappMsg(buildWhatsAppMessage());
        setWhatsappInitialized(true);
      }
    }
  }, [subTab, loading, whatsappInitialized]);

  function regenerateWhatsApp() {
    setWhatsappMsg(buildWhatsAppMessage());
    toast.success("Mensagem regenerada a partir do cronograma!");
  }

  function copyWhatsApp() {
    navigator.clipboard.writeText(whatsappMsg || buildWhatsAppMessage());
    setWhatsappCopied(true);
    toast.success("Mensagem copiada!");
    setTimeout(() => setWhatsappCopied(false), 2000);
  }

  // ─── Slot helpers ─────────────────────────────────────────────────────────
  function getSlot(dia: number, horarioId: string) {
    return slots.find((s) => s.dia_semana === dia && s.horario_id === horarioId);
  }

  function getSlotAlocacoes(slotId: string) {
    return alocacoes.filter((a) => a.slot_id === slotId);
  }

  // ─── Slot CRUD ────────────────────────────────────────────────────────────
  async function createSlot(dia: number, horarioId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("formacao_slots")
      .insert({ dia_semana: dia, horario_id: horarioId })
      .select("*, formacao_horarios(hora, ordem)")
      .single();
    if (error || !data) { toast.error("Erro ao criar slot."); return; }
    setSlots((prev) => [...prev, data]);
    toast.success("Slot criado!");
  }

  async function updateSlot(id: string, fields: Partial<FormacaoSlot>) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("formacao_slots")
      .update(fields)
      .eq("id", id)
      .select("*, formacao_horarios(hora, ordem)")
      .single();
    if (error || !data) { toast.error("Erro ao atualizar slot."); return; }
    setSlots((prev) => prev.map((s) => (s.id === id ? data : s)));
  }

  async function deleteSlot(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("formacao_slots").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover slot."); return; }
    setSlots((prev) => prev.filter((s) => s.id !== id));
    setAlocacoes((prev) => prev.filter((a) => a.slot_id !== id));
    toast.success("Slot removido!");
  }

  // ─── Alocacao CRUD ────────────────────────────────────────────────────────
  async function addAlocacao(slotId: string, condutorId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("formacao_alocacoes")
      .insert({ slot_id: slotId, condutor_id: condutorId })
      .select("*, certificado_condutores(id, nome, telefone)")
      .single();
    if (error || !data) { toast.error("Erro ao alocar condutor."); return; }
    setAlocacoes((prev) => [...prev, data]);
    setAddCondutorSlotId(null);
    toast.success("Condutor alocado!");
  }

  async function removeAlocacao(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("formacao_alocacoes").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover alocação."); return; }
    setAlocacoes((prev) => prev.filter((a) => a.id !== id));
  }

  // ─── Nova Semana ──────────────────────────────────────────────────────────
  async function handleNovaSemana() {
    const supabase = createClient();
    const activeSlotIds = slots.filter((s) => s.ativo).map((s) => s.id);
    if (activeSlotIds.length === 0) { toast.error("Nenhum slot ativo."); setResetModalOpen(false); return; }
    const { error } = await supabase
      .from("formacao_slots")
      .update({ status: "pendente" })
      .in("id", activeSlotIds);
    if (error) { toast.error("Erro ao resetar semana."); return; }
    setSlots((prev) => prev.map((s) => (s.ativo ? { ...s, status: "pendente" } : s)));
    setResetModalOpen(false);
    toast.success("Nova semana iniciada! Todos os status foram resetados.");
  }

  // ─── Horario CRUD ─────────────────────────────────────────────────────────
  async function handleAddHorario() {
    if (!newHora) return;
    setAddingHorario(true);
    const supabase = createClient();
    const maxOrdem = horarios.length > 0 ? Math.max(...horarios.map((h) => h.ordem)) : 0;
    const { data, error } = await supabase
      .from("formacao_horarios")
      .insert({ hora: newHora, ordem: maxOrdem + 1, ativo: true })
      .select("*")
      .single();
    if (error || !data) { toast.error("Erro ao criar horário."); setAddingHorario(false); return; }
    setHorarios((prev) => [...prev, data].sort((a, b) => a.ordem - b.ordem));
    setAddingHorario(false);
    toast.success(`Horário ${newHora} adicionado!`);
  }

  async function deleteHorario(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("formacao_horarios").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover horário."); return; }
    setHorarios((prev) => prev.filter((h) => h.id !== id));
    toast.success("Horário removido!");
  }

  async function toggleHorario(id: string, ativo: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("formacao_horarios").update({ ativo }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar horário."); return; }
    setHorarios((prev) => prev.map((h) => (h.id === id ? { ...h, ativo } : h)));
  }

  // ─── Evento CRUD ──────────────────────────────────────────────────────────
  async function handleAddEvento() {
    if (!eventoForm.titulo.trim() || !eventoForm.data_inicio || !eventoForm.data_fim) {
      toast.error("Preencha título, data de início e data de fim.");
      return;
    }
    setAddingEvento(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("certificado_eventos")
      .insert({
        titulo: eventoForm.titulo.trim(),
        descricao: eventoForm.descricao.trim() || null,
        data_inicio: eventoForm.data_inicio,
        data_fim: eventoForm.data_fim,
        ativo: true,
      })
      .select("*")
      .single();
    if (error || !data) { toast.error("Erro ao criar evento."); setAddingEvento(false); return; }
    setEventos((prev) => [data, ...prev]);
    setEventoForm({ titulo: "", descricao: "", data_inicio: "", data_fim: "" });
    setAddingEvento(false);
    toast.success("Evento criado!");
  }

  async function toggleEvento(id: string, ativo: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("certificado_eventos").update({ ativo }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar evento."); return; }
    setEventos((prev) => prev.map((e) => (e.id === id ? { ...e, ativo } : e)));
  }

  async function deleteEvento(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("certificado_eventos").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover evento."); return; }
    setEventos((prev) => prev.filter((e) => e.id !== id));
    setDeleteEventoTarget(null);
    toast.success("Evento removido!");
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const activeSlots = slots.filter((s) => s.ativo);
  const stats = {
    total: activeSlots.length,
    conduzidos: activeSlots.filter((s) => s.status === "conduzido").length,
    nao_conduzidos: activeSlots.filter((s) => s.status === "nao_conduzido").length,
    cancelados: activeSlots.filter((s) => s.status === "cancelado").length,
    desmarcados: activeSlots.filter((s) => s.status === "desmarcado").length,
    pendentes: activeSlots.filter((s) => s.status === "pendente").length,
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-32" />
          ))}
        </div>
        <div className="grid grid-cols-6 gap-3">
          {[...Array(30)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  // ─── activeHorarios for the grid ──────────────────────────────────────────
  const activeHorarios = horarios.filter((h) => h.ativo).sort((a, b) => a.ordem - b.ordem);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-fraunces font-bold text-2xl" style={{ color: "#FDFBF7" }}>
          Calendário Semanal
        </h1>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Duration input */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: "rgba(253,251,247,0.5)" }} />
            <input
              type="number"
              min={30}
              max={300}
              step={10}
              value={config?.duracao_minutos ?? 90}
              onChange={(e) => upsertConfig({ duracao_minutos: Number(e.target.value) } as Partial<FormacaoCronograma>)}
              className="w-20 px-2 py-1.5 rounded-lg text-xs font-dm"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#FDFBF7",
              }}
            />
            <span className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>min</span>
          </div>

          {/* Visibility toggle */}
          <button
            onClick={() => upsertConfig({ grupos_visiveis: !(config?.grupos_visiveis ?? true) } as Partial<FormacaoCronograma>)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-dm transition-colors"
            style={{
              background: (config?.grupos_visiveis ?? true) ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
              color: (config?.grupos_visiveis ?? true) ? "#22c55e" : "rgba(253,251,247,0.4)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {(config?.grupos_visiveis ?? true) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {(config?.grupos_visiveis ?? true) ? "Visível" : "Oculto"}
          </button>

          {/* Nova Semana */}
          <Button variant="secondary" size="sm" onClick={() => setResetModalOpen(true)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Nova Semana
          </Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {SUB_TABS.map((tab) => {
          const active = subTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-dm transition-all duration-200"
              style={{
                background: active ? "rgba(200,75,49,0.15)" : "transparent",
                color: active ? "#C84B31" : "rgba(253,251,247,0.5)",
                fontWeight: active ? 600 : 400,
              }}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {subTab === "calendario" && (
          <motion.div
            key="calendario"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Stats bar */}
            <div
              className="flex flex-wrap gap-3 p-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {[
                { label: "Total",          value: stats.total,          color: "#FDFBF7" },
                { label: "Conduzidos",      value: stats.conduzidos,    color: "#22c55e" },
                { label: "Não conduzidos",  value: stats.nao_conduzidos, color: "#f59e0b" },
                { label: "Cancelados",      value: stats.cancelados,    color: "#ef4444" },
                { label: "Desmarcados",     value: stats.desmarcados,   color: "#8b5cf6" },
                { label: "Pendentes",       value: stats.pendentes,     color: "#9ca3af" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.5)" }}>
                    {s.label}:
                  </span>
                  <span className="text-sm font-dm font-semibold" style={{ color: s.color }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header row */}
                <div className="grid grid-cols-[80px_repeat(5,1fr)] gap-2 mb-2">
                  <div />
                  {DIAS.map((dia) => (
                    <div
                      key={dia}
                      className="text-center text-xs font-dm font-semibold py-2 rounded-lg"
                      style={{ color: "rgba(253,251,247,0.6)", background: "rgba(255,255,255,0.03)" }}
                    >
                      {dia}
                    </div>
                  ))}
                </div>

                {/* Data rows */}
                {activeHorarios.map((horario) => (
                  <div key={horario.id} className="grid grid-cols-[80px_repeat(5,1fr)] gap-2 mb-2">
                    {/* Time label */}
                    <div
                      className="flex items-center justify-center text-xs font-dm font-semibold rounded-lg"
                      style={{ color: "#C84B31", background: "rgba(200,75,49,0.08)" }}
                    >
                      {horario.hora}
                    </div>

                    {/* Cells */}
                    {DIAS.map((_, diaIdx) => {
                      const slot = getSlot(diaIdx, horario.id);
                      const slotAlocacoes = slot ? getSlotAlocacoes(slot.id) : [];

                      if (!slot) {
                        return (
                          <div
                            key={`${diaIdx}-${horario.id}`}
                            className="flex items-center justify-center rounded-xl min-h-[100px] transition-colors hover:bg-white/[0.04] cursor-pointer"
                            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)" }}
                            onClick={() => createSlot(diaIdx, horario.id)}
                          >
                            <Plus className="h-5 w-5" style={{ color: "rgba(253,251,247,0.15)" }} />
                          </div>
                        );
                      }

                      if (!slot.ativo) {
                        return (
                          <div
                            key={`${diaIdx}-${horario.id}`}
                            className="flex flex-col items-center justify-center rounded-xl min-h-[100px] gap-1"
                            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", opacity: 0.5 }}
                          >
                            <span className="text-[10px] font-dm" style={{ color: "rgba(253,251,247,0.3)" }}>Inativo</span>
                            <button
                              onClick={() => updateSlot(slot.id, { ativo: true } as Partial<FormacaoSlot>)}
                              className="text-[10px] font-dm underline"
                              style={{ color: "#C84B31" }}
                            >
                              Ativar
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${diaIdx}-${horario.id}`}
                          className="rounded-xl p-2.5 flex flex-col gap-1.5 min-h-[100px]"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          {/* Top row: status + delete */}
                          <div className="flex items-center justify-between gap-1">
                            <StatusDropdown
                              current={slot.status}
                              onChange={(status) => updateSlot(slot.id, { status } as Partial<FormacaoSlot>)}
                            />
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => updateSlot(slot.id, { ativo: false } as Partial<FormacaoSlot>)}
                                className="p-1 rounded hover:bg-white/5 transition-colors"
                                title="Desativar"
                              >
                                <EyeOff className="h-3 w-3" style={{ color: "rgba(253,251,247,0.25)" }} />
                              </button>
                              <button
                                onClick={() => deleteSlot(slot.id)}
                                className="p-1 rounded hover:bg-red-500/10 transition-colors"
                                title="Remover"
                              >
                                <Trash2 className="h-3 w-3" style={{ color: "rgba(239,68,68,0.5)" }} />
                              </button>
                            </div>
                          </div>

                          {/* Atividade */}
                          <AtividadeDropdown
                            current={slot.atividade_nome}
                            atividades={atividades}
                            onChange={(nome) => updateSlot(slot.id, { atividade_nome: nome } as Partial<FormacaoSlot>)}
                          />

                          {/* Meet link */}
                          {meetEditSlotId === slot.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="url"
                                value={meetLinkDraft}
                                onChange={(e) => setMeetLinkDraft(e.target.value)}
                                placeholder="https://meet.google.com/..."
                                className="flex-1 px-2 py-1 rounded text-[10px] font-dm"
                                style={{
                                  background: "rgba(255,255,255,0.05)",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  color: "#FDFBF7",
                                }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    updateSlot(slot.id, { meet_link: meetLinkDraft || null } as Partial<FormacaoSlot>);
                                    setMeetEditSlotId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  updateSlot(slot.id, { meet_link: meetLinkDraft || null } as Partial<FormacaoSlot>);
                                  setMeetEditSlotId(null);
                                }}
                                className="p-1 rounded hover:bg-white/5"
                              >
                                <Check className="h-3 w-3" style={{ color: "#22c55e" }} />
                              </button>
                              <button onClick={() => setMeetEditSlotId(null)} className="p-1 rounded hover:bg-white/5">
                                <X className="h-3 w-3" style={{ color: "rgba(253,251,247,0.3)" }} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setMeetEditSlotId(slot.id); setMeetLinkDraft(slot.meet_link || ""); }}
                              className="flex items-center gap-1 text-[10px] font-dm transition-colors hover:opacity-80"
                              style={{ color: slot.meet_link ? "#60a5fa" : "rgba(253,251,247,0.2)" }}
                            >
                              <LinkIcon className="h-3 w-3" />
                              {slot.meet_link ? "Meet" : "Add link"}
                            </button>
                          )}

                          {/* Condutores */}
                          <div className="space-y-1 mt-auto">
                            {slotAlocacoes.map((aloc) => (
                              <div key={aloc.id} className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-dm truncate" style={{ color: "rgba(253,251,247,0.7)" }}>
                                  {aloc.certificado_condutores?.nome || "—"}
                                </span>
                                <button
                                  onClick={() => removeAlocacao(aloc.id)}
                                  className="p-0.5 rounded hover:bg-red-500/10 flex-shrink-0"
                                >
                                  <X className="h-2.5 w-2.5" style={{ color: "rgba(239,68,68,0.5)" }} />
                                </button>
                              </div>
                            ))}

                            {/* Add condutor */}
                            {addCondutorSlotId === slot.id ? (
                              <div className="space-y-1">
                                <div
                                  className="max-h-[120px] overflow-y-auto rounded-lg py-1"
                                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
                                >
                                  {condutores
                                    .filter((c) => !slotAlocacoes.some((a) => a.condutor_id === c.id))
                                    .map((c) => (
                                      <button
                                        key={c.id}
                                        onClick={() => addAlocacao(slot.id, c.id)}
                                        className="w-full text-left px-2 py-1 text-[10px] font-dm hover:bg-white/5 transition-colors"
                                        style={{ color: "#FDFBF7" }}
                                      >
                                        {c.nome}
                                      </button>
                                    ))}
                                  {condutores.filter((c) => !slotAlocacoes.some((a) => a.condutor_id === c.id)).length === 0 && (
                                    <span className="px-2 py-1 text-[10px] font-dm block" style={{ color: "rgba(253,251,247,0.3)" }}>
                                      Sem condutores disponíveis
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => setAddCondutorSlotId(null)}
                                  className="text-[10px] font-dm"
                                  style={{ color: "rgba(253,251,247,0.3)" }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddCondutorSlotId(slot.id)}
                                className="flex items-center gap-1 text-[10px] font-dm transition-colors hover:opacity-80"
                                style={{ color: "rgba(200,75,49,0.7)" }}
                              >
                                <UserPlus className="h-3 w-3" />
                                Condutor
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {activeHorarios.length === 0 && (
                  <div className="text-center py-16">
                    <Clock className="h-8 w-8 mx-auto mb-3" style={{ color: "rgba(253,251,247,0.15)" }} />
                    <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>
                      Nenhum horário ativo. Crie horários na aba &quot;Horários&quot;.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {subTab === "horarios" && (
          <motion.div
            key="horarios"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Add new */}
            <div
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <input
                type="time"
                value={newHora}
                onChange={(e) => setNewHora(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm font-dm"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#FDFBF7",
                  colorScheme: "dark",
                }}
              />
              <Button size="sm" onClick={handleAddHorario} loading={addingHorario}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>

            {/* List */}
            <div className="space-y-2">
              {horarios
                .sort((a, b) => a.ordem - b.ordem)
                .map((h) => (
                  <motion.div
                    key={h.id}
                    layout
                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4" style={{ color: "#C84B31" }} />
                      <span className="text-sm font-dm font-semibold" style={{ color: "#FDFBF7" }}>
                        {h.hora}
                      </span>
                      <span className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.3)" }}>
                        Ordem: {h.ordem}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Toggle ativo */}
                      <button
                        onClick={() => toggleHorario(h.id, !h.ativo)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-dm transition-colors"
                        style={{
                          background: h.ativo ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                          color: h.ativo ? "#22c55e" : "rgba(253,251,247,0.4)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {h.ativo ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {h.ativo ? "Ativo" : "Inativo"}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => deleteHorario(h.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" style={{ color: "rgba(239,68,68,0.6)" }} />
                      </button>
                    </div>
                  </motion.div>
                ))}

              {horarios.length === 0 && (
                <div className="text-center py-16">
                  <Clock className="h-8 w-8 mx-auto mb-3" style={{ color: "rgba(253,251,247,0.15)" }} />
                  <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>
                    Nenhum horário cadastrado.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── Cronograma ──────────────────────────────────────────── */}
        {subTab === "cronograma" && (
          <motion.div key="cronograma" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
            <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" style={{ color: "#C84B31" }} />
                  <h3 className="font-fraunces font-semibold text-base" style={{ color: "#FDFBF7" }}>Quadro de Horários</h3>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => drawCronograma()}>
                    <RefreshCw className="h-3.5 w-3.5" /> Atualizar
                  </Button>
                  <Button size="sm" onClick={downloadCronograma}>
                    <Download className="h-3.5 w-3.5" /> Baixar PNG
                  </Button>
                </div>
              </div>
              <p className="text-xs font-dm mb-4" style={{ color: "rgba(253,251,247,0.35)" }}>
                A arte é gerada automaticamente a partir dos dados do calendário.
              </p>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <canvas ref={cronogramaCanvasRef} className="w-full h-auto" style={{ maxWidth: "100%", display: "block" }} onLoad={() => drawCronograma()} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── WhatsApp ──────────────────────────────────────────── */}
        {subTab === "whatsapp" && (
          <motion.div key="whatsapp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
            <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} />
                  <h3 className="font-fraunces font-semibold text-base" style={{ color: "#FDFBF7" }}>Mensagem para WhatsApp</h3>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={regenerateWhatsApp}>
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerar
                  </Button>
                  <Button size="sm" onClick={copyWhatsApp}>
                    {whatsappCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {whatsappCopied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
              </div>
              <p className="text-[10px] font-dm mb-2" style={{ color: "rgba(253,251,247,0.25)" }}>Edite livremente. Use &quot;Regenerar&quot; para recriar a partir do cronograma.</p>
              <textarea
                value={whatsappMsg || buildWhatsAppMessage()}
                onChange={(e) => setWhatsappMsg(e.target.value)}
                className="w-full text-xs font-dm p-4 rounded-lg resize-y outline-none"
                style={{ background: "rgba(0,0,0,0.3)", color: "rgba(253,251,247,0.7)", border: "1px solid rgba(255,255,255,0.06)", minHeight: "200px", maxHeight: "500px" }}
              />
            </div>

            {/* Conductor WhatsApp links */}
            <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Send className="h-4 w-4" style={{ color: "#25D366" }} />
                <h3 className="font-dm text-sm font-semibold" style={{ color: "rgba(253,251,247,0.7)" }}>Links dos Condutores</h3>
              </div>
              <div className="space-y-2">
                {condutores.filter((c) => c.telefone).map((c) => (
                  <a key={c.id} href={`https://wa.me/55${c.telefone!.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/[0.03]"
                    style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(37,211,102,0.12)" }}>
                      <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-dm font-medium truncate" style={{ color: "rgba(253,251,247,0.8)" }}>{c.nome}</p>
                      <p className="text-[10px] font-dm" style={{ color: "rgba(253,251,247,0.3)" }}>{c.telefone}</p>
                    </div>
                    <span className="text-[10px] font-dm font-bold px-2 py-0.5 rounded" style={{ background: "rgba(37,211,102,0.1)", color: "#25D366" }}>WhatsApp</span>
                  </a>
                ))}
                {condutores.filter((c) => c.telefone).length === 0 && (
                  <p className="text-xs font-dm text-center py-6" style={{ color: "rgba(253,251,247,0.3)" }}>Nenhum condutor com telefone cadastrado.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {subTab === "eventos" && (
          <motion.div
            key="eventos"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Create form */}
            <div
              className="p-5 rounded-xl space-y-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="font-fraunces font-semibold text-base" style={{ color: "#FDFBF7" }}>
                Novo Evento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Título"
                  value={eventoForm.titulo}
                  onChange={(e) => setEventoForm((f) => ({ ...f, titulo: e.target.value }))}
                  className="px-3 py-2 rounded-lg text-sm font-dm col-span-full"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#FDFBF7",
                  }}
                />
                <input
                  type="text"
                  placeholder="Descrição (opcional)"
                  value={eventoForm.descricao}
                  onChange={(e) => setEventoForm((f) => ({ ...f, descricao: e.target.value }))}
                  className="px-3 py-2 rounded-lg text-sm font-dm col-span-full"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#FDFBF7",
                  }}
                />
                <div className="space-y-1">
                  <label className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>Início</label>
                  <input
                    type="datetime-local"
                    value={eventoForm.data_inicio}
                    onChange={(e) => setEventoForm((f) => ({ ...f, data_inicio: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm font-dm"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#FDFBF7",
                      colorScheme: "dark",
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>Fim</label>
                  <input
                    type="datetime-local"
                    value={eventoForm.data_fim}
                    onChange={(e) => setEventoForm((f) => ({ ...f, data_fim: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm font-dm"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#FDFBF7",
                      colorScheme: "dark",
                    }}
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleAddEvento} loading={addingEvento}>
                <Plus className="h-4 w-4" />
                Criar Evento
              </Button>
            </div>

            {/* Events list */}
            <div className="space-y-2">
              {eventos.map((evento) => (
                <motion.div
                  key={evento.id}
                  layout
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    opacity: evento.ativo ? 1 : 0.5,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 flex-shrink-0" style={{ color: "#C84B31" }} />
                      <span className="text-sm font-dm font-semibold truncate" style={{ color: "#FDFBF7" }}>
                        {evento.titulo}
                      </span>
                    </div>
                    {evento.descricao && (
                      <p className="text-xs font-dm mt-0.5 ml-6 truncate" style={{ color: "rgba(253,251,247,0.4)" }}>
                        {evento.descricao}
                      </p>
                    )}
                    <div className="flex gap-3 ml-6 mt-1">
                      <span className="text-[10px] font-dm" style={{ color: "rgba(253,251,247,0.3)" }}>
                        Início: {new Date(evento.data_inicio).toLocaleString("pt-BR")}
                      </span>
                      <span className="text-[10px] font-dm" style={{ color: "rgba(253,251,247,0.3)" }}>
                        Fim: {new Date(evento.data_fim).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle ativo */}
                    <button
                      onClick={() => toggleEvento(evento.id, !evento.ativo)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-dm transition-colors"
                      style={{
                        background: evento.ativo ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                        color: evento.ativo ? "#22c55e" : "rgba(253,251,247,0.4)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {evento.ativo ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {evento.ativo ? "Ativo" : "Inativo"}
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => setDeleteEventoTarget(evento)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" style={{ color: "rgba(239,68,68,0.6)" }} />
                    </button>
                  </div>
                </motion.div>
              ))}

              {eventos.length === 0 && (
                <div className="text-center py-16">
                  <CalendarDays className="h-8 w-8 mx-auto mb-3" style={{ color: "rgba(253,251,247,0.15)" }} />
                  <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>
                    Nenhum evento cadastrado.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset modal */}
      <Modal open={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Nova Semana">
        <div className="space-y-4">
          <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.7)" }}>
            Tem certeza que deseja iniciar uma nova semana? Todos os status dos slots ativos serão
            resetados para <strong style={{ color: "#9ca3af" }}>&quot;Pendente&quot;</strong>.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setResetModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleNovaSemana}>
              <RefreshCw className="h-4 w-4" />
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete evento modal */}
      <Modal
        open={!!deleteEventoTarget}
        onClose={() => setDeleteEventoTarget(null)}
        title="Remover Evento"
      >
        <div className="space-y-4">
          <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.7)" }}>
            Deseja remover o evento{" "}
            <strong style={{ color: "#FDFBF7" }}>&quot;{deleteEventoTarget?.titulo}&quot;</strong>?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setDeleteEventoTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deleteEventoTarget && deleteEvento(deleteEventoTarget.id)}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}