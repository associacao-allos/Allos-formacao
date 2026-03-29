import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = await createServiceRoleClient()

    // Check visibility
    const { data: config } = await sb.from('formacao_cronograma').select('grupos_visiveis, duracao_minutos').limit(1).single()
    if (config && config.grupos_visiveis === false) {
      return NextResponse.json({ visivel: false, horarios: [], slots: [], atividades: [] })
    }

    // Fetch data in parallel
    const [horariosRes, slotsRes, atividadesRes] = await Promise.all([
      sb.from('formacao_horarios').select('*').eq('ativo', true).order('ordem'),
      sb.from('formacao_slots').select('*, formacao_horarios(hora, ordem)').eq('ativo', true),
      sb.from('certificado_atividades').select('id, nome, descricao').eq('ativo', true),
    ])

    return NextResponse.json({
      visivel: true,
      duracao_minutos: config?.duracao_minutos || 120,
      horarios: horariosRes.data || [],
      slots: slotsRes.data || [],
      atividades: atividadesRes.data || [],
    })
  } catch (e) {
    console.error('sync-groups error:', e)
    return NextResponse.json({ visivel: false, horarios: [], slots: [], atividades: [] })
  }
}
