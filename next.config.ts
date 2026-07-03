import type { NextConfig } from "next";

const CC_URL = process.env.COMMAND_CENTER_URL ?? "http://localhost:7703";
const AUTH_URL = process.env.AUTH_URL ?? "http://localhost:7701";
const NOTIFICATIONS_URL = process.env.NOTIFICATIONS_URL ?? "http://localhost:7712";
const PANTRY_URL = process.env.PANTRY_URL ?? "http://localhost:7721";

const nextConfig: NextConfig = {
  output: "standalone",
  // Anti-clickjacking + hardening headers. Scoped to the set that's safe for a
  // Next.js app (no script/style-src restriction → inline hydration unaffected);
  // a full script-src CSP would need nonce middleware and is deferred.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
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
