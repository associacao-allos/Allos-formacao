// Troca, em todas as colunas de texto e jsonb do schema public, o endereço do storage da
// Supabase pelo do gateway novo. Sem argumento só conta; com --aplicar grava.
//   node reescrever_urls.js [formacao|formacao_ensaio] [--aplicar]
const l = require('./lib');
const DB = process.argv.find((a) => a.startsWith('formacao')) || 'formacao';
const APLICAR = process.argv.includes('--aplicar');
const VELHO = 'https://syiaushvzhgyhvsmoegt.supabase.co/storage/v1/';
const NOVO = 'https://sb-gateway-production-1dca.up.railway.app/storage/v1/';

(async () => {
  await l.withDb(DB, async (c) => {
    const cols = await c.query(`
      select c.table_name t, c.column_name col, c.data_type tipo
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY')`);
    let total = 0;
    for (const { t, col, tipo } of cols.rows) {
      const comoTexto = tipo === 'text' || tipo === 'character varying' ? `"${col}"` : `"${col}"::text`;
      const q = await c.query(`select count(*)::int n from public."${t}" where ${comoTexto} like $1`, ['%' + VELHO + '%']);
      if (!q.rows[0].n) continue;
      total += q.rows[0].n;
      console.log(`${t}.${col} (${tipo}): ${q.rows[0].n}`);
      if (APLICAR) {
        const expr = tipo === 'text' || tipo === 'character varying'
          ? `replace("${col}", $1, $2)`
          : `replace("${col}"::text, $1, $2)::${tipo === 'ARRAY' ? 'text[]' : tipo}`;
        await c.query(`update public."${t}" set "${col}" = ${expr} where ${comoTexto} like $3`, [VELHO, NOVO, '%' + VELHO + '%']);
      }
    }
    console.log(`${total} linhas ${APLICAR ? 'reescritas' : 'a reescrever'}`);
  });
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
