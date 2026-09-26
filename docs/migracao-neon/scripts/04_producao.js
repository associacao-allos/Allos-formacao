// Aponta sb-auth, sb-rest e sb-storage para o banco `formacao` com a configuração de produção.
//
// - JWT: o segredo LEGADO da Supabase (o que assina as chaves anon e service_role em uso),
//   de modo que as chaves do app, do allos-site e dos scripts continuam valendo.
// - GoTrue na mesma versão da Supabase hospedada (v2.197.0), com a configuração lida de
//   GET /v1/projects/{ref}/config/auth: autoconfirm ligado, hook de claims DESLIGADO (como lá),
//   Google com o mesmo client, site_url e allow list.
// - E-mail de login pelo Send Email Hook, que cai em /formacao/api/auth-email do app.
//
// Segredos vêm de C:\Users\gabri\.allos-migracao (fora de qualquer repo) e do .env.local do app.
const fs = require('fs');
const crypto = require('crypto');
const l = require('./lib');

const PASTA = 'C:/Users/gabri/.allos-migracao';
const GW = 'https://sb-gateway-production-1dca.up.railway.app';
const APP_INTERNO = 'https://allos-formacao-production.up.railway.app';

function envLocal(nome) {
  const linha = fs.readFileSync('C:/Users/gabri/Allos-formacao/.env.local', 'utf8').split(/\r?\n/).find((x) => x.startsWith(nome + '='));
  if (!linha) throw new Error('faltou ' + nome + ' no .env.local');
  return linha.slice(nome.length + 1).trim();
}

function segredoDoHook() {
  const arq = `${PASTA}/send_email_hook_secret.txt`;
  if (!fs.existsSync(arq)) fs.writeFileSync(arq, 'v1,whsec_' + crypto.randomBytes(32).toString('base64'));
  return fs.readFileSync(arq, 'utf8').trim();
}

(async () => {
  const auth = JSON.parse(fs.readFileSync(`${PASTA}/supabase-auth-config.json`, 'utf8'));
  const jwt = fs.readFileSync(`${PASTA}/jwt_secret_legado.txt`, 'utf8').trim();
  const svc = await l.services();

  const vars = {
    'sb-auth': {
      DB_NAME: 'formacao',
      SB_JWT_SECRET: jwt,
      SB_ANON_KEY: envLocal('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      SB_SERVICE_ROLE_KEY: envLocal('SUPABASE_SERVICE_ROLE_KEY'),
      GOTRUE_SITE_URL: auth.site_url,
      GOTRUE_URI_ALLOW_LIST: [auth.uri_allow_list, 'https://www.allos.org.br/**', `${APP_INTERNO}/**`, 'http://localhost:3000/**'].join(','),
      GOTRUE_MAILER_AUTOCONFIRM: String(auth.mailer_autoconfirm),
      GOTRUE_MAILER_OTP_EXP: String(auth.mailer_otp_exp),
      GOTRUE_PASSWORD_MIN_LENGTH: String(auth.password_min_length),
      GOTRUE_JWT_EXP: String(auth.jwt_exp),
      GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: String(auth.refresh_token_rotation_enabled),
      GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: String(auth.security_refresh_token_reuse_interval),
      GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED: String(auth.hook_custom_access_token_enabled),
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: String(auth.external_google_enabled),
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: auth.external_google_client_id,
      GOTRUE_EXTERNAL_GOOGLE_SECRET: auth.external_google_secret,
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: `${GW}/auth/v1/callback`,
      GOTRUE_HOOK_SEND_EMAIL_ENABLED: 'true',
      GOTRUE_HOOK_SEND_EMAIL_URI: `${APP_INTERNO}/formacao/api/auth-email`,
      GOTRUE_HOOK_SEND_EMAIL_SECRETS: segredoDoHook(),
    },
    'sb-rest': { DB_NAME: 'formacao' },
    'sb-storage': { DB_NAME: 'formacao' },
  };

  for (const [nome, variables] of Object.entries(vars)) {
    await l.gql(`mutation($i:VariableCollectionUpsertInput!){ variableCollectionUpsert(input:$i) }`,
      { i: { projectId: l.PROJECT, environmentId: l.ENV, serviceId: svc[nome], skipDeploys: true, variables } });
    console.log('vars', nome, Object.keys(variables).join(' '));
  }
  await l.gql(`mutation($s:String!,$e:String!,$i:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(serviceId:$s, environmentId:$e, input:$i) }`,
    { s: svc['sb-auth'], e: l.ENV, i: { source: { image: 'supabase/gotrue:v2.197.0' } } });
  console.log('imagem sb-auth → supabase/gotrue:v2.197.0');

  // rest antes do storage: o storage consulta o PostgREST ao subir.
  for (const nome of ['sb-auth', 'sb-rest', 'sb-storage']) {
    const d = await l.gql(`mutation($s:String!,$e:String!){ serviceInstanceDeployV2(serviceId:$s, environmentId:$e) }`, { s: svc[nome], e: l.ENV });
    console.log('deploy', nome, d.serviceInstanceDeployV2);
  }
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
