import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * This build deliberately ships with open access: `/demo` lets anyone sign in
 * as any seeded user so the deployment can be evaluated without credentials.
 *
 * These tests pin that decision rather than assume it, and — more usefully —
 * pin the labelling that goes with it. The day the platform holds real
 * supplier data, `isDemoEnabled` must stop returning true outside development,
 * and the first of these tests is what will fail and say so.
 */
const original = { ...process.env };

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

const DEVELOPMENT = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://vionex:pass@localhost:5433/app",
  AUTH_SECRET: "a-genuinely-random-secret-of-enough-length",
  APP_URL: "http://localhost:3000",
  STORAGE_DRIVER: "local",
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
  it("keeps the account chooser open, including in production", async () => {
    const { isDemoEnabled } = await loadDemo(PRODUCTION);
    expect(isDemoEnabled()).toBe(true);
  });

  it("is open in development too", async () => {
    const { isDemoEnabled } = await loadDemo(DEVELOPMENT);
    expect(isDemoEnabled()).toBe(true);
  });

  it("labels a deployed environment on screen", async () => {
    // A reachable URL that asks for no password has to announce itself.
    const { isPublicDemo } = await loadDemo(PRODUCTION);
    expect(isPublicDemo()).toBe(true);
  });

  it("does not clutter local development with the banner", async () => {
    const { isPublicDemo } = await loadDemo(DEVELOPMENT);
    expect(isPublicDemo()).toBe(false);
  });

  it("needs no environment variable to decide", async () => {
    // The behaviour is a property of the build, not of configuration: a
    // deployment cannot end up half-open because a variable was mistyped.
    const withNoise = await loadDemo({ ...PRODUCTION, DEMO_MODE: "0" });
    expect(withNoise.isDemoEnabled()).toBe(true);
  });
});
