// POST /formacao/api/auth-email
//
// Carteiro do login. Na Supabase, os e-mails de confirmar cadastro e de trocar
// a senha saíam do mailer dela, com os modelos guardados no painel. Desde a
// saída da Supabase (09/2026) o login roda num GoTrue próprio na Railway, que
// não tem carteiro: ele chama esta rota (Send Email Hook) e o e-mail sai pela
// mesma Gmail API que já manda os avisos da Formação.
//
// Quem chama assina no padrão Standard Webhooks com o segredo
// SEND_EMAIL_HOOK_SECRET ("v1,whsec_<base64>", o mesmo configurado no GoTrue
// em GOTRUE_HOOK_SEND_EMAIL_SECRETS). Sem assinatura válida, nada sai.

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendMail, workspaceConfigurado } from "@/lib/email/googleWorkspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Janela aceita entre o carimbo de hora do webhook e agora.
const TOLERANCIA_SEGUNDOS = 5 * 60;

type Payload = {
  user?: { email?: string; user_metadata?: Record<string, unknown> };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
};

function erro(status: number, message: string) {
  // Formato que o GoTrue entende e repassa a quem pediu o e-mail.
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}

function assinaturaConfere(corpo: string, headers: Headers, segredo: string): boolean {
  const id = headers.get("webhook-id");
  const carimbo = headers.get("webhook-timestamp");
  const assinaturas = headers.get("webhook-signature");
  if (!id || !carimbo || !assinaturas) return false;

  const segundos = Number(carimbo);
  if (!Number.isFinite(segundos)) return false;
  if (Math.abs(Date.now() / 1000 - segundos) > TOLERANCIA_SEGUNDOS) return false;

  const chave = Buffer.from(segredo.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", chave).update(`${id}.${carimbo}.${corpo}`).digest();

  // O cabeçalho pode trazer várias assinaturas separadas por espaço ("v1,<b64> v1,<b64>").
  return assinaturas.split(" ").some((item) => {
    const [versao, valor] = item.split(",");
    if (versao !== "v1" || !valor) return false;
    const recebida = Buffer.from(valor, "base64");
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  });
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Modelo = { assunto: string; abertura: string; botao: string; fecho: string };

const MODELOS: Record<string, Modelo> = {
  signup: {
    assunto: "Confirme seu cadastro na Allos Formação",
    abertura: "Falta um passo para ativar sua conta na Allos Formação: confirmar que este e-mail é seu.",
    botao: "Confirmar meu e-mail",
    fecho: "Se você não criou uma conta na Allos, pode ignorar esta mensagem.",
  },
  recovery: {
    assunto: "Troque sua senha da Allos Formação",
    abertura: "Recebemos um pedido para trocar a senha da sua conta na Allos Formação.",
    botao: "Criar uma senha nova",
    fecho: "Se não foi você quem pediu, ignore esta mensagem: sua senha atual continua valendo.",
  },
  magiclink: {
    assunto: "Seu link de acesso à Allos Formação",
    abertura: "Use o botão abaixo para entrar na Allos Formação.",
    botao: "Entrar",
    fecho: "Se você não pediu este link, pode ignorar esta mensagem.",
  },
  email_change: {
    assunto: "Confirme seu novo e-mail na Allos Formação",
    abertura: "Recebemos um pedido para trocar o e-mail da sua conta na Allos Formação.",
    botao: "Confirmar o novo e-mail",
    fecho: "Se não foi você quem pediu, responda esta mensagem para avisar a equipe.",
  },
  invite: {
    assunto: "Seu convite para a Allos Formação",
    abertura: "Você foi convidado para a Allos Formação.",
    botao: "Aceitar o convite",
    fecho: "Se não esperava este convite, pode ignorar esta mensagem.",
  },
};

export async function POST(request: NextRequest) {
  const segredo = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!segredo) return erro(500, "SEND_EMAIL_HOOK_SECRET ausente");

  const corpo = await request.text();
  if (!assinaturaConfere(corpo, request.headers, segredo)) {
    return erro(401, "Assinatura do webhook inválida");
  }

  let payload: Payload;
  try {
    payload = JSON.parse(corpo);
  } catch {
    return erro(400, "Corpo inválido");
  }

  const para = payload.user?.email;
  const dados = payload.email_data;
  const tipo = dados?.email_action_type || "";
  const modelo = MODELOS[tipo];

  // reauthentication manda só o código, sem link; o app não usa.
  if (!para || !dados?.token_hash || !modelo) {
    return erro(400, `E-mail de login não suportado: ${tipo || "sem tipo"}`);
  }
  if (!workspaceConfigurado()) return erro(500, "Envio de e-mail não configurado");

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const link =
    `${base}/auth/v1/verify?token=${encodeURIComponent(dados.token_hash)}` +
    `&type=${encodeURIComponent(tipo)}` +
    (dados.redirect_to ? `&redirect_to=${encodeURIComponent(dados.redirect_to)}` : "");

  const nome = String(payload.user?.user_metadata?.full_name || "").trim().split(/\s+/)[0] || "";
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";

  const texto = [saudacao, "", modelo.abertura, "", `${modelo.botao}: ${link}`, "", modelo.fecho, "", "Allos"].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:520px">
<p style="margin:0 0 12px">${escapar(saudacao)}</p>
<p style="margin:0 0 20px">${escapar(modelo.abertura)}</p>
<p style="margin:0 0 20px"><a href="${escapar(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">${escapar(modelo.botao)}</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#555">Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all">${escapar(link)}</span></p>
<p style="margin:0 0 12px;font-size:13px;color:#555">${escapar(modelo.fecho)}</p>
<p style="margin:0">Allos</p>
</div>`;

  try {
    await sendMail({ para, assunto: modelo.assunto, texto, html });
  } catch (e) {
    console.error("[auth-email] falha ao enviar:", e);
    return erro(502, "Não foi possível enviar o e-mail agora");
  }

  return NextResponse.json({});
}
