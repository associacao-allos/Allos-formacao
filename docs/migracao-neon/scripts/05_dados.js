// Fase de dados do corte: dump final da Supabase → restauração no Neon → storage → URLs →
// redeploy de sb-auth e sb-rest (as conexões deles apontavam para os schemas apagados).
//   node 05_dados.js
// Usa o papel temporário migrador_neon na Supabase (senha em .allos-migracao/migrador.pw).
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const l = require('./lib');

const PASTA = 'C:/Users/gabri/.allos-migracao';
const BIN = 'C:/Users/gabri/tools/pgsql18';
const CONN = 'host=aws-1-sa-east-1.pooler.supabase.com port=5432 dbname=postgres user=migrador_neon.syiaushvzhgyhvsmoegt sslmode=require connect_timeout=30';
const PUBLICO = 'https://syiaushvzhgyhvsmoegt.supabase.co/storage/v1/object/public';

function passo(nome, fn) {
  const t = Date.now();
  const r = fn();
  console.log(`✓ ${nome} (${((Date.now() - t) / 1000).toFixed(0)} s)`);
  return r;
}
function node(script, ...args) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { encoding: 'utf8', env: process.env });
  const saida = (r.stdout + r.stderr).split(/\r?\n/).filter((x) => x && !/ssl ?mode|libpq|pg-connection|prepare for|explicit|trace-warn|If you want|See https/i.test(x));
  for (const x of saida) console.log('   ' + x);
  if (r.status !== 0) throw new Error(`${script} saiu com ${r.status}`);
}

(async () => {
  const carimbo = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '_');
  const dump = `${PASTA}/supabase_formacao_${carimbo}_final.dump`;

  passo('dump final da Supabase', () => {
    const r = spawnSync(`${BIN}/pg_dump.exe`, [CONN, '-Fc', '-n', 'public', '-n', 'auth', '-n', 'storage', '-f', dump],
      { encoding: 'utf8', env: { ...process.env, PGPASSWORD: fs.readFileSync(`${PASTA}/migrador.pw`, 'utf8').trim() } });
    if (r.status !== 0) throw new Error('pg_dump: ' + r.stderr);
    console.log(`   ${dump} (${(fs.statSync(dump).size / 1e6).toFixed(1)} MB)`);
  });

  passo('restauração no Neon', () => node('restaurar.js', dump, 'formacao'));

  passo('arquivos novos do storage', () => {
    const sql = spawnSync(`${BIN}/pg_restore.exe`, ['-a', '-n', 'storage', '-t', 'objects', '-f', '-', dump], { encoding: 'utf8', maxBuffer: 1 << 30 }).stdout;
    let dentro = false, novos = 0, total = 0;
    for (const linha of sql.split(/\r?\n/)) {
      if (linha.startsWith('COPY storage.objects')) { dentro = true; continue; }
      if (dentro && linha === String.fromCharCode(92) + '.') break;
      if (!dentro) continue;
      const [, bucket, nome] = linha.split('\t');
      total++;
      const destino = path.join(PASTA, 'storage', bucket, ...nome.split('/'));
      if (fs.existsSync(destino)) continue;
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      execFileSync('curl', ['-s', '-f', '-m', '120', '-o', destino, `${PUBLICO}/${bucket}/${nome}`]);
      novos++;
    }
    console.log(`   ${total} objetos no dump, ${novos} baixados agora`);
  });
  passo('envio ao storage novo', () => node('enviar_storage.js', 'formacao'));
  passo('URLs do storage no banco', () => node('reescrever_urls.js', 'formacao', '--aplicar'));

  const svc = await l.services();
  for (const nome of ['sb-auth', 'sb-rest']) {
    const d = await l.gql(`mutation($s:String!,$e:String!){ serviceInstanceDeployV2(serviceId:$s, environmentId:$e) }`, { s: svc[nome], e: l.ENV });
    console.log(`✓ redeploy ${nome} ${d.serviceInstanceDeployV2}`);
  }
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
