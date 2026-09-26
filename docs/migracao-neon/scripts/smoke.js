// Teste de fumaça do ensaio contra o gateway, com o supabase-js do próprio app.
const { createClient } = require('C:/Users/gabri/Allos-formacao/node_modules/@supabase/supabase-js');
const l = require('./lib');
const GW = 'https://sb-gateway-production-1dca.up.railway.app';
const res = [];
const ok = (name, cond, extra = '') => { res.push([cond ? 'PASSOU' : 'FALHOU', name, extra]); console.log(cond ? 'PASSOU' : 'FALHOU', name, extra); };
(async () => {
  const svc = await l.services();
  const v = await l.serviceVars(svc['sb-auth']);
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(GW, v.SB_SERVICE_ROLE_KEY, opts);
  const anon = createClient(GW, v.SB_ANON_KEY, opts);
  const email = `ensaio.${Date.now()}@example.com`, password = 'Ensaio-' + Math.random().toString(36).slice(2, 10);
  let userId;
  try {
    const su = await anon.auth.signUp({ email, password, options: { data: { full_name: 'Ensaio Neon' } } });
    userId = su.data?.user?.id;
    ok('signUp', !su.error && !!userId, su.error?.message || '');
    const si = await anon.auth.signInWithPassword({ email, password });
    ok('signInWithPassword', !si.error && !!si.data.session, si.error?.message || '');
    const tok = si.data.session?.access_token;
    const claims = tok ? JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()) : {};
    ok('hook: claim user_role no JWT', 'user_role' in claims, `user_role=${JSON.stringify(claims.user_role)} cargos=${JSON.stringify(claims.user_cargos)} aud=${claims.aud} role=${claims.role}`);
    const user = createClient(GW, v.SB_ANON_KEY, { ...opts, global: { headers: { Authorization: `Bearer ${tok}` } } });
    const gu = await user.auth.getUser(tok);
    ok('getUser com o token', gu.data?.user?.id === userId, gu.error?.message || '');
    const own = await user.from('profiles').select('id, role').eq('id', userId);
    ok('RLS: usuário lê o próprio profile (trigger on_auth_user_created)', !own.error && own.data?.length === 1, own.error?.message || JSON.stringify(own.data));
    const all = await user.from('profiles').select('id');
    ok('RLS: usuário comum não vê profiles alheios', !all.error && all.data.every(r => r.id === userId), `${all.data?.length} linhas`);
    const an = await createClient(GW, v.SB_ANON_KEY, opts).from('profiles').select('id');
    ok('RLS: anon não lê profiles', !!an.error || an.data.length === 0, an.error?.message || `${an.data.length} linhas`);
    const sr = await admin.from('profiles').select('id', { count: 'exact', head: true });
    ok('service role lê tudo (bypass RLS)', !sr.error && sr.count >= 1, sr.error?.message || `count=${sr.count}`);
    const lu = await admin.auth.admin.listUsers();
    ok('auth.admin.listUsers', !lu.error && lu.data.users.some(u => u.id === userId), lu.error?.message || `${lu.data.users.length} usuários`);
    const gl = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: 'https://allos.org.br/formacao/redefinir-senha' } });
    ok('generateLink aponta para /auth/v1/verify', !gl.error && /\/auth\/v1\/verify\?/.test(gl.data?.properties?.action_link || ''), gl.error?.message || (gl.data?.properties?.action_link || '').replace(/token=[^&]+/, 'token=…'));
    const rf = await anon.auth.refreshSession({ refresh_token: si.data.session.refresh_token });
    ok('refreshSession', !rf.error && !!rf.data.session, rf.error?.message || '');
    // storage
    const bucket = 'ensaio-teste';
    await admin.storage.createBucket(bucket, { public: true });
    const body = Buffer.from('ola neon ' + Date.now());
    const upl = await admin.storage.from(bucket).upload('teste/ola.txt', body, { contentType: 'text/plain', upsert: true });
    ok('storage upload', !upl.error, upl.error?.message || '');
    const pub = admin.storage.from(bucket).getPublicUrl('teste/ola.txt').data.publicUrl;
    const f = await fetch(pub); const txt = await f.text();
    ok('storage URL pública devolve o arquivo', f.status === 200 && txt === body.toString(), `${f.status} ${pub.replace(GW, '')}`);
    const rm = await admin.storage.from(bucket).remove(['teste/ola.txt']);
    const db = await admin.storage.deleteBucket(bucket);
    ok('storage limpeza', !rm.error && !db.error, rm.error?.message || db.error?.message || '');
    // CORS
    for (const p of ['/rest/v1/profiles', '/auth/v1/token?grant_type=password', '/storage/v1/object/public/x/y']) {
      const r = await fetch(GW + p, { method: 'OPTIONS', headers: { Origin: 'https://allos.org.br', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-client-info' } });
      const aco = r.headers.get('access-control-allow-origin');
      ok(`CORS preflight ${p.split('?')[0]}`, r.status < 300 && (aco === '*' || aco === 'https://allos.org.br'), `${r.status} ACAO=${aco}`);
    }
  } finally {
    if (userId) { const d = await admin.auth.admin.deleteUser(userId); ok('limpeza: usuário apagado', !d.error, d.error?.message || ''); }
    require('fs').writeFileSync(__dirname + '/smoke_result.json', JSON.stringify(res, null, 1));
  }
})().catch(e => { console.error('ERRO', e); process.exit(1); });
