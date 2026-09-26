// Recria o bucket course-images no storage novo e reenvia os arquivos baixados da Supabase,
// no mesmo caminho, e recria as duas policies que a Supabase tinha em storage.objects.
//   node enviar_storage.js [formacao|formacao_ensaio]
// Os arquivos vêm de C:\Users\gabri\.allos-migracao\storage\<bucket>\<caminho>, baixados
// pelas URLs públicas a partir da lista storage.objects do dump.
const fs = require('fs');
const path = require('path');
const l = require('./lib');
const { createClient } = require('C:/Users/gabri/Allos-formacao/node_modules/@supabase/supabase-js');

const GW = 'https://sb-gateway-production-1dca.up.railway.app';
const RAIZ = 'C:/Users/gabri/.allos-migracao/storage';
const BUCKET = 'course-images';
const DB = process.argv[2] || 'formacao';
const TIPOS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif' };

function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivos(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

(async () => {
  const chave = fs.readFileSync('C:/Users/gabri/Allos-formacao/.env.local', 'utf8').match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
  const sb = createClient(GW, chave, { auth: { persistSession: false } });

  const { data: existentes } = await sb.storage.listBuckets();
  if (!existentes?.some((b) => b.id === BUCKET)) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: true });
    if (error) throw error;
    console.log('bucket criado');
  }

  const base = path.join(RAIZ, BUCKET);
  let ok = 0;
  for (const arq of arquivos(base)) {
    const nome = path.relative(base, arq).split(path.sep).join('/');
    const tipo = TIPOS[path.extname(nome).toLowerCase()] || 'application/octet-stream';
    const { error } = await sb.storage.from(BUCKET).upload(nome, fs.readFileSync(arq), { contentType: tipo, upsert: true });
    if (error) console.log('FALHA', nome, error.message); else ok++;
  }
  console.log(`enviados ${ok}`);

  await l.withDb(DB, async (c) => {
    for (const sql of [
      `drop policy if exists "Allow authenticated uploads 178296_0" on storage.objects`,
      `create policy "Allow authenticated uploads 178296_0" on storage.objects for insert to authenticated with check (bucket_id = 'course-images'::text)`,
      `drop policy if exists "Allow public read 178296_0" on storage.objects`,
      `create policy "Allow public read 178296_0" on storage.objects for select to anon using (bucket_id = 'course-images'::text)`,
    ]) await c.query(sql);
    const r = await c.query(`select count(*)::int n from storage.objects where bucket_id = $1`, [BUCKET]);
    console.log(`storage.objects no Neon: ${r.rows[0].n}; policies recriadas`);
  });
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
