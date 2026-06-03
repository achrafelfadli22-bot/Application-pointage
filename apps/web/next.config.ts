import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@pointage360/ui', '@pointage360/types'],
};

export default nextConfig;
