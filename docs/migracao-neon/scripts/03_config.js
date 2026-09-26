// Variáveis não secretas dos serviços + imagem de origem. Segredos entram por referência ${{...}}.
const l = require('./lib');
const GW = 'https://sb-gateway-production-1dca.up.railway.app';
const IMAGES = { 'sb-auth': 'supabase/gotrue:v2.196.0', 'sb-rest': 'postgrest/postgrest:v14.17', 'sb-storage': 'supabase/storage-api:v1.74.0' };
const VARS = {
  'sb-auth': {
    PORT: '9999', GOTRUE_API_HOST: '::', GOTRUE_API_PORT: '9999',
    API_EXTERNAL_URL: `${GW}/auth/v1`, GOTRUE_JWT_ISSUER: `${GW}/auth/v1`,
    GOTRUE_DB_DRIVER: 'postgres',
    GOTRUE_DB_DATABASE_URL: 'postgres://supabase_auth_admin:${{AUTH_DB_PASSWORD}}@${{DB_HOST}}/${{DB_NAME}}?sslmode=require',
    GOTRUE_SITE_URL: 'https://allos.org.br/formacao',
    GOTRUE_URI_ALLOW_LIST: 'https://allos.org.br/**,https://www.allos.org.br/**,https://allos-formacao-production.up.railway.app/**,http://localhost:3000/**',
    GOTRUE_DISABLE_SIGNUP: 'false',
    GOTRUE_JWT_SECRET: '${{SB_JWT_SECRET}}', GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_AUD: 'authenticated',
    GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
    GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true',
    GOTRUE_EXTERNAL_PHONE_ENABLED: 'false', GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: 'false',
    GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED: 'true',
    GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI: 'pg-functions://postgres/public/custom_access_token_hook',
    GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: 'true', GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: '10',
    GOTRUE_PASSWORD_MIN_LENGTH: '6', GOTRUE_LOG_LEVEL: 'info',
  },
  'sb-rest': {
    PGRST_DB_URI: 'postgres://authenticator:${{REST_DB_PASSWORD}}@${{DB_HOST}}/${{DB_NAME}}?sslmode=require',
    PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: '${{sb-auth.SB_JWT_SECRET}}', PGRST_DB_USE_LEGACY_GUCS: 'false',
    PGRST_DB_MAX_ROWS: '1000', PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions',
    PGRST_SERVER_HOST: '*', PGRST_SERVER_PORT: '3000', PGRST_DB_POOL: '10',
    PGRST_ADMIN_SERVER_PORT: '3001', PGRST_APP_SETTINGS_JWT_EXP: '3600', PGRST_LOG_LEVEL: 'warn',
  },
  'sb-storage': {
    DATABASE_URL: 'postgres://supabase_storage_admin:${{STORAGE_DB_PASSWORD}}@${{DB_HOST}}/${{DB_NAME}}?sslmode=require',
    ANON_KEY: '${{sb-auth.SB_ANON_KEY}}', SERVICE_KEY: '${{sb-auth.SB_SERVICE_ROLE_KEY}}',
    AUTH_JWT_SECRET: '${{sb-auth.SB_JWT_SECRET}}', PGRST_JWT_SECRET: '${{sb-auth.SB_JWT_SECRET}}',
    POSTGREST_URL: 'http://sb-rest.railway.internal:3000',
    STORAGE_PUBLIC_URL: GW, REQUEST_ALLOW_X_FORWARDED_PATH: 'true',
    FILE_SIZE_LIMIT: '52428800', STORAGE_BACKEND: 'file', FILE_STORAGE_BACKEND_PATH: '/var/lib/storage',
    GLOBAL_S3_BUCKET: 'stub', TENANT_ID: 'stub', REGION: 'stub',
    ENABLE_IMAGE_TRANSFORMATION: 'false', SERVER_HOST: '::', SERVER_PORT: '5000', PORT: '5000',
  },
  'sb-gateway': { PORT: '8080' },
};
(async () => {
  const svc = await l.services();
  for (const [name, variables] of Object.entries(VARS)) {
    await l.gql(`mutation($i:VariableCollectionUpsertInput!){ variableCollectionUpsert(input:$i) }`,
      { i: { projectId: l.PROJECT, environmentId: l.ENV, serviceId: svc[name], skipDeploys: true, variables } });
    console.log('vars', name, Object.keys(variables).length);
  }
  // volume do storage
  const v = await l.gql(`query($id:String!){ project(id:$id){ volumes { edges { node { id name volumeInstances { edges { node { serviceId mountPath } } } } } } } }`, { id: l.PROJECT });
  const has = v.project.volumes.edges.some(e => e.node.volumeInstances.edges.some(i => i.node.serviceId === svc['sb-storage']));
  if (!has) {
    const r = await l.gql(`mutation($i:VolumeCreateInput!){ volumeCreate(input:$i){ id name } }`, { i: { projectId: l.PROJECT, environmentId: l.ENV, serviceId: svc['sb-storage'], mountPath: '/var/lib/storage', region: l.REGION } });
    console.log('volume', JSON.stringify(r));
  } else console.log('volume já existe');
  for (const [name, image] of Object.entries(IMAGES)) {
    await l.gql(`mutation($s:String!,$e:String!,$i:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(serviceId:$s, environmentId:$e, input:$i) }`,
      { s: svc[name], e: l.ENV, i: { source: { image } } });
    const d = await l.gql(`mutation($s:String!,$e:String!){ serviceInstanceDeployV2(serviceId:$s, environmentId:$e) }`, { s: svc[name], e: l.ENV });
    console.log('deploy', name, image, JSON.stringify(d));
  }
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
