/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: 'https://allos-formacao-production.up.railway.app',
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
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
