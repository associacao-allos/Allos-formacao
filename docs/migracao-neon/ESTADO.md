# Migração Supabase → Neon

## ✅ CORTE FEITO em 26/09/2026, ~20:20 (Brasília)

Produção da Formação roda no backend próprio: gateway
`https://sb-gateway-production-1dca.up.railway.app` (GoTrue v2.197.0, PostgREST 14.17,
storage-api) sobre o banco `formacao` do Neon. O que foi feito no corte:

- **JWT = segredo legado da Supabase** (lido de `GET /v1/projects/{ref}/postgrest`): as chaves
  anon e service_role de sempre continuam valendo; só a URL mudou em todo lugar.
- Configuração do GoTrue copiada de `GET /v1/projects/{ref}/config/auth` (autoconfirm, hook de
  claims desligado como lá, Google com o mesmo client). Callback novo cadastrado no Google Cloud
  (projeto 784872211865). E-mails de login pelo Send Email Hook → `/formacao/api/auth-email`
  (Gmail API). Configuração em `scripts/04_producao.js`.
- Dados: `scripts/05_dados.js` (dump final → `restaurar.js` → `enviar_storage.js` →
  `reescrever_urls.js`): 97 tabelas, 37.368 linhas, 0 divergências; 587 usuários; 86 arquivos.
- Allos-formacao: `NEXT_PUBLIC_SUPABASE_URL` = gateway, `SUPABASE_JWT_SECRET`,
  `SEND_EMAIL_HOOK_SECRET`; região movida de Singapura para **us-east4** (junto do Neon).
- Allos-site: `FORMACAO_SUPABASE_URL` e `NEXT_PUBLIC_FORMACAO_SUPABASE_URL` = gateway.
- Verificado em produção: `e2e_app.mjs https://allos.org.br` 13/13, certificados, captura do
  Meet (13 etapas, 0 erros, 11 s), e-mail de troca de senha aceito pelo hook.
- A Supabase continua de pé, intocada, como reserva. Dumps e arquivos baixados ficam em
  `C:\Users\gabri\.allos-migracao\`, fora do repo, porque têm segredos.

Para rodar os scripts: `NODE_PATH` apontando para uma pasta com `pg` instalado, token da Railway
na variável de usuário `RAILWAY_API_TOKEN` e token de gestão da Supabase em `SUPABASE_ACCESS_TOKEN`.

---

# Histórico: o ensaio, antes do corte

Nenhum segredo neste arquivo. Senhas, JWT secret e chaves vivem só nas variáveis
da Railway dos serviços `sb-*`, e os scripts as leem de lá em tempo de execução.

## Arquitetura montada

O banco sai da Supabase e vai para o Neon. Auth, REST e Storage continuam sendo as
peças open-source da própria Supabase, rodando na Railway, de modo que o código do
app (supabase-js, `.from()`, `auth.*`, `storage.*`) não precisa ser reescrito:
basta trocar a URL e as chaves.

```
browser / Next (Allos-formacao) ──► sb-gateway (Caddy, domínio público)
                                      ├─ /auth/v1/*    ─► sb-auth    (GoTrue)      :9999
                                      ├─ /rest/v1/*    ─► sb-rest    (PostgREST)   :3000
                                      └─ /storage/v1/* ─► sb-storage (storage-api) :5000  + volume
                                                               │
                                                               ▼
                                        Neon broad-shape-76041796, PG 18.6, us-east-1
                                        bancos: formacao (alvo, vazio) · formacao_ensaio
```

**Gateway:** `https://sb-gateway-production-1dca.up.railway.app`
(`/health` responde `ok`). Esta é a futura `NEXT_PUBLIC_SUPABASE_URL`.

## Serviços na Railway (projeto allos-formacao, environment production)

| Serviço | ID | Origem | Região |
|---|---|---|---|
| sb-auth | 381f0f93-c884-49bc-89f5-65033a5e2ed7 | imagem `supabase/gotrue:v2.196.0` | us-east4-eqdc4a |
| sb-rest | 6dddefac-8ea2-4517-9a52-8eda617f6884 | imagem `postgrest/postgrest:v14.17` | us-east4-eqdc4a |
| sb-storage | 4dd263fe-1c02-48c5-9bcc-6ae6d0e78b39 | imagem `supabase/storage-api:v1.74.0` | us-east4-eqdc4a |
| sb-gateway | c90dd8e1-9a66-4a99-8650-e281c214f513 | `railway up` da pasta `gateway/` (Caddy 2.11) | us-east4-eqdc4a |

Volume `sb-storage-volume` (2374a97a-622e-4c83-8c13-ffded1221255) montado em
`/var/lib/storage` no sb-storage. Versões iguais às do `docker-compose.yml` oficial
de autohospedagem da Supabase.

⚠️ **O service Allos-formacao roda em Singapura** (`asia-southeast1-eqsg3a`), assim
como os crons `captura-meet-cron` e `vigia-captura`. A Supabase da Formação está em
**São Paulo** (sa-east-1: o pooler `aws-1-sa-east-1` reconhece o tenant, os outros
dizem "tenant not found"). Com o banco no Neon us-east-1, cada consulta do app em
Singapura cruza o Pacífico (~200 ms de ida e volta). Recomendo mover o Allos-formacao
para `us-east4-eqdc4a` no corte, lembrando que mudar a região redeploya a fonte
congelada do GitHub e precisa ser seguido de `railway up` na hora.

Nenhuma variável, deploy ou redeploy foi feito nos services Allos-formacao e
Allos-site. Último deploy do Allos-formacao continua `c65174b9` (21/09).

## Variáveis por serviço (só nomes)

- **sb-auth:** API_EXTERNAL_URL, AUTH_DB_PASSWORD, DB_HOST, DB_NAME,
  GOTRUE_API_HOST, GOTRUE_API_PORT, GOTRUE_DB_DATABASE_URL, GOTRUE_DB_DRIVER,
  GOTRUE_DISABLE_SIGNUP, GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED,
  GOTRUE_EXTERNAL_EMAIL_ENABLED, GOTRUE_EXTERNAL_PHONE_ENABLED,
  GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED, GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI,
  GOTRUE_JWT_ADMIN_ROLES, GOTRUE_JWT_AUD, GOTRUE_JWT_DEFAULT_GROUP_NAME,
  GOTRUE_JWT_EXP, GOTRUE_JWT_ISSUER, GOTRUE_JWT_SECRET, GOTRUE_LOG_LEVEL,
  GOTRUE_MAILER_AUTOCONFIRM, GOTRUE_MAILER_URLPATHS_{CONFIRMATION,EMAIL_CHANGE,INVITE,RECOVERY},
  GOTRUE_PASSWORD_MIN_LENGTH, GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL,
  GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED, GOTRUE_SITE_URL,
  GOTRUE_URI_ALLOW_LIST, PORT, **SB_ANON_KEY, SB_JWT_SECRET, SB_SERVICE_ROLE_KEY**
  (as três chaves novas moram aqui; os outros serviços as referenciam por `${{sb-auth.…}}`)
- **sb-rest:** DB_HOST, DB_NAME, PGRST_ADMIN_SERVER_PORT, PGRST_APP_SETTINGS_JWT_EXP,
  PGRST_DB_ANON_ROLE, PGRST_DB_EXTRA_SEARCH_PATH, PGRST_DB_MAX_ROWS (1000),
  PGRST_DB_POOL, PGRST_DB_SCHEMAS, PGRST_DB_URI, PGRST_DB_USE_LEGACY_GUCS,
  PGRST_JWT_SECRET, PGRST_LOG_LEVEL, PGRST_SERVER_HOST, PGRST_SERVER_PORT, REST_DB_PASSWORD
- **sb-storage:** ANON_KEY, AUTH_JWT_SECRET, DATABASE_URL, DB_HOST, DB_NAME,
  ENABLE_IMAGE_TRANSFORMATION, FILE_SIZE_LIMIT, FILE_STORAGE_BACKEND_PATH,
  GLOBAL_S3_BUCKET, PGRST_JWT_SECRET, PORT, POSTGREST_URL, REGION,
  REQUEST_ALLOW_X_FORWARDED_PATH, SERVER_HOST, SERVER_PORT, SERVICE_KEY,
  STORAGE_BACKEND, STORAGE_DB_PASSWORD, STORAGE_PUBLIC_URL, TENANT_ID
- **sb-gateway:** PORT

As URLs de banco são montadas por referência (`…@${{DB_HOST}}/${{DB_NAME}}`).
**Para o corte, trocar `DB_NAME` de `formacao_ensaio` para `formacao` nos três
serviços** e redeployá-los; nada mais muda.

## Neon

- Bancos criados: `formacao` (alvo, com extensions/auth/storage prontos e vazios)
  e `formacao_ensaio`.
- Papéis de cluster: `anon`, `authenticated`, `service_role` (BYPASSRLS),
  `authenticator` (login, membro dos três), `supabase_auth_admin`,
  `supabase_storage_admin` (login; o de storage também assume os três papéis),
  e `postgres` (NOLOGIN, só para as migrações do GoTrue e do storage, que dão
  grants a ele). Nenhum nome foi recusado pelo Neon.
- `neondb_owner` virou membro de `supabase_auth_admin` e `supabase_storage_admin`
  (para criar FKs e o trigger em `auth.users`) e tem `search_path = "$user",
  public, extensions` **só dentro de `formacao` e `formacao_ensaio`**, como o
  papel `postgres` da Supabase. Sem isso `uuid_generate_v4()` não resolve.
- statement_timeout igual ao padrão Supabase: anon 3 s, authenticated e
  authenticator 8 s.
- No ensaio há o event trigger `pgrst_watch`, que avisa o PostgREST para recarregar
  o schema a cada DDL. Criar também no `formacao` depois do restore.

## O que passou no ensaio

- GoTrue aplicou as próprias migrações; storage-api idem.
- As 101 migrações do repo aplicaram no `formacao_ensaio` (70 tabelas em public).
- Teste de fumaça com o supabase-js do app contra o gateway, todo verde: signUp,
  signInWithPassword, claim `user_role`/`user_cargos` do hook no JWT, getUser,
  trigger `on_auth_user_created` cria o profile, RLS (usuário vê o próprio,
  anon não vê nada, service role vê tudo), `auth.admin.listUsers`,
  `generateLink` com link em `/auth/v1/verify`, refreshSession, upload no storage
  + URL pública devolvendo o arquivo, CORS de `https://allos.org.br` em rest,
  auth e storage. Usuário, bucket e arquivo de teste apagados no fim.
- Corte de 1000 linhas do PostgREST confirmado (206, `0-999/1500`).

## O que falhou e foi consertado no ensaio

1. GoTrue e storage caíam com `role "postgres" does not exist` → criado o papel
   `postgres` NOLOGIN.
2. `uuid_generate_v4()` inexistente na 000 → search_path com `extensions`.
3. `011_formacao_admin_tables.sql` não é idempotente depois da 000 (policy
   `select_condutores` já existe) → rodada de uma cópia com `DROP POLICY IF EXISTS`
   (o arquivo do repo não foi tocado).
4. **As migrações do repo NÃO reproduzem o banco vivo**: a 026 cria a policy
   `select_profile_self_or_admin` com EXISTS em `profiles` dentro de `profiles`
   (recursão infinita), e nenhuma migração a apaga; a 027 conta que ela "quebrou o
   site" e foi removida à mão. Apagada no ensaio. O schema real tem de vir do
   pg_dump, não das migrações.
5. storage-api sem permissão de `SET ROLE service_role` → grant dos três papéis
   ao `supabase_storage_admin`.
6. Link de e-mail saía em `/verify` sem o prefixo → `GOTRUE_MAILER_URLPATHS_* =
   /auth/v1/verify`.
7. GoTrue e storage não respondem preflight com `apikey` → CORS feito no Caddy,
   como o plugin cors do Kong faz na Supabase hospedada.

## Pendências para o corte

1. **Dados.** pg_dump 18 portátil pronto em `C:\Users\gabri\tools\pgsql18`
   (pg_dump, pg_restore, psql, pg_dumpall). Falta a Supabase voltar e uma forma de
   conectar (senha do banco ou token de gestão `sbp_`). Sugestão: dump de `public`
   e `auth` com dados; criar antes papéis-fantasma NOLOGIN (`supabase_admin`,
   `dashboard_user`, `authenticator` já existe…) para os GRANTs não caírem, restaurar
   com `--no-owner` e devolver a posse de tudo em `auth` ao `supabase_auth_admin`.
   Manter os privilégios do dump (não usar `--no-privileges`), porque há REVOKEs
   deliberados (ex.: 051).
2. **JWT.** Hoje o segredo é novo, então todas as sessões atuais cairiam e as chaves
   anon/service do app e do allos-site mudariam. Se conseguirmos o JWT secret legado
   do projeto Supabase, basta gravá-lo em `SB_JWT_SECRET` e reusar as chaves antigas:
   ninguém é deslogado e só a URL muda.
3. **Storage.** Não restaurar o schema `storage` do dump; baixar cada objeto dos
   buckets da Supabase e reenviar pelo gateway com o mesmo bucket e caminho, depois
   trocar o host nas colunas de URL (`…supabase.co/storage/v1` → gateway).
4. **Google OAuth.** Copiar client id/secret do painel da Supabase para
   `GOTRUE_EXTERNAL_GOOGLE_{ENABLED,CLIENT_ID,SECRET,REDIRECT_URI}` e cadastrar
   `https://sb-gateway-production-1dca.up.railway.app/auth/v1/callback` no Google
   Cloud Console. Sem isso só e-mail e senha funcionam.
5. **E-mail.** `GOTRUE_MAILER_AUTOCONFIRM=true` e sem SMTP (cliente noop): recuperação
   de senha não envia e-mail. Copiar a configuração de confirmação e o SMTP da
   Supabase (Auth → Settings) antes do corte.
6. **Região** do Allos-formacao (ver acima).
7. **Nome do cookie de sessão**: o supabase-js deriva do primeiro rótulo do host
   (`sb-sb-gateway-production-1dca-auth-token`); rotas que filtram `sb-<ref>-auth-token`
   precisam aceitar o nome novo.
8. Conferir no banco vivo os `statement_timeout` por papel e as policies de
   `storage.objects`, e criar o `pgrst_watch` no `formacao`.
9. PostgREST 14 e GoTrue 2.196 podem ser mais novos que os da Supabase hospedada;
   testar os fluxos do app contra o ensaio antes do corte.
10. `GOTRUE_JWT_DEFAULT_GROUP_NAME` gera aviso de depreciação no log; inofensivo.

## Scripts (em `scripts/`, sem segredos)

`lib.js` (Railway GraphQL + Neon), `01_services.js`, `02_neon.js` (⚠️ rodar de novo
ROTACIONA as senhas dos papéis e regrava nas variáveis), `03_config.js`,
`psqlrun.js` (aplica uma pasta de .sql com o psql 18), `reset_public.js` (só aceita
`formacao_ensaio`), `smoke.js` (teste de fumaça), `st.js`, `logs.js <serviço>`,
`redeploy.js` (só aceita `sb-*`). Precisam do pacote `pg`: rodar de uma pasta com
`npm i pg` ou da cópia com `node_modules` no scratchpad da sessão.
Resultados: `migr_formacao_ensaio.json`, `smoke_result.json`.

O zip de binários baixado (343 MB) ficou em `%TEMP%\pg18.zip` e pode ser apagado.
