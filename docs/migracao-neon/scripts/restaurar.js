// Restaura no Neon um pg_dump (-Fc) dos schemas auth e public da Supabase da Formação.
//
//   node restaurar.js <arquivo.dump> [formacao|formacao_ensaio]
//
// ⚠️ APAGA os schemas auth e public do banco alvo antes de restaurar. O storage
// não vem do dump: o storage-api cria o schema dele, e os arquivos são reenviados
// por enviar_storage.js.
//
// Ordem: papéis-fantasma → drop → pg_restore sem dono (com os GRANT/REVOKE do dump,
// que carregam decisões como a 051) → posse do auth ao supabase_auth_admin (é ele
// que o GoTrue usa para migrar) → default privileges → event trigger do PostgREST →
// conferência de contagem tabela a tabela contra os COPY do dump.
const { spawnSync } = require('child_process');
const l = require('./lib');
const FIM_COPY = String.fromCharCode(92) + '.'; // a linha que fecha um bloco COPY

const BIN = 'C:/Users/gabri/tools/pgsql18';
const DUMP = process.argv[2];
const DB = process.argv[3] || 'formacao';
if (!DUMP) throw new Error('uso: node restaurar.js <arquivo.dump> [banco]');
if (!['formacao', 'formacao_ensaio'].includes(DB)) throw new Error('banco alvo não permitido: ' + DB);

function run(args, opts = {}) {
  const r = spawnSync(`${BIN}/${args[0]}.exe`, args.slice(1), { encoding: 'utf8', maxBuffer: 1 << 30, ...opts });
  if (r.error) throw r.error;
  return r;
}

// Contagem de linhas por tabela, lida dos blocos COPY do próprio dump.
function contagensDoDump() {
  const r = run(['pg_restore', '-a', '-n', 'auth', '-n', 'public', '-f', '-', DUMP]);
  const cont = {};
  let atual = null;
  for (const linha of r.stdout.split(/\r?\n/)) {
    if (atual) {
      if (linha === FIM_COPY) atual = null;
      else cont[atual]++;
    } else {
      const m = linha.match(/^COPY ([a-z_]+\.[a-z_0-9"]+) /);
      if (m) { atual = m[1].replace(/"/g, ''); cont[atual] = 0; }
    }
  }
  return cont;
}

(async () => {
  const t0 = Date.now();
  console.log(`alvo: ${DB} · dump: ${DUMP}`);

  await l.withDb(DB, async (c) => {
    // dashboard_user é papel interno da Supabase que aparece nos GRANT do dump.
    await c.query(`do $$ begin
      if not exists (select from pg_roles where rolname = 'dashboard_user') then create role dashboard_user nologin; end if;
    end $$`);
    await c.query('drop schema if exists auth cascade');
    await c.query('drop schema if exists public cascade');
  });
  console.log('schemas auth e public apagados');

  // Lista do dump sem o storage. Com -n o pg_restore pula o próprio CREATE SCHEMA e os
  // GRANT de schema; filtrando a lista, eles vêm junto.
  const lista = run(['pg_restore', '-l', DUMP]).stdout.split('\n')
    .filter((x) => !/^\d+;/.test(x) || !/( storage |SCHEMA - storage|SCHEMA storage )/.test(x + ' '));
  const arqLista = require('path').join(require('os').tmpdir(), `restaurar_${DB}.list`);
  require('fs').writeFileSync(arqLista, lista.join('\n'));

  const url = l.neonUrl(DB);
  const r = run(['pg_restore', '--no-owner', '-L', arqLista, '-d', url, DUMP]);
  const erros = (r.stderr || '').split('\n').filter((x) => /error:/i.test(x));
  console.log(`pg_restore: status ${r.status}, ${erros.length} erros`);
  for (const e of erros.slice(0, 40)) console.log('  ', e.slice(0, 220));

  await l.withDb(DB, async (c) => {
    // O GoTrue migra o schema auth conectado como supabase_auth_admin: ele precisa ser o dono.
    await c.query(`alter schema auth owner to supabase_auth_admin`);
    await c.query(`do $$ declare r record; begin
      for r in select c.oid::regclass as obj, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'auth' and c.relkind in ('r','p','v','m','S') loop
        begin
          execute format('alter %s %s owner to supabase_auth_admin',
            case r.relkind when 'S' then 'sequence' when 'v' then 'view' when 'm' then 'materialized view' else 'table' end, r.obj);
        exception when others then null; -- sequência de coluna identity/serial segue a tabela
        end;
      end loop;
      for r in select p.oid::regprocedure as obj, p.prokind from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'auth' loop
        execute format('alter %s %s owner to supabase_auth_admin', case r.prokind when 'p' then 'procedure' else 'function' end, r.obj);
      end loop;
      for r in select t.oid::regtype as obj from pg_type t join pg_namespace n on n.oid = t.typnamespace
               where n.nspname = 'auth' and t.typtype in ('e','d') loop
        execute format('alter type %s owner to supabase_auth_admin', r.obj);
      end loop;
    end $$`);

    // Na Supabase quem cria tabela é o papel postgres, que tem default privileges para os
    // três papéis da API. Aqui quem cria é o neondb_owner: sem isto, tabela de migração
    // futura nasceria invisível para o app.
    await c.query(`alter default privileges for role neondb_owner in schema public grant all on tables to anon, authenticated, service_role`);
    await c.query(`alter default privileges for role neondb_owner in schema public grant all on sequences to anon, authenticated, service_role`);
    await c.query(`alter default privileges for role neondb_owner in schema public grant all on functions to anon, authenticated, service_role`);

    // O PostgREST guarda o schema em cache: DDL precisa avisá-lo (a Supabase faz igual).
    await c.query(`create schema if not exists extensions`);
    await c.query(`create or replace function extensions.pgrst_ddl_watch() returns event_trigger language plpgsql as $$
      begin notify pgrst, 'reload schema'; end $$`);
    await c.query(`drop event trigger if exists pgrst_ddl_watch`);
    await c.query(`create event trigger pgrst_ddl_watch on ddl_command_end execute procedure extensions.pgrst_ddl_watch()`);
    await c.query(`notify pgrst, 'reload schema'`);

    const esperado = contagensDoDump();
    let divergencias = 0, total = 0;
    for (const [tabela, n] of Object.entries(esperado)) {
      const [s, t] = tabela.split('.');
      const q = await c.query(`select count(*)::int n from ${s}."${t}"`);
      total += q.rows[0].n;
      if (q.rows[0].n !== n) { divergencias++; console.log(`  ≠ ${tabela}: dump ${n}, neon ${q.rows[0].n}`); }
    }
    const u = await c.query(`select count(*)::int n from auth.users`);
    console.log(`contagem: ${Object.keys(esperado).length} tabelas, ${total} linhas, ${divergencias} divergências; auth.users = ${u.rows[0].n}`);
  });
  console.log(`pronto em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
