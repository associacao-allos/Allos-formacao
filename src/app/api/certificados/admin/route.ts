import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const sb = await createServiceRoleClient();
    const type = req.nextUrl.searchParams.get("type");

    if (type === "submissions") {
      const { data, error } = await sb
        .from("certificado_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "atividades") {
      const { data, error } = await sb
        .from("certificado_atividades")
        .select("*")
        .order("nome");
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "condutores") {
      const { data, error } = await sb
        .from("certificado_condutores")
        .select("*")
        .order("nome");
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: "Invalid type parameter" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createServiceRoleClient();
    const body = await req.json();
    const { action } = body;

    // --- Atividades ---

    if (action === "create_atividade") {
      const { data, error } = await sb
        .from("certificado_atividades")
        .insert({ nome: body.nome, carga_horaria: body.carga_horaria ?? 2 })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "update_atividade") {
      const updates: Record<string, unknown> = {};
      if (body.nome !== undefined) updates.nome = body.nome;
      if (body.carga_horaria !== undefined) updates.carga_horaria = body.carga_horaria;
      if (body.descricao !== undefined) updates.descricao = body.descricao;
      const { data, error } = await sb
        .from("certificado_atividades")
        .update(updates)
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "toggle_atividade") {
      const { data, error } = await sb
        .from("certificado_atividades")
        .update({ ativo: body.ativo })
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "delete_atividade") {
      const { error } = await sb
        .from("certificado_atividades")
        .delete()
        .eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- Condutores ---

    if (action === "create_condutor") {
      const { data, error } = await sb
        .from("certificado_condutores")
        .insert({ nome: body.nome })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "update_condutor") {
      const updates: Record<string, unknown> = {};
      if (body.nome !== undefined) updates.nome = body.nome;
      if (body.telefone !== undefined) updates.telefone = body.telefone;
      if (body.observacoes !== undefined) updates.observacoes = body.observacoes;
      const { data, error } = await sb
        .from("certificado_condutores")
        .update(updates)
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "toggle_condutor") {
      const { data, error } = await sb
        .from("certificado_condutores")
        .update({ ativo: body.ativo })
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "delete_condutor") {
      const { error } = await sb
        .from("certificado_condutores")
        .delete()
        .eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- Submissions ---

    if (action === "import_submission") {
      const { data, error } = await sb
        .from("certificado_submissions")
        .insert({
          nome_completo: body.nome_completo,
          email: body.email,
          atividade_nome: body.atividade_nome,
          nota_grupo: body.nota_grupo ?? 0,
          nota_condutor: body.nota_condutor ?? 0,
          condutores: body.condutores ?? [],
          relato: body.relato,
        })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "delete_submissions") {
      const { error } = await sb
        .from("certificado_submissions")
        .delete()
        .in("id", body.ids);
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- Sync ---

    if (action === "sync_condutores") {
      const { data: submissions, error: subErr } = await sb
        .from("certificado_submissions")
        .select("condutores");
      if (subErr) throw subErr;

      const { data: existing, error: exErr } = await sb
        .from("certificado_condutores")
        .select("nome");
      if (exErr) throw exErr;

      const existingNames = new Set(existing?.map((c) => c.nome) ?? []);
      const uniqueNames = new Set<string>();

      for (const sub of submissions ?? []) {
        const condutores = sub.condutores;
        if (Array.isArray(condutores)) {
          for (const name of condutores) {
            if (typeof name === "string" && name.trim() && !existingNames.has(name)) {
              uniqueNames.add(name);
            }
          }
        }
      }

      let added = 0;
      for (const nome of Array.from(uniqueNames)) {
        const { error } = await sb
          .from("certificado_condutores")
          .insert({ nome });
        if (!error) added++;
      }

      return NextResponse.json(
        { success: true, added },
        { headers: corsHeaders }
      );
    }

    if (action === "sync_atividades") {
      const { data: submissions, error: subErr } = await sb
        .from("certificado_submissions")
        .select("atividade_nome");
      if (subErr) throw subErr;

      const { data: existing, error: exErr } = await sb
        .from("certificado_atividades")
        .select("nome");
      if (exErr) throw exErr;

      const existingNames = new Set(existing?.map((a) => a.nome) ?? []);
      const uniqueNames = new Set<string>();

      for (const sub of submissions ?? []) {
        const name = sub.atividade_nome;
        if (typeof name === "string" && name.trim() && !existingNames.has(name)) {
          uniqueNames.add(name);
        }
      }

      let added = 0;
      for (const nome of Array.from(uniqueNames)) {
        const { error } = await sb
          .from("certificado_atividades")
          .insert({ nome, ativo: false });
        if (!error) added++;
      }

      return NextResponse.json(
        { success: true, added },
        { headers: corsHeaders }
      );
    }

    // --- Hours & Certificates ---

    if (action === "get_hours") {
      const { data: submissions, error: subErr } = await sb
        .from("certificado_submissions")
        .select("atividade_nome, created_at")
        .ilike("nome_completo", `%${body.nome.trim()}%`)
        .or("certificado_resgatado.is.null,certificado_resgatado.eq.false")
        .order("created_at", { ascending: true });
      if (subErr) throw subErr;

      const { data: atividades, error: atvErr } = await sb
        .from("certificado_atividades")
        .select("nome, carga_horaria");
      if (atvErr) throw atvErr;

      const horasMap: Record<string, number> = {};
      for (const atv of atividades ?? []) {
        horasMap[atv.nome.toLowerCase()] = atv.carga_horaria;
      }

      const porAtividadeMap: Record<
        string,
        { count: number; horas: number; dataInicio: string; dataFim: string }
      > = {};

      for (const sub of submissions ?? []) {
        const nome = sub.atividade_nome;
        const carga = horasMap[nome.toLowerCase()] ?? horasMap[nome] ?? 2;
        const date = sub.created_at;

        if (!porAtividadeMap[nome]) {
          porAtividadeMap[nome] = {
            count: 0,
            horas: 0,
            dataInicio: date,
            dataFim: date,
          };
        }

        porAtividadeMap[nome].count++;
        porAtividadeMap[nome].horas += carga;
        porAtividadeMap[nome].dataFim = date;
      }

      const porAtividade = Object.entries(porAtividadeMap).map(
        ([nome, info]) => ({
          nome,
          ...info,
        })
      );

      const totalHoras = porAtividade.reduce((sum, a) => sum + a.horas, 0);

      return NextResponse.json(
        {
          totalHoras,
          horasRestantes: Math.max(0, 20 - totalHoras),
          liberado: totalHoras >= 20,
          porAtividade,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "claim_certificates") {
      const { error } = await sb
        .from("certificado_submissions")
        .update({ certificado_resgatado: true })
        .ilike("nome_completo", `%${body.nome.trim()}%`)
        .or("certificado_resgatado.is.null,certificado_resgatado.eq.false");
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
