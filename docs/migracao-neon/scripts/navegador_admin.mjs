// Abre telas do app num Chromium de verdade, logado como admin, contra o backend novo,
// e registra erros de console/rede e uma captura de cada tela.
//   node navegador_admin.mjs [baseDoApp] [pastaDasCapturas]
// Precisa do pacote playwright (rodar com NODE_PATH apontando para onde ele está).
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(process.env.NODE_PATH ? `${process.env.NODE_PATH}/playwright` : 'playwright');

const APP = process.argv[2] || 'http://localhost:3100';
const OUT = process.argv[3] || 'C:/Users/gabri/.allos-migracao/capturas';
mkdirSync(OUT, { recursive: true });
const GW = 'https://sb-gateway-production-1dca.up.railway.app';
const env = readFileSync('C:/Users/gabri/Allos-formacao/.env.local', 'utf8');
const SR = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const h = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };

const link = await (await fetch(`${GW}/auth/v1/admin/generate_link`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'magiclink', email: 'gabriel_20angelo@hotmail.com' }) })).json();
const tokens = await (await fetch(`${GW}/auth/v1/verify`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token }) })).json();
if (!tokens.access_token) throw new Error('sem sessão: ' + JSON.stringify(tokens).slice(0, 200));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const problemas = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problemas.push(`console: ${m.text().slice(0, 160)}`); });
page.on('response', (r) => { if (r.status() >= 400) problemas.push(`${r.status()} ${r.url().replace(GW, '[gw]').slice(0, 150)}`); });
page.on('console', () => {});

await page.goto(`${APP}/formacao`, { waitUntil: 'domcontentloaded' });
const r = await page.evaluate(async (t) => (await fetch('/formacao/auth/set-session', { method: 'POST', headers: { 'content-type': 'application/json', 'x-allos-auth': '1' }, body: JSON.stringify(t) })).status,
  { access_token: tokens.access_token, refresh_token: tokens.refresh_token });
const auth = (await ctx.cookies()).filter((c) => c.name.includes('-auth-token') && !c.name.endsWith('-code-verifier')).map((c) => ({ name: c.name, value: c.value }));
await page.evaluate((v) => localStorage.setItem('sb-auth-cookies', JSON.stringify(v)), auth);
console.log('set-session', r, 'cookies', auth.map((c) => c.name).join(','));

for (const p of ['/formacao', '/formacao/admin', '/formacao/admin/cursos', '/formacao/admin/alunos', '/formacao/admin/certificados', '/formacao/meus-cursos']) {
  const antes = problemas.length;
  const t = Date.now();
  await page.goto(`${APP}${p}`, { waitUntil: 'networkidle', timeout: 120000 }).catch((e) => problemas.push(`goto ${p}: ${e.message.slice(0, 80)}`));
  await page.waitForTimeout(1500);
  const texto = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 140);
  const nome = p.replace(/\//g, '_') || 'raiz';
  await page.screenshot({ path: `${OUT}/${nome}.png` });
  console.log(`${p} [${Date.now() - t}ms] url=${page.url().replace(APP, '')} | ${texto}`);
  for (const x of problemas.slice(antes)) console.log('   ⚠', x);
}
await browser.close();
