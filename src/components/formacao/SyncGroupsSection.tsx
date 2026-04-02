"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Radio, Clock, Video, ChevronRight, MessageCircle, X, Trophy } from "lucide-react";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;

interface Slot {
  id: string;
  dia_semana: number;
  horario_id: string;
  ativo: boolean;
  status: string;
  atividade_nome: string | null;
  meet_link: string | null;
  formacao_horarios: { hora: string; ordem: number } | null;
}

interface AtividadeInfo {
  id: string;
  nome: string;
  descricao: string | null;
}

interface ScheduleItem {
  id: string;
  dia: string;
  diaIndex: number;
  hora: string;
  horaMinutos: number;
  atividade: string;
  descricao: string | null;
  meetLink: string | null;
  status: string;
}

function InfoIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getTodayIndex() {
  const day = new Date().getDay();
  return day === 0 || day === 6 ? -1 : day - 1;
}

export default function SyncGroupsSection() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [atividades, setAtividades] = useState<AtividadeInfo[]>([]);
  const [duracao, setDuracao] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes);
  const [todayIndex, setTodayIndex] = useState(getTodayIndex);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Ranking
  type RankingPeriod = "week" | "month" | "quarter" | "semester" | "year";
  const RANKING_LABELS: Record<RankingPeriod, string> = { week: "Semana", month: "Mês", quarter: "Trimestre", semester: "Semestre", year: "Ano" };
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>("week");
  const [rankingData, setRankingData] = useState<{ nome: string; horas: number; count: number }[]>([]);

  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  // Tick every 60s to keep live status in sync
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMinutes(getNowMinutes());
      setTodayIndex(getTodayIndex());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const client = (await import("@/lib/supabase/client")).createClient();

        const [slotsRes, atividadesRes] = await Promise.all([
          client
            .from("formacao_slots")
            .select("*, formacao_horarios(hora, ordem)")
            .eq("ativo", true),
          client
            .from("certificado_atividades")
            .select("id, nome, descricao")
            .eq("ativo", true),
        ]);

        if (slotsRes.data) setSlots(slotsRes.data as unknown as Slot[]);
        if (atividadesRes.data) setAtividades(atividadesRes.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, []);

  // Ranking fetch
  useEffect(() => {
    fetch(`/api/ranking?period=${rankingPeriod}&_t=${Date.now()}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRankingData(d); })
      .catch(() => setRankingData([]));
  }, [rankingPeriod]);

  const schedule = useMemo(() => {
    const items: ScheduleItem[] = [];

    slots
      .filter((s) => s.ativo && s.atividade_nome && s.status !== "desmarcado" && s.status !== "cancelado")
      .forEach((slot) => {
        const hora = slot.formacao_horarios?.hora || "";
        const [h, m] = hora.split(":").map(Number);
        const atividadeInfo = atividades.find((a) => a.nome === slot.atividade_nome);

        items.push({
          id: slot.id,
          dia: DIAS[slot.dia_semana],
          diaIndex: slot.dia_semana,
          hora,
          horaMinutos: h * 60 + (m || 0),
          atividade: slot.atividade_nome!,
          descricao: atividadeInfo?.descricao || null,
          meetLink: slot.meet_link,
          status: slot.status,
        });
      });

    items.sort((a, b) => {
      if (a.diaIndex !== b.diaIndex) return a.diaIndex - b.diaIndex;
      return a.horaMinutos - b.horaMinutos;
    });

    return items;
  }, [slots, atividades]);

  const isLive = useCallback((item: ScheduleItem) => {
    return item.diaIndex === todayIndex && nowMinutes >= item.horaMinutos && nowMinutes < item.horaMinutos + duracao;
  }, [todayIndex, nowMinutes, duracao]);

  const isNext = useCallback((item: ScheduleItem) => {
    if (item.diaIndex !== todayIndex) return false;
    const diff = item.horaMinutos - nowMinutes;
    return diff > 0 && diff <= 120;
  }, [todayIndex, nowMinutes]);

  const liveOrNext = useMemo(
    () => schedule.filter((s) => isLive(s) || isNext(s)),
    [schedule, isLive, isNext]
  );

  const scheduleByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    schedule.forEach((item) => {
      const list = map.get(item.dia) || [];
      list.push(item);
      map.set(item.dia, list);
    });
    return map;
  }, [schedule]);

  if (loading || error || !visivel) return null;

  const hasSchedule = schedule.length > 0;
  const hasRanking = rankingData.length > 0;

  if (!hasSchedule && !hasRanking) return null;

  return (
    <section
      ref={ref}
      className="relative py-16 sm:py-20 md:py-24 px-5 sm:px-6 md:px-10"
      style={{
        background: "radial-gradient(ellipse at 50% 20%,rgba(46,158,143,.06) 0%,transparent 60%)",
      }}
    >
      <div className="max-w-[1200px] mx-auto">
        {/* Header — only show if schedule exists */}
        {hasSchedule && (
        <div className="text-center mb-10">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="font-dm font-semibold text-xs tracking-[.22em] text-[#2E9E8F] uppercase mb-3"
          >
            Grupos Síncronos
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-fraunces font-bold text-[#FDFBF7] mb-3"
            style={{ fontSize: "clamp(24px,3vw,36px)" }}
          >
            Aprendizado <span className="italic text-[#2E9E8F]">ao vivo</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.16, duration: 0.5 }}
            className="font-dm max-w-lg mx-auto"
            style={{ fontSize: "15px", color: "rgba(253,251,247,0.5)" }}
          >
            Participe dos nossos grupos síncronos semanais conduzidos por
            profissionais da Allos. Encontros ao vivo para aprofundar a prática.
            Certificados são enviados no chat do Google Meet ao final de cada encontro.
          </motion.p>
        </div>
        )}

        {/* Live / Upcoming banner */}
        {hasSchedule && liveOrNext.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-8 space-y-3"
          >
            {liveOrNext.map((item) => {
              const live = isLive(item);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  style={{
                    background: live
                      ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(46,158,143,0.08))"
                      : "rgba(253,251,247,0.02)",
                    border: `1px solid ${live ? "rgba(34,197,94,0.2)" : "rgba(253,251,247,0.06)"}`,
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: live ? "rgba(34,197,94,0.15)" : "rgba(46,158,143,0.1)",
                        border: `1px solid ${live ? "rgba(34,197,94,0.3)" : "rgba(46,158,143,0.2)"}`,
                      }}
                    >
                      {live ? (
                        <Radio size={18} style={{ color: "#22c55e" }} className="animate-pulse" />
                      ) : (
                        <Clock size={18} style={{ color: "#2E9E8F" }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-dm text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: live ? "rgba(34,197,94,0.15)" : "rgba(46,158,143,0.1)",
                            color: live ? "#22c55e" : "#2E9E8F",
                          }}
                        >
                          {live ? "Ao vivo agora" : "Em breve"}
                        </span>
                        <span className="font-fraunces font-bold text-sm" style={{ color: "#FDFBF7" }}>
                          {item.atividade}
                        </span>
                      </div>
                      <p className="font-dm text-xs mt-0.5" style={{ color: "rgba(253,251,247,0.4)" }}>
                        {item.dia} as {item.hora}
                      </p>
                    </div>
                  </div>

                  {item.meetLink && (
                    <a
                      href={item.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-dm text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:-translate-y-0.5 flex-shrink-0"
                      style={{
                        backgroundColor: live ? "#22c55e" : "#2E9E8F",
                        color: "#fff",
                        boxShadow: live ? "0 4px 20px rgba(34,197,94,0.3)" : "0 4px 20px rgba(46,158,143,0.25)",
                      }}
                    >
                      <Video size={16} /> Clique aqui para assistir
                    </a>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Weekly schedule grid */}
        {hasSchedule && <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(253,251,247,0.06)", background: "rgba(253,251,247,0.015)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {DIAS.map((dia, diaIdx) => {
              const items = scheduleByDay.get(dia) || [];
              const isCurrentDay = todayIndex === diaIdx;
              return (
                <div key={dia} className="p-4"
                  style={{
                    borderRight: diaIdx < 4 ? "1px solid rgba(253,251,247,0.04)" : "none",
                    borderBottom: "1px solid rgba(253,251,247,0.04)",
                    background: isCurrentDay ? "rgba(200,75,49,0.03)" : "transparent",
                  }}>
                  <p className="font-dm text-[10px] font-bold uppercase tracking-wider mb-3"
                    style={{ color: isCurrentDay ? "#C84B31" : "rgba(253,251,247,0.3)" }}>
                    {dia}
                    {isCurrentDay && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full normal-case tracking-normal font-medium"
                        style={{ backgroundColor: "rgba(200,75,49,0.1)", color: "#C84B31" }}>hoje</span>
                    )}
                  </p>
                  {items.length > 0 ? (
                    <div className="space-y-2">
                      {items.map((item) => {
                        const live = isLive(item);
                        const isExpanded = expandedId === item.id;
                        return (
                          <div key={item.id}>
                            <button
                              onClick={() => item.descricao && setExpandedId(isExpanded ? null : item.id)}
                              className="w-full text-left rounded-lg p-2.5 transition-all"
                              style={{
                                background: live ? "rgba(34,197,94,0.06)" : "rgba(253,251,247,0.02)",
                                border: `1px solid ${live ? "rgba(34,197,94,0.12)" : "rgba(253,251,247,0.05)"}`,
                                cursor: item.descricao ? "pointer" : "default",
                              }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="font-dm text-[11px] font-bold" style={{ color: "#C84B31" }}>{item.hora}</span>
                                {live && <Radio size={10} style={{ color: "#22c55e" }} className="animate-pulse" />}
                                {item.descricao && (
                                  <span className="ml-auto" style={{ color: isExpanded ? "rgba(253,251,247,0.4)" : "rgba(253,251,247,0.12)" }}><InfoIcon size={11} /></span>
                                )}
                              </div>
                              <p className="font-dm text-xs font-medium" style={{ color: "rgba(253,251,247,0.65)" }}>{item.atividade}</p>
                              {item.meetLink && live && (
                                <a href={item.meetLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="font-dm text-[10px] font-bold mt-1.5 flex items-center gap-1 transition-all hover:gap-2" style={{ color: "#22c55e" }}>
                                  <Video size={10} /> Assistir agora <ChevronRight size={10} />
                                </a>
                              )}
                            </button>
                            <AnimatePresence>
                              {isExpanded && item.descricao && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                                  <div className="px-2.5 pb-2.5 pt-1.5 rounded-b-lg -mt-0.5" style={{ background: "rgba(253,251,247,0.02)", border: "1px solid rgba(253,251,247,0.06)", borderTop: "none" }}>
                                    <div className="flex items-start gap-1.5">
                                      <p className="font-dm text-[11px] leading-relaxed flex-1" style={{ color: "rgba(253,251,247,0.4)" }}>{item.descricao}</p>
                                      <button onClick={() => setExpandedId(null)} className="p-0.5 rounded flex-shrink-0 hover:bg-white/[0.05]" style={{ color: "rgba(253,251,247,0.2)" }}><X size={10} /></button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="font-dm text-[11px]" style={{ color: "rgba(253,251,247,0.12)" }}>Sem grupo</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom bar: WhatsApp + Google inline */}
          <div className="flex flex-col sm:flex-row items-center gap-3 px-5 py-4" style={{ borderTop: "1px solid rgba(253,251,247,0.06)" }}>
            <a href="https://chat.whatsapp.com/JpZtYWJovU03VlrZJ5oUxQ" target="_blank" rel="noopener noreferrer"
              className="font-dm text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.15)" }}>
              <MessageCircle size={14} />
              Grupo WhatsApp
            </a>
            <a href="https://search.google.com/local/writereview?placeid=ChIJRU1omzaXpgARA4UFQLEIq4g" target="_blank" rel="noopener noreferrer"
              className="font-dm text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "rgba(253,251,247,0.03)", color: "rgba(253,251,247,0.5)", border: "1px solid rgba(253,251,247,0.06)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Avaliar no Google
            </a>
          </div>
        </motion.div>}

        {/* Ranking — compact, same visual language */}
        {rankingData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-4 rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(253,251,247,0.06)", background: "rgba(253,251,247,0.015)" }}
          >
            <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid rgba(253,251,247,0.04)" }}>
              <div className="flex items-center gap-1.5">
                <Trophy size={13} style={{ color: "#C84B31" }} />
                <span className="font-dm text-[11px] font-semibold" style={{ color: "rgba(253,251,247,0.5)" }}>Top participantes</span>
              </div>
              <div className="flex gap-1 ml-auto">
                {(Object.keys(RANKING_LABELS) as RankingPeriod[]).map(p => (
                  <button key={p} onClick={() => setRankingPeriod(p)}
                    className="font-dm text-[9px] px-2 py-0.5 rounded-full transition-all"
                    style={{
                      backgroundColor: rankingPeriod === p ? "rgba(200,75,49,0.1)" : "transparent",
                      color: rankingPeriod === p ? "#C84B31" : "rgba(253,251,247,0.25)",
                    }}>
                    {RANKING_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5">
              {rankingData.map((entry, i) => {
                const medals = ["#C84B31", "rgba(253,251,247,0.5)", "rgba(200,75,49,0.6)"];
                const isMedal = i < 3;
                return (
                  <div key={entry.nome} className="flex items-center gap-2 px-5 py-2.5 sm:flex-col sm:text-center sm:py-4 sm:gap-1"
                    style={{ borderRight: i < rankingData.length - 1 ? "1px solid rgba(253,251,247,0.04)" : "none" }}>
                    <span className="font-fraunces font-bold text-lg sm:text-xl" style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.15)" }}>{i + 1}</span>
                    <span className="font-dm text-[11px] flex-1 truncate sm:flex-none" style={{ color: "rgba(253,251,247,0.6)" }}>{entry.nome.split(" ").slice(0, 2).join(" ")}</span>
                    <span className="font-dm text-[11px] font-bold" style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.2)" }}>{entry.horas}h</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
