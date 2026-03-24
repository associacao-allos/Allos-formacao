import { NextRequest, NextResponse } from 'next/server'

const ALLOS_SITE_URL = process.env.NEXT_PUBLIC_ALLOS_SITE_URL || 'https://allos.org.br'

function getSince(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    case 'semester': return new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1)
    case 'year': return new Date(now.getFullYear(), 0, 1)
    default: { // week
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

    const [subsRes, atRes] = await Promise.all([
      fetch(`${ALLOS_SITE_URL}/api/certificados/admin?type=submissions`, { next: { revalidate: 300 } }),
      fetch(`${ALLOS_SITE_URL}/api/certificados/admin?type=atividades`, { next: { revalidate: 300 } }),
    ])
    if (!subsRes.ok) return NextResponse.json([])

    const subs: { nome_completo: string; atividade_nome: string; created_at: string }[] = await subsRes.json()
    const atividades: { nome: string; carga_horaria: number }[] = atRes.ok ? await atRes.json() : []

    if (!Array.isArray(subs)) return NextResponse.json([])

    const since = getSince(period)
    const horasMap = new Map<string, number>()
    if (Array.isArray(atividades)) atividades.forEach(a => horasMap.set(a.nome.toLowerCase(), a.carga_horaria))

    const filtered = subs.filter(s => new Date(s.created_at) >= since)
    const map = new Map<string, { count: number; horas: number }>()

    filtered.forEach(s => {
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
