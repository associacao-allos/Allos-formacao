// Roda arquivos .sql com o psql 18 portátil, um por transação; senha só no ambiente do processo filho.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const l = require('./lib');
const PSQL = 'C:/Users/gabri/tools/pgsql18/psql.exe';
function env(db) {
  const u = new URL(l.neonUrl(db));
  return { ...process.env, PGHOST: u.hostname, PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: db, PGSSLMODE: 'require', PGCLIENTENCODING: 'UTF8' };
}
function run(db, file, { single = true } = {}) {
  const args = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', ...(single ? ['--single-transaction'] : []), '-f', file];
  const r = spawnSync(PSQL, args, { env: env(db), encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stderr || '') + (r.stdout || '') };
}
module.exports = { run, env, PSQL };
if (require.main === module) {
  const [db, dir] = process.argv.slice(2);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const res = [];
  for (const f of files) {
    const r = run(db, path.join(dir, f));
    res.push({ f, ok: r.ok, err: r.ok ? '' : r.out.split('\n').filter(x => /ERROR|ERRO/.test(x)).slice(0, 2).join(' | ') });
    console.log((r.ok ? 'ok   ' : 'FALHA') + ' ' + f + (r.ok ? '' : '  ' + res.at(-1).err.slice(0, 300)));
  }
  fs.writeFileSync(path.join(__dirname, `migr_${db}.json`), JSON.stringify(res, null, 1));
}
