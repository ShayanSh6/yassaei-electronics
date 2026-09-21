import type { NextConfig } from "next";

// Backend URL: local dev = 127.0.0.1:4000; in Docker compose set BACKEND_URL=http://backend:4000
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
