// Nome fixo do cookie de sessão, e da chave que o cliente do browser guarda no
// localStorage.
//
// Sem isto o @supabase/ssr deriva o nome do host do backend:
// sb-<primeiro rótulo do host>-auth-token. Enquanto o backend era
// syiaushvzhgyhvsmoegt.supabase.co o nome era estável. Desde a saída da
// Supabase (09/2026) o login e a API rodam em serviços próprios na Railway, com
// o banco no Neon, e deixar o nome seguir o host faria cada troca de endereço
// deslogar todo mundo, além de quebrar o sync-cookies, que só reconhecia host
// sem hífen.
export const AUTH_COOKIE_NAME = "sb-formacao-auth-token";

/** Cookie de sessão deste site (inclui os pedaços .0, .1 e o code-verifier). */
export function ehCookieDeSessao(nome: string): boolean {
  return nome.startsWith(AUTH_COOKIE_NAME);
}

/**
 * Cookie de sessão de um backend antigo (sb-<ref>-auth-token de quando a
 * Formação morava na Supabase). O SDK ignora, mas quem junta pedaços de
 * sessão à mão precisa descartar, senão cola o token velho no novo.
 */
export function ehCookieDeSessaoLegado(nome: string): boolean {
  return /^sb-.+-auth-token/.test(nome) && !ehCookieDeSessao(nome);
}
