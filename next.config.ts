import type { NextConfig } from "next";

const CC_URL = process.env.COMMAND_CENTER_URL ?? "http://localhost:7703";
const AUTH_URL = process.env.AUTH_URL ?? "http://localhost:7701";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${AUTH_URL}/auth/:path*`,
      },
      {
        source: "/api/households/:path*",
        destination: `${AUTH_URL}/households/:path*`,
      },
      {
        source: "/api/cc/:path*",
        destination: `${CC_URL}/api/v0/:path*`,
      },
    ];
  },
};

export default nextConfig;
