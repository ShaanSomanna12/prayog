import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the tracing root to this sub-directory so Next.js doesn't walk up
  // into the monorepo parent and get confused by the backend's package-lock.json
  outputFileTracingRoot: __dirname,
  // Allow images from the Watch Guard backend origin
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
      },
    ],
  },
  // Proxy API & WebSocket calls to the backend so CORS is never an issue in dev
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;

