// Confere, tabela a tabela, a contagem do banco alvo contra os COPY do dump.
//   node conferir.js <arquivo.dump> [formacao|formacao_ensaio]
const { spawnSync } = require('child_process');
const l = require('./lib');
const FIM_COPY = String.fromCharCode(92) + '.'; // a linha que fecha um bloco COPY
const DUMP = process.argv[2], DB = process.argv[3] || 'formacao';
(async () => {
  const r = spawnSync('C:/Users/gabri/tools/pgsql18/pg_restore.exe', ['-a', '-n', 'auth', '-n', 'public', '-f', '-', DUMP], { encoding: 'utf8', maxBuffer: 1 << 30 });
  const cont = {}; let atual = null;
  for (const linha of r.stdout.split(/\r?\n/)) {
    if (atual) { if (linha === FIM_COPY) atual = null; else cont[atual]++; }
    else { const m = linha.match(/^COPY ([a-z_]+\.[a-z_0-9"]+) /); if (m) { atual = m[1].replace(/"/g, ''); cont[atual] = 0; } }
  }
  await l.withDb(DB, async (c) => {
    let div = 0, total = 0;
    for (const [tabela, n] of Object.entries(cont)) {
      const [s, t] = tabela.split('.');
      const q = await c.query(`select count(*)::int n from ${s}."${t}"`);
      total += q.rows[0].n;
      if (q.rows[0].n !== n) { div++; console.log(`  ≠ ${tabela}: dump ${n}, neon ${q.rows[0].n}`); }
    }
    console.log(`${Object.keys(cont).length} tabelas, ${total} linhas no Neon, ${div} divergências`);
  });
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
