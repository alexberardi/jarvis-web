import type { NextConfig } from "next";

const CC_URL = process.env.COMMAND_CENTER_URL ?? "http://localhost:7703";
const AUTH_URL = process.env.AUTH_URL ?? "http://localhost:7701";
const NOTIFICATIONS_URL = process.env.NOTIFICATIONS_URL ?? "http://localhost:7712";
const PANTRY_URL = process.env.PANTRY_URL ?? "http://localhost:7721";

const nextConfig: NextConfig = {
  output: "standalone",
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
        source: "/api/invites/:path*",
        destination: `${AUTH_URL}/invites/:path*`,
      },
      {
        source: "/api/inbox/:path*",
        destination: `${NOTIFICATIONS_URL}/api/v0/inbox/:path*`,
      },
      {
        source: "/api/pantry/:path*",
        destination: `${PANTRY_URL}/v1/:path*`,
      },
      {
        source: "/api/cc/:path*",
        destination: `${CC_URL}/api/v0/:path*`,
      },
    ];
  },
};

export default nextConfig;
