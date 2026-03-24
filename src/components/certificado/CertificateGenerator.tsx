'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { jsPDF } from 'jspdf'

interface CertificateData {
  nomeParticipante: string
  atividade: string
  data: string
  dataFim?: string
  tipo?: 'participação' | 'conclusão' | 'supervisão' | 'palestra' | 'organização'
  cargaHoraria?: number
  cargaHorariaExtenso?: string
}

interface CertificateGeneratorProps {
  data: CertificateData
  onReady?: () => void
}

function formatDatePtBR(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ]
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function CertificateGenerator({ data, onReady }: CertificateGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [signatureImg, setSignatureImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    loadImage('/assinatura.jpg').then(setSignatureImg).catch(() => {})
  }, [])

  const drawCertificate = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const name = data.nomeParticipante
    const ch = data.cargaHoraria || 2
    const chExt = data.cargaHorariaExtenso || 'duas'
    const dataInicio = formatDatePtBR(data.data)
    const dataFim = data.dataFim ? formatDatePtBR(data.dataFim) : null
    const dateStr = dataFim && data.dataFim !== data.data ? `${dataInicio} a ${dataFim}` : dataInicio
    const tipo = data.tipo || 'participação'
    const cx = w / 2

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#1a3a3a'
    ctx.fillRect(0, 0, w, 12)
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(w * 0.4, 0, w * 0.2, 12)

    ctx.fillStyle = '#1a3a3a'
    ctx.fillRect(0, h - 12, w, 12)
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(w * 0.4, h - 12, w * 0.2, 12)

    const fm = 40
    ctx.strokeStyle = 'rgba(26,58,58,0.12)'
    ctx.lineWidth = 1
    ctx.strokeRect(fm, fm, w - fm * 2, h - fm * 2)

    ctx.textAlign = 'center'
    ctx.font = '700 28px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = '#1a3a3a'
    ctx.letterSpacing = '8px'
    ctx.fillText('ASSOCIAÇÃO ALLOS', cx, 110)
    ctx.letterSpacing = '0px'

    ctx.font = '400 16px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = '#888888'
    ctx.letterSpacing = '4px'
    ctx.fillText('PSICOLOGIA  ·  FORMAÇÃO  ·  PESQUISA', cx, 140)
    ctx.letterSpacing = '0px'

    const lineW = 120
    ctx.strokeStyle = '#c0392b'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - lineW, 165)
    ctx.lineTo(cx + lineW, 165)
    ctx.stroke()

    ctx.fillStyle = '#c0392b'
    ctx.save()
    ctx.translate(cx, 165)
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-4, -4, 8, 8)
    ctx.restore()

    ctx.font = '300 72px Georgia, "Times New Roman", serif'
    ctx.fillStyle = '#1a3a3a'
    ctx.fillText('CERTIFICADO', cx, 260)

    ctx.font = '400 22px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = '#888888'
    ctx.letterSpacing = '6px'
    ctx.fillText(`DE ${tipo.toUpperCase()}`, cx, 295)
    ctx.letterSpacing = '0px'

    ctx.font = '300 22px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = '#666666'
    ctx.fillText('Certificamos que', cx, 370)

    ctx.font = 'italic 700 52px Georgia, "Times New Roman", serif'
    ctx.fillStyle = '#c0392b'
    ctx.fillText(name, cx, 440)

    const nw = ctx.measureText(name).width
    const nlGrad = ctx.createLinearGradient(cx - nw / 2 - 10, 452, cx + nw / 2 + 10, 452)
    nlGrad.addColorStop(0, 'transparent')
    nlGrad.addColorStop(0.15, 'rgba(192,57,43,0.25)')
    nlGrad.addColorStop(0.85, 'rgba(192,57,43,0.25)')
    nlGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = nlGrad
    ctx.fillRect(cx - nw / 2 - 20, 448, nw + 40, 5)

    const hasRange = dataFim && data.dataFim !== data.data
    const periodoStr = hasRange ? `no período de ${dateStr}` : `em ${dateStr}`

    let bodyLines: string[]
    switch (tipo) {
      case 'conclusão':
        bodyLines = [
          `concluiu a formação em \u201C${data.atividade}\u201D,`,
          `promovida pela Associação Allos, com carga horária total de ${ch} (${chExt}) horas,`,
          `${periodoStr}.`,
        ]
        break
      case 'supervisão':
        bodyLines = [
          `realizou supervisão clínica na modalidade \u201C${data.atividade}\u201D,`,
          `promovida pela Associação Allos, com carga horária de ${ch} (${chExt}) horas,`,
          `${periodoStr}.`,
        ]
        break
      case 'palestra':
        bodyLines = [
          `participou da palestra \u201C${data.atividade}\u201D,`,
          `promovida pela Associação Allos, com duração de ${ch} (${chExt}) horas,`,
          `${hasRange ? periodoStr : `realizada em ${dateStr}`}.`,
        ]
        break
      case 'organização':
        bodyLines = [
          `atuou na organização da atividade \u201C${data.atividade}\u201D,`,
          `promovida pela Associação Allos,`,
          `${hasRange ? periodoStr : `realizada em ${dateStr}`}.`,
        ]
        break
      default:
        bodyLines = [
          `participou da atividade \u201C${data.atividade}\u201D,`,
          `promovida pela Associação Allos, com carga horária de ${ch} (${chExt}) horas,`,
          `${periodoStr}.`,
        ]
    }

    ctx.font = '300 20px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = '#444444'
    bodyLines.forEach((line, i) => {
      ctx.fillText(line, cx, 500 + i * 34)
    })

    const locY = 500 + bodyLines.length * 34 + 30
    ctx.font = 'italic 18px Georgia, "Times New Roman", serif'
    ctx.fillStyle = '#999999'
    ctx.fillText(`Belo Horizonte, ${dataFim || dataInicio}`, cx, locY)

    if (signatureImg) {
      const iw = signatureImg.naturalWidth
      const ih = signatureImg.naturalHeight
      const sx = Math.round(iw * 0.36)
      const sy = Math.round(ih * 0.58)
      const sw = Math.round(iw * 0.40)
      const sh = Math.round(ih * 0.38)
      const sigDrawW = w * 0.30
      const sigDrawH = sigDrawW * (sh / sw)
      const sigX = cx - sigDrawW / 2
      const sigY = h - 55 - sigDrawH
      ctx.drawImage(signatureImg, sx, sy, sw, sh, sigX, sigY, sigDrawW, sigDrawH)
    }
  }, [data, signatureImg])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = 1684
    const h = 1190
    canvas.width = w
    canvas.height = h
    drawCertificate(ctx, w, h)
    onReady?.()
  }, [data, drawCertificate, onReady])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = pdf.internal.pageSize.getHeight()
    const imgData = canvas.toDataURL('image/png', 1.0)
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
    pdf.save(`Certificado_Allos_${data.nomeParticipante.replace(/\s+/g, '_')}.pdf`)
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <canvas ref={canvasRef} className="w-full h-auto" style={{ maxWidth: '100%', display: 'block' }} />
      </div>
      <button
        onClick={handleDownload}
        className="w-full font-dm font-bold text-sm py-4 rounded-xl transition-all duration-300 hover:-translate-y-0.5 inline-flex items-center justify-center gap-2"
        style={{ backgroundColor: '#C84B31', color: '#FFFFFF', boxShadow: '0 4px 20px rgba(200,75,49,0.35)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Baixar Certificado (PDF)
      </button>
    </div>
  )
}
