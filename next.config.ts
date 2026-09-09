import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Static security headers.
 *
 * The Content-Security-Policy is deliberately NOT here — it needs a
 * per-request nonce for Next's inline RSC scripts, so it is set in
 * `src/proxy.ts`. Sending it from both places would make the browser enforce
 * the intersection of two policies and break hydration.
 */
const securityHeaders = [
  // Defence in depth alongside the CSP's frame-ancestors, for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Cross-origin isolation: nothing here is meant to be embedded elsewhere.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Do not advertise the framework or its version.
  poweredByHeader: false,

  // Trailing-slash-free URLs keep the canonical form stable.
  trailingSlash: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          // HSTS only makes sense once the app is served over TLS.
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
      {
        // Every page is user-specific; none of it may sit in a shared cache.
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
