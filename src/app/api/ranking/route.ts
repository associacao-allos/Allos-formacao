import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

function getSince(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    case 'semester': return new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1)
    case 'year': return new Date(now.getFullYear(), 0, 1)
    default: {
      const d = new Date(now)
      d.setDate(d.getDate() - d.getDay() + 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get('period') || 'week'
    const sb = await createServiceRoleClient()

    const [subsRes, atRes] = await Promise.all([
      sb.from('certificado_submissions').select('nome_completo, atividade_nome, created_at'),
      sb.from('certificado_atividades').select('nome, carga_horaria'),
    ])

    if (subsRes.error || !Array.isArray(subsRes.data)) return NextResponse.json([])

    const since = getSince(period)
    const horasMap = new Map<string, number>()
    if (Array.isArray(atRes.data)) atRes.data.forEach((a: { nome: string; carga_horaria: number }) => horasMap.set(a.nome.toLowerCase(), a.carga_horaria))

    const filtered = subsRes.data.filter((s: { created_at: string }) => new Date(s.created_at) >= since)
    const map = new Map<string, { count: number; horas: number }>()

    filtered.forEach((s: { nome_completo: string; atividade_nome: string }) => {
      const nome = s.nome_completo.trim()
      const e = map.get(nome) || { count: 0, horas: 0 }
      e.count++
      e.horas += horasMap.get(s.atividade_nome?.toLowerCase()) || 2
      map.set(nome, e)
    })

    const ranked = Array.from(map.entries())
      .map(([nome, d]) => ({ nome, count: d.count, horas: d.horas }))
      .sort((a, b) => b.horas - a.horas || b.count - a.count)
      .slice(0, 5)

    return NextResponse.json(ranked)
  } catch {
    return NextResponse.json([])
  }
}
