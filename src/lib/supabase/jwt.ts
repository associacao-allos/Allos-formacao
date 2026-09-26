// Conferência local do JWT de sessão, sem ida ao servidor de login.
//
// Na Supabase o token era assinado com chave assimétrica (ES256) e o
// getClaims() conferia pela chave pública em cache. O GoTrue próprio (desde a
// saída da Supabase, 09/2026) assina com segredo compartilhado HS256, e nesse
// caso o getClaims() cai para getUser(), que é uma ida ao /auth/v1/user a cada
// request do middleware. Com o segredo em SUPABASE_JWT_SECRET a conferência
// volta a ser local. Roda no edge: só Web Crypto, nada de node:crypto.

function base64urlParaBytes(trecho: string): Uint8Array<ArrayBuffer> {
  const b64 = trecho.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
}

const chaves = new Map<string, Promise<CryptoKey>>();

function chaveHmac(segredo: string): Promise<CryptoKey> {
  let chave = chaves.get(segredo);
  if (!chave) {
    chave = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(segredo),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    chaves.set(segredo, chave);
  }
  return chave;
}

/**
 * Devolve as claims se a assinatura HS256 confere e o token não expirou;
 * null em qualquer outro caso (assinatura errada, outro algoritmo, expirado,
 * token malformado).
 */
export async function claimsVerificadas(
  token: string,
  segredo: string
): Promise<Record<string, unknown> | null> {
  try {
    const [cabecalho, corpo, assinatura] = token.split(".");
    if (!cabecalho || !corpo || !assinatura) return null;

    const header = JSON.parse(new TextDecoder().decode(base64urlParaBytes(cabecalho)));
    if (header.alg !== "HS256") return null;

    const valida = await crypto.subtle.verify(
      "HMAC",
      await chaveHmac(segredo),
      base64urlParaBytes(assinatura),
      new TextEncoder().encode(`${cabecalho}.${corpo}`)
    );
    if (!valida) return null;

    const claims = JSON.parse(new TextDecoder().decode(base64urlParaBytes(corpo)));
    if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
