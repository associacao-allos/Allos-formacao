// Teste de ponta a ponta do app contra o backend novo, com um usuário temporário.
//   node e2e_app.mjs [baseDoApp]   (padrão http://localhost:3100)
// Cria um usuário admin descartável, entra com senha, passa pela ponte set-session,
// abre páginas protegidas e rotas de API, e apaga o usuário no fim.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/gabri/Allos-formacao/package.json');
const { createClient } = require('@supabase/supabase-js');

const APP = process.argv[2] || 'http://localhost:3100';
const GW = 'https://sb-gateway-production-1dca.up.railway.app';
const env = readFileSync('C:/Users/gabri/Allos-formacao/.env.local', 'utf8');
const pega = (n) => env.match(new RegExp(`^${n}=(.+)$`, 'm'))[1].trim();
const ANON = pega('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE = pega('SUPABASE_SERVICE_ROLE_KEY');

const admin = createClient(GW, SERVICE, { auth: { persistSession: false } });
const email = `teste-migracao-${Date.now()}@allos.invalid`;
const senha = 'Teste-' + Math.random().toString(36).slice(2) + '!9';
const res = [];
const ok = (nome, cond, extra = '') => { res.push(cond); console.log(`${cond ? 'OK ' : 'FALHA'} ${nome} ${extra}`); };

let userId;
try {
  const { data: criado, error: e1 } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { full_name: 'Teste Migração' } });
  if (e1) throw e1;
  userId = criado.user.id;
  const { data: perfil } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle();
  ok('trigger cria profile', !!perfil, JSON.stringify(perfil));
  await admin.from('profiles').update({ role: 'admin' }).eq('id', userId);

  const pub = createClient(GW, ANON, { auth: { persistSession: false } });
  const { data: login, error: e2 } = await pub.auth.signInWithPassword({ email, password: senha });
  ok('login com senha', !e2 && !!login.session, e2?.message || '');

  const r1 = await fetch(`${APP}/formacao/auth/set-session`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-allos-auth': '1' },
    body: JSON.stringify({ access_token: login.session.access_token, refresh_token: login.session.refresh_token }),
  });
  const setCookies = r1.headers.getSetCookie();
  ok('set-session', r1.ok, `${r1.status} ${setCookies.map((c) => c.split('=')[0]).join(',')}`);
  ok('cookie com nome fixo', setCookies.some((c) => c.startsWith('sb-formacao-auth-token')));
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');

  const r0 = await fetch(`${APP}/formacao/admin`, { redirect: 'manual' });
  ok('admin sem login redireciona', r0.status === 307, `${r0.status} → ${r0.headers.get('location')}`);

  for (const p of ['/formacao/admin', '/formacao/admin/cursos', '/formacao/meus-cursos', '/formacao/associados']) {
    const t = Date.now();
    const r = await fetch(`${APP}${p}`, { headers: { cookie }, redirect: 'manual' });
    const loc = r.headers.get('location') || '';
    ok(`página ${p}`, r.status === 200 || (p === '/formacao/associados' && r.status === 307 && !loc.includes('/formacao/auth')), `${r.status} ${loc} ${Date.now() - t}ms`);
  }

  const hd = await fetch(`${APP}/formacao/api/home-data`);
  const hj = await hd.json().catch(() => ({}));
  ok('home-data', hd.ok && (hj.courses?.length || 0) > 0, `${hd.status} cursos=${hj.courses?.length}`);

  const sess = await fetch(`${APP}/formacao/auth/session`, { headers: { cookie } });
  const sj = await sess.json().catch(() => ({}));
  ok('rota session lê o cookie novo', !!(sj.session || sj.user || sj.access_token), `${sess.status} ${Object.keys(sj).join(',')}`);

  const home = await fetch(`${APP}/formacao`);
  ok('home /formacao', home.ok, String(home.status));
} catch (e) {
  ok('execução', false, e.message);
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    ok('usuário temporário apagado', !error, error?.message || '');
  }
}
console.log(`${res.filter(Boolean).length}/${res.length} ok`);
