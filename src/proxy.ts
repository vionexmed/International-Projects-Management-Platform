import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy with a per-request nonce.
 *
 * Next streams the RSC payload through inline `<script>` tags, so a policy of
 * plain `script-src 'self'` would block hydration and leave a dead page. The
 * nonce is set on the *request* headers as well as the response: Next reads it
 * from there and stamps it onto the scripts it generates.
 *
 * A nonce forces dynamic rendering, which costs nothing here — every route in
 * this app is already server-rendered per request.
 *
 * Scripts are locked down with a nonce plus `strict-dynamic`. Styles keep
 * `'unsafe-inline'` deliberately: `next/font` emits an inline `<style>` block
 * and the UI uses React `style` attributes (progress bars, the root error
 * page). Inline CSS cannot execute JavaScript, so this is the far cheaper half
 * of the trade — the script directive is where XSS actually lives.
 *
 * Note this file is `proxy.ts`, not `middleware.ts`: Next 16 renamed the
 * convention. It only sets headers — authentication and authorization are
 * enforced in layouts, services and server actions, never here.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // React uses eval in development to rebuild server stacks in the browser.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Documents and images are served by our own authenticated /api/files route.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    {
      // Static assets and API routes need no nonce; prefetches would otherwise
      // cache a nonce that no longer matches the document that uses it.
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
