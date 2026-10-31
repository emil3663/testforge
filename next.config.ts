import type { NextConfig } from "next";
import { currentVersion } from "./src/lib/version";

// 'unsafe-eval' is required by Next.js dev-mode/HMR (Turbopack/webpack eval'd
// module wrappers), not by the app itself in production - see TFP-069.
const scriptSrc = process.env.NODE_ENV === "production"
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "connect-src 'self' http: https: ws: wss:",
    ].join("; "),
  },
];

// TFP-257: a build carries what it was built from, for src/lib/version.ts. `next build` runs in production, and `env`
// is only inlined at build; dev reads it live.
const built = currentVersion();

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "production"
    ? { env: { TESTFORGE_BUILD_VERSION: built.version, TESTFORGE_BUILD_COMMIT: built.commit ?? "" } }
    : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
