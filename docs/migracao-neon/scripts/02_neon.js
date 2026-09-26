// Cria bancos e papéis no Neon e grava as senhas direto nas variáveis dos serviços novos.
const crypto = require('crypto');
const l = require('./lib');
const pw = () => crypto.randomBytes(24).toString('base64url').replace(/[-_]/g, 'x');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(payload, secret) {
  const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload);
  return `${h}.${p}.${crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
}
(async () => {
  const svc = await l.services();
  const host = new URL(l.neonUrl()).hostname;
  const secrets = { authenticator: pw(), supabase_auth_admin: pw(), supabase_storage_admin: pw() };
  await l.withDb('postgres', async c => {
    for (const db of ['formacao', 'formacao_ensaio']) {
      const r = await c.query('select 1 from pg_database where datname=$1', [db]);
      if (!r.rowCount) { await c.query(`create database ${db}`); console.log('db criado', db); } else console.log('db existe', db);
    }
    const roles = {
      anon: 'nologin noinherit', authenticated: 'nologin noinherit', service_role: 'nologin noinherit bypassrls',
      authenticator: 'login noinherit', supabase_auth_admin: 'login noinherit', supabase_storage_admin: 'login noinherit',
    };
    for (const [role, attrs] of Object.entries(roles)) {
      const r = await c.query('select 1 from pg_roles where rolname=$1', [role]);
      const pass = secrets[role] ? ` password '${secrets[role]}'` : '';
      if (!r.rowCount) { await c.query(`create role ${role} ${attrs}${pass}`); console.log('papel criado', role); }
      else { await c.query(`alter role ${role} ${attrs}${pass}`); console.log('papel ajustado', role); }
    }
    for (const q of [
      'grant anon, authenticated, service_role to authenticator',
      'grant supabase_auth_admin, supabase_storage_admin to current_user with inherit true, set true',
      "alter role anon set statement_timeout = '3s'",
      "alter role authenticated set statement_timeout = '8s'",
      "alter role authenticator set statement_timeout = '8s'",
      'alter role supabase_auth_admin set search_path = auth',
      "alter role supabase_auth_admin set idle_in_transaction_session_timeout = 60000",
      'alter role supabase_storage_admin set search_path = storage',
    ]) { try { await c.query(q); } catch (e) { console.log('FALHOU:', q, '->', e.message); } }
  });
  for (const db of ['formacao', 'formacao_ensaio']) {
    await l.withDb(db, async c => {
      for (const q of [
        'create schema if not exists extensions',
        'create extension if not exists "uuid-ossp" with schema extensions',
        'create extension if not exists pgcrypto with schema extensions',
        'grant usage on schema public to anon, authenticated, service_role',
        'alter default privileges in schema public grant all on tables to anon, authenticated, service_role',
        'alter default privileges in schema public grant all on functions to anon, authenticated, service_role',
        'alter default privileges in schema public grant all on sequences to anon, authenticated, service_role',
        'grant usage on schema extensions to anon, authenticated, service_role',
        'create schema if not exists auth authorization supabase_auth_admin',
        'grant usage on schema auth to anon, authenticated, service_role',
        'create schema if not exists storage authorization supabase_storage_admin',
        'grant usage on schema storage to anon, authenticated, service_role',
        `grant create on database ${db} to supabase_storage_admin`,
        `grant connect on database ${db} to authenticator, supabase_auth_admin, supabase_storage_admin`,
      ]) { try { await c.query(q); } catch (e) { console.log(db, 'FALHOU:', q, '->', e.message); } }
      console.log('base pronta em', db);
    });
  }
  const jwtSecret = crypto.randomBytes(48).toString('base64url');
  const iat = Math.floor(Date.now() / 1000), exp = iat + 10 * 365 * 24 * 3600;
  const anon = jwt({ role: 'anon', iss: 'supabase', iat, exp }, jwtSecret);
  const service = jwt({ role: 'service_role', iss: 'supabase', iat, exp }, jwtSecret);
  const up = (serviceId, variables) => l.gql(`mutation($i:VariableCollectionUpsertInput!){ variableCollectionUpsert(input:$i) }`,
    { i: { projectId: l.PROJECT, environmentId: l.ENV, serviceId, skipDeploys: true, variables } });
  await up(svc['sb-auth'], { SB_JWT_SECRET: jwtSecret, SB_ANON_KEY: anon, SB_SERVICE_ROLE_KEY: service, AUTH_DB_PASSWORD: secrets.supabase_auth_admin, DB_HOST: host, DB_NAME: 'formacao_ensaio' });
  await up(svc['sb-rest'], { REST_DB_PASSWORD: secrets.authenticator, DB_HOST: host, DB_NAME: 'formacao_ensaio' });
  await up(svc['sb-storage'], { STORAGE_DB_PASSWORD: secrets.supabase_storage_admin, DB_HOST: host, DB_NAME: 'formacao_ensaio' });
  console.log('segredos gravados na Railway (sb-auth, sb-rest, sb-storage)');
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
