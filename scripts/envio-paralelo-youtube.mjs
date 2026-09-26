// Envio paralelo ao YouTube dos jobs de UM curso na fila formacao_clip_jobs.
//
// Uso (rodar DENTRO do contêiner, a linha de casa satura em ~19 Mbps):
//   railway ssh -s Allos-formacao -- "echo <base64> | base64 -d > /tmp/e.mjs && setsid nohup node /tmp/e.mjs <curso_id> 3 > /tmp/e.log 2>&1 < /dev/null &"
// Os jobs precisam estar na fila antes (acao publicar, trocar_fonte).
// ⛔ 3 envios simultâneos: com 6 o YouTube devolve 503 em quase todo pedaço.
//
// Segue o contrato de subirParaYoutube (src/lib/meet/clipes.ts): reserva o job
// com trabalhando_desde, grava youtube_upload_url e bytes enviados a cada
// pedaço (se este processo morrer, o cron retoma a mesma sessão depois de 15
// min de trava vencida) e, ao terminar, troca a fonte da aula e fecha o job.
//
// Pega da ponta NOVA da fila; o cron pega da ponta velha. Assim os dois não
// disputam o mesmo job.

import fs from "node:fs";

// No contêiner da Railway as chaves já estão no ambiente; no PC, no .env.local.
const ENV_LOCAL = "C:/Users/gabri/Allos-formacao/.env.local";
const env = fs.existsSync(ENV_LOCAL)
  ? Object.fromEntries(
      fs.readFileSync(ENV_LOCAL, "utf8")
        .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
    )
  : process.env;
const SB = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const CURSO = process.argv[2];
// Aceita vários cursos separados por vírgula: os 3 envios se repartem entre eles.
if (!CURSO) { console.error("uso: node envio-paralelo-youtube.mjs <curso_id[,curso_id...]> [envios=3]"); process.exit(1); }
const WORKERS = Number(process.argv[3] || 3);
const PEDACO = 32 * 1024 * 1024; // múltiplo de 256 KB
const LOCK_MIN = 15;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sb(path, opts = {}) {
  for (let t = 0; ; t++) {
    try {
      const r = await fetch(`${SB}/rest/v1/${path}`, {
        ...opts,
        headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers || {}) },
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(`supabase ${r.status}: ${txt.slice(0, 200)}`);
      return txt ? JSON.parse(txt) : null;
    } catch (e) {
      if (t >= 4) throw e;
      await sleep(2000 * (t + 1));
    }
  }
}

// ── token do Google, renovado antes de vencer ──
let token = null, tokenAte = 0, refresh = null;
async function getToken(forcar = false) {
  if (!forcar && token && Date.now() < tokenAte) return token;
  if (!refresh) refresh = (await sb("formacao_meet_credenciais?select=refresh_token"))[0].refresh_token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_MEET_CLIENT_ID, client_secret: env.GOOGLE_MEET_CLIENT_SECRET, refresh_token: refresh, grant_type: "refresh_token" }),
  }).then((r) => r.json());
  if (!r.access_token) throw new Error("token: " + JSON.stringify(r));
  token = r.access_token;
  tokenAte = Date.now() + (r.expires_in - 300) * 1000;
  return token;
}

class CotaAcabou extends Error {}

// ── reserva: só pega job livre, e marca como seu na mesma requisição ──
async function reservar() {
  const limite = new Date(Date.now() - LOCK_MIN * 60_000).toISOString();
  const livres = await sb(
    `formacao_clip_jobs?select=id,titulo,drive_file_id,lesson_id,youtube_upload_url,youtube_bytes_enviados,youtube_bytes_total,youtube_tentativas` +
    `&curso_id=in.(${CURSO})&status=in.(pendente,subindo)&video_url_envio=is.null&drive_file_id=not.is.null&somente_drive=eq.false` +
    `&or=(trabalhando_desde.is.null,trabalhando_desde.lt.${limite})&order=created_at.desc&limit=5`
  );
  for (const j of livres) {
    const agora = new Date().toISOString();
    // PATCH condicional: se o cron pegou entre o select e aqui, volta vazio.
    const r = await sb(
      `formacao_clip_jobs?id=eq.${j.id}&or=(trabalhando_desde.is.null,trabalhando_desde.lt.${limite})`,
      { method: "PATCH", body: JSON.stringify({ status: "subindo", trabalhando_desde: agora }) }
    );
    if (r?.length) return j;
  }
  return null;
}

async function abrirSessao(titulo, total) {
  const r = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Length": String(total),
      "X-Upload-Content-Type": "video/*",
    },
    body: JSON.stringify({
      snippet: { title: titulo.slice(0, 100), description: `${titulo}\n\nVídeo não listado: só quem tem o link assiste.`.slice(0, 5000), categoryId: "27" },
      status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
    }),
  });
  if (!r.ok) {
    const corpo = await r.text();
    if (/quotaexceeded|uploadlimitexceeded/i.test(corpo) || r.status === 429) throw new CotaAcabou(corpo.slice(0, 300));
    throw new Error(`abrir sessão ${r.status}: ${corpo.slice(0, 300)}`);
  }
  return r.headers.get("location");
}

async function progresso(url, total) {
  const r = await fetch(url, { method: "PUT", headers: { Authorization: `Bearer ${await getToken()}`, "Content-Range": `bytes */${total}` } });
  if (r.status === 200 || r.status === 201) return { fim: true, videoId: (await r.json()).id };
  if (r.status === 308) {
    const range = r.headers.get("range");
    return { fim: false, prox: range ? Number(range.split("-")[1]) + 1 : 0 };
  }
  if (r.status === 404 || r.status === 410) return { expirou: true };
  throw new Error(`progresso ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function baixarPedaco(fileId, ini, fim) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${await getToken()}`, Range: `bytes=${ini}-${fim}` },
  });
  if (r.status !== 206 && r.status !== 200) throw new Error(`drive ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length !== fim - ini + 1) throw new Error(`drive devolveu ${b.length} bytes, esperava ${fim - ini + 1}`);
  return b;
}

async function enviarPedaco(url, buf, ini, total) {
  const fim = ini + buf.length - 1;
  const r = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${await getToken()}`, "Content-Length": String(buf.length), "Content-Range": `bytes ${ini}-${fim}/${total}` },
    body: buf,
  });
  if (r.status === 200 || r.status === 201) return { fim: true, videoId: (await r.json()).id };
  if (r.status === 308) {
    const range = r.headers.get("range");
    return { fim: false, prox: range ? Number(range.split("-")[1]) + 1 : 0 };
  }
  throw new Error(`envio ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function tamanho(fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=size&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await getToken()}` } });
  return Number((await r.json()).size);
}

async function subir(job, w) {
  const nome = job.titulo.split(" · ")[1] || job.titulo;
  let url = job.youtube_upload_url, total = job.youtube_bytes_total || 0, pos = 0;

  if (url) {
    const p = await progresso(url, total);
    if (p.expirou) url = null;
    else if (p.fim) return concluir(job, p.videoId, total, w);
    else pos = p.prox;
  }
  if (!url) {
    total = await tamanho(job.drive_file_id);
    url = await abrirSessao(job.titulo, total);
    pos = 0;
    await sb(`formacao_clip_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ youtube_upload_url: url, youtube_bytes_total: total, youtube_bytes_enviados: 0 }) });
  }
  log(`[w${w}] ${nome}: ${(total / 1e6).toFixed(0)} MB, começando em ${(pos / total * 100).toFixed(0)}%`);

  const t0 = Date.now(), pos0 = pos;
  let falhas = 0;
  while (true) {
    try {
      const fim = Math.min(pos + PEDACO, total) - 1;
      const buf = await baixarPedaco(job.drive_file_id, pos, fim);
      const r = await enviarPedaco(url, buf, pos, total);
      if (r.fim) return concluir(job, r.videoId, total, w);
      pos = r.prox;
      falhas = 0;
      await sb(`formacao_clip_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ youtube_bytes_enviados: pos, youtube_erro: null, trabalhando_desde: new Date().toISOString() }),
      });
      const mbps = ((pos - pos0) * 8 / 1e6 / ((Date.now() - t0) / 1000)).toFixed(0);
      if (Math.floor(pos / total * 10) !== Math.floor((pos - PEDACO) / total * 10)) log(`[w${w}] ${nome}: ${(pos / total * 100).toFixed(0)}% (${mbps} Mbps)`);
    } catch (e) {
      falhas++;
      log(`[w${w}] ${nome}: falha ${falhas} (${e.message.slice(0, 120)})`);
      // 503 do YouTube é "volte mais tarde", não "desista": soltar o vídeo e
      // abrir outro só aumenta a concorrência que provocou a recusa.
      if (falhas >= 25) throw e;
      await sleep(Math.min(120_000, 5000 * 2 ** Math.min(falhas, 5)) + Math.random() * 5000);
      // Mantém a trava viva durante a espera, para o cron não pegar o job.
      await sb(`formacao_clip_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ trabalhando_desde: new Date().toISOString() }) }).catch(() => {});
      if (/401/.test(e.message)) await getToken(true);
      const p = await progresso(url, total).catch(() => null);
      if (p?.fim) return concluir(job, p.videoId, total, w);
      if (p?.expirou) throw new Error("sessão de envio expirou");
      if (p) pos = p.prox;
    }
  }
}

async function concluir(job, videoId, total, w) {
  const link = `https://www.youtube.com/watch?v=${videoId}`;
  const agora = new Date().toISOString();
  await sb(`lessons?id=eq.${job.lesson_id}`, { method: "PATCH", body: JSON.stringify({ video_url: link, video_source: "youtube" }) });
  // Aula que aponta para o MESMO arquivo do Drive troca junto. No Aprimoramento
  // Clínico (Acervo) cada gravação está ligada a dois encontros seguidos: subir
  // duas vezes criaria vídeo duplicado no canal, e trocar só uma deixaria a
  // outra pedindo acesso ao Drive.
  if (job.drive_file_id) {
    await sb(`lessons?video_source=eq.google_drive&video_url=like.*${job.drive_file_id}*`, { method: "PATCH", body: JSON.stringify({ video_url: link, video_source: "youtube" }) });
  }
  await sb(`formacao_clip_jobs?id=eq.${job.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      fonte_trocada_em: agora, youtube_video_id: videoId, video_url_envio: link, youtube_bytes_enviados: total,
      youtube_erro: null, status: "publicado", concluido_em: agora, trabalhando_desde: null,
    }),
  });
  log(`[w${w}] ✔ ${job.titulo.split(" · ")[1]} → ${link} (aula trocada)`);
}

let cotaAcabou = false;
async function trabalhador(w) {
  await sleep(w * 4000); // não reservar os três no mesmo instante
  while (!cotaAcabou) {
    const job = await reservar();
    if (!job) { log(`[w${w}] nada livre na fila, encerrando`); return; }
    try {
      await subir(job, w);
    } catch (e) {
      // Libera o job sem queimar tentativa: o cron retoma a mesma sessão.
      await sb(`formacao_clip_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "pendente", trabalhando_desde: null, youtube_erro: `envio paralelo: ${e.message.slice(0, 300)}` }),
      }).catch(() => {});
      if (e instanceof CotaAcabou) { cotaAcabou = true; log(`[w${w}] ⛔ COTA DO YOUTUBE ACABOU: ${e.message}`); return; }
      log(`[w${w}] ✖ ${job.titulo}: ${e.message}`);
    }
  }
}

await getToken();
log(`iniciando ${WORKERS} envios paralelos`);
await Promise.all(Array.from({ length: WORKERS }, (_, i) => trabalhador(i + 1)));
log("fim");
