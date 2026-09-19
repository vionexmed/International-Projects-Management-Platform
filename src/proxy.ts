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
/**
 * The storage endpoint's origin, when uploads go straight from the browser.
 *
 * Large files bypass the server entirely — the browser PUTs directly to
 * object storage with a short-lived signed URL, because Vercel rejects any
 * request to a function above ~4.5 MB before our code ever runs. `connect-src
 * 'self'` blocked exactly that connection: the browser refuses it at the CSP
 * layer before CORS is even negotiated, which is why it never showed up as a
 * CORS error and looked like a bare network failure instead.
 *
 * Derived from the same `STORAGE_ENDPOINT` the server signs against, so this
 * never drifts from the actual provider and needs no change to switch one.
 * Downloads are unaffected — those still go through `/api/files/[versionId]`,
 * same-origin, with the session revalidated on every request.
 */
export function storageConnectSrc(): string {
  const endpoint = process.env.STORAGE_ENDPOINT;
  if (!endpoint) return "";
  try {
    return new URL(endpoint).origin;
  } catch {
    return "";
  }
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  const storageOrigin = storageConnectSrc();

  const csp = [
    "default-src 'self'",
    // React uses eval in development to rebuild server stacks in the browser.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Documents and images are served by our own authenticated /api/files route.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${storageOrigin ? ` ${storageOrigin}` : ""}`,
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
