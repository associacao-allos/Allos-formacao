"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { generateCertificateCode } from "@/lib/utils/certificate";
import { formatDuration } from "@/lib/utils/format";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { Award, Download } from "lucide-react";
import type { Certificate, Course } from "@/types";

function formatDatePtBR(dateStr: string) {
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const d = new Date(dateStr);
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function horasExtenso(h: number): string {
  const unidades = ["", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentas", "trezentas"];
  if (h === 0) return "zero";
  if (h === 1) return "uma";
  if (h < 10) return unidades[h];
  if (h < 20) return teens[h - 10];
  if (h < 100) {
    const d = Math.floor(h / 10);
    const u = h % 10;
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
  }
  if (h === 100) return "cem";
  if (h < 400) {
    const c = Math.floor(h / 100);
    const r = h % 100;
    return r === 0 ? (h === 100 ? "cem" : centenas[c] + "as") : `${centenas[c]} e ${horasExtenso(r)}`;
  }
  return String(h);
}

export default function CertificadoPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user, profile } = useAuth();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [extraHours, setExtraHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function fetch() {
      if (!user) {
        setLoading(false);
        return;
      }
      const client = createClient();

      const { data: courseData } = await client
        .from("courses")
        .select(`*, instructor:profiles!courses_instructor_id_fkey(full_name)`)
        .eq("slug", slug)
        .single();

      if (!courseData || courseData.course_type === "sync" || courseData.is_discontinued) {
        router.push(`/formacao/curso/${slug}`);
        return;
      }

      const isCollection = courseData.course_type === "collection";

      // Collections don't need certificate_enabled flag — they have their own cert logic
      if (!isCollection && !courseData.certificate_enabled) {
        router.push(`/formacao/curso/${slug}`);
        return;
      }
      setCourse(courseData);

      if (isCollection) {
        // Collection certificate logic: count completed lessons and existing certificates
        const certReq = courseData.cert_lessons_required || 10;

        // Get all lesson IDs for this course
        const { data: sectionsData } = await client
          .from("sections")
          .select("id, lessons(id)")
          .eq("course_id", courseData.id);

        const allLessonIds = (sectionsData || []).flatMap(
          (s) => ((s.lessons as { id: string }[]) || []).map((l) => l.id)
        );

        // Count completed lessons
        const { data: progressData } = await client
          .from("lesson_progress")
          .select("lesson_id")
          .eq("user_id", user.id)
          .eq("completed", true)
          .in("lesson_id", allLessonIds.length > 0 ? allLessonIds : ["_none_"]);

        const completedCount = progressData?.length || 0;

        // Count existing certificates for this collection
        const { data: existingCerts } = await client
          .from("certificates")
          .select("id, certificate_code, issued_at")
          .eq("course_id", courseData.id)
          .eq("user_id", user.id)
          .order("issued_at", { ascending: false });

        const issuedCount = existingCerts?.length || 0;
        const certsEarned = Math.floor(completedCount / certReq);
        const available = certsEarned - issuedCount;

        if (available <= 0) {
          const remaining = certReq - (completedCount % certReq);
          toast.error(`Assista mais ${remaining} aula${remaining !== 1 ? "s" : ""} para o próximo certificado.`);
          router.push(`/formacao/curso/${slug}`);
          return;
        }

        // Show the most recent certificate if exists, otherwise allow generation
        if (existingCerts && existingCerts.length > 0) {
          // Set the latest cert for display, but allow generating new ones
          setCertificate(existingCerts[0]);
        }

        setLoading(false);
        return;
      }

      // Standard async course logic
      const { data: existing } = await client
        .from("certificates")
        .select("*")
        .eq("course_id", courseData.id)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        setCertificate(existing);
        setLoading(false);
        return;
      }

      const { data: enrollment } = await client
        .from("enrollments")
        .select("status")
        .eq("course_id", courseData.id)
        .eq("user_id", user.id)
        .single();

      if (!enrollment || enrollment.status !== "completed") {
        toast.error("Complete o curso primeiro.");
        router.push(`/formacao/curso/${slug}`);
        return;
      }

      if (courseData.exam_enabled) {
        const { data: attempts } = await client
          .from("exam_attempts")
          .select("passed")
          .eq("course_id", courseData.id)
          .eq("user_id", user.id)
          .eq("passed", true)
          .limit(1);

        if (!attempts || attempts.length === 0) {
          toast.error("Passe na prova final antes de emitir o certificado.");
          router.push(`/formacao/curso/${slug}/prova`);
          return;
        }
      }

      // Calculate extra hours from completed extra sections
      const { data: sectionsData } = await client
        .from("sections")
        .select("id, is_extra, lessons(id, duration_minutes)")
        .eq("course_id", courseData.id)
        .eq("is_extra", true);

      if (sectionsData && sectionsData.length > 0) {
        const extraLessonIds = sectionsData.flatMap((s) =>
          (s.lessons as { id: string; duration_minutes: number | null }[])?.map((l) => l.id) || []
        );

        if (extraLessonIds.length > 0) {
          const { data: progressData } = await client
            .from("lesson_progress")
            .select("lesson_id")
            .eq("user_id", user.id)
            .eq("completed", true)
            .in("lesson_id", extraLessonIds);

          const completedExtraIds = new Set(progressData?.map((p) => p.lesson_id) || []);

          // Sum hours from fully completed extra sections
          let bonusMinutes = 0;
          for (const section of sectionsData) {
            const lessons = (section.lessons as { id: string; duration_minutes: number | null }[]) || [];
            const allDone = lessons.length > 0 && lessons.every((l) => completedExtraIds.has(l.id));
            if (allDone) {
              bonusMinutes += lessons.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
            }
          }
          setExtraHours(Math.round(bonusMinutes / 60));
        }
      }

      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, [slug, user?.id, router]);

  // Draw certificate on canvas (Allos-site style)
  const drawCertificate = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!profile || !course || !certificate) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = 1684;
      const H = 1190;
      canvas.width = W;
      canvas.height = H;

      // Background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);

      // Top border
      ctx.fillStyle = "#1a3a3a";
      ctx.fillRect(0, 0, W, 12);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(W * 0.4, 0, W * 0.2, 12);

      // Bottom border
      ctx.fillStyle = "#1a3a3a";
      ctx.fillRect(0, H - 12, W, 12);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(W * 0.4, H - 12, W * 0.2, 12);

      // Header
      ctx.textAlign = "center";
      ctx.fillStyle = "#1a3a3a";
      ctx.font = "700 28px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.fillText("ASSOCIAÇÃO ALLOS", W / 2, 110);

      ctx.fillStyle = "#888888";
      ctx.font = "400 16px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.fillText("PSICOLOGIA · FORMAÇÃO · PESQUISA", W / 2, 140);

      // Decorative line with diamond
      const lineY = 165;
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W * 0.25, lineY);
      ctx.lineTo(W / 2 - 12, lineY);
      ctx.moveTo(W / 2 + 12, lineY);
      ctx.lineTo(W * 0.75, lineY);
      ctx.stroke();

      // Diamond
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.moveTo(W / 2, lineY - 6);
      ctx.lineTo(W / 2 + 6, lineY);
      ctx.lineTo(W / 2, lineY + 6);
      ctx.lineTo(W / 2 - 6, lineY);
      ctx.closePath();
      ctx.fill();

      // "CERTIFICADO"
      ctx.fillStyle = "#1a3a3a";
      ctx.font = "300 72px Georgia, 'Times New Roman', serif";
      ctx.fillText("CERTIFICADO", W / 2, 275);

      // "DE CONCLUSÃO"
      ctx.font = "400 22px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.letterSpacing = "8px";
      ctx.fillText("DE CONCLUSÃO", W / 2, 310);

      // "Certificamos que"
      ctx.fillStyle = "#444444";
      ctx.font = "300 22px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.fillText("Certificamos que", W / 2, 380);

      // Name
      ctx.fillStyle = "#c0392b";
      ctx.font = "italic 700 52px Georgia, 'Times New Roman', serif";
      ctx.fillText(profile.full_name, W / 2, 445);

      // Name underline gradient
      const nameWidth = ctx.measureText(profile.full_name).width;
      const grad = ctx.createLinearGradient(W / 2 - nameWidth / 2, 0, W / 2 + nameWidth / 2, 0);
      grad.addColorStop(0, "rgba(192,57,43,0)");
      grad.addColorStop(0.2, "rgba(192,57,43,0.3)");
      grad.addColorStop(0.5, "rgba(192,57,43,0.5)");
      grad.addColorStop(0.8, "rgba(192,57,43,0.3)");
      grad.addColorStop(1, "rgba(192,57,43,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W / 2 - nameWidth / 2 - 30, 460);
      ctx.lineTo(W / 2 + nameWidth / 2 + 30, 460);
      ctx.stroke();

      // Body text
      const baseHours = course.course_type === "collection"
        ? (course.cert_hours_value || 20)
        : (course.certificate_hours || Math.round((course.total_duration_minutes || 0) / 60));
      const hours = course.course_type === "collection" ? baseHours : baseHours + extraHours;
      const extenso = horasExtenso(hours);
      const dateStr = formatDatePtBR(certificate.issued_at);

      let bodyText: string;
      if (course.certificate_body_text) {
        bodyText = course.certificate_body_text
          .replace("{nome}", profile.full_name)
          .replace("{curso}", course.title)
          .replace("{horas}", `${hours} (${extenso})`)
          .replace("{data}", dateStr);
      } else {
        bodyText = `concluiu com aproveitamento o curso "${course.title}", promovido pela Associação Allos, com carga horária total de ${hours} (${extenso}) horas, em ${dateStr}.`;
      }

      // Split body text into lines for canvas (max ~65 chars per line)
      const words = bodyText.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      for (const word of words) {
        if ((currentLine + " " + word).length > 65 && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + " " + word : word;
        }
      }
      if (currentLine) lines.push(currentLine);

      ctx.fillStyle = "#444444";
      ctx.font = "300 20px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      lines.forEach((line, i) => {
        ctx.fillText(line, W / 2, 510 + i * 34);
      });

      // Location/Date
      ctx.fillStyle = "#888888";
      ctx.font = "italic 18px Georgia, 'Times New Roman', serif";
      ctx.fillText(`Belo Horizonte, ${dateStr}`, W / 2, 640);

      // Footer
      ctx.fillStyle = "#aaa";
      ctx.font = "300 12px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      ctx.fillText("Associação Allos", W / 2, H - 30);

      // Load and draw signature
      const drawSignatureFallback = () => {
        const sigY = H - 110;
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(W / 2 - 120, sigY);
        ctx.lineTo(W / 2 + 120, sigY);
        ctx.stroke();
        ctx.fillStyle = "#888";
        ctx.font = "300 14px 'Helvetica Neue', Helvetica, Arial, sans-serif";
        ctx.fillText("Coordenação Allos", W / 2, sigY + 20);
      };

      const sigImg = new Image();
      sigImg.crossOrigin = "anonymous";
      sigImg.src = "/assinatura.jpg";
      sigImg.onload = () => {
        const sx = sigImg.width * 0.36;
        const sy = sigImg.height * 0.58;
        const sw = sigImg.width * 0.40;
        const sh = sigImg.height * 0.38;
        const sigDrawW = W * 0.30;
        const sigDrawH = sigDrawW * (sh / sw);
        const sigX = (W - sigDrawW) / 2;
        const sigY = H - 55 - sigDrawH;

        ctx.drawImage(sigImg, sx, sy, sw, sh, sigX, sigY, sigDrawW, sigDrawH);

        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(W / 2 - 120, sigY + sigDrawH + 5);
        ctx.lineTo(W / 2 + 120, sigY + sigDrawH + 5);
        ctx.stroke();

        ctx.fillStyle = "#888";
        ctx.font = "300 14px 'Helvetica Neue', Helvetica, Arial, sans-serif";
        ctx.fillText("Coordenação Allos", W / 2, sigY + sigDrawH + 25);
      };
      sigImg.onerror = drawSignatureFallback;
    },
    [profile, course, certificate, extraHours]
  );

  // Render canvas when certificate exists
  useEffect(() => {
    if (certificate && canvasRef.current) {
      drawCertificate(canvasRef.current);
    }
  }, [certificate, drawCertificate]);

  function downloadPDF() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imgData = canvas.toDataURL("image/png", 1.0);
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.addImage(imgData, "PNG", 0, 0, 297, 210);
    const safeName = profile?.full_name.replace(/\s+/g, "_") || "Certificado";
    pdf.save(`Certificado_Allos_${safeName}.pdf`);
    toast.success("PDF baixado!");
  }

  async function generateCertificate() {
    if (!user || !course) return;
    setGenerating(true);

    const code = generateCertificateCode();
    const client = createClient();

    const { data, error } = await client
      .from("certificates")
      .insert({
        user_id: user.id,
        course_id: course.id,
        certificate_code: code,
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao gerar certificado. Tente novamente.");
      setGenerating(false);
      return;
    }

    setCertificate(data);
    toast.success("Certificado gerado com sucesso!");
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Not yet generated (or collection with available certs to generate)
  const isCollection = course?.course_type === "collection";
  if (!certificate) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{
            background: "linear-gradient(135deg, rgba(200,75,49,0.12), rgba(163,61,39,0.06))",
            border: "1px solid rgba(200,75,49,0.15)",
          }}
        >
          <Award className="h-10 w-10 text-accent" />
        </div>
        <h1 className="font-fraunces font-bold text-3xl text-cream mb-3 tracking-tight">
          Emitir certificado
        </h1>
        <p className="text-cream/45 mb-8">
          {isCollection
            ? <>Você atingiu o número de aulas necessário em <span className="font-medium text-cream">{course?.title}</span>! Clique abaixo para gerar seu certificado de {course?.cert_hours_value || 20} horas.</>
            : <>Parabéns pela conclusão do curso <span className="font-medium text-cream">{course?.title}</span>! Clique abaixo para gerar seu certificado.</>
          }
        </p>
        <Button size="lg" loading={generating} onClick={generateCertificate}>
          <Award className="h-5 w-5" />
          Gerar meu certificado
        </Button>
      </div>
    );
  }

  // Show certificate
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-fraunces font-bold text-3xl text-cream mb-8 text-center tracking-tight">
        Seu certificado
      </h1>

      {/* Certificate canvas preview */}
      <div className="mb-8 rounded-[16px] overflow-hidden" style={{ border: "2px solid rgba(200,75,49,0.15)" }}>
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{ display: "block" }}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
        <Button onClick={downloadPDF}>
          <Download className="h-4 w-4" />
          Baixar PDF
        </Button>
      </div>

      {/* Google review CTA */}
      <div className="mt-10">
        <a
          href="https://search.google.com/local/writereview?placeid=ChIJRU1omzaXpgARA4UFQLEIq4g"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl p-5 sm:p-6 text-center transition-all hover:-translate-y-0.5 max-w-lg mx-auto"
          style={{
            background: "linear-gradient(135deg, rgba(251,188,5,0.06), rgba(234,67,53,0.04))",
            border: "1px solid rgba(251,188,5,0.15)",
          }}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <p className="font-fraunces font-bold text-lg text-[#FDFBF7]">Gostou da experiência?</p>
          </div>
          <p className="font-dm text-sm mb-4" style={{ color: "rgba(253,251,247,0.4)" }}>
            Avalie a Allos no Google e ajude outras pessoas a nos encontrarem!
          </p>
          <span
            className="font-dm text-sm font-bold inline-flex items-center gap-2 px-5 py-2.5 rounded-xl"
            style={{ background: "linear-gradient(135deg, #FBBC05, #EA4335)", color: "#fff", boxShadow: "0 4px 20px rgba(251,188,5,0.25)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Avaliar no Google
          </span>
        </a>
      </div>
    </div>
  );
}
