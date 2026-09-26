// Utilitários do ensaio. Nenhum segredo é gravado em disco: tudo vem da Railway em tempo de execução.
const { execSync } = require('child_process');
const { Client } = require('pg');
const PROJECT = '0af44322-0330-4403-921c-263bf33503cd';
const ENV = 'a3701b32-e32d-452e-aba2-f94704d171f8';
const REGION = 'us-east4-eqdc4a';
function railwayToken() {
  return process.env.RAILWAY_API_TOKEN || execSync(`powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('RAILWAY_API_TOKEN','User')"`).toString().trim();
}
async function gql(query, variables) {
  const r = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + railwayToken() },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}
let _neon;
function neonUrl(db, { pooled = false, user, password } = {}) {
  if (!_neon) {
    const j = JSON.parse(execSync('railway variables --service Allos-site --json', { cwd: 'C:/Users/gabri/allos-site', env: { ...process.env, RAILWAY_API_TOKEN: railwayToken() } }).toString());
    _neon = j.NEON_DATABASE_URL;
  }
  const u = new URL(_neon);
  if (!pooled) u.hostname = u.hostname.replace('-pooler', '');
  if (db) u.pathname = '/' + db;
  if (user) u.username = user;
  if (password) u.password = encodeURIComponent(password);
  u.searchParams.delete('channel_binding');
  u.searchParams.set('sslmode', 'require');
  return u.toString();
}
async function withDb(db, fn, opts) {
  const c = new Client({ connectionString: neonUrl(db, opts) });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}
async function serviceVars(serviceId) {
  const d = await gql(`query($p:String!,$e:String!,$s:String!){ variables(projectId:$p, environmentId:$e, serviceId:$s, unrendered:false) }`, { p: PROJECT, e: ENV, s: serviceId });
  return d.variables;
}
async function services() {
  const d = await gql(`query($id:String!){ project(id:$id){ services { edges { node { id name } } } } }`, { id: PROJECT });
  return Object.fromEntries(d.project.services.edges.map(e => [e.node.name, e.node.id]));
}
module.exports = { gql, neonUrl, withDb, serviceVars, services, PROJECT, ENV, REGION, railwayToken };
