import type { NextConfig } from 'next';

const configuredApiProxyUrl = process.env.API_PROXY_URL ?? 'http://localhost:4000';
const apiProxyUrl = (configuredApiProxyUrl.includes('://')
  ? configuredApiProxyUrl
  : `http://${configuredApiProxyUrl}`
).replace(/\/$/, '');

const nextConfig: NextConfig = {
  transpilePackages: ['@pointage360/ui', '@pointage360/types'],
  async rewrites() {
    if (process.env.NODE_ENV !== 'development' && !process.env.API_PROXY_URL) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
