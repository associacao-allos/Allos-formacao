// Zera o schema public do banco de ENSAIO e reaplica o search_path estilo Supabase no dono.
const l = require('./lib');
(async () => {
  const db = process.argv[2];
  if (db !== 'formacao_ensaio') throw new Error('reset só no ensaio');
  await l.withDb('postgres', async c => {
    for (const d of ['formacao', 'formacao_ensaio'])
      await c.query(`alter role current_user in database ${d} set search_path to "$user", public, extensions`);
  });
  await l.withDb(db, async c => {
    for (const q of [
      'drop schema public cascade', 'create schema public',
      'grant usage on schema public to public',
      'grant usage on schema public to anon, authenticated, service_role',
      'alter default privileges in schema public grant all on tables to anon, authenticated, service_role',
      'alter default privileges in schema public grant all on functions to anon, authenticated, service_role',
      'alter default privileges in schema public grant all on sequences to anon, authenticated, service_role',
    ]) await c.query(q);
    console.log('public zerado em', db);
  });
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
