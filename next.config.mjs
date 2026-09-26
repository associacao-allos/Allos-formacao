// Host do backend (login, API e arquivos). Desde a saída da Supabase ele é um
// serviço próprio na Railway, e as capas de curso enviadas depois disso moram
// lá; o next/image recusa host que não esteja em remotePatterns.
const backendHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname || null;
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⛔ Só em produção. Com o prefixo ligado, `next dev` serve HTML que busca CSS
  // e JS no domínio da Railway, onde os hashes de chunk são outros: tudo 404, a
  // página aparece sem estilo nenhum e não hidrata, e nada disso vira erro no
  // console. O sintoma parece bug da tela e é do ambiente, e custou uma
  // verificação inteira em 06/08/2026. `next build` define NODE_ENV=production
  // sozinho, então o deploy continua exatamente igual.
  assetPrefix:
    process.env.NODE_ENV === 'production'
      ? 'https://allos-formacao-production.up.railway.app'
      : undefined,
  // Proxy /_sb pra Supabase REST foi removido — expõe a API toda do
  // Supabase pra qualquer caller externo. Cliente vai direto pro
  // domínio Supabase (NEXT_PUBLIC_SUPABASE_URL).
  async rewrites() {
    return [];
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      // Authenticated HTML routes — never cache.
      // (Public APIs like /formacao/api/home-data need to be cacheable by the
      // CDN, so they're left out of this list and the middleware skips them
      // too.)
      {
        source: '/formacao/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      // Página de login é client component static — sem esses headers o Next
      // emite s-maxage=31536000 e o navegador serve HTML com chunks JS antigos
      // após deploys, deixando o usuário com login que parece travar.
      {
        source: '/formacao/auth',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/formacao/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/formacao/curso/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/formacao/meus-cursos/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/formacao/meu-perfil/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
  images: {
    path: 'https://allos-formacao-production.up.railway.app/_next/image',
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      ...(backendHost && !backendHost.endsWith('.supabase.co')
        ? [{ protocol: "https", hostname: backendHost }]
        : []),
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default nextConfig;
