import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { storageConnectSrc } from "@/proxy";

/**
 * The bug this pins: `connect-src 'self'` silently blocked every direct
 * upload to object storage. The browser refuses the connection at the CSP
 * layer before CORS is even negotiated, so the failure never carried a status
 * code — it surfaced as a bare XHR `error` event, indistinguishable from a
 * dropped connection. `curl` and Node's `fetch` don't enforce CSP at all, so
 * every server-side check looked fine while the browser silently discarded
 * the request. Confirmed against a real Chromium instance driven over CDP,
 * not just asserted here.
 */
const ORIGINAL_ENDPOINT = process.env.STORAGE_ENDPOINT;

beforeEach(() => {
  delete process.env.STORAGE_ENDPOINT;
});

afterEach(() => {
  if (ORIGINAL_ENDPOINT === undefined) delete process.env.STORAGE_ENDPOINT;
  else process.env.STORAGE_ENDPOINT = ORIGINAL_ENDPOINT;
});

describe("the CSP allows the browser to reach configured object storage", () => {
  it("derives the origin from STORAGE_ENDPOINT, dropping the path", () => {
    process.env.STORAGE_ENDPOINT =
      "https://nxearovwvfotbernsrji.storage.supabase.co/storage/v1/s3";
    expect(storageConnectSrc()).toBe("https://nxearovwvfotbernsrji.storage.supabase.co");
  });

  it("stays same-origin-only when no storage endpoint is configured", () => {
    // The local driver: nothing the browser needs to reach directly.
    expect(storageConnectSrc()).toBe("");
  });

  it("does not throw on a malformed endpoint", () => {
    process.env.STORAGE_ENDPOINT = "not a url";
    expect(storageConnectSrc()).toBe("");
  });

  it("works for any S3-compatible provider, not just Supabase", () => {
    process.env.STORAGE_ENDPOINT = "https://s3.us-east-1.amazonaws.com";
    expect(storageConnectSrc()).toBe("https://s3.us-east-1.amazonaws.com");
  });
});
