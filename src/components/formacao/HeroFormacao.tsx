"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Award, ArrowRight, Trophy } from "lucide-react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function MovingGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const allOrbs = [
      { x: 0.12, y: 0.25, r: 0.6, speed: 0.0004, phase: 0, color: "rgba(200,75,49," },
      { x: 0.8, y: 0.65, r: 0.5, speed: 0.0003, phase: 2.1, color: "rgba(200,75,49," },
      { x: 0.5, y: 0.1, r: 0.4, speed: 0.0005, phase: 1.2, color: "rgba(163,61,39," },
      { x: 0.35, y: 0.8, r: 0.3, speed: 0.00035, phase: 3.5, color: "rgba(46,158,143," },
    ];
    const orbs = isMobile ? allOrbs.slice(0, 2) : allOrbs;

    const frameSkip = isMobile ? 2 : 1;
    let frameCount = 0;

    const draw = () => {
      frameCount++;
      if (frameCount % frameSkip !== 0) {
        raf = requestAnimationFrame(draw);
        return;
      }

      t += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      orbs.forEach((orb) => {
        const px = (orb.x + Math.sin(t * orb.speed + orb.phase) * 0.18) * canvas.width;
        const py = (orb.y + Math.cos(t * orb.speed * 1.3 + orb.phase) * 0.14) * canvas.height;
        const rad = orb.r * Math.min(canvas.width, canvas.height);

        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, orb.color + "0.18)");
        g.addColorStop(0.4, orb.color + "0.08)");
        g.addColorStop(1, orb.color + "0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [isMobile, prefersReduced]);

  if (prefersReduced) {
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 30% 40%, rgba(200,75,49,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(46,158,143,0.08) 0%, transparent 50%)",
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
}

interface RankingEntry { nome: string; horas: number; count: number }

export default function HeroFormacao() {
  const r = useReducedMotion();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  useEffect(() => {
    fetch("/api/ranking")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRanking(d); })
      .catch(() => {});
  }, []);
  const up = (d: number) => ({
    initial: { opacity: 0, y: r ? 0 : 24 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: d, duration: 0.75, ease: [0.22, 1, 0.36, 1] },
  });

  return (
    <section
      className="relative overflow-hidden flex items-center"
      style={{ background: "rgba(13,13,13,0.7)", minHeight: "min(45vh, 420px)" }}
    >
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[.05] z-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <MovingGradient />

      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-5 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16 items-center">
          {/* Left — text (3 cols) */}
          <div className="lg:col-span-3">
            {/* Tag */}
            <motion.div
              {...up(0.1)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-7"
              style={{
                background: "rgba(200,75,49,0.1)",
                border: "1px solid rgba(200,75,49,0.2)",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#C84B31] animate-pulse" />
              <span className="font-dm text-xs font-semibold tracking-wider uppercase text-[#C84B31]">
                Cursos
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              {...up(0.2)}
              className="font-fraunces font-bold leading-[1.05] mb-6 tracking-tight"
              style={{ fontSize: "clamp(36px, 5.5vw, 72px)" }}
            >
              <span className="text-[#FDFBF7]">Transformando </span>
              <span className="italic text-[#C84B31]">talentos</span>
              <span className="text-[#FDFBF7]"> em </span>
              <span className="italic text-[#C84B31]">legado</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              {...up(0.35)}
              className="font-dm leading-relaxed max-w-[540px] mb-10"
              style={{ fontSize: "clamp(15px,1.6vw,17px)", color: "rgba(253,251,247,0.6)" }}
            >
              Do manejo clínico à presença terapêutica. Cursos gravados, encontros síncronos e formação contínua para quem quer ir além do protocolo.
            </motion.p>

            {/* CTAs */}
            <motion.div {...up(0.5)} className="flex flex-wrap gap-4">
              <motion.a
                href="#cursos"
                whileHover={{ scale: 1.04, boxShadow: "0 10px 36px rgba(200,75,49,.35)" }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2.5 font-dm font-semibold text-white bg-[#C84B31] rounded-full hover:bg-[#A33D27] transition-colors"
                style={{ padding: "14px 32px", fontSize: "15px", boxShadow: "0 4px 20px rgba(200,75,49,.25)" }}
              >
                Ver cursos
                <ArrowRight size={16} />
              </motion.a>
            </motion.div>
          </div>

          {/* Right — certificate highlight (2 cols) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-2"
          >
            <div
              className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
              style={{
                background: "rgba(46,158,143,0.04)",
                border: "1px solid rgba(46,158,143,0.12)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: "rgba(46,158,143,0.12)",
                  border: "1px solid rgba(46,158,143,0.25)",
                }}
              >
                <Award className="h-5 w-5" style={{ color: "#2E9E8F" }} />
              </div>
              <h3 className="font-fraunces font-bold text-lg text-[#FDFBF7] mb-2">
                Certificação digital
              </h3>
              <p className="font-dm text-sm leading-relaxed" style={{ color: "rgba(253,251,247,0.5)" }}>
                Conclua seus cursos e emita certificados digitais da Associação Allos. Cada hora de estudo conta para a sua formação.
              </p>

              {/* Decorative line */}
              <div
                className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at 100% 0%, rgba(46,158,143,0.08) 0%, transparent 70%)",
                }}
              />
            </div>

            {/* Mini ranking */}
            {ranking.length > 0 && (
              <div
                className="rounded-2xl p-4 sm:p-5 mt-4"
                style={{
                  background: "rgba(251,188,5,0.03)",
                  border: "1px solid rgba(251,188,5,0.1)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Trophy style={{ color: "#FBBC05", width: 14, height: 14 }} />
                  <span className="font-dm text-[11px] font-semibold tracking-wider uppercase" style={{ color: "rgba(251,188,5,0.7)" }}>
                    Top participantes da semana
                  </span>
                </div>
                <div className="space-y-1.5">
                  {ranking.map((entry, i) => {
                    const medals = ["#FFD700", "#C0C0C0", "#CD7F32"];
                    const isMedal = i < 3;
                    return (
                      <div key={entry.nome} className="flex items-center gap-2.5">
                        <span
                          className="font-fraunces font-bold text-xs w-5 text-center"
                          style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.25)" }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="font-dm text-xs flex-1 truncate"
                          style={{ color: "rgba(253,251,247,0.6)" }}
                        >
                          {entry.nome}
                        </span>
                        <span
                          className="font-dm text-[11px] font-bold"
                          style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.3)" }}
                        >
                          {entry.horas}h
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none z-10"
        style={{ background: "linear-gradient(to bottom,transparent,#111111)" }}
      />
    </section>
  );
}
