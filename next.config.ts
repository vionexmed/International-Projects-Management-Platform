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

/**
 * O teto de upload do produto, lido da mesma variável que a validação usa.
 *
 * As server actions do Next aceitam 1 MB por padrão, e o formulário de upload
 * é uma server action. Enquanto isso ficou implícito, o produto anunciava 25
 * MB, validava 25 MB e o framework recusava qualquer arquivo acima de 1 MB
 * antes de o nosso código ver o arquivo — então o erro chegava ao usuário como
 * "algo deu errado", sem dizer o que estava errado.
 *
 * Uma folga é somada ao teto porque o corpo carrega também os campos do
 * formulário e a codificação multipart, que somam alguns bytes sobre o arquivo.
 */
const uploadLimitMb = Number(process.env.UPLOAD_MAX_SIZE_MB ?? 25);
const actionBodyLimit = `${Math.max(2, Math.ceil(uploadLimitMb * 1.1))}mb` as const satisfies `${number}mb`;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: actionBodyLimit,
    },
  },

  /**
   * PGlite ships a WebAssembly build of Postgres. Bundling it breaks the
   * module's own WASM instantiation, so it is loaded from node_modules at
   * runtime instead. It is only reached when no DATABASE_URL is configured.
   */
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-socket"],

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
