import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Demo mode turns off authentication: anyone with the URL becomes any user.
 * That is the point, and exactly why "off unless explicitly asked for" is an
 * invariant worth a test rather than a habit.
 */
const original = { ...process.env };

/** A configuration a real production deployment would actually have. */
const PRODUCTION = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app",
  AUTH_SECRET: "a-genuinely-random-secret-of-enough-length",
  APP_URL: "https://projetos.vionex.com",
  STORAGE_DRIVER: "s3",
  STORAGE_ACCESS_KEY: "key",
  STORAGE_SECRET_KEY: "secret",
  STORAGE_BUCKET: "documents",
};

async function loadDemo(overrides: Record<string, string>) {
  vi.resetModules();
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original, overrides);
  return import("@/lib/demo");
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
});

describe("demo mode", () => {
  it("is closed in production by default", async () => {
    const { isDemoEnabled, isPublicDemo } = await loadDemo({
      ...PRODUCTION,
      DEMO_MODE: "",
    });

    expect(isDemoEnabled()).toBe(false);
    expect(isPublicDemo()).toBe(false);
  });

  it("stays closed for values that merely look truthy", async () => {
    for (const value of ["0", "false", "no", "yes", "on", "TRUE "]) {
      const { isDemoEnabled } = await loadDemo({ ...PRODUCTION, DEMO_MODE: value });
      expect(isDemoEnabled(), `DEMO_MODE=${JSON.stringify(value)}`).toBe(false);
    }
  });

  it("opens only for an explicit opt-in", async () => {
    for (const value of ["1", "true"]) {
      const { isDemoEnabled, isPublicDemo } = await loadDemo({
        ...PRODUCTION,
        DEMO_MODE: value,
      });
      expect(isDemoEnabled()).toBe(true);
      // A production deployment with it on must announce itself.
      expect(isPublicDemo()).toBe(true);
    }
  });

  it("is available in development without any flag", async () => {
    const { isDemoEnabled, isPublicDemo } = await loadDemo({
      NODE_ENV: "development",
      DEMO_MODE: "",
      APP_URL: "http://localhost:3000",
      STORAGE_DRIVER: "local",
    });

    expect(isDemoEnabled()).toBe(true);
    // Local development needs no banner.
    expect(isPublicDemo()).toBe(false);
  });
});
